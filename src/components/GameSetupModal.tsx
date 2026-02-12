import {type Dispatch, type SetStateAction, useState} from "react";
import {useNavigate} from "react-router-dom";
import {SUPPORTED_GAME_TIMES} from "../helpers/game.helper.ts";

export default function GameSetupModal({onClose}: { onClose: () => void }) {
    const navigate = useNavigate();
    const [playerCount, setPlayerCount] = useState(2);
    const [roundTime, setRoundTime] = useState<number>(
        SUPPORTED_GAME_TIMES["1m"],
    );

    const handleStart = () => {
        navigate("/play", {
            state: {playerCount, roundTime},
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1e1e1e] p-8 shadow-2xl">
                <h2 className="mb-2 text-center text-2xl font-bold">Game Setup</h2>

                {/* Summary of current selections */}
                <p className="mb-8 text-center text-sm text-gray-400">
                    {playerCount}&nbsp;players &middot; {getTimeLabel(roundTime)} per round
                </p>

                {/* Player Count */}
                <OptionSelector label={"Player(s)"} value={playerCount} options={playerCountOptions}
                                onChange={setPlayerCount}/>

                {/* Round Timer */}
                <OptionSelector label={"Round Timer"} value={roundTime} options={roundTimeEntries}
                                onChange={setRoundTime}/>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg bg-white/5 px-4 py-3 font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleStart}
                        className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
                    >
                        Start Game
                    </button>
                </div>
            </div>
        </div>
    );
}
type OptionSelectorProps<T> = {
    label: string;
    value: T;
    options: readonly {
        label: string;
        value: T;
    }[];
    onChange: Dispatch<SetStateAction<T>>
}

function OptionSelector<T>({
                               label,
                               value,
                               options,
                               onChange
                           }: OptionSelectorProps<T>) {
    return <div className="mb-6">
        <label className="mb-3 block text-sm font-semibold uppercase tracking-wider text-gray-400">
            {label}
        </label>
        <div className="flex gap-2">
            {options.map((option) => (
                <button
                    key={option.label}
                    onClick={() => onChange(option.value)}
                    className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                        value === option.value
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                            : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    </div>
}

const playerCountOptions = [
    {label: "2", value: 2},
    {label: "3", value: 3},
    {label: "4", value: 4},
    {label: "5", value: 5},
    {label: "6", value: 6},
] as const;

const roundTimeEntries = Object.entries(SUPPORTED_GAME_TIMES).map(([key, value]) => ({label: key, value}))

function getTimeLabel(ms: number): string {
    const entry = roundTimeEntries.find(({value}) => value === ms);
    return `${(entry?.value ?? ms) / 1000}s`;
}