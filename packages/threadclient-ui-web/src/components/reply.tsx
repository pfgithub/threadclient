import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import {
    createEffect, createSignal, JSX
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { ShowCond } from "tmeta-util-solid";
import { getClientCached, link_styles_v } from "../app";
import { localStorageSignal } from "../util/utils_solid";
import { ClientContent, TopLevelWrapper } from "./page2";

type StoreTypeValue = {value: null | Generic.PostContent};
export function ReplyEditor(props: {
    action: Generic.ReplyAction,
    onCancel: () => void,
    onAddReply: (response: Generic.Link<Generic.Post>) => void,
}): JSX.Element {
    const [rawContent, setContent] = localStorageSignal("comment-draft-"+props.action.client_id+"-"+props.action.key);
    const content = () => rawContent() ?? "";
    const empty = () => content().trim() === "";

    const [isSending, setSending] = createSignal(false);
    const [sendError, setSendError] = createSignal<string | undefined>(undefined);

    const [diffable, setDiffable] = createStore<StoreTypeValue>({value: null});
    createEffect(() => {
        const client = getClientCached(props.action.client_id);
        const resv: Generic.PostContent = client!.previewReply!(content(), props.action.reply_info);
        setDiffable(reconcile<StoreTypeValue>({value: resv}, {merge: true}));
        // this does well but unfortunately it doesn't know what to use as keys for lists and it can't really know
        // because it's text → (opaque parser) → richtext
        // there's no way to set a custom key function so idk how to do a heuristic for this. a heuristic would be
        // matching links or stateful components idk
    });

    return <div>
        <textarea disabled={isSending()} class="border my-3 w-full resize-y" value={content()} onInput={(e) => {
            setContent(e.currentTarget.value);
        }} />
        <div class="flex space-x-1">
            <button
                disabled={empty() || isSending()}
                class={link_styles_v[empty() ? "pill-empty" : "pill-filled"]}
                onClick={(e) => {
                    setSending(true);

                    const client = getClientCached(props.action.client_id);
                    client!.sendReply!(content(), props.action.reply_info, props.action.mode).then((r) => {
                        console.log("Got response", r);
                        // TODO:
                        // so, this is a terrible idea,
                        // but what if onAddReply sent the .boundingClientRect of the TopLevelWrapper preview
                        // so it could like animate the newly added reply into position
                        // terrible idea, but like…
                        // it could be fun
                        // might not look good
                        setContent(null); // trust that the response is succesful
                        props.onAddReply({
                            ref: {
                                kind: "post",
                                internal_data: r.raw_value,
                                content: r.kind === "thread" ? {
                                    kind: "legacy",
                                    thread: r,
                                    client_id: props.action.client_id,
                                } : {
                                    kind: "post",
                                    title: {text: "Error"},
                                    body: {kind: "richtext", content: [
                                        rt.p(rt.error("Unsupported 'load more'", r)),
                                    ]},
                                    show_replies_when_below_pivot: false,
                                    collapsible: false,
                                },
                                display_style: "centered",

                                parent: null,
                                replies: null,
                                url: null,
                                client_id: props.action.client_id,
                            },
                        });
                    }).catch((error) => {
                        setSending(false);
                        const err = error as Error;
                        console.log("Got error", err);
                        setSendError(err.toString() + "\n" + err.stack);
                    });
                }}
            >{isSending() ? "…" : props.action.text}</button>
            <button disabled={isSending()} class={link_styles_v["pill-empty"]} onClick={(e) => {
                props.onCancel();
            }}>Cancel<div /></button>
        </div>
        <ShowCond when={sendError()}>{errv => <>
            <pre class="error"><code>There was an error! {errv}</code></pre>
            <button onclick={() => setSendError(undefined)}>Hide error</button>
        </>}</ShowCond>
        <ShowCond if={[!empty()]} when={diffable.value}>{value => {
            console.log("Value changed", value);
            return <TopLevelWrapper restrict_w>
                <ClientContent listing={value} opts={{
                    clickable: false,
                    replies: null,
                    at_or_above_pivot: true,
                    is_pivot: true,
                    top_level: true,
                    frame: null,
                    client_id: props.action.client_id,
                }}/>
            </TopLevelWrapper>;
        }}</ShowCond>
    </div>;
}