import {gameActor} from "../../../stateMachine";
import {useSelector} from "@xstate/react";
import {getGameStateSelector} from "../../../stateMachine/selectors.ts";

type DrawPileProps = {
    hasPlayableCards: boolean;
    drawPileCount: number;
}

export function DrawPile({
                             hasPlayableCards,
                             drawPileCount,
                         }: DrawPileProps) {
    const {isPaused, isHumanTurn} = useSelector(gameActor, getGameStateSelector);



    return (
        <button
            onClick={() => gameActor.send({type: "requestDrawCard"})}
            disabled={!isHumanTurn || isPaused || hasPlayableCards}
            className={`flex h-28 w-20 items-center justify-center rounded-lg border-2 shadow-md transition-all ${
                isHumanTurn && !isPaused && !hasPlayableCards
                    ? "border-yellow-400 bg-indigo-900 shadow-yellow-400/20 hover:scale-105"
                    : "border-indigo-400/30 bg-indigo-900 opacity-50"
            }`}
            title={
                hasPlayableCards
                    ? "You have playable cards"
                    : "Draw a card"
            }
        >
            <div className="flex flex-col items-center">
                <span className="text-2xl text-indigo-300/60">
                    {drawPileCount}
                </span>
                <span className="text-[10px] text-indigo-300/40">
                    DRAW
                </span>
            </div>
        </button>);
}
