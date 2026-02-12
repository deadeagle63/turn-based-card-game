import { assign, createActor, createMachine } from "xstate";
import { SUPPORTED_GAME_TIMES } from "../helpers/game.helper.ts";

export type Card = unknown;

export type PlayerId = string;

export type Player = {
    id: PlayerId;
    score: number;
    hand: Card[];
    deck: Card[];
};

export type GameTime = {
    currentTime: number;
    roundTime: number;
};

export type GameContext = {
    time: GameTime;
    players: Player[];
};

export type GameEvent =
    | { type: "start" }
    | { type: "tick"; time: number }
    | { type: "pause" }
    | { type: "resume" }
    | { type: "end" }
    | { type: "retry" }
    | { type: "setRoundTime"; roundTime: number }
    | { type: "addPlayer"; playerId: PlayerId }
    | { type: "removePlayer"; playerId: PlayerId }
    | { type: "setScore"; playerId: PlayerId; score: number }
    | { type: "setHand"; playerId: PlayerId; hand: Card[] }
    | { type: "setDeck"; playerId: PlayerId; deck: Card[] };

const DEFAULT_ROUND_TIME = SUPPORTED_GAME_TIMES["1m"];

const createPlayer = (playerId: PlayerId): Player => ({
    id: playerId,
    score: 0,
    hand: [],
    deck: [],
});

export const gameStateMachine = createMachine({
    id: "game",
    types: {} as {
        context: GameContext;
        events: GameEvent;
    },
    context: {
        time: {
            currentTime: 0,
            roundTime: DEFAULT_ROUND_TIME,
        },
        players: [],
    },
    initial: "NotStarted",
    on: {
        setRoundTime: {
            actions: assign({
                time: ({ context, event }) => ({
                    ...context.time,
                    roundTime: event.roundTime,
                }),
            }),
        },
        addPlayer: {
            actions: assign({
                players: ({ context, event }) => {
                    if (context.players.some((p) => p.id === event.playerId)) {
                        return context.players;
                    }
                    return [...context.players, createPlayer(event.playerId)];
                },
            }),
        },
        removePlayer: {
            actions: assign({
                players: ({ context, event }) =>
                    context.players.filter((p) => p.id !== event.playerId),
            }),
        },
        setScore: {
            actions: assign({
                players: ({ context, event }) =>
                    context.players.map((p) =>
                        p.id === event.playerId ? { ...p, score: event.score } : p,
                    ),
            }),
        },
        setHand: {
            actions: assign({
                players: ({ context, event }) =>
                    context.players.map((p) =>
                        p.id === event.playerId ? { ...p, hand: event.hand } : p,
                    ),
            }),
        },
        setDeck: {
            actions: assign({
                players: ({ context, event }) =>
                    context.players.map((p) =>
                        p.id === event.playerId ? { ...p, deck: event.deck } : p,
                    ),
            }),
        },
    },
    states: {
        NotStarted: {
            entry: assign({
                time: ({ context }) => ({
                    currentTime: 0,
                    roundTime: context.time.roundTime ?? DEFAULT_ROUND_TIME,
                }),
            }),
            on: {
                start: {
                    target: "Playing",
                },
            },
        },
        Playing: {
            type: "parallel",
            on: {
                end: {
                    target: "GameOver",
                },
            },
            states: {
                timer: {
                    initial: "Running",
                    states: {
                        Running: {
                            on: {
                                tick: [
                                    {
                                        guard: ({ context, event }) =>
                                            context.time.currentTime + event.time >=
                                            context.time.roundTime,
                                        target: "#game.GameOver",
                                        actions: assign({
                                            time: ({ context, event }) => ({
                                                ...context.time,
                                                currentTime:
                                                    context.time.currentTime + event.time,
                                            }),
                                        }),
                                    },
                                    {
                                        actions: assign({
                                            time: ({ context, event }) => ({
                                                ...context.time,
                                                currentTime:
                                                    context.time.currentTime + event.time,
                                            }),
                                        }),
                                    },
                                ],
                                pause: {
                                    target: "Paused",
                                },
                            },
                        },
                        Paused: {
                            on: {
                                resume: {
                                    target: "Running",
                                },
                            },
                        },
                    },
                },
                players: {
                    initial: "Active",
                    states: {
                        Active: {},
                    },
                },
            },
        },
        GameOver: {
            on: {
                retry: {
                    target: "NotStarted",
                },
            },
        },
    },
});

export const createGameActor = () => createActor(gameStateMachine);
