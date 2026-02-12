import { assign, createActor, setup } from "xstate";
import {
    createDeck,
    dealCards,
    handValue,
    orderChain,
    shuffle,

} from "../helpers/game.helper.ts";
import {type Card, SUPPORTED_GAME_TIMES} from "../helpers/game.constants.ts";

// ── Types ────────────────────────────────────────────────────────────────────

export type { Card };

export type PlayerId = string;

export type Player = {
    id: PlayerId;
    hand: Card[];
};

export type GameContext = {
    // time
    currentTime: number;
    roundTime: number;

    // players
    players: Player[];
    currentPlayerIndex: number;

    // cards
    drawPile: Card[];
    discardPile: Card[];

    // result
    winnerId: PlayerId | null;
};

export type GameEvent =
    | { type: "start" }
    | { type: "tick"; delta: number }
    | { type: "pause" }
    | { type: "resume" }
    | { type: "playCards"; cardIds: string[] }
    | { type: "drawCard" }
    | { type: "retry" }
    | { type: "quit" }
    | { type: "setRoundTime"; roundTime: number }
    | { type: "addPlayer"; playerId: PlayerId }
    | { type: "removePlayer"; playerId: PlayerId };

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_ROUND_TIME = SUPPORTED_GAME_TIMES["1m"];
const CARDS_PER_PLAYER = 7;

// ── Helpers ──────────────────────────────────────────────────────────────────

function topDiscard(ctx: GameContext): Card | undefined {
    return ctx.discardPile[ctx.discardPile.length - 1];
}

function currentPlayer(ctx: GameContext): Player {
    return ctx.players[ctx.currentPlayerIndex];
}

/**
 * Check whether there are still cards available to draw
 * (either in the draw pile or by recycling the discard pile).
 */
function canDrawCards(ctx: GameContext): boolean {
    return (
        ctx.drawPile.length > 0 ||
        (ctx.drawPile.length === 0 && ctx.discardPile.length > 1)
    );
}

/**
 * Advance to the next player.
 * When the draw pile is exhausted (can't draw), skip players with empty hands.
 * When the draw pile has cards, everyone gets a turn (empty-hand players will draw).
 * Returns -1 if all players have empty hands and no cards remain.
 */
function advanceTurn(ctx: GameContext): number {
    const n = ctx.players.length;
    const drawAvailable = canDrawCards(ctx);
    for (let i = 1; i <= n; i++) {
        const idx = (ctx.currentPlayerIndex + i) % n;
        if (drawAvailable || ctx.players[idx].hand.length > 0) return idx;
    }
    return -1; // all hands empty and no cards to draw
}

/**
 * The game ends when the draw pile is empty (and can't be recycled)
 * AND at least one player has an empty hand.
 * That player wins by being first to shed all cards after the deck ran out.
 */
function isDrawPileEmptyWithWinner(ctx: GameContext): boolean {
    if (canDrawCards(ctx)) return false;
    return ctx.players.some((p) => p.hand.length === 0);
}

/**
 * Find the player with the empty hand (winner when draw pile exhausted).
 * Falls back to lowest hand value if multiple are empty.
 */
function findEmptyHandWinner(ctx: GameContext): PlayerId | null {
    const empty = ctx.players.find((p) => p.hand.length === 0);
    return empty ? empty.id : findLowestHandPlayer(ctx);
}

/**
 * When the timer expires, find the player with the lowest hand value.
 */
function findLowestHandPlayer(ctx: GameContext): PlayerId | null {
    if (ctx.players.length === 0) return null;
    let best = ctx.players[0];
    for (const p of ctx.players) {
        if (handValue(p.hand) < handValue(best.hand)) best = p;
    }
    return best.id;
}

// ── Machine ──────────────────────────────────────────────────────────────────

export const gameMachine = setup({
    types: {
        context: {} as GameContext,
        events: {} as GameEvent,
    },
    guards: {
        timerExpired: ({ context, event }) => {
            const e = event as { type: "tick"; delta: number };
            return context.currentTime + e.delta >= context.roundTime;
        },
        canPlayCards: ({ context, event }) => {
            const e = event as { type: "playCards"; cardIds: string[] };
            const player = currentPlayer(context);
            const top = topDiscard(context);
            const cards = player.hand.filter((c) => e.cardIds.includes(c.id));
            if (cards.length === 0) return false;
            // Cards must form a valid chain from the top discard
            return orderChain(cards, top) !== null;
        },
        gameStalled: ({ context }) => {
            return isDrawPileEmptyWithWinner(context);
        },
        hasMinPlayers: ({ context }) => {
            return context.players.length >= 2;
        },
    },
    actions: {
        dealGame: assign(({ context }) => {
            const deck = shuffle(createDeck());
            const players = context.players.map((p) => ({
                ...p,
                hand: dealCards(deck, CARDS_PER_PLAYER),
            }));
            // Flip one card to start discard
            const firstDiscard = dealCards(deck, 1);
            return {
                drawPile: deck,
                discardPile: firstDiscard,
                players,
                currentPlayerIndex: 0,
                currentTime: 0,
                winnerId: null,
            };
        }),
        tickTimer: assign(({ context, event }) => {
            const e = event as { type: "tick"; delta: number };
            return {
                currentTime: context.currentTime + e.delta,
            };
        }),
        playCards: assign(({ context, event }) => {
            const e = event as { type: "playCards"; cardIds: string[] };
            const player = currentPlayer(context);
            const top = topDiscard(context);
            const played = player.hand.filter((c) => e.cardIds.includes(c.id));
            const remaining = player.hand.filter(
                (c) => !e.cardIds.includes(c.id),
            );

            // Order the played cards as a valid chain so the last card
            // becomes the new top of the discard pile
            const ordered = orderChain(played, top) ?? played;

            const updatedPlayers = context.players.map((p) =>
                p.id === player.id ? { ...p, hand: remaining } : p,
            );

            const newDiscard = [...context.discardPile, ...ordered];

            // Advance to next player
            const nextCtx = { ...context, players: updatedPlayers, discardPile: newDiscard };
            const nextIdx = advanceTurn(nextCtx);

            return {
                players: updatedPlayers,
                discardPile: newDiscard,
                currentPlayerIndex: nextIdx === -1
                    ? context.currentPlayerIndex
                    : nextIdx,
                winnerId: null,
            };
        }),
        drawCard: assign(({ context }) => {
            const player = currentPlayer(context);
            let drawPile = [...context.drawPile];
            let discardPile = [...context.discardPile];

            // If draw pile is empty, recycle the discard pile (except the top card)
            if (drawPile.length === 0 && discardPile.length > 1) {
                const top = discardPile[discardPile.length - 1];
                const recycled = shuffle(discardPile.slice(0, -1));
                drawPile = recycled;
                discardPile = [top];
            }

            if (drawPile.length === 0) {
                // No cards available, advance to next player with cards
                const nextIdx = advanceTurn(context);
                return {
                    currentPlayerIndex: nextIdx === -1
                        ? context.currentPlayerIndex
                        : nextIdx,
                };
            }

            const drawn = drawPile.shift()!;
            const updatedPlayers = context.players.map((p) =>
                p.id === player.id
                    ? { ...p, hand: [...p.hand, drawn] }
                    : p,
            );

            const nextCtx = { ...context, players: updatedPlayers, drawPile, discardPile };
            const nextIdx = advanceTurn(nextCtx);

            return {
                drawPile,
                discardPile,
                players: updatedPlayers,
                currentPlayerIndex: nextIdx === -1
                    ? context.currentPlayerIndex
                    : nextIdx,
            };
        }),
        setTimerWinner: assign(({ context }) => ({
            winnerId: findLowestHandPlayer(context),
        })),
        setStalledWinner: assign(({ context }) => ({
            winnerId: findEmptyHandWinner(context),
        })),
    },
}).createMachine({
    id: "game",
    context: {
        currentTime: 0,
        roundTime: DEFAULT_ROUND_TIME,
        players: [],
        currentPlayerIndex: 0,
        drawPile: [],
        discardPile: [],
        winnerId: null,
    },
    initial: "lobby",
    states: {
        lobby: {
            on: {
                addPlayer: {
                    actions: assign({
                        players: ({ context, event }) => {
                            if (
                                context.players.some(
                                    (p) => p.id === event.playerId,
                                )
                            )
                                return context.players;
                            return [
                                ...context.players,
                                { id: event.playerId, hand: [] },
                            ];
                        },
                    }),
                },
                removePlayer: {
                    actions: assign({
                        players: ({ context, event }) =>
                            context.players.filter(
                                (p) => p.id !== event.playerId,
                            ),
                    }),
                },
                setRoundTime: {
                    actions: assign({
                        roundTime: ({ event }) => event.roundTime,
                    }),
                },
                start: {
                    guard: "hasMinPlayers",
                    target: "playing",
                    actions: "dealGame",
                },
            },
        },
        playing: {
            type: "parallel",
            on: {
                quit: { target: "gameOver" },
            },
            states: {
                timer: {
                    initial: "running",
                    states: {
                        running: {
                            on: {
                                tick: [
                                    {
                                        guard: "timerExpired",
                                        target: "#game.gameOver",
                                        actions: [
                                            "tickTimer",
                                            "setTimerWinner",
                                        ],
                                    },
                                    {
                                        actions: "tickTimer",
                                    },
                                ],
                                pause: { target: "paused" },
                            },
                        },
                        paused: {
                            on: {
                                resume: { target: "running" },
                            },
                        },
                    },
                },
                turns: {
                    initial: "awaitingAction",
                    states: {
                        awaitingAction: {
                            on: {
                                playCards: {
                                    guard: "canPlayCards",
                                    actions: "playCards",
                                    target: "checkEnd",
                                },
                                drawCard: {
                                    actions: "drawCard",
                                    target: "checkEnd",
                                },
                            },
                        },
                        checkEnd: {
                            always: [
                                {
                                    guard: "gameStalled",
                                    target: "#game.gameOver",
                                    actions: "setStalledWinner",
                                },
                                {
                                    target: "awaitingAction",
                                },
                            ],
                        },
                    },
                },
            },
        },
        gameOver: {
            on: {
                retry: {
                    target: "lobby",
                    actions: assign({
                        currentTime: 0,
                        drawPile: [],
                        discardPile: [],
                        currentPlayerIndex: 0,
                        winnerId: null,
                        players: ({ context }) =>
                            context.players.map((p) => ({
                                ...p,
                                hand: [],
                            })),
                    }),
                },
                quit: {
                    target: "lobby",
                    actions: assign({
                        currentTime: 0,
                        drawPile: [],
                        discardPile: [],
                        currentPlayerIndex: 0,
                        winnerId: null,
                        players: [],
                    }),
                },
            },
        },
    },
});

export const createGameActor = () => createActor(gameMachine);
