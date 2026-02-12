import {gameActor} from "../../../stateMachine";
import {useMemo} from "react";

type PlayCardsButtonProps = {
isHumanTurn: boolean;
selectedChainLength: number;
}
export function PlayCardsButton({
                                    isHumanTurn,
                                    selectedChainLength
                                }: PlayCardsButtonProps) {
    const content = useMemo(()=>{
        if (!isHumanTurn) {
            return "Waiting for opponent...";
        } else if (selectedChainLength === 0) {
            return "Select cards to play";
        }
        return `Play ${selectedChainLength} card(s)`
    }, [isHumanTurn, selectedChainLength])

    return (
        <button
            disabled={!isHumanTurn || selectedChainLength === 0}
            onClick={() => gameActor.send({type: "playSelectedCards"})}
            className="rounded-lg bg-green-600 px-6 py-2 font-semibold text-white shadow-lg shadow-green-600/30 transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {content}
        </button>
    );
}
