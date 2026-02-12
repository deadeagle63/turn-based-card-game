import CardView from "../../../components/CardView.tsx";
import type {Card} from "../../../helpers/game.constants.ts";

type DiscardPileProps = {
    topDiscard?: Card;
}

export function DiscardPile({
                                topDiscard,
                            }: DiscardPileProps) {
    return (
        <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500">Discard</span>
            {topDiscard ? (
                <CardView card={topDiscard}/>
            ) : (
                <div
                    className="flex h-28 w-20 items-center justify-center rounded-lg border-2 border-dashed border-white/10">
                    <span className="text-xs text-gray-600">Empty</span>
                </div>
            )}
            <span className="text-xs text-gray-600">
                card(s)
            </span>
        </div>
    );
}
