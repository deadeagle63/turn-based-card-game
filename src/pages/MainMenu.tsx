import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import GameSetupModal from "../components/GameSetupModal.tsx";
import {
  gameActor,

} from "../stateMachine/index.ts";
import {clearPersistedGame, hasPersistedGame} from "../stateMachine/stateMachine.helper.ts";

export default function MainMenu() {
  const navigate = useNavigate();
  const [showSetup, setShowSetup] = useState(false);
  const [hasSavedGame, setHasSavedGame] = useState(() => hasPersistedGame());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== "turnBasedCardGame:lastSnapshot:v1") return;
      setHasSavedGame(hasPersistedGame());
    };
    window.addEventListener("storage", onStorage);
    const sub = gameActor.subscribe(() => {
      setHasSavedGame(hasPersistedGame());
    });
    return () => {
      sub.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center">
      <h1 className="mb-12 text-center text-5xl font-bold tracking-tight">
        Card Game
      </h1>

      {hasSavedGame && (
        <button
          onClick={() => navigate("/play")}
          className="mb-4 rounded-xl bg-indigo-600 px-12 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
        >
          Continue
        </button>
      )}

      <button
        onClick={() => setShowSetup(true)}
        className="rounded-xl bg-white/5 px-12 py-4 text-lg font-semibold text-gray-200 shadow-lg shadow-black/20 transition-colors hover:bg-white/10 hover:text-white"
      >
        Start
      </button>

      <button
        onClick={() => {
          const ok = window.confirm("Clear saved game? This cannot be undone.");
          if (!ok) return;
          clearPersistedGame();
          gameActor.send({ type: "RESET_GAME" });
          setHasSavedGame(false);
        }}
        disabled={!hasSavedGame}
        className="mt-4 rounded-lg bg-white/5 px-6 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Clear Saved Game
      </button>

      {showSetup && <GameSetupModal onClose={() => setShowSetup(false)} />}
    </div>
  );
}
