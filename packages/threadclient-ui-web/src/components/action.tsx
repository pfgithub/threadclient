import type * as Generic from "api-types-generic";
import { createSignal, For, JSX } from "solid-js";
import { ShowCond } from "tmeta-util-solid";
import { link_styles_v, renderAction } from "../app";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { size_lt } from "../util/utils_solid";
import { Body } from "./body";
import { Counter } from "./counter";
import { LinkButton } from "./links";
import type { ClientPostProps } from "./page2";
import { ReplyEditor } from "./reply";

// TODO
// function postActions(): PostAction[]
//
// that way we can have both button actions and actions as a dropdown

export function PostActions(props: ClientPostProps & {
    children?: undefined | JSX.Element,
    onAddReply: (reply: Generic.Post) => void,
}): JSX.Element {
    const [showingWindowBelow, setShowingWindowBelow] = createSignal<null | (() => JSX.Element)>(null);

    const mobile = size_lt.sm;

    return <><section class={"flex flex-wrap gap-2 "+(mobile() ? "flex-col" : "items-center")}>
        {props.children}
        <ShowCond when={props.opts.frame?.url}>{url => (
            <LinkButton client_id={props.opts.client_id} href={url} style="action-button">
                <ShowCond when={props.content.info?.comments} fallback={"Focus"}>{num_comments => (
                    num_comments.toLocaleString() + " comment"+(
                        num_comments === 1 ? "" : "s"
                    )
                )}</ShowCond>
            </LinkButton>
        )}</ShowCond>
        <ShowCond if={[props.content.collapsible === false]} when={props.content.actions?.vote}>{vote => (
            <Counter counter={vote} />
        )}</ShowCond>
        <ShowCond
            if={[props.content.show_replies_when_below_pivot && !props.opts.at_or_above_pivot]}
            when={props.opts.frame?.replies?.reply}
        >{reply_action => {
            const action = () => <ReplyEditor
                action={reply_action.action} 
                onCancel={() => setShowingWindowBelow(null)}
                onAddReply={reply => {
                    props.onAddReply(reply);
                    setShowingWindowBelow(null);
                }}
            />;
            return <>
                <button
                    class={link_styles_v[
                        showingWindowBelow() === action ? "action-button-active" : "action-button"
                    ]}
                    disabled={reply_action.locked}
                    onclick={() => {
                        if(showingWindowBelow() === action) {
                            setShowingWindowBelow(null);
                        }else{
                            setShowingWindowBelow(() => action);
                        }
                    }}
                >{reply_action.action.text + (reply_action.locked ? " (Locked)" : "")}</button>
            </>;
        }}</ShowCond>
        <ShowCond when={props.content.actions?.other}>{other_actions => <>
            <For each={other_actions}>{(item, i) => <>
                <Action action={item} />
            </>}</For>
        </>}</ShowCond>
        <ShowCond when={props.content?.actions?.code?.body} fallback={
            <button
                class={link_styles_v["code-button"]}
                onclick={() => {
                    console.log(props.opts.frame);
                }}
            >Code</button>
        }>{code_action => {
            const action = () => <Body body={code_action} autoplay={true} />;
            return <button
                class={link_styles_v[
                    showingWindowBelow() === action
                    ? "action-button-active" : "action-button"
                ]}
                onclick={() => {
                    console.log(props.opts.frame);
                    if(showingWindowBelow() === action) {
                        setShowingWindowBelow(null);
                    }else{
                        setShowingWindowBelow(() => action);
                    }
                }}
            >Code</button>;
        }}</ShowCond>
    </section><ShowCond when={showingWindowBelow()}>{windowBelow => (
        windowBelow()
    )}</ShowCond></>;
}

export function Action(props: {action: Generic.Action}): JSX.Element {
    return <SolidToVanillaBoundary getValue={hsc => {
        const span = el("span");
        renderAction(props.action, span, {value_for_code_btn: 0}).defer(hsc);
        return span;
    }} />;
}