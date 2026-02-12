import { useLocation, useNavigate } from "react-router-dom";

export default function PlayGame() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playerCount, roundTime } = (location.state as {
    playerCount: number;
    roundTime: number;
  }) ?? { playerCount: 2, roundTime: 60000 };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">Play Game</h1>
      <p className="mb-2 text-gray-400">
        Players: {playerCount} | Round Time: {roundTime / 1000}s
      </p>
      <p className="mb-8 text-gray-500">Game content coming soon...</p>
      <button
        onClick={() => navigate("/")}
        className="rounded-lg bg-[#3a3a3a] px-6 py-3 font-medium text-gray-300 transition-colors hover:bg-[#4a4a4a]"
      >
        Back to Menu
      </button>
    </div>
  );
}
