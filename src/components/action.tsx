import type { JSX } from "solid-js";
import {
    Accessor, For, Setter
} from "solid-js";
import { renderAction } from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { ShowCond } from "../util/utils_solid";
import { Counter } from "./counter";
import { LinkButton } from "./links";
import type { ClientPostProps } from "./page2";

export function PostActions(props: ClientPostProps & {
    replyWindowOpen: [Accessor<Generic.ReplyAction | null>, Setter<Generic.ReplyAction | null>],
    children?: JSX.Element,
}): JSX.Element {
    return <><span class="flex flex-wrap gap-2 items-center">
        {props.children}
        <button on:click={() => {
            console.log(props.content, props.opts);
        }}>Code</button>
        <ShowCond when={props.content.actions?.vote}>{vote => (
            <Counter counter={vote} />
        )}</ShowCond>
        <ShowCond when={props.opts.frame?.url}>{url => (
            <LinkButton href={url} style="action-button">View</LinkButton>
        )}</ShowCond>
        <ShowCond
            if={[props.content.show_replies_when_below_pivot]}
            when={props.opts.replies?.reply}
        >{(reply_action) => {

            return <>
                <button disabled={props.replyWindowOpen[0]() != null} on:click={() => {
                    props.replyWindowOpen[1](reply_action);
                }}>{reply_action.text}</button>
            </>;
        }}</ShowCond>
        <ShowCond when={props.content.actions?.other}>{other_actions => <>
            <For each={other_actions}>{(item, i) => <>
                <Action action={item} />
            </>}</For>
        </>}</ShowCond>
    </span></>;
}

export function Action(props: {action: Generic.Action}): JSX.Element {
    return <SolidToVanillaBoundary getValue={(hsc, client) => {
        const span = el("span");
        renderAction(client(), props.action, span, {value_for_code_btn: 0}).defer(hsc);
        return span;
    }} />;
}