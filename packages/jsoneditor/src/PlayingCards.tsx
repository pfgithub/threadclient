import { JSX } from "solid-js";
import { AnNode } from "./app_data";

type Token = {
    x: number,
    y: number,
    upd: number, // z index value = Date.now() (set to server time value if using a server TODO)
};
type PlayingCards = {
    tokens: {[key: string]: Token},
};

export default function PlayingCards(props: {node: AnNode<PlayingCards>}): JSX.Element {
    return <div class="w-full bg-gray-700" style={{
        'aspect-ratio': "16 / 9",
    }}>
        TODO
    </div>;
}
