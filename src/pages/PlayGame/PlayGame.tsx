import {useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useSelector} from "@xstate/react";
import {gameActor} from "../../stateMachine";
import {GameOverScreen} from "./components/screens/GameOverScreen.tsx";
import {GameLobbyScreen} from "./components/screens/GameLobbyScreen.tsx";
import {PlayGamePlayerLeftBar} from "./components/PlayGamePlayerLeftBar.tsx";
import {GamePanel} from "./components/GamePanel.tsx";
import {getGameStateSelector} from "../../stateMachine/selectors.ts";
import {useSpaceListener} from "../../hooks/useSpaceListener.tsx";

export default function PlayGame() {
    const navigate = useNavigate();

    const {state, ctx, isPlaying, currentPlayer, currentPlayerColor} = useSelector(gameActor, getGameStateSelector);
    const send = gameActor.send;

    // load game in
    useEffect(() => {
        send({type: "pageMounted"});
        return () => send({type: "pageUnmounted"});
    }, [send]);
    useSpaceListener()

    const isGameOver = state.matches("gameOver");
    const isTimerRunning = state.matches({playing: {timer: "running"}});
    const isTimerPaused = state.matches({playing: {timer: "paused"}});
    const canPauseResume = isTimerRunning || isTimerPaused;

    const timeLeftSec = Math.max(
        0,
        Math.ceil((ctx.roundTime - ctx.currentTime) / 1000),
    );
    const timeLeftMin = Math.floor(timeLeftSec / 60);
    const timeLeftSecRem = timeLeftSec % 60;
    const timeDisplay = `${timeLeftMin}:${String(timeLeftSecRem).padStart(2, "0")}`;


    // Game Over screen
    if (isGameOver) {
        return <GameOverScreen/>
    }

    if (state.matches("lobby")) {
        return <GameLobbyScreen/>
    }

    // Lobby / loading
    if (!isPlaying) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center border-4 border-white/10">
                <p className="text-gray-400">Setting up game...</p>
            </div>
        );
    }

    // Main game screen
    return (
        <div
            className="flex min-h-screen w-full flex-col border-4 transition-colors duration-500"
            style={{borderColor: currentPlayerColor}}
        >
            {/* Top bar: timer + info */}
            <div className="flex items-center justify-between border-b border-white/10 bg-[#1e1e1e] px-6 py-3">
                <div className="flex items-center gap-4">
                    <span
                        className={`font-mono text-2xl font-bold ${
                            timeLeftSec <= 10 ? "animate-pulse text-red-400" : "text-white"
                        }`}
                    >
                        {timeDisplay}
                    </span>
                    <button
                        disabled={!canPauseResume}
                        onClick={() => send({type: isTimerRunning ? "pause" : "resume"})}
                        className="rounded bg-white/10 px-3 py-1 text-sm text-gray-300 transition hover:bg-white/20"
                    >
                        {isTimerPaused ? "Resume" : "Pause"}
                    </button>
                </div>

                <button
                    onClick={() => {
                        send({type: "pageUnmounted"});
                        navigate("/");
                    }}
                    className="rounded bg-white/10 px-3 py-1 text-sm text-gray-300 transition hover:bg-white/20"
                >
                    Quit
                </button>
            </div>

            {/* Main area: sidebar + game */}
            <div className="flex flex-1">
                <PlayGamePlayerLeftBar key={`SIDE_PLAY_PANEL_${currentPlayer?.id}`}/>

                <GamePanel key={`GAME_PANEL_${currentPlayer?.id}`}/>
            </div>
        </div>
    );
}
