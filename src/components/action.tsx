import { createSignal, For, JSX } from "solid-js";
import { link_styles_v, renderAction } from "../app";
import type * as Generic from "../types/generic";
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
    const [showingCode, setShowingCode] = createSignal<null | Generic.Body>(null);
    const [replyWindowOpen, setReplyWindowOpen] = createSignal<Generic.ReplyAction | null>(null);

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
        >{(reply_action) => {

            return <>
                <button
                    class={link_styles_v[
                        replyWindowOpen() === reply_action ? "action-button-active" : "action-button"
                    ]}
                    disabled={replyWindowOpen() != null}
                    on:click={() => {
                        if(replyWindowOpen() != null) {
                            setReplyWindowOpen(null);
                        }else{
                            setReplyWindowOpen(reply_action);
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
        <button
            class={link_styles_v[
                props.content.actions?.code?.body != null ? showingCode() === props.content.actions?.code?.body
                ? "action-button-active" : "action-button" : "code-button"
            ]}
            on:click={() => {
                console.log(props.opts.frame);
                setShowingCode(c => c == null ? props.content?.actions?.code?.body ?? null : null);
            }}
        >Code</button>
    </div><ShowCond when={showingCode()}>{code => (
        <Body body={code} autoplay={true} />
    )}</ShowCond><ShowCond when={replyWindowOpen()}>{reply_editor => (
        <ReplyEditor
            action={reply_editor} 
            onCancel={() => setReplyWindowOpen(null)}
            onAddReply={() => {
                setReplyWindowOpen(null);
                // TODO show the reply in the tree
            }}
        />
    )}</ShowCond></>;
}

export function Action(props: {action: Generic.Action}): JSX.Element {
    return <SolidToVanillaBoundary getValue={(hsc, client) => {
        const span = el("span");
        renderAction(client(), props.action, span, {value_for_code_btn: 0}).defer(hsc);
        return span;
    }} />;
}