import {handValue} from "../../../helpers/game.helper.ts";
import {useSelector} from "@xstate/react";
import {type Card, gameActor} from "../../../stateMachine";
import {getGameStateSelector} from "../../../stateMachine/selectors.ts";

type ScoreBannerProps = {
    currentHand: Card[]
}

export function ScoreBanner({currentHand}: ScoreBannerProps) {
    const {currentPlayer, currentPlayerColor} = useSelector(gameActor, getGameStateSelector);

    return <div
        className="mb-4 flex items-center justify-center gap-3 rounded-xl px-4 py-2"
        style={{backgroundColor: currentPlayerColor + "20"}}
    >
        <span
            className="inline-block h-3 w-3 rounded-full"
            style={{backgroundColor: currentPlayerColor}}
        />
        <span className="text-sm font-semibold text-white">
                            {currentPlayer?.id}'s turn
                        </span>
        <span className="text-sm text-gray-400">|</span>
        <span className="font-mono text-sm text-gray-300">
                            {handValue(currentHand)} pts
                        </span>
        <span className="text-sm text-gray-400">|</span>
        <span className="text-xs text-gray-500">
                            {currentHand.length} card{currentHand.length !== 1 ? "s" : ""}
        </span>
    </div>
}
