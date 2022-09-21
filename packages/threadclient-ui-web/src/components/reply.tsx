import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { createSignal, JSX } from "solid-js";
import { createMergeMemo, Show } from "tmeta-util-solid";
import { getClientCached } from "../clients";
import { getSettings, localStorageSignal } from "../util/utils_solid";
import { ClientContent, CrosspostWrapper } from "./page2";

// ok the dream for replies is to have a comment appear where you edit the actual body and it
// previews below or on the right or something
//
// shouldn't be *too* difficult
//
// same for edit but in the comment you're editing
// so reply should basically make a new comment and mark it as being edited

export default function ReplyEditor(props: {
    action: Generic.ReplyAction,
    onCancel: () => void,
    onAddReply: (response: Generic.Post) => void,
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
        const signature = settings.signature();
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

    const sendReply = () => {
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
                    collapsible: false,
                },

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
    };
    const cancelReply = () => {
        props.onCancel();
    };

    return <div>
        <textarea
            class="
                block w-full rounded-none rounded-t-lg resize-y
                bg-transparent border-2 border-b-0 border-slate-200 dark:border-zinc-700 p-2
            "
            rows={4}
            disabled={isSending()}
            value={baseContent() ?? ""}
            onInput={(e) => {
                setBaseContent(e.currentTarget.value);
            }}
        />
        <div class="bg-slate-200 dark:bg-zinc-700 rounded-b-lg p-2 flex flex-col gap-2">
            <Show if={!!settings.signature().trim()}>
                <label>
                    <input type="checkbox" checked={showSignature()} onInput={nv => {
                        setShowSignature(nv.currentTarget.checked);
                    }} />
                    {" "}Show my signature on this post
                </label>
            </Show>
            <div class="flex flex-wrap gap-2">
                <button
                    class={(empty() ? "bg-slate-400 dark:bg-zinc-100" : "bg-blue-400")
                    + " rounded-md text-slate-900 py-1 px-3"}
                    disabled={empty() || isSending()}
                    onClick={sendReply}
                >Reply</button>
                <button
                    onClick={cancelReply}
                    disabled={isSending()}
                >Cancel</button>
            </div>
        </div>
        <Show when={sendError()}>{errv => <>
            <pre class="error"><code>There was an error! {errv}</code></pre>
            <button onclick={() => setSendError(undefined)}>Hide error</button>
        </>}</Show>
        <Show if={!empty()} when={diffable.data}>{value => {
            console.log("Value changed", value);
            return <CrosspostWrapper>
                <ClientContent content={value} opts={{
                    frame: null,
                    client_id: props.action.client_id,
                    flat_frame: null,
                    id: null,
                }}/>
            </CrosspostWrapper>;
        }}</Show>
    </div>;
}