import { createSignal, For, JSX } from "solid-js";
import { link_styles_v, renderAction } from "../app";
import type * as Generic from "api-types-generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { ShowCond } from "../util/utils_solid";
import { Body } from "./body";
import { Counter } from "./counter";
import { LinkButton } from "./links";
import type { ClientPostProps } from "./page2";
import { ReplyEditor } from "./reply";

export function PostActions(props: ClientPostProps & {
    children?: JSX.Element,
}): JSX.Element {
    const [showingWindowBelow, setShowingWindowBelow] = createSignal<null | (() => JSX.Element)>(null);

    return <><div class="flex flex-wrap gap-2 items-center">
        {props.children}
        <ShowCond when={props.opts.frame?.url}>{url => (
            <LinkButton href={url} style="action-button">
                <ShowCond when={props.content.info?.comments} fallback={"View"}>{num_comments => (
                    num_comments.toLocaleString() + " comment"+(
                        num_comments === 1 ? "" : "s"
                    )
                )}</ShowCond>
            </LinkButton>
        )}</ShowCond>
        <ShowCond when={props.content.actions?.vote}>{vote => (
            <Counter counter={vote} />
        )}</ShowCond>
        <ShowCond
            if={[props.content.show_replies_when_below_pivot]}
            when={props.opts.replies?.reply}
        >{reply_action => {
            const action = () => <ReplyEditor
                action={reply_action} 
                onCancel={() => setShowingWindowBelow(null)}
                onAddReply={() => {
                    setShowingWindowBelow(null);
                    // TODO show the reply in the tree
                }}
            />;
            return <>
                <button
                    class={link_styles_v[
                        showingWindowBelow() === action ? "action-button-active" : "action-button"
                    ]}
                    on:click={() => {
                        if(showingWindowBelow() === action) {
                            setShowingWindowBelow(null);
                        }else{
                            setShowingWindowBelow(() => action);
                        }
                    }}
                >{reply_action.text}</button>
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
                on:click={() => {
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
                on:click={() => {
                    console.log(props.opts.frame);
                    if(showingWindowBelow() === action) {
                        setShowingWindowBelow(null);
                    }else{
                        setShowingWindowBelow(() => action);
                    }
                }}
            >Code</button>;
        }}</ShowCond>
    </div><ShowCond when={showingWindowBelow()}>{windowBelow => (
        windowBelow()
    )}</ShowCond></>;
}

export function Action(props: {action: Generic.Action}): JSX.Element {
    return <SolidToVanillaBoundary getValue={(hsc, client) => {
        const span = el("span");
        renderAction(client(), props.action, span, {value_for_code_btn: 0}).defer(hsc);
        return span;
    }} />;
}