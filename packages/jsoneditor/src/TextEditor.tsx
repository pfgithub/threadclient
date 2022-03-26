import {
    batch,
    createContext, createEffect, createMemo, createRenderEffect, createSignal,
    For, JSX, Signal, untrack, useContext
} from "solid-js";
import { Dynamic, insert } from "solid-js/web";
import { assertNever } from "tmeta-util";
import { Show } from "tmeta-util-solid";
import { anBool, anGet, anKeys, AnNode, anSetReconcile, anString, JSON as JSONValue } from "./app_data";
import { Button, Buttons } from "./components";
import { DragButton, DraggableList } from "./DraggableList";
import { asObject, isObject, unreachable } from "./guards";
import { BoolEditor } from "./Schemaless";
import { Include } from "./util";
import { uuid, UUID } from "./uuid";

//

// THE NEXT STEP IS TO MAKE CONSISTENT NODE STRUCTURES:
// switch all nodes to fit in these and make it so users can provide typings
// also make it so the merge function is given an array of nodes that
// either fit the schema or builtin nodes

// anyway we:
// 1. consistent node structures and get all the current code to work
// 2. typing inserts nodes
// 3. merging nodes with the user merge function
//
// this means:
// - every leaf render has to be a real physical thing in your document
// - before, we were attempting to allow renderers to render fake nodes they made
//   themselves. this is probably possible to do but feels like it will have lots of
//   complications trying to do basic things like deleting a node

const smart_guard_no = Symbol("smart_guard_no");
function smartGuard<T, U extends T>(cb: (item: T, no: typeof smart_guard_no) => U | (typeof smart_guard_no)) {
    return (item: T): item is U => cb(item, smart_guard_no) !== smart_guard_no;
}
smartGuard<string | number, string>((item, no) => {
    return typeof item === "string" ? item : no;
});

// [!] when merging, pass in a TENode but with U modified to include TERawNodes
type TEChild = TEContainer<any, any, any> | TEEditableString<any, any> | TESelectableObject<any, any>;
const teIsContainer = smartGuard<TEChild, TEContainer<any, any, TEChild>>((v, no) => {
    return ('children' in v) ? v : no;
});
const teIsEditableString = smartGuard<TEChild, TEEditableString<any, any>>((v, no) => {
    return ('text' in v) ? v : no;
});
const teIsSelectableObject = smartGuard<TEChild, TESelectableObject<any, any>>((v, no) => {
    if(!teIsContainer(v) && !teIsEditableString(v)) return v;
    return no;
});

type TEContainer<I extends `-${string}`, T, U extends TEChild> = {
    id: I,
    data: T,
    children: {[key: string]: U},
    // ^ TODO: consider using an array here
    // An nodes will have to be updated to support it
    //
    // the reason is because:
    // - all TE nodes will be managed by TE actions. AnReconcile will never
    //   be used for updating TE nodes
    // idk really not much reason to switch but it's something that we can do
};

// TODO: consider not storing text: string in here?
// should allow for better types of virtual nodes that define their own
// cursor movement functions and such
type TEEditableString<I extends `-${string}`, T> = {
    id: I,
    data: T,
    text: string,
};
// these have special behaviour relating to cursor movement
// not sure if this is the right way to handle this - there may be some way we can
// handle it by overriding cursor movement functions for a node like before but for now
// this seems like the easiest way to handle it
type TESelectableObject<I extends `-${string}`, T> = {
    id: I,
    data: T,
};

const te_unmerged_text = "-Mz3zu0mHQrjzZXzudzJ";
type TEUnmergedText = TEEditableString<typeof te_unmerged_text, null>;
// this is an unmerged text node
// this is how text gets inserted with the keyboard
// you should not store these in your data model
type TERawNode = TEUnmergedText;

// function merge(container: TEContainer): array of parent container children
// this will allow for lifting itemss out of their containers or splitting child
// containers and stuff like that

// (in the future, we may want the unmerged text node to
//  contain html data or something to support richtext pasting)

//

// ok just going to write some stuff
// - cursor movement is pretty easy. you ask the leaf and it tells you and you loop
//   until you get where you need to go
// - we do have that issue where there are two identical positions a cursor can be in
//   but in different leaves. not sure how to handle this yet. ignoring it for now.
//
// text insertion:
// - what I want to do is:
//   - split the node at the current position
//   - insert a new node containing the text
//   - recursively mergeNodes until everything is good
//   - emit all those updates at once to prevent excessive dom rerenders
//
// ranges are the same. we won't have a difference between "insert one" and "replace range"
// - to replace range, you:
//   - split at start and end points
//   - remove all nodes between these points
//   - insert a new node
//   - recursively merge
//
// there are some oddities there with how that works in a node heigherarchy. it should
// basically be the same though, we're deleting just child nodes and then eventually whole
// parent nodes
//
// ok the question is how do you implement this
// - leaves can't do it, they don't know who their parents are. a leaf can tell you
//   how to split itself though.
// - is there some way we can start at the top and have the nodes that have children
//   handle their children?
// - like EditorChildren would handle this and Root would handle this
//
// we emit a replacerange:
// - go up from the start and end nodes to find the children holders
// - ask the children holders to perform the replace range
//
// ok if we're going to have children holders we can also do some stuff like giving
// cursor positions a path rather than holding a sketchy HTMLElement

const editor_leaf_node_data = Symbol("editor_leaf_node_data");
const editor_list_node_data = Symbol("editor_list_node_data");
const editor_list_item_node_data = Symbol("editor_list_item_node_data");
type MoveCursorResult = CursorIndex | {dir: -1 | 1, stop: number};
export type MoveCursorStop = {
    unit: "codepoint",
    dir: -1 | 1,
} | {
    unit: "grapheme",
    dir: -1 | 1,
    // ok excuse me
    // does javascript not have unicode text segmentation algorithms built in
    // am i going to have to use ziglyph through wasm to get incredibly basic functionality
    // https://github.com/tc39/proposal-intl-segmenter
    // ok at least there's a proposal for it
    // https://github.com/surferseo/intl-segmenter-polyfill
    // ok cool we'll use the polyfill because it's available in chrome but not firefox
    //
    // that's really funny. the polyfill is implemented in wasm because there's no good
    // javascript implementation for this incredibly basic functionality required in
    // any text editor. i guess everyone uses contenteditable - except that's not true,
    // lots of code editors used to not use contenteditable at all. so they must have
    // had their own implementations. hmm

    // oh I should consider using zigglyph in threadclient-ui-terminal
    // it has fun stuff like terminal width measurement and word wrap
} | {
    unit: "word",
    dir: -1 | 1,
} | {
    unit: "sentence",
    dir: -1 | 1,
};
type EditorLeafNodeData = {
    moveCursor: (position: CursorIndex, stop: number) => MoveCursorResult,
    cursorPos: (v: -1 | 1) => CursorIndex,
    path: EditorPath,
};
type EditorListNodeData = {
    _?: undefined,
};
type EditorListItemNodeData = {
    id: string,
};
type EditorLeafNode = HTMLElement & {
    [editor_leaf_node_data]: EditorLeafNodeData,
};
type EditorListNode = HTMLElement & {
    [editor_list_node_data]: EditorListNodeData,
};
type EditorListItemNode = HTMLElement & {
    [editor_list_item_node_data]: EditorListItemNodeData,
};
function isLeafNode(el: Element): el is EditorLeafNode {
    return editor_leaf_node_data in el;
}
function leafNodeData(el: EditorLeafNode): EditorLeafNodeData;
function leafNodeData(el: Element): EditorLeafNodeData | null;
function leafNodeData(el: Element): EditorLeafNodeData | null {
    return isLeafNode(el) ? el[editor_leaf_node_data] : null;
}
() => [leafNodeData];
function isListNode(el: Element): el is EditorListNode {
    return editor_list_node_data in el;
}
function listNodeData(el: EditorListNode): EditorListNodeData;
function listNodeData(el: Element): EditorListNodeData | null;
function listNodeData(el: Element): EditorListNodeData | null {
    return isListNode(el) ? el[editor_list_node_data] : null;
}
() => [listNodeData];
function isListItemNode(el: Element): el is EditorListItemNode {
    return editor_list_item_node_data in el;
}
function listItemNodeData(el: EditorListNode): EditorListItemNodeData;
function listItemNodeData(el: Element): EditorListItemNodeData | null;
function listItemNodeData(el: Element): EditorListItemNodeData | null {
    return isListItemNode(el) ? el[editor_list_item_node_data] : null;
}
() => [listItemNodeData];

// why number[]? simple:
// - ids can make you think they might be static. they aren't. these paths are anchored
//   to a specific snapshot of data and after that they are invalid except under very
//   specific circumstances.
// - numbers can be compared to check if a node is between other nodes trivially.
//
// [!] CONSIDER GOING BACK TO IDS WITH THE FOLLOWING CHANGES:
//   - make all children arrays [!] sorted by id
//   - do not allow reordering of children
// this has some nice advantages:
//   - easier to add multiuser supppoprt
// i'll have to actually think about the multi user problem a bit first though.
// we're just directly using ansetreconcile for now
// probably should take after existing collaborative editors' action structures and figure
//   out how they handle these issues.
// oh also btw we literally can't make children uuids that are always sorted
// like what happens if you type a character in the middle of a node
export type EditorPath = number[];

export type Point = {
    path: EditorPath,
    offset: CursorIndex,
};
export type Selection = {
    // focus: Point,
    anchor: Point,
};

export type Richtext = TextEditorRoot;
export type TextEditorRoot = {
    node: TextEditorRootNode,
};

// we're not using indents but when we do add indents we get to figure
// out how we want to handle them
export const root_node = "-Mz4-b9S1AsOPum51JPo";
export type TextEditorRootNode = TEContainer<typeof root_node, null, TextEditorParagraphNode>;

export const paragraph_node_paragraph = "-Mz4-gNTR3S_mjtcMXsL";
export type TextEditorParagraphNodeParagraph = TEContainer<typeof paragraph_node_paragraph, null, TextEditorLeafNode>;

export const multiline_code_block = "-Mz4-s6Z6crc292yyvwX";
export type TextEditorParagraphNodeMultilineCodeBlock = TEContainer<typeof multiline_code_block, {
    language: string,
    // by putting language in here, it means that it cannot be edited inside this editor
    // - we have to make a button or <input /> or sub text editor to edit it

    // alternatively, we could have a CodeBlockLanguageNode that goes as the first
    // child inside the code block that contains its language if we want to be able to
    // edit it in the editor.

    // it would be nice to be able to enforce that in the typesystem somehow. not worrying
    // about that yet though.
}, CodeBlockLeafNode>;

export const code_block_leaf = "-Mz40QiKrp2mXvnN14DG";
export type CodeBlockLeafNode =
    | TEEditableString<typeof code_block_leaf, null>
    | TextEditorLeafNodeParagraphBreak
;

const paragraph_node_image = "-Mz40vr3zRJMMLf_Edme";
export type TextEditorParagraphNodeImage = TESelectableObject<typeof paragraph_node_image, {
    contenthash: string,
    ext: string,
    // ^ for file storage we will use content hashes
    // we can probably mess around with the structure to make it possible
    // to gc unused content

    // images are a bit special in that for one source content hash we might
    // generate thumbnails and stuff
}>;

const embedded_schema_editor = "-Mz41dooDLLiPqMvbitH";
export type TextEditorParagraphNodeEmbeddedSchemaEditor = TESelectableObject<typeof embedded_schema_editor, {
    enabled: boolean,
    // we're going to use this to demonstrate normal usage of anreconcile inside of
    // text editor stuff
}>;
export type TextEditorParagraphNode =
    | TextEditorParagraphNodeParagraph
    | TextEditorParagraphNodeMultilineCodeBlock
    | TextEditorParagraphNodeImage
    | TextEditorParagraphNodeEmbeddedSchemaEditor
;

export type TextStyle = {bold?: undefined | boolean};
const leaf_node_text = "-Mz43235vt7vZdqt56xm";
export type TextEditorLeafNodeText = TEEditableString<typeof leaf_node_text, {
    style?: undefined | TextStyle,
}>;

// TODO: consider making this a container node containing InlineCodeStart RawText InlineCodeEnd
const leaf_node_inline_code = "-Mz43MyMfCOT-P9Fq46I";
export type TextEditorLeafNodeInlineCode = TEEditableString<typeof leaf_node_inline_code, null>;

// [!] during merging, if this is missing it will merge paragraphs together
// [!] this node should contain the text "\n" at all times
export const text_editor_leaf_node_paragraph_break = "-Mz45jhe_pzC4lSQoQPb";
export type TextEditorLeafNodeParagraphBreak = TEEditableString<typeof text_editor_leaf_node_paragraph_break, null>;
export type TextEditorLeafNode =
    | TextEditorLeafNodeText
    | TextEditorLeafNodeInlineCode
    | TextEditorLeafNodeParagraphBreak
;

type TextEditorAnyNode =
    | TextEditorRootNode
    | TextEditorParagraphNode
    | TextEditorLeafNode
    | CodeBlockLeafNode
;
// ^ TODO: remove this. temporary hack.

// and then we'll have a bit
// "These nodes are defined by "
// "Your data model should not contain these nodes, they should be converted on insert"

// sample **bold** text
//
// [image]

// →
// paragraph[ leaf(sample ) leaf.bold(bold) leaf( text) leaf.paragraphbreak( ) ]
//
// image[]

// is this good? do we want this?
// is this better than whatever we're trying to do?
// can we type this properly?
// not sure

export const nc = {
    userInput(v: string): TEUnmergedText {
        return {
            id: te_unmerged_text,
            text: v,
            data: null,
        };
    },

    array<T>(...items: T[]): {[key: string]: T} {
        return Object.fromEntries(items.map(itm => [uuid(), itm] as const));
    },
    root(...ch: [TextEditorParagraphNode][]): TextEditorRootNode {
        return {
            id: root_node,
            data: null,
            children: nc.array(...ch.map(([v]): TextEditorParagraphNode => {
                return v;
            })),
        };
    },
    parBreak(): TextEditorLeafNodeParagraphBreak {
        return {
            id: text_editor_leaf_node_paragraph_break,
            data: null,
            text: "\n",
        };
    },
    par(...ch: TextEditorLeafNode[]): TextEditorParagraphNodeParagraph {
        return {
            id: paragraph_node_paragraph,
            data: null,
            children: nc.array(...ch, nc.parBreak()),
        };
    },
    code(lang: string, text: string): TextEditorParagraphNodeMultilineCodeBlock {
        return {
            id: multiline_code_block,
            data: {
                language: lang,
            },
            children: nc.array<CodeBlockLeafNode>({
                id: code_block_leaf,
                data: null,
                text,
            }, nc.parBreak()),
        };
    },
    img(contenthash: string, ext: string): TextEditorParagraphNodeImage {
        return {
            id: paragraph_node_image,
            data: {
                contenthash: contenthash,
                ext: ext,
            },
        };
    },
    embeddedSchemaEditor(): TextEditorParagraphNodeEmbeddedSchemaEditor {
        return {
            id: embedded_schema_editor,
            data: {enabled: false},
        };
    },
    text(txt: string, styl?: TextStyle | undefined): TextEditorLeafNodeText {
        return {
            id: leaf_node_text,
            text: txt,
            data: {
                style: styl,
            },
        };
    },
    inlineCode(txt: string): TextEditorLeafNodeInlineCode {
        return {
            id: leaf_node_inline_code,
            text: txt,
            data: null,
        };
    },
} as const;

// so we'll have a function Leaf that is a text editor
// gives you basic functions and you can put it where you need it to edit text

const node_renderers: {
    [key in TextEditorAnyNode["id"]]?: (props: {node: AnNode<Include<TextEditorAnyNode, {id: key}>>}) => JSX.Element
} = {
    [root_node](props: {node: AnNode<TextEditorRootNode>}): JSX.Element {
        return <RtList>
            <DraggableList
                items={anKeys(props.node.children)}
                setItems={cb => {
                    anSetReconcile(props.node.children, v => {
                        const pv = asObject(v) ?? {};
                        const nv = cb(Object.keys(pv));
                        return Object.fromEntries(nv.map(key => [key, pv[key]! as TextEditorParagraphNode]));
                    });
                }}

                wrapper_class="pt-2 first:pt-0"
                nodeClass={() => ""}
            >{(key, dragging, index, anyDragging) => {
                const [f0, setFocused] = createSignal(false);
                const [h0, setHovering] = createSignal(false);
                const hovering = () => f0() || h0();
                // TODO add the indent
                return <div class="flex flex-row flex-wrap gap-2">
                    <div>
                        <div class="relative -mt-1">
                            <button
                                class={[
                                    "absolute bg-blue-500 rounded-full w-7 h-7",
                                    hovering() ? "opacity-100" : "opacity-0",
                                    "transition-opacity",
                                ].join(" ")}
                                style="transform: translateY(-50%)"
                                onmouseenter={() => setHovering(true)}
                                onmouseleave={() => setHovering(false)}
                                onfocusin={() => setFocused(true)}
                                onfocusout={() => setFocused(false)}
                                onclick={() => {
                                    // it's still focused but it's weird to still
                                    // highlight it
                                    setFocused(false);
                                    anSetReconcile(props.node.children, v => {
                                        const pv = (asObject(v) ?? {}) as {[key: string]: TextEditorParagraphNode};
                                        const av = uuid();
                                        const nn = nc.par();
                                        const nv = {...pv, [av]: nn};
                                        const itm = Object.keys(pv);
                                        itm.splice(index(), 0, av);
                                        return Object.fromEntries(itm.map(k => [k, nv[k]!]));
                                    });
                                }}
                            >
                                +
                            </button>
                        </div>
                        <DragButton class={"px-2 rounded-md h-full "+(dragging() ? "bg-gray-500" : "")}>≡</DragButton>
                    </div>
                    <div class={
                        "flex-1 relative "
                        + (anyDragging() ? "whitespace-nowrap overflow-hidden text-ellipsis max-h-8 " : "")
                    }>
                        <div
                            class={[
                                "-mt-1 absolute bg-blue-500 w-full h-1 rounded-full",
                                hovering() ? "opacity-100" : "opacity-0",
                                "transition-opacity",
                            ].join(" ")}
                            style="transform: translateY(-50%)"
                        />
                        <RtListItem id={key} index={index()}>
                            <EditorNode node={props.node.children[key as UUID]!} />
                        </RtListItem>
                    </div>
                </div>;
            }}</DraggableList>
        </RtList>;
    },
    [paragraph_node_paragraph](props): JSX.Element {
        return <p>
            <Show if={anKeys(props.node.children).length === 1}>
                <span class="text-gray-400">…</span>
            </Show>
            <EditorChildren
                node={props.node.children}
            />
        </p>;
    },
    [text_editor_leaf_node_paragraph_break](): JSX.Element {
        return <LeafSignal text=" " setText={() => {
            throw new Error("todo delete the paragraph break");
        }} />;
    },
    [multiline_code_block](props): JSX.Element {
        return <pre class="bg-gray-800 p-2 rounded-md whitespace-pre-wrap">
            <EditorChildren node={props.node.children} />
        </pre>;
    },
    [code_block_leaf](props): JSX.Element {
        return <code><Leaf node={props.node.text} /></code>;
    },
    [paragraph_node_image](props): JSX.Element {
        return <div>
            <RtLeaf
                // hmm, there's an interesting thing to note with this leaf that is unlike
                // other leaves.
                //
                // if you are on it and press backspace, it should delete the leaf. but
                // you're at position 0.
                //
                // ok I guess it will end up calling removeRange( prev_node.last, this_node[0] )
                // and then we just have to handle that correctly
                replaceRange={(a, b, c) => {
                    throw new Error("ebad");
                }}
                moveCursor={(pos, stop) => {
                    const res = pos + stop;
                    if(res < 0) return {dir: -1, stop};
                    if(res >= 1) return {dir: 1, stop: stop -1};
                    return res;
                }}
                cursorPos={v => {
                    if(v === -1) return 0;
                    return 1;
                }}
            >{(leafprops) => <>
                <img
                    class={[
                        "rounded-md",
                        leafprops.selection != null ? "outline outline-blue-500" : "",
                    ].join(" ")}
                    src="https://picsum.photos/seed/jaqmga/650/365.jpg"
                    onclick={() => leafprops.onSelect(0)}
                />
            </>}</RtLeaf>
        </div>;
    },
    [embedded_schema_editor](props): JSX.Element {
        return <div class="bg-gray-800 p-2 rounded-md">
            <BoolEditor node={props.node.data.enabled} />
        </div>;
    },
    [leaf_node_text](props): JSX.Element {
        return <span class={(() => {

            const styles: string[] = [];
            const style = props.node.data.style;
            if(anBool(style.bold) ?? false) styles.push("font-bold");

            return styles.join(" ");
        })()}><Leaf node={props.node.text} /></span>;
    },
    [leaf_node_inline_code](props): JSX.Element {
        return <code class="bg-gray-800 p-1 rounded-md"><Leaf node={props.node.text} /></code>;
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

export function RtList(props: {
    children: JSX.Element,
}): JSX.Element {
    const ctx = useContext(te_context)!;

    const node_data: EditorListNodeData = {};
    const node: EditorListNode = Object.assign(
        document.createElement("bce:editor-list-node"),
        {[editor_list_node_data]: node_data},
    );
    node.setAttribute("data-editor-id", ctx.editor_id);
    insert(node, <>{props.children}</>);
    return node;
}

// this would make it nice to use number paths or sorted uuids
// number paths might be doable
// ok i think what this says is that every editor change needs to be done
// with an editor call, none of this using anReconcile when reordering nodes
// and then that suggests that we should have a consistent model for data which might
// make sense
function pathWithinSelection(path: EditorPath, selection: Selection): boolean {
    for(let i = 0; i < Math.min(path.length, selection.anchor.path.length); i++) {
        if(path[i] !== selection.anchor.path[i]) return false;
    }
    return true;
}

export function RtListItem(props: {
    id: string, // [!] static, not allowed to change
    index: number,
    children: JSX.Element,
}): JSX.Element {
    const ctx = useContext(te_context)!;
    const ictx = useContext(itm_context)!;

    const node_data: EditorListItemNodeData = {id: props.id};
    const node: EditorListItemNode = Object.assign(
        document.createElement("bce:editor-list-item"),
        {[editor_list_item_node_data]: node_data},
    );
    node.setAttribute("data-editor-id", ctx.editor_id);
    const selectionGroupMemo = createMemo(() => {
        if(!ictx.selection_group) return false;
        const selxn = ctx.selection[0]();
        if(selxn == null) unreachable();
        return pathWithinSelection([...ictx.path, props.index], selxn);
    });
    insert(node, <itm_context.Provider value={{
        get selection_group() {return selectionGroupMemo()},
        get path() {return [...ictx.path, props.index]},
    }}>
        {props.children}
    </itm_context.Provider>);
    return node;
}

export function RtLeaf(props: {
    children: (props: {
        selection: CursorIndex | null,
        onSelect: (v: CursorIndex | null) => void,
    }) => JSX.Element,
    replaceRange: (start: CursorIndex, end: CursorIndex, text: string) => void,
    moveCursor: (position: CursorIndex, stop: number) => MoveCursorResult,
    cursorPos: (v: -1 | 1) => CursorIndex,
}): JSX.Element {
    const ctx = useContext(te_context)!;
    const ictx = useContext(itm_context)!;
    const [selection, setSelection] = ctx.selection;

    const node_data: EditorLeafNodeData = {
        moveCursor: props.moveCursor,
        cursorPos: props.cursorPos,
        get path() {return ictx.path},
    };
    const node: EditorLeafNode = Object.assign(
        document.createElement("bce:editor-leaf-node"),
        {[editor_leaf_node_data]: node_data},
    );
    node.setAttribute("data-editor-id", ctx.editor_id);
    createEffect(() => node.setAttribute("id", JSON.stringify([ctx.editor_id, ictx.path])));
    // so we can querySelector the root node for bce:editor-node[data-editor-id="…"]
    // alternatively, we could maintain an array by having EditorSpan add and remove
    // onCleanup() couldn't we
    insert(node, <>
        {untrack(() => props.children({
            // this is just <props.children />
            get selection() {
                if(!ictx.selection_group) return null;
                const selxn = selection();
                if(selxn == null) unreachable();
                return selxn.anchor.offset;
            },
            onSelect: (nv) => {
                const nr: Selection | null = nv == null ? null : {
                    anchor: {
                        path: ictx.path,
                        offset: nv,
                    },
                };
                console.log("Set selection", nr);
                setSelection(() => nr);
            },
        }))}
    </>);
    return node;
}

export function TextNode(props: {
    value: string,
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
    node: AnNode<string>, // State<string>
}): JSX.Element {
    return <LeafSignal
        text={anString(props.node) ?? ""}
        setText={cb => anSetReconcile(props.node, pv => {
            return cb(typeof pv === "string" ? pv : "");
        })}
    />;
}

export function LeafSignal(props: {
    text: string, // State<string>
    setText: (cb: (pv: string) => string) => void,
}): JSX.Element {
    // TODO the returned node will have information in it to allow for handling
    // left arrow, right arrow, select, …

    let text_node_1!: Text;
    let text_node_2!: Text;

    return <RtLeaf replaceRange={(start, end, text) => {
        // I want to easily be able to do eg:
        // on enter key:
        // - splitNode(position)
        props.setText(pv => {
            return pv.substring(0, start) + text + pv.substring(end);
        });
    }} moveCursor={(position, stop) => {
        const res = position + stop;
        if(res < 0) return {dir: -1, stop: res}; // <= maybe?
        const value = props.text;
        if(res >= value.length) return {dir: 1, stop: res - value.length};
        return res;
    }} cursorPos={(v) => {
        if(v === -1) return 0;
        return props.text.length;
    }}>{(iprops) => <>
        <span onClick={e => {
            // we actually want a selectionchange event which is on the document.
            // so there should be one handler in the editor root that
            // dispatches events to leaves within its root.
            const sel = document.getSelection();
            if(!sel) return;
            if(sel.focusNode === text_node_1) {
                iprops.onSelect(sel.focusOffset);
            }else if(sel.focusNode === text_node_2){
                iprops.onSelect(text_node_1.data.length + sel.focusOffset);
            }else{
                iprops.onSelect(null);
            }
        }}>
            <span><TextNode
                ref={text_node_1}
                value={props.text.substring(0, iprops.selection ?? undefined)}
            /></span>
            <Show if={iprops.selection != null}>
                <Caret />
            </Show>
            <span><TextNode
                ref={text_node_2}
                value={props.text.substring(iprops.selection ?? Infinity)}
            /></span>
        </span>
    </>}</RtLeaf>;
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
    node: AnNode<{[key: string]: TextEditorAnyNode}>,
    fallback?: undefined | JSX.Element,
}): JSX.Element {
    return <RtList>
        <For each={anKeys(props.node)} fallback={props.fallback}>{(key, index) => {
            return <RtListItem id={key} index={index()}>
                <EditorNode node={props.node[key]!} />
            </RtListItem>;
        }}</For>
    </RtList>;
}

export function EditorNode(props: {
    node: AnNode<TextEditorAnyNode>,
}): JSX.Element {
    const nodeKind = () => anString(props.node.id);
    return <Dynamic component={(node_renderers as {
        [key: string]: (props: {node: AnNode<TextEditorAnyNode>}) => JSX.Element,
    })[nodeKind() ?? "null"]! ?? ((subprops: {state: AnNode<TextEditorAnyNode>}) => (
        <div class="text-red-500">E_NOT_FOUND {"kind:"+nodeKind()}</div>
    ))} node={props.node} />;
}

/*

REDUCERS:

(a, b) => a == leaf && b == leaf && opts the same => return joined(a, b)

*/

const te_context = createContext<{
    selection: Signal<Selection | null>,
    editor_id: UUID,
}>();
const itm_context = createContext<{
    selection_group: boolean,
    path: EditorPath,
}>();

const defaultnode = (): TextEditorRootNode => nc.root(
    [nc.par(
        nc.text("hello, "),
        nc.text("world", {bold: true}),
        nc.text("! "),
        nc.inlineCode("fancy!"),
        nc.text(" here i'm going to try out 🧜‍♀️unicode support"),
    )],
    [nc.code("ts", [
        "import {promises as fs} from \"fs\";",
        "",
        "(async () => { fs.deleteEntireSystem(); })()",
    ].join("\n"))],
    [nc.par(
        nc.text([
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce tempor arcu",
            "a lobortis hendrerit. Curabitur viverra, orci eu aliquet congue, sem odio",
            "semper tortor, vehicula placerat purus lorem at leo. Nam laoreet massa ac",
            "tellus auctor, nec cursus enim venenatis. Vestibulum egestas lorem neque.",
            "Donec et gravida nisl. Etiam blandit libero eget elit condimentum, et",
            "consectetur nisl gravida. Curabitur id egestas tellus, sed aliquam eros.",
            "Duis congue sagittis elit eget pulvinar. Integer nulla lorem, consequat eu",
            "lacus quis, porta scelerisque libero. Vestibulum dictum imperdiet libero",
            "vel facilisis. Aenean fringilla turpis ac ornare tincidunt. Mauris eros",
            "nisl, lacinia et nunc eu, auctor placerat lorem. Nulla interdum, diam",
            "sed tincidunt mattis, arcu nisl semper velit, et tempor arcu felis vel",
            "dolor. Morbi id enim eget elit bibendum venenatis.",
        ].join(" "))
    )],
    [nc.img("TODO", "jpg")],
    [nc.par(
        nc.text([
            "Phasellus in sem ante. Aenean volutpat, purus vel sollicitudin convallis,",
            "massa nunc imperdiet nulla, non dictum ante nulla sed lorem. Duis lacus",
            "libero, elementum ut tellus sit amet, fringilla ornare nisl. Sed tincidunt",
            "nisl in mattis varius. Proin nec mauris enim. Proin a nunc aliquam,",
            "condimentum urna ac, commodo tortor. Nunc a massa vel neque molestie",
            "viverra. Etiam ut vestibulum erat. Nulla scelerisque augue nec augue",
            "eleifend bibendum. Donec facilisis, sapien nec pharetra dictum, ipsum",
            "metus sagittis erat, vitae imperdiet quam nunc ac nisl.",
        ].join(" "))
    )],
);

export function deleteRange<U extends Point[]>(
    root: AnNode<TextEditorRoot>,
    l: Point, r: Point,
    track: U,
): [Point, Point, U] {
    if(JSON.stringify(l) !== JSON.stringify(r)) throw new Error("TODO delete range");
    return [l, r, track];

    // // insert a void node left
    // // insert a void node right
    // // clear range
    // let left_path: EditorPath = null as unknown as EditorPath;
    // let right_path: EditorPath = null as unknown as EditorPath;
    // [left_path, [r]] = insertAtNoMerge(l, nc.userInput(""), [r]); // @undef(l)
    // [right_path] = insertAtNoMerge(r, nc.userInput(""), []); // @undef(r)

    // // loop over all nodes between left and right and delete them including right_path
    // //   but excluding left_path
    // // call mergeNodes() at left_path
    // //
    // // this section would benefit from consistent node schemas because otherwise we have
    // // to go ask all the lists to handle the deletion themselves. which is okay but
    // // not sure if there's any clear benefit. there's probably only disadvantage.

    // ok we're defining a consistent node schema right now
    // oh right we also need it for actions. yeah it's important to have a consistent
    // node schema.

    // oh uh oh this is an issue
    // actions:
    // - do we
    // i'm just not going to think about this for now
}

export function use<T, U>(v: T, cb: (v: T) => U): U {
    return cb(v);
}

// we go left and right up the tree, merging stuff. after merge nodes is called on all
// affected ndoes, the node tree is guarenteed to conform to the user's defined schema
export function mergeNodes<U extends Point[]>(
    root: AnNode<TextEditorRoot>,
    center: EditorPath,
    track: U,
): [l: Point, r: Point, track: U] {
    // TODO merge nodes
    return [
        {path: center, offset: 0},
        {path: center, offset: (() => {
            let node: AnNode<TEChild> = root.node as unknown as AnNode<TEChild>;
            for(const segment of center) {
                const nodevc = (node as unknown as AnNode<TEContainer<any, any, TEChild>>).children;
                node = nodevc[
                    anKeys(nodevc)[segment] ?? unreachable()
                ] ?? unreachable();
            }
            return anString((node as unknown as {text: AnNode<string>}).text)?.length ?? 0;
        })()},
        track,
    ];
}

// TODO this will have type parameters to conform to the user's something or other
// and it will probably go in dom list nodes

// ok the way slate does this is all node changes are made with transforms rather
// than direct
//
// we should do that - it keeps our cursor in position where it should be

// here's the trouble with transforms:
// - transforms don't make it easy to maintain a defined schema

// oh here's a good thing with their node normalization:
// [!] they perform one change and then return. the normalization function is called
//     again until normalization is complete.

// ok let's think about that. that's smart i think

// function normalizeParagraph(node: TextEditorParagraphNodeParagraph) {
//     // ok so I want to do the following normalizations:
//     // - unmerged text should be merged with surrounding text
//     // - text with identical values should be merged
//     // - merges should always keep the leftmost id
//
//     // paragraph break normalization will be handled by the root.
//     // possibly we can flag our node or something to alert the root about it
//     let prev_child: [string, TextEditorLeafNode] | null = null;
//     for(const [index, child] of Object.values(node.children).entries()) {
//         if(child.text === "") Transforms.deleteNode(child);
//         if(child.id === te_unmerged_text && prev_child.id !== text_editor_leaf_node_paragraph_break) {
//             Transforms.mergeLeft(child);
//         }
//         prev_child = [index, child];
//         if(child.id === text_editor_leaf_node_paragraph_break) {
//             pbrk = index;
//             break;
//         }
//     }
// }

// type MergeNodesUserFunction<U extends TEChild> = (
//     id: UUID, node: U, path: number[],
// ) => {[key: string]: TEChild | TERawNode};
// const mergeNodesUserFn: MergeNodesUserFunction<TextEditorParagraphNodeParagraph> = (id, node, path) => {
//     const paragraphs: [string, TextEditorLeafNode][][] = [[]];
//     for(const ch of Object.entries(node.children)) {
//         const paragraph = paragraphs[paragraphs.length - 1]!;
//         paragraph.push(ch);
//         if(ch[1].id === text_editor_leaf_node_paragraph_break) {
//             paragraphs.push([]);
//         }
//     }
//     // part 1: split at all newline nodes
//     // note: the root should then merge text blocks that are missing newline nodes at the
//     // end (or add a newline node if it is the last paragraph)
//     return {[id]: node};
// };

function copyJSON<V extends JSONValue>(v: V): V {
    return JSON.parse(JSON.stringify(v)) as V;
}

export function insertAtNoMerge<U extends Point[]>(
    root: AnNode<TextEditorRoot>,
    cut: Point,
    new_node: TERawNode,
    track: U,
    void_handling: "replace" | "left" | "right",
): [c: EditorPath, track: U] {
    // ok
    // we're going to anSetReconcile the root node
    // treat this like we're writing an update function for an action basically

    let new_object_path: EditorPath | null = null;

    function recursiveStep(node: TEChild, path: number[]): TEChild[] {
        if(!path.every((bit, i) => bit === cut.path[i])) {
            return [node];
        }
        
        if(teIsContainer(node)) {
            if(cut.path.length === path.length) unreachable();
            return [recursiveStepContainer(node, path)];
        }

        if(cut.path.length !== path.length) unreachable();
        if(new_object_path != null) unreachable();

        if(teIsEditableString(node)) {
            if(cut.offset === 0) {
                new_object_path = path;
                return [new_node, node];
            }
            new_object_path = path.map((w, i, a) => i === a.length - 1 ? w + 1 : w);
            if(cut.offset === node.text.length) return [node, new_node];

            const left_half = {...node, text: node.text.substring(0, cut.offset)};
            // v: rather than copying ourselves, we could ask the node to do it. not sure
            const right_half = {...copyJSON(node), text: node.text.substring(cut.offset)};

            return [left_half, new_node, right_half];
        }
        if(teIsSelectableObject(node)) {
            if(void_handling === "right") {
                new_object_path = path.map((w, i, a) => i === a.length - 1 ? w + 1 : w);
                return [node, new_node];
            }
            if(void_handling === "left") return [new_node, node];
            new_object_path = path;
            if(void_handling === "replace") return [new_node];
            assertNever(void_handling);
        }
        assertNever(node);
    }
    function recursiveStepContainer(
        node: TEContainer<any, any, TEChild>,
        path: number[],
    ): TEContainer<any, any, TEChild> {
        return {
            ...node,
            children: Object.fromEntries(Object.entries(node.children).flatMap((child, i) => (
                recursiveStep(child[1], [...path, i]).map((nt, j) => {
                    // left half keeps the id
                    // this is because user node merging should use the id of the leftmost
                    // merged node. helps reduce solid js rerenders
                    return [j === 0 ? child[0] : uuid(), nt];
                })
            ))),
        };
    }

    anSetReconcile(root.node, (pv_raw) => {
        const pv = pv_raw as TextEditorRootNode; // we don't have to handle bad structures
        // here because all the structure will eventually be created through specialized
        // actions so it's guarenteed to match spec (unless someone publishes an
        // invalid snapshot)

        return recursiveStepContainer(pv, []) as TextEditorRootNode;
    });

    if(new_object_path == null) unreachable();

    // update all the tracked points
    track = track.map((point) => {
        throw new Error("todo support tracking points in insertAtNoMerge");
    }) as unknown as typeof track;

    return [new_object_path, track];
}
export function insertAt<U extends Point[]>(
    root: AnNode<TextEditorRoot>,
    cut: Point,
    node: TERawNode,
    track: U,
): [l: Point, r: Point, track: U] {
    let center: EditorPath;
    [center, track] = insertAtNoMerge(root, cut, node, track, "right");
    let l: Point;
    let r: Point;
    [l, r, track] = mergeNodes(root, center, track);
    return [l, r, track];
}
// hmm. here's something fun we could do
// it would require a WeakMap that you can loop over the keys of though
// I think you might be able to do it with the new WeakRef thing but idk
//
// anyway basically the idea is you keep all the cursors in some weakmap
// and update all of them when anything gets changed
//
// it's not a good idea because we'll need to find a proper solution to
// that problem when we implement multi-user editing

export function RichtextEditor(props: {
    node: AnNode<Richtext>,
}): JSX.Element {
    const [selected, setSelected] = createSignal<Selection | null>(null);

    const [textareaFocused, setTextAreaFocused] = createSignal(false);

    const editor_id = uuid();
    let div!: HTMLDivElement;

    const selectionGroupMemo = createMemo(() => {
        return selected() != null;
    });

    // this stylinng can probably be provided by the root node
    return <div
        class={
            "min-h-[130px] bg-gray-700 rounded-md relative p-2 "
            +(textareaFocused() ? "outline outline-green-500 " : "")
        }
        ref={div}
    >
        <textarea
            // if we want to use contenteditable=true, we'll have to intercept every
            // cursor movement and handle it ourself.
            // - contenteditable will bring some advantages
            //   - cursor movement on mobile browsers
            // - but also contenteditable is really buggy and messy and doesn't work
            //   very well in a lot of edge cases
            //   - simple vertical cursor movement was broken when i tried turning it
            //     on for this page
            class={[
                "fixed top-0 left-0 pointer-events-none w-full h-full rounded-md",
                "bg-transparent text-transparent",
                // selected() ? "outline outline-green-500" : "",
            ].join(" ")}
            ref={el => {
                // we're going to do our own mouse handling
                // focus should only be called during our mouse handling stuff
                // actually we're going to preventdefault so it won't even lose focus
                // ok perfect
                createEffect(() => {
                    if(selected()) el.focus();
                });
            }}
            onKeyDown={(event) => {
                if(event.isComposing) return;

                // console.log(event);
                const selection = selected();
                if(!selection) return;
                const editor_nodes = [...div.querySelectorAll(
                    "bce\\:editor-leaf-node[data-editor-id="+JSON.stringify(editor_id)+"]",
                )];
                const getNode = (path: EditorPath): [Element, EditorLeafNodeData] => {
                    const leaf = document.getElementById(JSON.stringify([editor_id, path]));
                    if(!leaf) unreachable();
                    if(!editor_nodes.includes(leaf)) unreachable();
                    return [leaf, leafNodeData(leaf) ?? unreachable()];
                };

                const moveCursor = (sel: Selection, stop: number, depth: number): void => {
                    if(depth > 30) throw new Error("Failed");
                    const [node, node_data] = getNode(sel.anchor.path);
                    const res = node_data.moveCursor(sel.anchor.offset, stop);
                    if(typeof res !== "number") {
                        const dir = res.dir;
                        const curr_idx = editor_nodes.indexOf(node);
                        if(curr_idx === -1) throw new Error("movecursor from invalid node");
                        const next_idx = curr_idx + dir;
                        if(!editor_nodes[next_idx]) {
                            setSelected({
                                anchor: {
                                    path: sel.anchor.path,
                                    offset: node_data.cursorPos(dir),
                                },
                            });
                            return;
                        }
    
                        const next_node = editor_nodes[next_idx] as EditorLeafNode;
                        const nn_data = leafNodeData(next_node);
                        return moveCursor({
                            anchor: {
                                path: nn_data.path,
                                offset: nn_data.cursorPos(-dir as (-1 | 1)),
                            },
                        }, res.stop, depth + 1);
                    }
                    setSelected({
                        anchor: {
                            path: sel.anchor.path,
                            offset: res,
                        },
                    });
                };
    
                if(event.code === "ArrowLeft") {
                    moveCursor(selection, -1, 0);
                }else if(event.code === "ArrowRight") {
                    moveCursor(selection, 1, 0);
                }
    
                console.log(event);
            }}
            onBeforeInput={ev => batch((): void => {
                ev.preventDefault();
                // console.log("beforeinput", ev);
                const selection = selected();
                if(!selection) return;
                // const getNodePath = (sel: Selection): string[] => {
                //     let node: HTMLElement | null = sel.editor_node;
                //     const path: string[] = [];
                //     while(node) {
                //         const lnd = listNodeData(node);
                //         if(lnd) {
                //             path.unshift(lnd.id);
                //         }
                //         node = node.parentElement;
                //     }
                // };

                function replaceRange<U extends Point[]>(
                    l: Point, r: Point,
                    nv: string, track: U,
                ): [Point, Point, U] {
                    [l, r, [...track]] = deleteRange(props.node, l, r, [...track]);
                    const new_node = nc.userInput(nv);
                    [l, r, [...track]] = insertAt(props.node, l, new_node, [...track]);
                    return [l, r, track];

                    // whenever we do an operation like this, we need it to
                    // tell us the new positions of any markers
                    //
                    // so eg if we do this and someone else's cursor is somewhere, we
                    // need to preserve that cursor's position
                    //
                    // for now I'm just explicitly preserving some position
                }
                if(ev.inputType === "insertText") {
                    setSelected({
                        anchor: replaceRange(selection.anchor, selection.anchor, ev.data!, [])[0],
                    });
                }

            })}
            oncompositionstart={() => {
                //
            }}
            oncompositionend={() => {
                //
            }}
            oncompositionupdate={() => {
                //
            }}
            onfocusin={() => {
                setTextAreaFocused(true);
            }}
            onfocusout={() => {
                setTextAreaFocused(false);
            }}
        />
        <Show if={isObject(anGet(props.node))} fallback={<div class="bg-gray-800 p-1 rounded-md inline-block">
            <Buttons><Button onClick={() => {
                anSetReconcile(props.node, (): TextEditorRoot => ({
                    node: defaultnode(),
                }));
            }}>click to create</Button></Buttons>
        </div>}>
            <te_context.Provider value={{
                selection: [selected, setSelected],
                editor_id,
            }}>
                <itm_context.Provider value={{
                    get selection_group() {return selectionGroupMemo()},
                    path: [],
                }}>
                    <EditorNode node={props.node.node} />
                </itm_context.Provider>
            </te_context.Provider>
        </Show>
    </div>;
}
