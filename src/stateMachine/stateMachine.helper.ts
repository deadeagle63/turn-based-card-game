import {getPlayableCards, handValue, orderChain, shuffle} from "../helpers/game.helper.ts";
import type {Snapshot} from "xstate";
import type {Card, GameContext, Player, PlayerId} from "./index.ts";
import {GAME_SNAPSHOT_STORAGE_KEY, type PersistedGameSnapshot} from "./stateMachine.constants.ts";

/**
 * Get the top card of the discard pile, or undefined if the pile is empty.
 * @param ctx
 */
export function topDiscard(ctx: GameContext): Card | undefined {
    return ctx.discardPile[ctx.discardPile.length - 1];
}

/**
 * Get the current player object based on the currentPlayerIndex in the context.
 * @param ctx
 */
export function currentPlayer(ctx: GameContext): Player {
    return ctx.players[ctx.currentPlayerIndex];
}

/**
 * Check if the current player is human-controlled (either by explicit controller type or by matching humanPlayerId).
 * @param ctx
 */
export function currentPlayerIsHuman(ctx: GameContext): boolean {
    const player = currentPlayer(ctx);
    return player.controller === "human" || player.id === ctx.humanPlayerId;
}

/**
 * Check if the current player is CPU-controlled (either by explicit controller type or by not matching humanPlayerId).
 * @param ctx
 */
export function currentPlayerIsCpu(ctx: GameContext): boolean {
    const player = currentPlayer(ctx);
    return player.controller === "cpu" && player.id !== ctx.humanPlayerId;
}

/**
 * Get the list of playable cards for the current player based on their hand and the top of the discard pile.
 * @param ctx
 */
export function currentPlayableCards(ctx: GameContext): Card[] {
    const player = currentPlayer(ctx);
    return getPlayableCards(player.hand, topDiscard(ctx));
}

/**
 * Get the list of currently selected cards for the current player based on the selectedCardIds in the context.
 * @param ctx
 */
export function selectedCards(ctx: GameContext): Card[] {
    const player = currentPlayer(ctx);
    return player.hand.filter((c) => ctx.selectedCardIds.includes(c.id));
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
export function isDrawPileEmptyWithWinner(ctx: GameContext): boolean {
    if (canDrawCards(ctx)) return false;
    return ctx.players.some((p) => p.hand.length === 0);
}

/**
 * Find the player with the empty hand (winner when draw pile exhausted).
 * Falls back to lowest hand value if multiple are empty.
 */
export function findEmptyHandWinner(ctx: GameContext): PlayerId | null {
    const empty = ctx.players.find((p) => p.hand.length === 0);
    return empty ? empty.id : findLowestHandPlayer(ctx);
}

/**
 * When the timer expires, find the player with the lowest hand value.
 */
export function findLowestHandPlayer(ctx: GameContext): PlayerId | null {
    if (ctx.players.length === 0) return null;
    let best = ctx.players[0];
    for (const p of ctx.players) {
        if (handValue(p.hand) < handValue(best.hand)) best = p;
    }
    return best.id;
}

/**
 * Apply the effect of playing the selected cards:
 * @param context
 * @param cardIds
 */
export function applyPlayCards(context: GameContext, cardIds: string[]): Partial<GameContext> {
    const player = currentPlayer(context);
    const top = topDiscard(context);
    const played = player.hand.filter((c) => cardIds.includes(c.id));
    const remaining = player.hand.filter((c) => !cardIds.includes(c.id));

    const ordered = orderChain(played, top) ?? played;

    const updatedPlayers = context.players.map((p) =>
        p.id === player.id ? {...p, hand: remaining} : p,
    );

    const newDiscard = [...context.discardPile, ...ordered];

    const nextCtx = {...context, players: updatedPlayers, discardPile: newDiscard};
    const nextIdx = advanceTurn(nextCtx);

    return {
        players: updatedPlayers,
        discardPile: newDiscard,
        currentPlayerIndex:
            nextIdx === -1 ? context.currentPlayerIndex : nextIdx,
        winnerId: null,
        selectedCardIds: [],
    };
}

/**
 * Apply the effect of the current player drawing a card (or advancing if no cards to draw).
 * @param context
 */
export function applyDrawCard(context: GameContext): Partial<GameContext> {
    const player = currentPlayer(context);
    let drawPile = [...context.drawPile];
    let discardPile = [...context.discardPile];

    if (drawPile.length === 0 && discardPile.length > 1) {
        const top = discardPile[discardPile.length - 1];
        drawPile = shuffle(discardPile.slice(0, -1));
        discardPile = [top];
    }

    if (drawPile.length === 0) {
        const nextIdx = advanceTurn(context);
        return {
            currentPlayerIndex:
                nextIdx === -1 ? context.currentPlayerIndex : nextIdx,
            selectedCardIds: [],
        };
    }

    const drawn = drawPile.shift()!;
    const updatedPlayers = context.players.map((p) =>
        p.id === player.id ? {...p, hand: [...p.hand, drawn]} : p,
    );

    const nextCtx = {...context, players: updatedPlayers, drawPile, discardPile};
    const nextIdx = advanceTurn(nextCtx);

    return {
        drawPile,
        discardPile,
        players: updatedPlayers,
        currentPlayerIndex:
            nextIdx === -1 ? context.currentPlayerIndex : nextIdx,
        selectedCardIds: [],
    };
}

/**
 * Heuristic check to see if a loaded snapshot looks like it's in the "playing" state,
 * @param snapshot
 */
export function snapshotLooksLikePlaying(snapshot: Snapshot<unknown>): boolean {
    const s = snapshot as unknown as Record<string, unknown>;
    const value = s["value"];
    if (value === "playing") return true;
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.prototype.hasOwnProperty.call(value, "playing");
}

/**
 * Load the persisted snapshot payload from localStorage, if it exists and is valid.
 */
function getPersistedPayload(): PersistedGameSnapshot | undefined {
    if (!canUseLocalStorage()) return undefined;
    try {
        const raw = window.localStorage.getItem(GAME_SNAPSHOT_STORAGE_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as Partial<PersistedGameSnapshot>;
        if (parsed.version !== 1 || !parsed.snapshot) return undefined;
        return parsed as PersistedGameSnapshot;
    } catch {
        return undefined;
    }
}

/**
 * Check if localStorage is available and can be used (e.g. not in privacy mode or SSR).
 */
function canUseLocalStorage(): boolean {
    try {
        return typeof window !== "undefined" && !!window.localStorage;
    } catch {
        return false;
    }
}

/**
 * Sanitize the persisted snapshot to ensure it doesn't trigger unintended side effects when loaded.
 * @param snapshot
 */
function sanitizePersistedSnapshot(snapshot: Snapshot<unknown>): Snapshot<unknown> {
    if (!snapshot || typeof snapshot !== "object") return snapshot;
    const next = {
        ...(snapshot as unknown as Record<string, unknown>),
    } satisfies Record<string, unknown>;

    const context = next["context"];
    if (context && typeof context === "object" && !Array.isArray(context)) {
        next["context"] = {
            ...(context as Record<string, unknown>),
            playPageMounted: false,
            selectedCardIds: [],
        };
    }

    // Ensure timers/turn logic doesn't run until the PlayGame page mounts.
    const value = next["value"];
    if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (value as Record<string, unknown>)["playing"] &&
        typeof (value as Record<string, unknown>)["playing"] === "object" &&
        !Array.isArray((value as Record<string, unknown>)["playing"])
    ) {
        const valueRecord = value as Record<string, unknown>;
        const playing = valueRecord["playing"] as Record<string, unknown>;
        // Restored snapshots should not start ticking/auto-playing immediately
        // (e.g. on refresh or while on the main menu). Keep everything paused;
        // the user can resume from the PlayGame page.
        const timerValue = "paused";
        const turnsValue = "paused";
        next["value"] = {
            ...valueRecord,
            playing: {
                ...playing,
                timer: timerValue,
                turns: turnsValue,
            },
        };
    }

    return next as unknown as Snapshot<unknown>;
}

/**
 * Load the persisted snapshot from localStorage, if it exists and looks valid.
 */
export function loadPersistedSnapshot(): Snapshot<unknown> | undefined {
    if (!canUseLocalStorage()) return undefined;
    try {
        const payload = getPersistedPayload();
        if (!payload) return undefined;

        const s = payload.snapshot as unknown as Record<string, unknown>;
        if (s["value"] === "gameOver") {
            window.localStorage.removeItem(GAME_SNAPSHOT_STORAGE_KEY);
            return undefined;
        }

        const snapshot = payload.snapshot as Snapshot<unknown>;
        if (!snapshotLooksLikePlaying(snapshot)) return undefined;

        return sanitizePersistedSnapshot(snapshot);
    } catch {
        return undefined;
    }
}

/**
 * Check if the given snapshot should be persisted (e.g. is in a valid state that can be resumed from).
 * @param snapshot
 */
export function shouldPersistSnapshot(snapshot: Snapshot<unknown>): boolean {
    const s = snapshot as unknown as Record<string, unknown>;
    const value = s["value"];
    if (value === "gameOver") return false;
    if (value !== "lobby") return true;

    const context = s["context"];
    if (!context || typeof context !== "object" || Array.isArray(context)) return false;
    const players = (context as Record<string, unknown>)["players"];
    if (!Array.isArray(players)) return false;
    return players.length > 0;
}

/**
 * Persist the given snapshot to localStorage, if it's in a valid state. If the snapshot indicates a game over or invalid state, remove any existing persisted snapshot.
 * @param snapshot
 */
export function persistSnapshot(snapshot: Snapshot<unknown>): void {
    if (!canUseLocalStorage()) return;
    try {
        if (!shouldPersistSnapshot(snapshot)) {
            window.localStorage.removeItem(GAME_SNAPSHOT_STORAGE_KEY);
            return;
        }
        const payload: PersistedGameSnapshot = {
            version: 1,
            savedAt: Date.now(),
            snapshot: sanitizePersistedSnapshot(snapshot),
        };
        window.localStorage.setItem(GAME_SNAPSHOT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // ignore persistence errors (quota, privacy mode, etc.)
    }
}

/**
 * Clear any persisted snapshot from localStorage (e.g. when the user wants to reset progress).
 */
export function clearPersistedGame(): void {
    if (!canUseLocalStorage()) return;
    try {
        window.localStorage.removeItem(GAME_SNAPSHOT_STORAGE_KEY);
    } catch {
        // ignore
    }
}

/**
 * Check if there is a valid persisted snapshot in localStorage that looks like it's in the "playing" state, which can be resumed from.
 */
export function hasPersistedGame(): boolean {
    if (!canUseLocalStorage()) return false;
    try {
        const payload = getPersistedPayload();
        if (!payload) return false;
        const snapshot = payload.snapshot as Snapshot<unknown>;
        return snapshotLooksLikePlaying(snapshot);
    } catch {
        return false;
    }
}