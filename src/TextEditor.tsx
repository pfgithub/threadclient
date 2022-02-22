import { createEffect, createSignal, For, Show } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Dynamic } from "solid-js/web";
import { Button } from "./components";
import { modValue, Path } from "./editor_data";
import { RichtextSchema } from "./schema";
import { uuid, UUID } from "./uuid";

const keyed_by = Symbol();

// this will be user provided eventually
// just doing it like this for now because it will be easier to get started

// actually we should probably make it user provided now I think

export type TextEditorRootNode = {
    kind: "root",
    children: {[key: UUID]: TextEditorParagraphNode};
    // ^ right, we didn't want this because we want the manager to be able to handle this
    // I think we can actually use real dom nodes though
    // eg we can have <Leaf> and <EditorSelectable ondelete={}>
    // that should work alright
};

export type TextEditorParagraphNode = {
    kind: "paragraph",
    children: {[key: UUID]: TextEditorLeafNode};
} | {
    kind: "multiline_code_block",
    language: string,
    text: string,
};

export type TextEditorLeafNode = {
    kind: "text",
    text: string,
    style?: undefined | {bold?: undefined | boolean},
} | {
    kind: "inline_code",
    text: string,
};

// so we'll have a function Leaf that is a text editor
// gives you basic functions and you can put it where you need it to edit text

const node_renderers: {[key: string]: (props: {path: Path}) => JSX.Element} = {
    root(props): JSX.Element {
        return <div class="space-y-2">
            <EditorChildren path={[...props.path, "children"]} />
        </div>;
    },
    paragraph(props): JSX.Element {
        return <p>
            <EditorChildren path={[...props.path, "children"]} />
        </p>;
    },
    multiline_code_block(props): JSX.Element {
        return <pre class="bg-gray-800 p-2 rounded-md whitespace-pre-wrap"><code>
            <Leaf path={[...props.path, "text"]} />
        </code></pre>;
    },
    text(props): JSX.Element {
        const [value, setValue] = modValue(() => props.path);
        return <span class={(() => {
            const v = value();
            if(v == null || typeof v !== "object") return "";
            const style = v["style"];
            if(style == null || typeof style !== "object") return "";

            let styles: string[] = [];
            if(style["bold"]) styles.push("font-bold");

            return styles.join(" ");
        })()}><Leaf path={[...props.path, "text"]} /></span>;
    },
    inline_code(props): JSX.Element {
        return <code class="bg-gray-800 p-1 rounded-md"><Leaf path={[...props.path, "text"]} /></code>;
    },
};

// class EditorSpanElement extends HTMLElement {
//     constructor() {
//         super();
//     }
// }
// customElements.define("editor-span", EditorSpanElement);
//
// ^ no hmr and the workaround is complicated
// https://stackoverflow.com/questions/47805288/modifying-a-custom-element-class-after-its-been-defined
//
// this is not necessary, I can just use attributes

export function EditorSpan(props: {
    children: JSX.Element,
    // ^ children: (props: {
    //     get selection: [start: CursorIndex | null, end: CursorIndex | null],
    //     onSelect: (start: index | null, end: index | null) => void
    //     - use selectionChange events combined with document.getSelection().focusOffset
    //       - we might do our own selectionChange event delegation to avoid overhead and
    //         properly handle whatever it is
    //   }) = > JSX.Element,
    //   length: number,
    //   node_path: Path,

    // this will hold events.
    //
    // moveCursor(pos: CursorIndex): CursorIndex | Progress
    // eg: given a cursor position and a direction, find a new cursor position
    //     by moving n chars in direction / moving to the nearest word border.
    //     if it's not in the node, we have to return how far left to go.
    //
    // replaceRange(left: CursorIndex, right: CursorIndex, value: string)
    //
    // split(point: CursorIndex)
    //
    // ime stuff:
    // - fetchSurrounding
    // - 
    // screenreader stuff:
    // - idk yet
    //
    // hmm maybe lots of this isn't right
    // a bunch of this should be done top-down to the nodes directly I think
    //
    // yeah this should be top-down
}): JSX.Element {
    return <Dynamic component="bce:editor-node">{props.children}</Dynamic>;
}

export function Leaf(props: {
    path: Path, // Path<string>
}): JSX.Element {
    // TODO the returned node will have information in it to allow for handling
    // left arrow, right arrow, select, …

    const [value, setValue] = modValue(() => props.path);
    const [editing, setEditing] = createSignal(false);
    return <EditorSpan><Show when={editing()} fallback={<>
        <span onClick={() => setEditing(true)}>{(() => {
            const v = value();
            if(typeof v !== "string") return "";
            return v;
        })()}</span>
    </>}><textarea
        class="bg-transparent w-full"
        rows={5}
        value={(() => {
            const v = value();
            if(typeof v !== "string") return "";
            return v;
        })()}
        onInput={e => setValue(() => e.currentTarget.value)}
        onBlur={() => setEditing(false)}
        ref={v => createEffect(() => v.focus())}

        // data-editor-leaf-node={…}
    /></Show></EditorSpan>;
    // return <EditorSelectable …automatic stuff />
}

export function EditorChildren(props: {
    path: Path, // Path<{[key: UUID]: TextEditorNode}>
}): JSX.Element {
    const [value, setValue] = modValue(() => props.path);

    return <For each={Object.keys(value())}>{key => {
        return <EditorNode path={[...props.path, key]} />;
    }}</For>;
}

export function EditorNode(props: {
    path: Path, // Path<TextEditorNode>
}): JSX.Element {
    const [value, setValue] = modValue(() => props.path);
    const nodeKind = (): null | string => {
        const v = value();
        if(v == null || typeof v !== "object") return null;
        const k = value()["kind"];
        if(k == null || typeof k !== "string") return null;
        return k;
    };
    return <Dynamic component={node_renderers[nodeKind()] ?? ((props: {path: Path}) => (
        <div class="text-red-500">E_NOT_FOUND {nodeKind()}</div>
    ))} path={props.path} />
}

/*

REDUCERS:

(a, b) => a == leaf && b == leaf && opts the same => return joined(a, b)

*/

export function RichtextEditor(props: {
    schema: RichtextSchema,
    path: Path,
}): JSX.Element {
    const [value, setValue] = modValue(() => props.path);

    // this stylinng can probably be provided by the root node
    return <div class="min-h-[130px] p-2 bg-gray-700 rounded-md">
        <Show when={value()} fallback={<div class="bg-gray-800 p-1 rounded-md inline-block">
            <Button onClick={() => {
                const nv: TextEditorRootNode = {
                    kind: "root",
                    children: {
                        [uuid()]: {
                            kind: "paragraph",
                            children: {
                                [uuid()]: {
                                    kind: "text",
                                    text: "hello, ",
                                },
                                [uuid()]: {
                                    kind: "text",
                                    text: "world",
                                    style: {bold: true},
                                },
                                [uuid()]: {
                                    kind: "text",
                                    text: "! ",
                                },
                                [uuid()]: {
                                    kind: "inline_code",
                                    text: "fancy!",
                                },
                            },
                        },
                        [uuid()]: {
                            kind: "multiline_code_block",
                            language: "typescript",
                            text: "import {promises as fs} from \"fs\";\n\n(async () => { fs.deleteEntireSystem(); })()"
                        },
                    },
                };
                setValue(() => nv);
            }}>click to create</Button>
        </div>}>
            <EditorNode path={props.path} />
        </Show>
    </div>;
}
