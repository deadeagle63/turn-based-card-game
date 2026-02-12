import {type Card, EMPTY_HAND, FALLBACK_PLAYER_COLOR} from "../helpers/game.constants.ts";
import type {SnapshotFrom} from "xstate";
import type {gameMachine} from "./index.ts";
import {getPlayerColorByPlayerId} from "./stateMachine.helper.ts";

type GameSnapshot = SnapshotFrom<typeof gameMachine>;

export function getGameStateSelector(state: GameSnapshot) {
    const ctx = state.context;
    const currentPlayer = ctx.players[ctx.currentPlayerIndex];
    const currentHand = currentPlayer?.hand ?? EMPTY_HAND;
    const selectedChain = ctx.selectedCardIds;

    // human player info (for hand display and score)
    const isHumanTurn = currentPlayer?.id === ctx.humanPlayerId;
    const humanPlayer = ctx.players.find((p) => p.id === ctx.humanPlayerId);
    const topDiscard: Card | undefined = ctx.discardPile[ctx.discardPile.length - 1];

    const winnerColor = ctx.winnerId
        ? ctx.playerColors[ctx.winnerId] ?? FALLBACK_PLAYER_COLOR
        : FALLBACK_PLAYER_COLOR;

    const currentPlayerColor = getPlayerColorByPlayerId(ctx, currentPlayer?.id);

    // could use a enum but JS enums are the devils work
    const isPaused =
        state.matches({playing: {timer: "paused"}}) ||
        state.matches({playing: {turns: "paused"}});
    const isPlaying = state.matches("playing");
    const isGameOver = state.matches("gameOver");
    const isTimerRunning = state.matches({playing: {timer: "running"}});
    const isTimerPaused = state.matches({playing: {timer: "paused"}});

    return {
        state,
        ctx,
        currentPlayer,
        currentHand,
        selectedChain,
        isHumanTurn,
        humanPlayer,
        topDiscard,
        winnerColor,
        currentPlayerColor,
        isPaused,
        isPlaying,
        isGameOver,
        isTimerRunning,
        isTimerPaused,
    }
}