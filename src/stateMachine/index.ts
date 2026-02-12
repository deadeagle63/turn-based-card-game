import {assign, createActor, fromCallback, setup} from "xstate";
import {
    assignPlayerColors,
    buildBestChain,
    canPlayCard,
    createDeck,
    dealCards,
    getPlayableCards,
    orderChain,
    shuffle,
} from "../helpers/game.helper.ts";
import {type Card, CARDS_PER_PLAYER, DEFAULT_ROUND_TIME, HUMAN_ID, TICK_MS} from "../helpers/game.constants.ts";
import {
    applyDrawCard,
    applyPlayCards,
    currentPlayableCards,
    currentPlayer,
    currentPlayerIsCpu,
    currentPlayerIsHuman,
    findEmptyHandWinner,
    findLowestHandPlayer,
    isDrawPileEmptyWithWinner,
    loadPersistedSnapshot,
    persistSnapshot,
    selectedCards,
    shouldPersistSnapshot,
    snapshotLooksLikePlaying,
    topDiscard
} from "./stateMachine.helper.ts";
import {GAME_ACTOR_GLOBAL_KEY, GAME_SNAPSHOT_GLOBAL_KEY, PERSIST_THROTTLE_MS} from "./stateMachine.constants.ts";

export type { Card };

export type PlayerId = string;

export type PlayerController = "human" | "cpu";

export type Player = {
    id: PlayerId;
    hand: Card[];
    controller: PlayerController;
};

export type GameContext = {
    // time
    currentTime: number;
    roundTime: number;

    // players
    players: Player[];
    currentPlayerIndex: number;
    humanPlayerId: PlayerId;

    // cards
    drawPile: Card[];
    discardPile: Card[];

    // ui state (kept in the machine so PlayGame can be stateless)
    selectedCardIds: string[];
    playerColors: Record<PlayerId, string>;
    playPageMounted: boolean;

    // result
    winnerId: PlayerId | null;
};

export type GameEvent =
    | {
          type: "GAME_CONFIG";
          cpuCount: number;
          roundTime: number;
          humanPlayerId?: PlayerId;
      }
    | { type: "RESET_GAME" }
    | { type: "start" }
    | { type: "tick"; delta: number }
    | { type: "pause" }
    | { type: "resume" }
    | { type: "pageMounted" }
    | { type: "pageUnmounted" }
    | { type: "toggleSelectCard"; cardId: string }
    | { type: "playSelectedCards" }
    | { type: "requestDrawCard" }
    | { type: "playCards"; cardIds: string[] } // internal
    | { type: "drawCard" } // internal
    | { type: "retry" }
    | { type: "quit" }
    | { type: "setRoundTime"; roundTime: number }
    | { type: "addPlayer"; playerId: PlayerId; controller?: PlayerController }
    | { type: "removePlayer"; playerId: PlayerId };

export const gameMachine = setup({
    types: {
        context: {} as GameContext,
        events: {} as GameEvent,
    },
    actors: {
        ticker: fromCallback(({ sendBack, input }) => {
            const delta =
                typeof (input as { delta?: number } | undefined)?.delta ===
                "number"
                    ? (input as { delta: number }).delta
                    : TICK_MS;
            const id = setInterval(() => {
                sendBack({ type: "tick", delta });
            }, delta);
            return () => clearInterval(id);
        }),
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
        isHumanTurn: ({ context }) => currentPlayerIsHuman(context),
        canPlaySelected: ({ context }) => {
            if (!currentPlayerIsHuman(context)) return false;
            if (context.selectedCardIds.length === 0) return false;
            return orderChain(selectedCards(context), topDiscard(context)) !== null;
        },
        canHumanDraw: ({ context }) => {
            if (!currentPlayerIsHuman(context)) return false;
            return currentPlayableCards(context).length === 0;
        },
        humanShouldAutoPlaySingle: ({ context }) => {
            if (!currentPlayerIsHuman(context)) return false;
            if (context.selectedCardIds.length !== 0) return false;
            return currentPlayableCards(context).length === 1;
        },
        humanShouldAutoDraw: ({ context }) => {
            if (!currentPlayerIsHuman(context)) return false;
            if (context.selectedCardIds.length !== 0) return false;
            return currentPlayableCards(context).length === 0;
        },
        cpuShouldAct: ({ context }) => currentPlayerIsCpu(context),
    },
    actions: {
        initFromConfig: assign(({ event }) => {
            const e = event as Extract<GameEvent, { type: "GAME_CONFIG" }>;
            const humanPlayerId = e.humanPlayerId ?? HUMAN_ID;
            const players: Player[] = [
                { id: humanPlayerId, hand: [], controller: "human" },
                ...Array.from({ length: e.cpuCount }, (_, i) => ({
                    id: `CPU ${i + 1}`,
                    hand: [],
                    controller: "cpu" as const,
                })),
            ];
            return {
                roundTime: e.roundTime,
                currentTime: 0,
                currentPlayerIndex: 0,
                humanPlayerId,
                players,
                drawPile: [],
                discardPile: [],
                winnerId: null,
                selectedCardIds: [],
                playerColors: assignPlayerColors(players.map((p) => p.id)),
            };
        }),
        markPlayPageMounted: assign(() => ({ playPageMounted: true })),
        markPlayPageUnmounted: assign(() => ({
            playPageMounted: false,
            selectedCardIds: [],
        })),
        resetGame: assign(() => ({
            currentTime: 0,
            roundTime: DEFAULT_ROUND_TIME,
            players: [],
            currentPlayerIndex: 0,
            humanPlayerId: HUMAN_ID,
            drawPile: [],
            discardPile: [],
            selectedCardIds: [],
            playerColors: {},
            playPageMounted: false,
            winnerId: null,
        })),
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
                selectedCardIds: [],
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
            return applyPlayCards(context, e.cardIds);
        }),
        drawCard: assign(({ context }) => {
            return applyDrawCard(context);
        }),
        toggleSelectedCard: assign(({ context, event }) => {
            const e = event as { type: "toggleSelectCard"; cardId: string };
            if (!currentPlayerIsHuman(context)) return {};
            const player = currentPlayer(context);
            const hand = player.hand;
            const cleanedSelection = context.selectedCardIds.filter((id) =>
                hand.some((c) => c.id === id),
            );

            const idx = cleanedSelection.indexOf(e.cardId);
            if (idx !== -1) {
                return { selectedCardIds: cleanedSelection.slice(0, idx) };
            }

            const candidate = hand.find((c) => c.id === e.cardId);
            if (!candidate) return { selectedCardIds: cleanedSelection };

            const chainEnd =
                cleanedSelection.length > 0
                    ? hand.find(
                          (c) =>
                              c.id ===
                              cleanedSelection[cleanedSelection.length - 1],
                      )
                    : topDiscard(context);

            if (!canPlayCard(candidate, chainEnd)) {
                return { selectedCardIds: cleanedSelection };
            }

            return { selectedCardIds: [...cleanedSelection, e.cardId] };
        }),
        playSelectedCards: assign(({ context }) => {
            if (!currentPlayerIsHuman(context)) return {};
            return applyPlayCards(context, context.selectedCardIds);
        }),
        cpuTakeTurn: assign(({ context }) => {
            if (!currentPlayerIsCpu(context)) return {};
            const player = currentPlayer(context);
            const top = topDiscard(context);
            const playable = getPlayableCards(player.hand, top);
            if (playable.length === 0) return applyDrawCard(context);

            const chain = buildBestChain(player.hand, top);
            const toPlay = chain.length > 0 ? chain : [playable[0]];
            return applyPlayCards(
                context,
                toPlay.map((c) => c.id),
            );
        }),
        humanAutoPlaySingle: assign(({ context }) => {
            if (!currentPlayerIsHuman(context)) return {};
            if (context.selectedCardIds.length !== 0) return {};
            const playable = currentPlayableCards(context);
            if (playable.length !== 1) return {};
            return applyPlayCards(context, [playable[0].id]);
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
        humanPlayerId: HUMAN_ID,
        drawPile: [],
        discardPile: [],
        selectedCardIds: [],
        playerColors: {},
        playPageMounted: false,
        winnerId: null,
    },
    initial: "lobby",
    on: {
        GAME_CONFIG: {
            target: ".playing",
            actions: ["initFromConfig", "dealGame"],
            reenter: true,
        },
        RESET_GAME: {
            target: ".lobby",
            actions: "resetGame",
            reenter: true,
        },
        pageMounted: { actions: "markPlayPageMounted" },
        pageUnmounted: { actions: "markPlayPageUnmounted" },
    },
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
                                {
                                    id: event.playerId,
                                    hand: [],
                                    controller: event.controller ?? "cpu",
                                },
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
                // Quitting the PlayGame page should be resumable; the UI will
                // navigate away and send `pageUnmounted` to stop ticking.
                quit: { actions: "markPlayPageUnmounted" },
            },
            states: {
                timer: {
                    initial: "awaitingMount",
                    states: {
                        awaitingMount: {
                            always: {
                                guard: ({ context }) => context.playPageMounted,
                                target: "running",
                            },
                            on: {
                                pageMounted: { target: "running" },
                            },
                        },
                        running: {
                            invoke: {
                                src: "ticker",
                                input: () => ({ delta: TICK_MS }),
                            },
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
                                pageUnmounted: { target: "awaitingMount" },
                            },
                        },
                        paused: {
                            on: {
                                resume: { target: "running" },
                                pageUnmounted: { target: "awaitingMount" },
                            },
                        },
                    },
                },
                turns: {
                    initial: "awaitingMount",
                    on: {
                        pause: { target: ".paused" },
                        resume: { target: ".active" },
                        pageUnmounted: { target: ".awaitingMount" },
                    },
                    states: {
                        awaitingMount: {
                            always: {
                                guard: ({ context }) => context.playPageMounted,
                                target: "active",
                            },
                            on: {
                                pageMounted: { target: "active" },
                            },
                        },
                        active: {
                            initial: "awaitingAction",
                            states: {
                                awaitingAction: {
                                    on: {
                                        toggleSelectCard: {
                                            guard: "isHumanTurn",
                                            actions: "toggleSelectedCard",
                                            reenter: true,
                                        },
                                        playSelectedCards: {
                                            guard: "canPlaySelected",
                                            actions: "playSelectedCards",
                                            target: "checkEnd",
                                        },
                                        requestDrawCard: {
                                            guard: "canHumanDraw",
                                            actions: "drawCard",
                                            target: "checkEnd",
                                        },
                                        // internal actions (CPU + forced human)
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
                                    after: {
                                        600: [
                                            {
                                                guard: "humanShouldAutoPlaySingle",
                                                actions: "humanAutoPlaySingle",
                                                target: "checkEnd",
                                            },
                                            {
                                                guard: "humanShouldAutoDraw",
                                                actions: "drawCard",
                                                target: "checkEnd",
                                            },
                                        ],
                                        800: {
                                            guard: "cpuShouldAct",
                                            actions: "cpuTakeTurn",
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
                        paused: {},
                    },
                },
            },
        },
        gameOver: {
            on: {
                retry: {
                    target: "#game.playing",
                    actions: ["markPlayPageMounted", "dealGame"],
                },
                quit: {
                    target: "lobby",
                    actions: assign({
                        currentTime: 0,
                        drawPile: [],
                        discardPile: [],
                        currentPlayerIndex: 0,
                        winnerId: null,
                        selectedCardIds: [],
                        playerColors: {},
                        players: [],
                    }),
                },
            },
        },
    },
});

export const createGameActor = () => createActor(gameMachine);

export const gameActor: ReturnType<typeof createGameActor> = (() => {
    const g = globalThis as unknown as Record<string, unknown>;
    const existing = g[GAME_ACTOR_GLOBAL_KEY] as
        | ReturnType<typeof createGameActor>
        | undefined;
    if (existing) return existing;

    const created = createActor(gameMachine, {
        snapshot: loadPersistedSnapshot(),
    }).start();
    g[GAME_ACTOR_GLOBAL_KEY] = created;

    if (!g[GAME_SNAPSHOT_GLOBAL_KEY]) {
        g[GAME_SNAPSHOT_GLOBAL_KEY] = true;
	        let timeout: ReturnType<typeof setTimeout> | null = null;
	        created.subscribe(() => {
	            const snapshot = created.getPersistedSnapshot();
	            const snapshotRecord = snapshot as unknown as Record<string, unknown>;
	            const context = snapshotRecord["context"];
	            const playPageMounted =
	                context &&
	                typeof context === "object" &&
	                !Array.isArray(context) &&
	                (context as Record<string, unknown>)["playPageMounted"];

	            // When leaving the PlayGame page, persist immediately so the menu
	            // can show "Continue" without waiting for the throttle.
	            if (snapshotLooksLikePlaying(snapshot) && playPageMounted === false) {
	                if (timeout) {
	                    clearTimeout(timeout);
	                    timeout = null;
	                }
	                persistSnapshot(snapshot);
	                return;
	            }

	            if (!shouldPersistSnapshot(snapshot)) {
	                if (timeout) {
	                    clearTimeout(timeout);
	                    timeout = null;
	                }
                persistSnapshot(snapshot);
                return;
            }

            if (timeout) return;
            timeout = setTimeout(() => {
                timeout = null;
                persistSnapshot(created.getPersistedSnapshot());
            }, PERSIST_THROTTLE_MS);
        });

        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", () => {
                persistSnapshot(created.getPersistedSnapshot());
            });
        }
    }

    return created;
})();
