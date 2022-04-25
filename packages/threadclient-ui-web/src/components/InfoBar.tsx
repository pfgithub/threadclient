import type * as Generic from "api-types-generic";
import {
    createMemo, For, JSX
} from "solid-js";
import { assertNever } from "tmeta-util";
import { timeAgoTextWatchable } from "tmeta-util-solid";
import { classes } from "../util/utils_solid";
import { colorClass } from "./color";
import DevCodeButton from "./DevCodeButton";
import { InfoBarItem, useInfoBar } from "./flat_posts";
import Icon from "./Icon";

function scoreToString(score: number) {
    // oh that weird .match(…) is for rounding down
    // because I couldn't… *10 |0 /10?
    // idk I'm sure I thought of that when I was programming this
    // weird
    if(score < 10_000) return "" + score;
    if(score < 100_000) return (score / 1_000).toFixed(2).match(/^-?\d+(?:\.\d{0,1})?/)?.[0] + "k";
    if(score < 1_000_000) return (score / 1_000 |0) + "k";
    if(score < 100_000_000) return (score / 1_000_000).toFixed(2).match(/^-?\d+(?:\.\d{0,1})?/)?.[0] + "m";
    return (score / 1_000_000 |0) + "m";
}
function formatItemString({value}: InfoBarItem): [short: string, long: string] {
    if(value[0] === "none") return ["", ""];
    if(value[0] === "percent") return [
        " "+value[1].toLocaleString(undefined, {style: "percent"}),
        " "+value[1].toLocaleString(undefined, {style: "percent"}),
    ];
    if(value[0] === "timeago") return [
        " "+timeAgoTextWatchable(value[1], {short: true})(),
        " "+new Date(value[1]).toLocaleString(),
    ];
    if(value[0] === "number") return [
        " "+scoreToString(value[1]),
        " "+value[1].toLocaleString(),
    ];
    if(value[0] === "hidden") return [
        " "+"—",
        " "+"Hidden",
    ];
    assertNever(value[0]);
}

export function InfoBarItemNode(props: {item: InfoBarItem}): JSX.Element {
    // sizeLt.sm
    // for larger sizes we can do longer text
    // eg
    // [c]12 [u]21.8k [h]83% [t]2y
    // →
    // 12 comments, 21.8k points, 83% upvoted, 2 years ago

    const fmt = createMemo(() => formatItemString(props.item));
    const lblv = () => props.item.text+(props.item.value[0] === "none" ? "" : ":");

    return <span
        class={classes(
            colorClass(props.item.color),
            props.item.disabled ?? false ? "opacity-50" : "",
        )}
        title={lblv() + fmt()[1]}
    >
        <Icon icon={props.item.icon} bold={props.item.color != null} label={lblv()} />
        {fmt()[0]}
    </span>;
}

export default function InfoBar(props: {post: Generic.PostContentPost}): JSX.Element {
    const getInfoBar = useInfoBar(() => props.post);
    return <div class="text-gray-500 flex flex-wrap gap-2 <sm:text-xs">
        <For each={getInfoBar()}>{item => (
            <InfoBarItemNode item={item} />
        )}</For>
        <DevCodeButton data={props} />
    </div>;
}