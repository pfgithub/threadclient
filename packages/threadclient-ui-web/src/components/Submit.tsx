import * as Generic from "api-types-generic";
import { StoreViewer } from "jsoneditor/src/JsonViewer";
import { anBool, AnNode, anSetReconcile, anString, createAppData } from "jsoneditor";
import { createMemo, createSignal, For, JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { Flair } from "./Flair";
import { ClientPostOpts } from "./Post";
import ToggleButton from "./ToggleButton";
import Clickable from "./Clickable";
import { Body } from "./body";
import { getSettings } from "../util/utils_solid";

/*
!BEFORE RELEASE:
- cache the node in localstorage like reply.tsx does
  "commentv2-draft-"+props.opts.id,
- either support signatures or remove signatures

!NEXT STEPS:
- make it possible to submit a post
  - put a submit button on this. it calls an act function defined in the Generic.Submit.SubmitPost thing
*/

export default function Submit(props: {
    submit: Generic.Submit.SubmitPost,
    opts: ClientPostOpts,
}): JSX.Element {
    // the alternative is storing data in links in content itself
    // that's probably not a good idea
    // (or using a real state manager. that might be agood idea)
    const node = createAppData<Generic.SubmitResult.SubmitPost>();
    // also we can add undo/redo buttons which is kind of fun
    // woah I can use DraggableList when I support poll posts
    // - will have to do some stuff to make the css work

    const settings = getSettings();

    return <div>
        <For each={props.submit.fields}>{(field, i) => <>
            <div>
                <Show if={i() !== 0}>
                    <div class="mt-4" />
                </Show>
                <SubmitField node={node.fields[field.id]!} field={field} />
            </div>
        </>}</For>
        <Show if={settings.dev.showLogButtons() === "on"}>
            dev info:
            <StoreViewer node={node as unknown as AnNode<unknown>} autoexpand />
        </Show>
    </div>;
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
                        <label class="select-none">
                            <input type="checkbox" value={theflair.id} name={groupid} checked={anBool(props.node.flair_many[theflair.id]!) ?? false} onInput={e => {
                                anSetReconcile(props.node.flair_many[theflair.id]!, () => e.currentTarget.checked);
                            }} />
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