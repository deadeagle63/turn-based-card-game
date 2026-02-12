
import {type Card, SUIT_COLORS, SUIT_SYMBOLS} from "../helpers/game.constants.ts";

type CardViewProps = {
    card: Card;
    selected?: boolean;
    playable?: boolean;
    faceDown?: boolean;
    onClick?: () => void;
};

export default function CardView({
    card,
    selected = false,
    playable = false,
    faceDown = false,
    onClick,
}: CardViewProps) {
    if (faceDown) {
        return (
            <div className="flex h-28 w-20 items-center justify-center rounded-lg border-2 border-indigo-400/30 bg-indigo-900 shadow-md">
                <span className="text-2xl text-indigo-300/60">?</span>
            </div>
        );
    }

    const color = SUIT_COLORS[card.suit];
    const symbol = SUIT_SYMBOLS[card.suit];
    const isRed = card.suit === "hearts" || card.suit === "diamonds";

    return (
        <button
            onClick={onClick}
            disabled={!playable && !selected}
            className={`relative flex h-28 w-20 flex-col justify-between rounded-lg border-2 p-1.5 shadow-md transition-all ${
                selected
                    ? "z-10 -translate-y-3 border-yellow-400 shadow-yellow-400/30"
                    : playable
                      ? "border-white/20 hover:-translate-y-1 hover:border-indigo-400 hover:shadow-lg"
                      : "border-white/10 opacity-50"
            }`}
            style={{ backgroundColor: "#fefefe", color }}
        >
            <div className="flex flex-col items-start leading-none">
                <span className="text-sm font-bold">{card.rank}</span>
                <span className="text-xs">{symbol}</span>
            </div>
            <div className="flex items-center justify-center">
                <span className={`text-2xl ${isRed ? "text-red-500" : "text-gray-800"}`}>
                    {symbol}
                </span>
            </div>
            <div className="flex flex-col items-end leading-none">
                <span className="rotate-180 text-sm font-bold">{card.rank}</span>
                <span className="rotate-180 text-xs">{symbol}</span>
            </div>
        </button>
    );
}
