import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {useMachine} from "@xstate/react";
import {type Card, gameMachine} from "../stateMachine/index.ts";
import {
    assignPlayerColors,
    buildBestChain,
    canPlayCard,
    getPlayableCards,
    handValue,
} from "../helpers/game.helper.ts";
import CardView from "../components/CardView.tsx";
import {HUMAN_ID, RANK_VALUES, TICK_MS} from "../helpers/game.constants.ts";

export default function PlayGame() {
    const navigate = useNavigate();
    const location = useLocation();
    const { cpuCount, roundTime } = (location.state as {
        cpuCount: number;
        roundTime: number;
    }) ?? { cpuCount: 1, roundTime: 60000 };

    // ── State machine ────────────────────────────────────────────────────────
    const [state, send] = useMachine(gameMachine);
    const ctx = state.context;

    // ── Local UI state ───────────────────────────────────────────────────────
    const [selectedChain, setSelectedChain] = useState<string[]>([]);
    const [playerColors, setPlayerColors] = useState<Record<string, string>>({});
    const initialized = useRef(false);

    // ── Bootstrap: 1 human ("You") + N CPUs ──────────────────────────────────
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        send({ type: "setRoundTime", roundTime });

        const ids: string[] = [HUMAN_ID];
        send({ type: "addPlayer", playerId: HUMAN_ID });
        for (let i = 1; i <= cpuCount; i++) {
            const cpuId = `CPU ${i}`;
            ids.push(cpuId);
            send({ type: "addPlayer", playerId: cpuId });
        }

        setPlayerColors(assignPlayerColors(ids));
        setTimeout(() => send({ type: "start" }), 0);
    }, [cpuCount, roundTime, send]);

    // ── Timer tick ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!state.matches({ playing: { timer: "running" } })) return;
        const id = setInterval(() => send({ type: "tick", delta: TICK_MS }), TICK_MS);
        return () => clearInterval(id);
    }, [state, send]);

    // ── Derived values ───────────────────────────────────────────────────────
    const topDiscard: Card | undefined =
        ctx.discardPile[ctx.discardPile.length - 1];
    const currentPlayer = ctx.players[ctx.currentPlayerIndex];
    const currentHand = currentPlayer?.hand ?? [];
    const playable = useMemo(
        () => getPlayableCards(currentHand, topDiscard),
        [currentHand, topDiscard],
    );
    const isPlaying = state.matches("playing");
    const isPaused = state.matches({ playing: { timer: "paused" } });
    const isGameOver = state.matches("gameOver");
    const isHumanTurn = currentPlayer?.id === HUMAN_ID;

    const currentBorderColor = currentPlayer
        ? playerColors[currentPlayer.id] ?? "#6366f1"
        : "#6366f1";

    const timeLeftSec = Math.max(
        0,
        Math.ceil((ctx.roundTime - ctx.currentTime) / 1000),
    );
    const timeLeftMin = Math.floor(timeLeftSec / 60);
    const timeLeftSecRem = timeLeftSec % 60;
    const timeDisplay = `${timeLeftMin}:${String(timeLeftSecRem).padStart(2, "0")}`;

    // ── Card selection toggle ────────────────────────────────────────────────
    const toggleCard = useCallback(
        (cardId: string) => {
            setSelectedChain((prev) => {
                const idx = prev.indexOf(cardId);
                if (idx !== -1) {
                    // Deselecting: truncate chain from this card onwards
                    return prev.slice(0, idx);
                }
                // Adding: card must match the end of the chain (or topDiscard if empty)
                const card = currentHand.find((c: Card) => c.id === cardId);
                if (!card) return prev;
                const chainEnd = prev.length > 0
                    ? currentHand.find((c: Card) => c.id === prev[prev.length - 1])
                    : topDiscard;
                if (!canPlayCard(card, chainEnd)) return prev;
                return [...prev, cardId];
            });
        },
        [currentHand, topDiscard],
    );

    // ── Play selected cards ──────────────────────────────────────────────────
    const playSelectedCards = useCallback(() => {
        if (selectedChain.length === 0) return;
        send({ type: "playCards", cardIds: selectedChain });
        setSelectedChain([]);
    }, [selectedChain, send]);

    // ── Handle card click: delegate to toggleCard which validates the chain ──
    const handleCardClick = useCallback(
        (card: Card) => {
            toggleCard(card.id);
        },
        [toggleCard],
    );

    // ── Draw card (when no playable cards) ───────────────────────────────────
    const handleDraw = useCallback(() => {
        send({ type: "drawCard" });
        setSelectedChain([]);
    }, [send]);

    // ── SPACE key to play selected cards (human turn only) ─────────────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space" && selectedChain.length > 0 && isPlaying && isHumanTurn) {
                e.preventDefault();
                playSelectedCards();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedChain, isPlaying, isHumanTurn, playSelectedCards]);

    // ── Clear selection on turn change ───────────────────────────────────────
    const prevPlayerIdx = useRef(ctx.currentPlayerIndex);
    useEffect(() => {
        if (ctx.currentPlayerIndex !== prevPlayerIdx.current) {
            setSelectedChain([]);
            prevPlayerIdx.current = ctx.currentPlayerIndex;
        }
    }, [ctx.currentPlayerIndex]);

    // ── Keep stable refs to derived values so auto-play effects don't
    //    reset their timer on every tick-induced re-render. ───────────────
    const playableRef = useRef(playable);
    playableRef.current = playable;
    const currentHandRef = useRef(currentHand);
    currentHandRef.current = currentHand;
    const topDiscardRef = useRef(topDiscard);
    topDiscardRef.current = topDiscard;

    // ── Auto-play: human -- single valid card, empty hand, or forced draw ───
    // Auto-play when only one valid card exists, hand is empty (must draw),
    // or no playable cards (must draw). Only fires on the human player's turn.
    // Halted while the game is paused.
    useEffect(() => {
        if (!isPlaying || isPaused || !isHumanTurn) return;

        if (playable.length === 1) {
            const timer = setTimeout(() => {
                const cards = playableRef.current;
                if (cards.length === 1) {
                    send({ type: "playCards", cardIds: [cards[0].id] });
                    setSelectedChain([]);
                }
            }, 600);
            return () => clearTimeout(timer);
        }

        if (playable.length === 0) {
            const timer = setTimeout(() => {
                send({ type: "drawCard" });
                setSelectedChain([]);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [isPlaying, isPaused, isHumanTurn, playable.length, currentHand.length, send]);

    // ── Auto-play: CPU turns ─────────────────────────────────────────────────
    // CPUs always auto-play: build the longest chain (or draw if none).
    useEffect(() => {
        if (!isPlaying || isPaused || isHumanTurn) return;

        const timer = setTimeout(() => {
            const current = playableRef.current;
            if (current.length > 0) {
                // CPU builds the longest possible chain from its hand
                const chain = buildBestChain(currentHandRef.current, topDiscardRef.current);
                if (chain.length > 0) {
                    send({ type: "playCards", cardIds: chain.map((c: Card) => c.id) });
                } else {
                    send({ type: "playCards", cardIds: [current[0].id] });
                }
            } else {
                send({ type: "drawCard" });
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [isPlaying, isPaused, isHumanTurn, playable.length, currentHand.length, send]);

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
            ? playerColors[ctx.winnerId] ?? "#6366f1"
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
                        onClick={() => navigate("/")}
                        className="rounded-lg bg-white/5 px-6 py-3 font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        Main Menu
                    </button>
                </div>
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
                        onClick={() =>
                            send({
                                type: state.matches({
                                    playing: { timer: "running" },
                                })
                                    ? "pause"
                                    : "resume",
                            })
                        }
                        className="rounded bg-white/10 px-3 py-1 text-sm text-gray-300 transition hover:bg-white/20"
                    >
                        {state.matches({ playing: { timer: "running" } })
                            ? "Pause"
                            : "Resume"}
                    </button>
                </div>

                <button
                    onClick={() => navigate("/")}
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
                        const color = playerColors[p.id] ?? "#6366f1";
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
                                        {p.id === HUMAN_ID ? "" : "CPU \u00b7 "}
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
                            const color = playerColors[p.id] ?? "#6366f1";
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
                            onClick={handleDraw}
                            disabled={hasPlayableCards}
                            className={`flex h-28 w-20 items-center justify-center rounded-lg border-2 shadow-md transition-all ${
                                !hasPlayableCards
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
                                onClick={playSelectedCards}
                                className="rounded-lg bg-green-600 px-6 py-2 font-semibold text-white shadow-lg shadow-green-600/30 transition-colors hover:bg-green-500"
                            >
                                Play {selectedChain.length} card
                                {selectedChain.length > 1 ? "s" : ""} (SPACE)
                            </button>
                        </div>
                    )}

                    {/* Human player hand (always visible so you can see your cards) */}
                    {(() => {
                        const humanPlayer = ctx.players.find((p) => p.id === HUMAN_ID);
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
                                                    onClick={() => isHumanTurn && handleCardClick(card)}
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
