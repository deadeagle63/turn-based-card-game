import {handValue} from "../../../helpers/game.helper.ts";
import {useSelector} from "@xstate/react";
import {gameActor} from "../../../stateMachine";
import {getGameStateSelector} from "../../../stateMachine/selectors.ts";

export function MobilePlayerList() {
    const {ctx, currentPlayer} = useSelector(gameActor, getGameStateSelector);

    return <div className="mb-4 flex flex-wrap justify-center gap-2 md:hidden">
        {ctx.players.map((p) => {
            const isActive = p.id === currentPlayer?.id;
            const color = ctx.playerColors[p.id] ?? "#6366f1";
            return (
                <div
                    key={p.id}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                        isActive ? "bg-white/10 text-white" : "bg-white/5 text-gray-500"
                    }`}
                >
                    <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{backgroundColor: color}}
                    />
                    <span className="font-medium">{p.id}</span>
                    <span className="text-gray-600">
                        {handValue(p.hand)}pts
                    </span>
                </div>
            );
        })}
    </div>
}
