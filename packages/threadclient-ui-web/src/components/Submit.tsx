import * as Generic from "api-types-generic";
import { anBool, anJson, AnNode, anSetReconcile, anString, createAppData } from "jsoneditor";
import { createMemo, createSignal, For, JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { fetchClient } from "../clients";
import { getSettings } from "../util/utils_solid";
import { Body } from "./body";
import Clickable from "./Clickable";
import { Flair } from "./Flair";
import { InternalIconRaw } from "./Icon";
import { ClientPostOpts } from "./Post";
import ToggleButton from "./ToggleButton";

/*
!TODO:
- cache the node in localstorage like reply.tsx does
  "commentv2-draft-"+props.submit.client_id + props.opts.id,
  // note: if props.opts.id is not a string, display a warning 'a draft will not be saved'
- either support signatures or remove signatures
*/

export default function Submit(props: {
    submit: Generic.Submit.SubmitPost,
    opts: ClientPostOpts,
    cancel_enabled?: undefined | (() => void),
}): JSX.Element {
    // the alternative is storing data in links in content itself
    // that's probably not a good idea
    // (or using a real state manager. that might be agood idea)
    const node = createAppData<Generic.SubmitResult.SubmitPost>();
    // also we can add undo/redo buttons which is kind of fun
    // woah I can use DraggableList when I support poll posts
    // - will have to do some stuff to make the css work

    const settings = getSettings();

    const [validated, setValidated] = createSignal(true); // TODO clientside validation
    () => setValidated; // and even we can mix in serverside validation onchange for fields

    const [sendState, setSendState] = createSignal<{
        kind: "none",
        error: null | string,
    } | {
        kind: "sending",
    } | {
        kind: "sent",
        url: string,
    }>({kind: "none", error: null});

    const sendReplyAsync = async () => {
        const client = await fetchClient(props.submit.client_id);
        if(!client) throw new Error("no client");
        if(!client.submit) throw new Error("client does not support submitting posts");
        // vv instead of using anJson, maybe use a serialization fn
        const res = await client.submit(
            props.submit.submit_key, anJson(node) as unknown as Generic.SubmitResult.SubmitPost
        );
        return res;
        // // - add the new content
        // // - if the submit node is the pivot, navigate to the new node
        // // - otherwise, TODO figure out what to do
        // setLoading(false);
        // setError(null);
        // console.log("adding content", r.content, props.loader_or_post);
        // hprc.addContent(pgin, r.content);
    };
    const sendReply = () => {
        setSendState({kind: "sending"});
        sendReplyAsync().then((url) => {
            // ✓ OK
            setSendState({kind: "sent", url});
        }).catch(e => {
            setTimeout(() => {
                setSendState({kind: "none", error: (e as Error).toString()});
            }, 200);
        });
    };

    return <div>
        <SwitchKind item={sendState()} children={{
            none: none => <>
                <h1 class="mb-4">
                    {props.submit.title} | Warning: if you navigate away, you will lose any entered text |
                    Post submission is also currently{" "}
                    <Clickable
                        action={{client_id: "", url: "https://github.com/pfgithub/threadclient/issues/7"}}
                        class="text-blue-600 dark:text-blue-400 underline"
                    >missing some features</Clickable>.
                </h1>
                <Show when={none.error}>{emsg => <>
                    <p class="text-red-500 mb-4">{emsg}</p>
                </>}</Show>
                <For each={props.submit.fields}>{(field, i) => <>
                    <div>
                        <SubmitField node={node.fields[field.id]!} field={field} />
                        <div class="mb-4" />
                    </div>
                </>}</For>
                <div class="flex flex-wrap gap-4">
                    <button
                        class={(!validated() ? "bg-slate-400 dark:bg-zinc-100" : "bg-blue-400")
                        + " rounded-md text-slate-900 py-1 px-3"}
                        disabled={!validated()}
                        onClick={sendReply}
                    >{props.submit.send_name}</button>
                    {props.cancel_enabled ? <button
                        onClick={props.cancel_enabled}
                    >Cancel</button> : null}
                    {settings.dev.showLogButtons() === "on" ? <button
                        onClick={() => console.log(anJson(node))}
                        disabled={false}
                    >Code</button> : null}
                </div>
            </>,
            sending: () => <>
                Submitting…
                {" "}<InternalIconRaw class="fa-solid fa-spinner animate-spin" label="spinner" />
            </>,
            sent: sent => <Body body={{kind: "richtext", content: [
                Generic.rt.p(
                    Generic.rt.txt("Submitted! "),
                    Generic.rt.link({id: props.submit.client_id}, sent.url, {},
                        Generic.rt.txt(sent.url),
                    ),
                ),
            ]}} autoplay={false} />,
        }} />
    </div>;
    /*
            <StoreViewer node={node as unknown as AnNode<unknown>} autoexpand />
    */
}

function contentTypeName(content_type: Generic.Submit.ContentType): string {
    if(content_type.kind === "link") return "Link";
    if(content_type.kind === "text") return "Text";
    if(content_type.kind === "none") return "None";
    if(content_type.kind === "todo") return content_type.title;
    return "todo["+(content_type as Generic.Submit.ContentType).kind+"]";
}

/*
function radiofix(group: string) {
    return (rbtn: HTMLInputElement) => {
        if(rbtn.type === "radio") {
            rbtn.addEventListener("click", e => {
                // https://stackoverflow.com/questions/4957207/how-to-check-uncheck-radio-button-on-click
                // eventually I'll probably want to make a custom radio button and make sure it's accessible with
                // screenreaders and stuff
                const classname = "+rsel:"+group;
                if(rbtn.classList.contains(classname)) {
                    rbtn.checked = false;
                }
                Array.from(document.getElementsByClassName(classname)).forEach(v => {
                    v.classList.remove(classname);
                });
                if(rbtn.checked) {
                    rbtn.classList.add(classname);
                }
            });
        }
    };
}
*/

let gid = 0;
function SubmitField(props: {
    node: AnNode<undefined | Generic.SubmitResult.Field>,
    field: Generic.Submit.Field,
}): JSX.Element {
    const groupid = "" +(gid++);
    return <div>
        <SwitchKind item={props.field} children={{
            title: () => <div>
                <label>
                    <div class="sr-only">Title</div>
                    <input
                        class="w-full bg-slate-300 dark:bg-zinc-900 text-xl font-black p-2 placeholder-slate-600 dark:placeholder-zinc-400 placeholder:font-normal"
                        placeholder="Title"
                        value={anString(props.node.title) ?? ""}
                        onInput={e => {
                            anSetReconcile(props.node.title, () => e.currentTarget.value);
                        }}
                    />
                </label>
            </div>,
            content: content => <div>
                <SubmitContent
                    default_id={content.default_id}
                    node={props.node.content}
                    content_types={content.content_types}
                />
            </div>,
            flair_one: flair => <div>
                <ul class="flex flex-wrap flex-row gap-4">
                    <label class="select-none">
                        <input type="radio" name={groupid} checked={anString(props.node.flair_one) == null} onInput={e => {
                            if(e.currentTarget.checked) anSetReconcile(props.node.flair_one, () => null);
                        }} />
                        {" (no flair)"}
                    </label>
                    <For each={flair.flairs}>{theflair => <li>
                        <label>
                            <input type="radio" name={groupid} checked={anString(props.node.flair_one) === theflair.id} onInput={e => {
                                if(e.currentTarget.checked) anSetReconcile(props.node.flair_one, () => theflair.id);
                            }} />
                            {" "}
                            <Flair flairs={theflair.flairs} />
                        </label>
                    </li>}</For>
                </ul>
            </div>,
            flair_many: flair => <div>
                <ul class="flex flex-wrap flex-row gap-4">
                    <For each={flair.flairs}>{theflair => <li>
                        <label class="select-none" title={theflair.disabled != null ? theflair.disabled : undefined}>
                            <input type="checkbox" value={theflair.id} name={groupid} checked={anBool(props.node.flair_many[theflair.id]!) ?? false} onInput={e => {
                                anSetReconcile(props.node.flair_many[theflair.id]!, () => e.currentTarget.checked);
                            }} disabled={theflair.disabled != null ? true : false} />
                            {" "}
                            <Flair flairs={theflair.flairs} />
                        </label>
                    </li>}</For>
                </ul>
            </div>,
        }} />
    </div>;
}

function SubmitContent(props: {
    node: AnNode<undefined | Generic.SubmitResult.Content>,
    default_id: string,
    content_types: Generic.Submit.ContentType[],
}): JSX.Element {
    const tabv = () => anString(props.node.tab) ?? props.default_id;
    const cv = createMemo((): null | {
        node: AnNode<undefined | Generic.SubmitResult.OneContent>,
        ct: Generic.Submit.ContentType,
    } => {
        const tab = tabv();
        const v = props.content_types.find(q => q.id === tab);
        if(v == null) return null;
        return {
            node: props.node.choices[tab]!,
            ct: v,
        };
    });
    return <div>
        <div class="flex flex-row flex-wrap"><ToggleButton
            value={tabv()}
            setValue={nv => anSetReconcile(props.node.tab, () => nv)}
            choices={props.content_types.map(ct => [
                ct.id,
                contentTypeName(ct),
            ])}
        /></div>
        <Show when={cv()} fallback={<>error: no tab selected</>}>{scv => (
            <Show when={scv.ct.disabled} fallback={
                <SubmitOneContent node={scv.node} content={scv.ct} />
            }>{disabled_reason => <div>
                {disabled_reason}
            </div>}</Show>
        )}</Show>
    </div>;
}

function SubmitOneContent(props: {
    node: AnNode<undefined | Generic.SubmitResult.OneContent>,
    content: Generic.Submit.ContentType,
}): JSX.Element {
    const [editpreview, setEditpreview] = createSignal<"edit" | "preview">("edit");

    return <SwitchKind item={props.content} children={{
        text: txtv => <div class="pt-2">
            <div class="bg-slate-400 dark:bg-zinc-700 rounded-t-lg p-1 pb-0 flex flex-row flex-wrap gap-2">
                <ToggleButton<"edit" | "preview">
                    value={editpreview()}
                    setValue={nv => setEditpreview(() => nv ?? "edit")}
                    choices={[
                        ["edit", "Edit"],
                        ["preview", "Preview"],
                    ]}
                />
            </div>
            <Show if={editpreview() === "edit"}>
                <textarea
                    class="
                        block w-full rounded-none rounded-bl-lg resize-y
                        placeholder-slate-600 dark:placeholder-zinc-400
                        bg-slate-300 dark:bg-zinc-900 p-2
                    "
                    placeholder={textplaceholder(txtv)}
                    rows={4}
                    value={anString(props.node.text) ?? ""}
                    onInput={(e) => {
                        anSetReconcile(props.node.text, () => e.currentTarget.value);
                    }}
                />
            </Show>
            <Show if={editpreview() === "preview"}>
                <div class="
                    block w-full rounded-none rounded-b-lg
                    bg-transparent border-2 border-slate-200 dark:border-zinc-700 p-2
                ">
                    <PreviewText textcontent={txtv} value={anString(props.node.text) ?? ""} />
                </div>
            </Show>
        </div>,
        link: link => <div class="pt-2">
            <label>
                <div class="sr-only">URL</div>
                <input
                    class="w-full bg-slate-300 dark:bg-zinc-900 p-2 placeholder-slate-600 dark:placeholder-zinc-400"
                    placeholder="https://…"
                    value={anString(props.node.link) ?? ""}
                    onInput={e => {
                        anSetReconcile(props.node.link, () => e.currentTarget.value);
                    }}
                />
            </label>
        </div>,
        todo: todo => <div>
            <div>{todo.reason}</div>
            <Clickable class="text-blue-600 dark:text-blue-400 underline" action={{
                url: todo.linkout,
                client_id: todo.client_id,
            }}>
                {todo.linkout_label}
            </Clickable>
        </div>,
        none: () => <div></div>,
    }} />;
}

function textplaceholder(txtv: Generic.Submit.TextContentType): string {
    if(txtv.mode === "reddit") return "Content. You can use markdown, *like this*.";
    if(txtv.mode === "none") return "Content.";
    return "Content. «"+txtv.mode+"»";
}

function PreviewText(props: {
    value: string,
    textcontent: Generic.Submit.TextContentType,
}): JSX.Element {
    return <div>
        <Body body={{
            kind: "text",
            content: props.value,
            markdown_format: props.textcontent.mode,
            client_id: props.textcontent.client_id,
        }} autoplay={false} />
    </div>;
}