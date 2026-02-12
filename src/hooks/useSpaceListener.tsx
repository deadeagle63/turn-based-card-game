import {useEffect} from "react";
import {useSelector} from "@xstate/react";
import {gameActor} from "../stateMachine";
import {getGameStateSelector} from "../stateMachine/selectors.ts";

export function useSpaceListener() {
    const {selectedChain, isHumanTurn, isPlaying} = useSelector(gameActor, getGameStateSelector)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space" && selectedChain.length > 0 && isPlaying && isHumanTurn) {
                e.preventDefault();
                gameActor.send({type: "playSelectedCards"});
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedChain.length, isPlaying, isHumanTurn]);
}
