import type {Snapshot} from "xstate";

export const GAME_ACTOR_GLOBAL_KEY = "__turnBasedCardGame_gameActor__";
export const GAME_SNAPSHOT_GLOBAL_KEY = "__turnBasedCardGame_gameActorPersistence__";
export const GAME_SNAPSHOT_STORAGE_KEY = "turnBasedCardGame:lastSnapshot:v1";
export const PERSIST_THROTTLE_MS = 1000;

export type PersistedGameSnapshot = {
    version: 1;
    savedAt: number;
    snapshot: Snapshot<unknown>;
};