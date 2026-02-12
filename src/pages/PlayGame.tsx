import {useEffect, useMemo} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {useSelector} from "@xstate/react";
import {type Card, gameActor} from "../stateMachine/index.ts";
import {
    canPlayCard,
    getPlayableCards,
    handValue,
} from "../helpers/game.helper.ts";
import CardView from "../components/CardView.tsx";
import {RANK_VALUES} from "../helpers/game.constants.ts";

const EMPTY_HAND: Card[] = [];

export default function PlayGame() {
    const navigate = useNavigate();
    const location = useLocation();

    // ── State machine ────────────────────────────────────────────────────────
    const state = useSelector(gameActor, (s) => s);
    const send = gameActor.send;
    const ctx = state.context;

    const configFromUrl = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const cpuCountRaw = params.get("cpuCount");
        const roundTimeRaw = params.get("roundTime");
        if (!cpuCountRaw || !roundTimeRaw) return null;
        const cpuCount = Number.parseInt(cpuCountRaw, 10);
        const roundTime = Number.parseInt(roundTimeRaw, 10);
        if (!Number.isFinite(cpuCount) || !Number.isFinite(roundTime)) return null;
        if (cpuCount <= 0 || roundTime <= 0) return null;
        return { cpuCount, roundTime };
    }, [location.search]);

    // ── Page lifecycle ───────────────────────────────────────────────────────
    useEffect(() => {
        send({ type: "pageMounted" });
        return () => send({ type: "pageUnmounted" });
    }, [send]);

    useEffect(() => {
        if (!state.matches("lobby")) return;
        if (!configFromUrl) return;
        send({ type: "GAME_CONFIG", ...configFromUrl });
    }, [configFromUrl, send, state]);

    // ── Derived values ───────────────────────────────────────────────────────
    const topDiscard: Card | undefined =
        ctx.discardPile[ctx.discardPile.length - 1];
    const currentPlayer = ctx.players[ctx.currentPlayerIndex];
    const currentHand = currentPlayer?.hand ?? EMPTY_HAND;
    const playable = useMemo(
        () => getPlayableCards(currentHand, topDiscard),
        [currentHand, topDiscard],
    );
    const isPlaying = state.matches("playing");
    const isPaused =
        state.matches({ playing: { timer: "paused" } }) ||
        state.matches({ playing: { turns: "paused" } });
    const isGameOver = state.matches("gameOver");
    const isHumanTurn = currentPlayer?.id === ctx.humanPlayerId;
    const selectedChain = ctx.selectedCardIds;
    const isTimerRunning = state.matches({ playing: { timer: "running" } });
    const isTimerPaused = state.matches({ playing: { timer: "paused" } });
    const canPauseResume = isTimerRunning || isTimerPaused;

    const currentBorderColor = currentPlayer
        ? ctx.playerColors[currentPlayer.id] ?? "#6366f1"
        : "#6366f1";

    const timeLeftSec = Math.max(
        0,
        Math.ceil((ctx.roundTime - ctx.currentTime) / 1000),
    );
    const timeLeftMin = Math.floor(timeLeftSec / 60);
    const timeLeftSecRem = timeLeftSec % 60;
    const timeDisplay = `${timeLeftMin}:${String(timeLeftSecRem).padStart(2, "0")}`;

    // ── SPACE key to play selected cards (human turn only) ─────────────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space" && selectedChain.length > 0 && isPlaying && isHumanTurn) {
                e.preventDefault();
                send({ type: "playSelectedCards" });
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedChain.length, isPlaying, isHumanTurn, send]);

    // ── Score board for game over ────────────────────────────────────────────
    const sortedPlayers = useMemo(
        () =>
            [...ctx.players].sort(
                (a, b) => handValue(a.hand) - handValue(b.hand),
            ),
        [ctx.players],
    );

    // ── Render ───────────────────────────────────────────────────────────────

    // Game Over screen
    if (isGameOver) {
        const winnerColor = ctx.winnerId
            ? ctx.playerColors[ctx.winnerId] ?? "#6366f1"
            : "#6366f1";
        return (
            <div
                className="flex min-h-screen w-full flex-col items-center justify-center gap-6 border-4 p-8 transition-colors duration-500"
                style={{ borderColor: winnerColor }}
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
                        onClick={() => send({ type: "retry" })}
                        className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
                    >
                        Play Again
                    </button>
                    <button
                        onClick={() => {
                            send({ type: "quit" });
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

    if (state.matches("lobby")) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 border-4 border-white/10">
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

    // Lobby / loading
    if (!isPlaying) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center border-4 border-white/10">
                <p className="text-gray-400">Setting up game...</p>
            </div>
        );
    }

    // ── Playing screen ───────────────────────────────────────────────────────

    const hasPlayableCards = playable.length > 0;

    return (
        <div
            className="flex min-h-screen w-full flex-col border-4 transition-colors duration-500"
            style={{ borderColor: currentBorderColor }}
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
                        onClick={() => send({ type: isTimerRunning ? "pause" : "resume" })}
                        className="rounded bg-white/10 px-3 py-1 text-sm text-gray-300 transition hover:bg-white/20"
                    >
                        {isTimerPaused ? "Resume" : "Pause"}
                    </button>
                </div>

                <button
                    onClick={() => {
                        send({ type: "pageUnmounted" });
                        navigate("/");
                    }}
                    className="rounded bg-white/10 px-3 py-1 text-sm text-gray-300 transition hover:bg-white/20"
                >
                    Quit
                </button>
            </div>

            {/* Main area: sidebar + game */}
            <div className="flex flex-1">
                {/* ── Player sidebar (left) ──────────────────────────────── */}
                <aside className="hidden w-52 shrink-0 flex-col gap-1 border-r border-white/10 bg-[#1a1a1a] p-3 md:flex">
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
                                    style={{ backgroundColor: color }}
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

                {/* ── Game area (center) ─────────────────────────────────── */}
                <div className="flex flex-1 flex-col p-4">
                    {/* Current player score banner */}
                    <div
                        className="mb-4 flex items-center justify-center gap-3 rounded-xl px-4 py-2"
                        style={{ backgroundColor: currentBorderColor + "20" }}
                    >
                        <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: currentBorderColor }}
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

                    {/* Mobile-only player list (stacked horizontally) */}
                    <div className="mb-4 flex flex-wrap justify-center gap-2 md:hidden">
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
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="font-medium">{p.id}</span>
                                    <span className="text-gray-600">
                                        {handValue(p.hand)}pts
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Center area: discard pile + draw pile */}
                    <div className="mb-6 flex flex-1 items-center justify-center gap-8">
                        {/* Draw pile */}
                        <button
                            onClick={() => send({ type: "requestDrawCard" })}
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
                                    {ctx.drawPile.length}
                                </span>
                                <span className="text-[10px] text-indigo-300/40">
                                    DRAW
                                </span>
                            </div>
                        </button>

                        {/* Discard pile */}
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-500">Discard</span>
                            {topDiscard ? (
                                <CardView card={topDiscard} />
                            ) : (
                                <div className="flex h-28 w-20 items-center justify-center rounded-lg border-2 border-dashed border-white/10">
                                    <span className="text-xs text-gray-600">Empty</span>
                                </div>
                            )}
                            <span className="text-xs text-gray-600">
                                {ctx.discardPile.length} card
                                {ctx.discardPile.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                    </div>

                    {/* Action hint */}
                    <div className="mb-2 text-center text-sm text-gray-500">
                        {!isHumanTurn ? (
                            <span className="text-gray-400">
                                {currentPlayer?.id} is thinking...
                            </span>
                        ) : !hasPlayableCards ? (
                            <span className="text-yellow-400">
                                No matching cards -- drawing from the deck...
                            </span>
                        ) : playable.length === 1 ? (
                            <span className="text-green-400">
                                One match found -- auto-playing...
                            </span>
                        ) : (
                            <span>
                                Select matching cards, then press{" "}
                                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                                    SPACE
                                </kbd>{" "}
                                to play
                            </span>
                        )}
                    </div>

                    {/* Play button (when multiple selected, human turn only) */}
                    {isHumanTurn && selectedChain.length > 0 && (
                        <div className="mb-2 flex justify-center">
                            <button
                                onClick={() => send({ type: "playSelectedCards" })}
                                className="rounded-lg bg-green-600 px-6 py-2 font-semibold text-white shadow-lg shadow-green-600/30 transition-colors hover:bg-green-500"
                            >
                                Play {selectedChain.length} card
                                {selectedChain.length > 1 ? "s" : ""} (SPACE)
                            </button>
                        </div>
                    )}

                    {/* Human player hand (always visible so you can see your cards) */}
                    {(() => {
                        const humanPlayer = ctx.players.find((p) => p.id === ctx.humanPlayerId);
                        const humanHand = humanPlayer?.hand ?? [];
                        return (
                            <div className="mt-auto flex flex-col items-center pb-2">
                                <div className="mb-1 text-xs text-gray-500">
                                    Your hand &middot; {handValue(humanHand)} pts &middot; {humanHand.length} card{humanHand.length !== 1 ? "s" : ""}
                                </div>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {[...humanHand]
                                        .sort(
                                            (a: Card, b: Card) =>
                                                RANK_VALUES[a.rank] - RANK_VALUES[b.rank] ||
                                                a.suit.localeCompare(b.suit),
                                        )
                                        .map((card: Card) => {
                                            const isSelected = selectedChain.includes(card.id);
                                            // A card is playable if it can extend the current chain
                                            // (or match the top discard when nothing is selected)
                                            const chainEnd = selectedChain.length > 0
                                                ? humanHand.find((c: Card) => c.id === selectedChain[selectedChain.length - 1])
                                                : topDiscard;
                                            const isPlayable = isHumanTurn && (
                                                isSelected || canPlayCard(card, chainEnd)
                                            );
                                            return (
                                                <CardView
                                                    key={card.id}
                                                    card={card}
                                                    selected={isSelected}
                                                    playable={isPlayable}
                                                    onClick={() =>
                                                        isHumanTurn &&
                                                        send({
                                                            type: "toggleSelectCard",
                                                            cardId: card.id,
                                                        })
                                                    }
                                                />
                                            );
                                        })}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
