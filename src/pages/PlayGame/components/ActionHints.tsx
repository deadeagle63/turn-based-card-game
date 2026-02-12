import {useMemo} from "react";
import type {PlayerId} from "../../../stateMachine";

type ActionHintsProps = {
    isHumanTurn: boolean;
    hasPlayableCards: boolean;
    playableCardLength: number;
    currentPlayerId?: PlayerId;
}

export function ActionHints({
                                isHumanTurn,
                                hasPlayableCards,
                                playableCardLength,
                                currentPlayerId,
                            }: ActionHintsProps) {
    return useMemo(() => {
        // memo'd because the if/else ternary was getting really unwieldy in the JSX below
        if (!isHumanTurn) {
            return <span className="text-gray-400">
                                {currentPlayerId} is thinking...
                            </span>
        } else if (!hasPlayableCards) {
            return <span className="text-yellow-400">
                                No matching cards -- drawing from the deck...
                    </span>
        }
        if (playableCardLength === 1) {
            return <span className="text-green-400">
                        One match found -- auto-playing...
                    </span>
        } else {
            return <span>
                Select matching cards, then press&nbsp;
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                    SPACE
                </kbd>&nbsp;
                to play
                </span>
        }
    }, [isHumanTurn, hasPlayableCards, playableCardLength, currentPlayerId]);
}
