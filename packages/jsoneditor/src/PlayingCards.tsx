import { JSX } from "solid-js/jsx-runtime";
import { AnNode } from "./app_data";

type Token = {
    x: number,
    y: number,
};
type PlayingCards = {
    tokens: {[key: string]: Token},
};

export default function PlayingCards(props: {node: AnNode<PlayingCards>}): JSX.Element {
    return <div class="w-full bg-gray-700" style={{
        'aspect-ratio': "16 / 9",
    }}>
        TODO make it a set ratio
    </div>;
}
