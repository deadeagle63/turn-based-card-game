import {type Card, PLAYER_COLORS, RANK_VALUES, RANKS, SUITS} from "./game.constants.ts";

/** Create a standard 52-card deck. */
export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ id: `${rank}-${suit}`, suit, rank });
        }
    }
    return deck;
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Deal `count` cards from the top of the deck (mutates the deck). */
export function dealCards(deck: Card[], count: number): Card[] {
    return deck.splice(0, count);
}

/** Calculate the total point value of a hand. */
export function handValue(hand: Card[]): number {
    return hand.reduce((sum, card) => sum + RANK_VALUES[card.rank], 0);
}

/** Check whether a card can be played on top of the discard pile. */
export function canPlayCard(card: Card, topDiscard: Card | undefined): boolean {
    if (!topDiscard) return true; // empty discard pile, anything goes
    return card.rank === topDiscard.rank || card.suit === topDiscard.suit;
}

/** Get all playable cards from a hand given the current discard top. */
export function getPlayableCards(
    hand: Card[],
    topDiscard: Card | undefined,
): Card[] {
    return hand.filter((c) => canPlayCard(c, topDiscard));
}

/**
 * Try to find a valid chain ordering for the given cards starting from `top`.
 * Each successive card must match the previous card by rank or suit.
 * Returns the ordered array if a valid chain exists, or null if not.
 */
export function orderChain(
    cards: Card[],
    top: Card | undefined,
): Card[] | null {
    if (cards.length === 0) return [];
    if (cards.length === 1) {
        return canPlayCard(cards[0], top) ? [cards[0]] : null;
    }

    // DFS to find a valid ordering
    const result: Card[] = [];
    const used = new Set<string>();

    function dfs(current: Card | undefined): boolean {
        if (result.length === cards.length) return true;
        for (const card of cards) {
            if (used.has(card.id)) continue;
            if (!canPlayCard(card, current)) continue;
            result.push(card);
            used.add(card.id);
            if (dfs(card)) return true;
            result.pop();
            used.delete(card.id);
        }
        return false;
    }

    return dfs(top) ? [...result] : null;
}

/**
 * Check whether adding `candidate` to the currently selected cards
 * still forms a valid chain from `top`.
 */
export function canAddToChain(
    selected: Card[],
    candidate: Card,
    top: Card | undefined,
): boolean {
    return orderChain([...selected, candidate], top) !== null;
}

/**
 * Build the longest possible chain from `hand` starting from `top`.
 * Uses a greedy DFS approach to maximise the number of cards played.
 */
export function buildBestChain(
    hand: Card[],
    top: Card | undefined,
): Card[] {
    const playable = getPlayableCards(hand, top);
    if (playable.length === 0) return [];

    let best: Card[] = [];

    function dfs(current: Card | undefined, chain: Card[], remaining: Card[]): void {
        if (chain.length > best.length) {
            best = [...chain];
        }
        for (let i = 0; i < remaining.length; i++) {
            const card = remaining[i];
            if (!canPlayCard(card, current)) continue;
            const next = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
            chain.push(card);
            dfs(card, chain, next);
            chain.pop();
        }
    }

    dfs(top, [], hand);
    return best;
}

/**
 * Get the player color mapping for the given player IDs.
 * Colors are assigned randomly using fischer-yates shuffle, and will cycle if there are more players than colors.
 */
export function assignPlayerColors(playerIds: string[]): Record<string, string> {
    const pool = shuffle([...PLAYER_COLORS]);
    const map: Record<string, string> = {};
    playerIds.forEach((id, idx) => {
        map[id] = pool[idx % pool.length];
    });
    return map;
}