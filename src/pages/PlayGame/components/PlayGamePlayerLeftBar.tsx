import {handValue} from "../../../helpers/game.helper.ts";
import {useSelector} from "@xstate/react";
import {gameActor} from "../../../stateMachine";
import {getGameStateSelector} from "../../../stateMachine/selectors.ts";

export function PlayGamePlayerLeftBar() {
    const {ctx, currentPlayer} = useSelector(gameActor, getGameStateSelector);
    return (
        <aside
            className="hidden w-52 shrink-0 flex-col gap-1 border-r border-white/10 bg-[#1a1a1a] p-3 md:flex">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Players
            </h3>
            {ctx.players.map((p) => {
                const isActive = p.id === currentPlayer?.id;
                const color = ctx.playerColors[p.id] ?? "#6366f1";
                return (
                    <div
                        key={p.id}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                            isActive
                                ? "bg-white/10"
                                : "bg-transparent"
                        }`}
                    >
                        {/* Color dot */}
                        <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{backgroundColor: color}}
                        />
                        <div className="flex flex-1 flex-col overflow-hidden">
                                    <span
                                        className={`truncate text-sm font-semibold ${
                                            isActive ? "text-white" : "text-gray-400"
                                        }`}
                                    >
                                        {p.id}
                                        {isActive && (
                                            <span className="ml-1 text-[10px] font-normal text-gray-500">
                                                (turn)
                                            </span>
                                        )}
                                    </span>
                            <span className="text-xs text-gray-600">
                                        {p.controller === "human" ? "" : "CPU \u00b7 "}
                                {handValue(p.hand)} pts &middot; {p.hand.length} cards
                                    </span>
                        </div>
                    </div>
                );
            })}
        </aside>
    );
}
