import {canPlayCard, getPlayableCards, handValue} from "../../../helpers/game.helper.ts";
import CardView from "../../../components/CardView.tsx";
import {PlayCardsButton} from "./PlayCardsButton.tsx";
import {type Card, RANK_VALUES} from "../../../helpers/game.constants.ts";
import {useSelector} from "@xstate/react";
import {gameActor} from "../../../stateMachine";
import {useCallback, useMemo} from "react";
import {DiscardPile} from "./DiscardPile.tsx";
import {DrawPile} from "./DrawPile.tsx";
import {ScoreBanner} from "./ScoreBanner.tsx";
import {MobilePlayerList} from "./MobilePlayerList.tsx";
import {ActionHints} from "./ActionHints.tsx";
import {getGameStateSelector} from "../../../stateMachine/selectors.ts";

export function GamePanel() {
    const {ctx, currentPlayer, currentHand, selectedChain, isHumanTurn, humanPlayer, topDiscard} = useSelector(gameActor, getGameStateSelector);

    const humanHand = useMemo(() => humanPlayer?.hand ?? [], [humanPlayer]);

    const playable = useMemo(
        () => getPlayableCards(currentHand, topDiscard),
        [currentHand, topDiscard],
    );

    const hasPlayableCards = playable.length > 0;

    const selectCard = useCallback((card: Card) => {
        return () => {
            if (!isHumanTurn) return;
            gameActor.send({
                type: "toggleSelectCard",
                cardId: card.id,
            })
        }
    }, [isHumanTurn])

    const humanPlayableHand = useMemo(() => {
        return structuredClone(humanHand)
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
                return {
                    card,
                    isSelected,
                    isPlayable,
                    onClick: selectCard(card)
                }
            });
    }, [humanHand, isHumanTurn, selectCard, selectedChain, topDiscard])

    return <div className="flex flex-1 flex-col p-4">
        {/* Current player score banner */}
        <ScoreBanner currentHand={currentHand}/>

        {/* Mobile-only player list (stacked horizontally) */}
        <MobilePlayerList/>

        {/* Center area: discard pile + draw pile */}
        <div className="mb-6 flex flex-1 items-center justify-center gap-8">
            {/* Draw pile */}
            <DrawPile
                hasPlayableCards={hasPlayableCards}
                drawPileCount={ctx.drawPile.length}/>


            <DiscardPile key={`DISCARD_PILE_${topDiscard.id}`} topDiscard={topDiscard}/>
        </div>

        {/* Action hint */}
        <div className="mb-2 text-center text-sm text-gray-500">
            <ActionHints
                isHumanTurn={isHumanTurn}
                hasPlayableCards={hasPlayableCards}
                playableCardLength={playable.length}
                currentPlayerId={currentPlayer?.id}
            />
        </div>

        {/* Play button (when multiple selected, human turn only) */}
        <div className="mb-2 flex justify-center">
            <PlayCardsButton isHumanTurn={isHumanTurn} selectedChainLength={selectedChain.length}/>
        </div>

        {/* Human player hand (always visible so you can see your cards) */}
        <div className="mt-auto flex flex-col items-center pb-2 gap-4 ">
            <div className="text-xs text-gray-500">
                Your
                hand &middot; {handValue(humanHand)} pts &middot; {humanHand.length} card{humanHand.length !== 1 ? "s" : ""}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
                {humanPlayableHand.map(({card, isSelected, isPlayable, onClick}) => (
                    <CardView
                        key={card.id}
                        card={card}
                        selected={isSelected}
                        playable={isPlayable}
                        onClick={onClick}
                    />))}
            </div>
        </div>
    </div>
}
