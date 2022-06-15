import type * as Generic from "api-types-generic";
import {
    createMemo, For, JSX
} from "solid-js";
import { assertNever } from "tmeta-util";
import { Show, timeAgoTextWatchable } from "tmeta-util-solid";
import { classes, getSettings, size_lt } from "../util/utils_solid";
import { colorClass } from "./color";
import DevCodeButton from "./DevCodeButton";
import { FormattableNumber, InfoBarItem, useInfoBar } from "./flat_posts";
import Icon from "./Icon";
import { ClientPostOpts } from "./Post";

export function scoreToString(score: number) {
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
export function formatItemString(value: FormattableNumber): [short: string, long: string] {
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

    const fmt = createMemo(() => formatItemString(props.item.value));
    const lblv = () => props.item.text+(props.item.value[0] === "none" ? "" : ":");

    return <span
        class={classes(
            colorClass(props.item.color),
            props.item.disabled ?? false ? "opacity-50" : "",
        )}
        title={lblv() + fmt()[1]}
    >
        {(true as boolean) || size_lt.sm() ? 
            <Icon icon={props.item.icon} bold={props.item.color != null} label={lblv()} />
        : <></>}
        {fmt()[0]}
        {(true as boolean) || size_lt.sm() ? <></> : <>{props.item.value[0] === "none" ? "" : " "}{props.item.text}</>}
    </span>;
}

export default function InfoBar(props: {
    post: Generic.PostContentPost,
    opts: ClientPostOpts,
}): JSX.Element {
    const getInfoBar = useInfoBar(() => props.post);
    const settings = getSettings();
    return <div class="text-gray-500 flex flex-wrap gap-2 <sm:text-xs">
        <For each={getInfoBar()}>{item => (
            <InfoBarItemNode item={item} />
        )}</For>
        <DevCodeButton data={props} />
        <Show if={settings.dev.showLogButtons() === "on"}>
            <div>
                [{(props.opts.id ?? "null").toString()}]
            </div>
        </Show>
    </div>;
}