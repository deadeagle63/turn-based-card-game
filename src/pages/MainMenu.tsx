import { useState } from "react";
import GameSetupModal from "../components/GameSetupModal.tsx";

export default function MainMenu() {
  const [showSetup, setShowSetup] = useState(false);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center">
      <h1 className="mb-12 text-center text-5xl font-bold tracking-tight">
        Card Game
      </h1>

      <button
        onClick={() => setShowSetup(true)}
        className="rounded-xl bg-indigo-600 px-12 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
      >
        Start
      </button>

      {showSetup && <GameSetupModal onClose={() => setShowSetup(false)} />}
    </div>
  );
}
