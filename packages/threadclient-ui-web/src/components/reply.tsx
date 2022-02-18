import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { createEffect, createSignal, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { getClientCached, link_styles_v } from "../app";
import { getSettings, localStorageSignal } from "../util/utils_solid";
import { createMergeMemo } from "./createMergeMemo";
import { ClientContent, TopLevelWrapper } from "./page2";

export default function ReplyEditor(props: {
    action: Generic.ReplyAction,
    onCancel: () => void,
    onAddReply: (response: Generic.PostData) => void,
}): JSX.Element {
    const settings = getSettings();
    const [baseContent, setBaseContent] = localStorageSignal(
        "comment-draft-"+props.action.client_id+"-"+props.action.key,
        // TODO indexeddb so we can query all the drafts and stuff
        // and keep a link to the post to show if you want to continue a draft
    );
    const [showSignature, setShowSignature] = createSignal(true);
    const content = () => {
        const v = baseContent() ?? "";
        const signature = settings.signature.value();
        if(showSignature() && signature.trim()) {
            return v + (v.trim() ? "\n\n" : "") + signature;
        }
        return v;
    };
    const empty = () => content().trim() === "";

    const [isSending, setSending] = createSignal(false);
    const [sendError, setSendError] = createSignal<string | undefined>(undefined);

    const diffable = createMergeMemo((): Generic.PostContent => {
        const client = getClientCached(props.action.client_id);
        return client!.previewReply!(content(), props.action.reply_info);
    }, {key: null, merge: true});

    return <div>
        <textarea
            disabled={isSending()}
            class="border my-3 w-full resize-y"
            value={baseContent() ?? ""}
            onInput={(e) => {
                setBaseContent(e.currentTarget.value);
            }}
        />
        <Show if={!!settings.signature.value().trim()}>
            <label class="my-3">
                <input type="checkbox" checked={showSignature()} onInput={nv => {
                    setShowSignature(nv.currentTarget.checked);
                }} />
                {" "}Show my signature on this post
            </label>
        </Show>
        <div class="flex space-x-1 my-3">
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
                        setBaseContent(null); // trust that the response is succesful
                        props.onAddReply({
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
        <Show when={sendError()}>{errv => <>
            <pre class="error"><code>There was an error! {errv}</code></pre>
            <button onclick={() => setSendError(undefined)}>Hide error</button>
        </>}</Show>
        <Show if={!empty()} when={diffable.data}>{value => {
            console.log("Value changed", value);
            return <TopLevelWrapper restrict_w>
                <ClientContent listing={value} opts={{
                    clickable: false,
                    replies: null,
                    at_or_above_pivot: true,
                    is_pivot: true,
                    frame: null,
                    client_id: props.action.client_id,
                }}/>
            </TopLevelWrapper>;
        }}</Show>
    </div>;
}