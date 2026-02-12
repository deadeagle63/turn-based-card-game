import {useLocation, useNavigate} from "react-router-dom";
import {useEffect, useMemo} from "react";
import {gameActor} from "../../../../stateMachine";
import {useSelector} from "@xstate/react";
import {getGameStateSelector} from "../../../../stateMachine/selectors.ts";

export function GameLobbyScreen() {
    const navigate = useNavigate();
    const location = useLocation();
    const {state} = useSelector(gameActor, getGameStateSelector);

    const configFromUrl = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const cpuCountRaw = params.get("cpuCount");
        const roundTimeRaw = params.get("roundTime");
        if (!cpuCountRaw || !roundTimeRaw) return null;
        const cpuCount = Number.parseInt(cpuCountRaw, 10);
        const roundTime = Number.parseInt(roundTimeRaw, 10);
        if (!Number.isFinite(cpuCount) || !Number.isFinite(roundTime)) return null;
        if (cpuCount <= 0 || roundTime <= 0) return null;
        return {cpuCount, roundTime};
    }, [location.search]);

    useEffect(() => {
        if (!state.matches("lobby")) return;
        if (!configFromUrl) return;
        gameActor.send({type: "GAME_CONFIG", ...configFromUrl});
    }, [configFromUrl, state]);

    return (
        <div
            className="flex min-h-screen w-full flex-col items-center justify-center gap-4 border-4 border-white/10">
            <p className="text-gray-400">
                {configFromUrl ? "Setting up game..." : "No game configured."}
            </p>
            <button
                onClick={() => navigate("/")}
                className="rounded-lg bg-white/5 px-6 py-3 font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
                Main Menu
            </button>
        </div>
    );
}
