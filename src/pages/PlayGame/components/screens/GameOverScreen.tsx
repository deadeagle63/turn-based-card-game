import {handValue} from "../../../../helpers/game.helper.ts";
import {useSelector} from "@xstate/react";
import {gameActor} from "../../../../stateMachine";
import {useNavigate} from "react-router-dom";
import {getGameStateSelector} from "../../../../stateMachine/selectors.ts";
import {useMemo} from "react";


export function GameOverScreen() {
    const navigate = useNavigate();
    const {winnerColor, ctx} = useSelector(gameActor, getGameStateSelector);

    const sortedPlayers = useMemo(
        () =>
            [...ctx.players].sort(
                (a, b) => handValue(a.hand) - handValue(b.hand),
            ),
        [ctx.players],
    );
    return (
        <div
            className="flex min-h-screen w-full flex-col items-center justify-center gap-6 border-4 p-8 transition-colors duration-500"
            style={{borderColor: winnerColor}}
        >
            <h1 className="text-4xl font-bold">Game Over</h1>
            {ctx.winnerId && (
                <p className="text-2xl text-indigo-400">
                    {ctx.winnerId} wins!
                </p>
            )}

            <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1e1e1e] p-6">
                <h2 className="mb-4 text-center text-lg font-semibold text-gray-300">
                    Scoreboard
                </h2>
                <div className="space-y-2">
                    {sortedPlayers.map((p, i) => (
                        <div
                            key={p.id}
                            className={`flex items-center justify-between rounded-lg px-4 py-2 ${
                                p.id === ctx.winnerId
                                    ? "bg-indigo-600/30 text-indigo-300"
                                    : "bg-white/5 text-gray-400"
                            }`}
                        >
                                <span>
                                    {i + 1}. {p.id}
                                </span>
                            <span className="font-mono">
                                    {p.hand.length === 0
                                        ? "0 pts (empty hand)"
                                        : `${handValue(p.hand)} pts (${p.hand.length} cards)`}
                                </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => {
                        gameActor.send({type: "retry"});
                        gameActor.send({type: "pageMounted"});
                    }}
                    className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
                >
                    Play Again
                </button>
                <button
                    onClick={() => {
                        gameActor.send({type: "quit"});
                        navigate("/");
                    }}
                    className="rounded-lg bg-white/5 px-6 py-3 font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                    Main Menu
                </button>
            </div>
        </div>
    );
}
