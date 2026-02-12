export const SUPPORTED_GAME_TIMES = {
    '1m': 60000,
    "3m": 180000,
    '5m': 300000,
}

export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
    "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
] as const;
export type Rank = (typeof RANKS)[number];

export type Card = {
    id: string;
    suit: Suit;
    rank: Rank;
};

export const RANK_VALUES: Record<Rank, number> = {
    A: 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
    hearts: "\u2665",
    diamonds: "\u2666",
    clubs: "\u2663",
    spades: "\u2660",
};

export const SUIT_COLORS: Record<Suit, string> = {
    hearts: "#e74c3c",
    diamonds: "#e74c3c",
    clubs: "#1a1a2e",
    spades: "#1a1a2e",
};

export const TICK_MS = 250;

export const HUMAN_ID = "You";

// player border colors (cycled through for CPU players)
export const PLAYER_COLORS = [
    "#e74c3c", // red
    "#3498db", // blue
    "#2ecc71", // green
    "#f39c12", // orange
    "#9b59b6", // purple
    "#1abc9c", // teal
] as const;