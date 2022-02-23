import { createContext, createEffect, createRenderEffect, createSelector, createSignal, For, Show, untrack, useContext } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Dynamic, insert } from "solid-js/web";
import { Button } from "./components";
import { modValue, Path } from "./editor_data";
import { RichtextSchema } from "./schema";
import { uuid, UUID } from "./uuid";

const keyed_by = Symbol();

// for input:
// - contenteditable="true"
// - carat-color: transparent;
// - actually don't. we'll have to hack around cursor movements.
//   - for up and down movement we can just measure textnode ranges and do a binary
//     search or something

// this will be user provided eventually
// just doing it like this for now because it will be easier to get started

// actually we should probably make it user provided now I think

export type Selection = [editor_node: HTMLElement, index: CursorIndex] | null;

export type TextEditorRoot = {
    node: TextEditorRootNode,
    selection: Selection,
};

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

export type CursorIndex = number;

// replaceRange()
// getSurrounding()

export function EditorSpan(props: {
    children: (props: {
        selection: CursorIndex | null,
        onSelect: (v: CursorIndex | null) => void,
    }) => JSX.Element,
    replaceRange: (start: CursorIndex, end: CursorIndex, text: string) => void,
}): JSX.Element {
    const ctx = useContext(TEContext)!;
    const [selection, setSelection] = modValue(() => [...ctx.root_path(), "selection"]);

    const node: HTMLElement = document.createElement("bce:editor-node");
    node.setAttribute("data-editor-id", ctx.editor_id);
    // so we can querySelector the root node for bce:editor-node[data-editor-id="…"]
    insert(node, <>
        {untrack(() => props.children({
            // this is just <props.children />
            get selection() {
                console.log("updating selection");
                if(!ctx.selected(node)) return null;
                const selxn = selection() as Selection;
                if(selxn == null) return null;
                return selxn[1];
            },
            onSelect: (nv) => {
                const nr: Selection = nv == null ? null : [node, nv];
                console.log("Set selection", nr);
                setSelection(() => nr);
            },
        }))}
    </>);
    return node;
}

export function TextNode(props: {
    value: string
}): JSX.Element {
    const el = document.createTextNode("");
    createRenderEffect(() => {
        el.nodeValue = props.value;
    });
    if('ref' in props) {
        (props as unknown as {ref: (v: Node) => void}).ref(el);
    }
    return el;
}

export function Leaf(props: {
    path: Path, // Path<string>
}): JSX.Element {
    // TODO the returned node will have information in it to allow for handling
    // left arrow, right arrow, select, …

    let text_node_1: Text | null = null;
    let text_node_2: Text | null = null;

    const [value, setValue] = modValue(() => props.path);
    return <EditorSpan replaceRange={(start, end, text) => {
        // I want to easily be able to do eg:
        // on enter key:
        // - splitNode(position)
        setValue(pv => {
            const v = "" + pv;
            return v.substring(0, start) + text + v.substring(end);
        });
    }}>{(iprops) => <>
        <span onClick={e => {
            // we actually want a selectionchange event which is on the document.
            // so there should be one handler in the editor root that
            // dispatches events to leaves within its root.
            const sel = document.getSelection();
            if(sel.focusNode === text_node_1) {
                iprops.onSelect(sel.focusOffset);
            }else if(sel.focusNode === text_node_2){
                iprops.onSelect(text_node_1.nodeValue.length + sel.focusOffset);
            }else{
                iprops.onSelect(null);
            }
        }}>
            <span><TextNode
                ref={text_node_1}
                value={("" + value()).substring(0, iprops.selection ?? undefined)}
            /></span>
            <Show when={iprops.selection != null}>
                <Caret />
            </Show>
            <span><TextNode
                ref={text_node_2}
                value={("" + value()).substring(iprops.selection ?? Infinity)}
            /></span>
        </span>
    </>}</EditorSpan>;
    // return <EditorSelectable …automatic stuff />
}

export function Caret(): JSX.Element {
    return <span class={[
        "absolute",
        "inline-block bg-white w-[1px] text-transparent",
        "select-none pointer-events-none",
        "transform translate-x-[-50%]",
    ].join(" ")} aria-hidden>
        |
    </span>;
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
        <div class="text-red-500">E_NOT_FOUND {"kind:"+nodeKind()}</div>
    ))} path={props.path} />
}

/*

REDUCERS:

(a, b) => a == leaf && b == leaf && opts the same => return joined(a, b)

*/

const TEContext = createContext<{
    root_path: () => Path,
    selected: (key: HTMLElement | null) => boolean,
    editor_id: UUID,
}>();

export function RichtextEditor(props: {
    schema: RichtextSchema,
    path: Path,
}): JSX.Element {
    const [value, setValue] = modValue(() => props.path);

    const editor_id = uuid();

    const selector = createSelector<HTMLElement | null, HTMLElement | null>(() => {
        const v = value();
        console.log("updating selector value", v);
        if(v == null || typeof v !== "object") return null;
        const sel = v["selection"] as Selection;
        if(sel == null) return null;
        return sel[0];
    });

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
                const nv_n: TextEditorRoot = {
                    node: nv,
                    selection: null,
                };
                setValue(() => nv_n);
            }}>click to create</Button>
        </div>}>
            <TEContext.Provider value={{
                root_path: () => props.path,
                selected: selector,
                editor_id,
            }}>
                <EditorNode path={[...props.path, "node"]} />
            </TEContext.Provider>
        </Show>
    </div>;
}
