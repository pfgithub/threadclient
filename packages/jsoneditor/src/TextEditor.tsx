import {
    createContext, createRenderEffect, createSelector, createSignal,
    For, JSX, Show, Signal, untrack, useContext
} from "solid-js";
import { Dynamic, insert } from "solid-js/web";
import { anBool, anGet, anKeys, AnNode, anSetReconcile, anString } from "./app_data";
import { Button, Buttons } from "./components";
import { DragButton, DraggableList } from "./DraggableList";
import { asObject, isObject } from "./guards";
import { Include } from "./util";
import { uuid, UUID } from "./uuid";

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
type MoveCursorResult = CursorIndex | {dir: -1 | 1, stop: number};
type EditorLeafNodeData = {
    moveCursor: (position: CursorIndex, stop: number) => MoveCursorResult,
    cursorPos: (v: -1 | 1) => CursorIndex,
};
type EditorListNodeData = {
    _?: undefined,
};
type EditorLeafNode = HTMLElement & {
    [editor_leaf_node_data]: EditorLeafNodeData,
};
type EditorListNode = HTMLElement & {
    [editor_list_node_data]: EditorListNodeData,
};
export type Selection = {editor_node: EditorLeafNode, index: CursorIndex};

export type Richtext = TextEditorRoot;
export type TextEditorRoot = {
    node: TextEditorRootNode,
};

export type TextEditorRootNode = {
    kind: "root",
    children: {[key: UUID]: TextEditorFlatNode},
    // ^ right, we didn't want this because we want the manager to be able to handle this
    // I think we can actually use real dom nodes though
    // eg we can have <Leaf> and <EditorSelectable ondelete={}>
    // that should work alright
};

export type TextEditorIndentItem = {
    __nothing: null,
    //GROUP_ID so we can properly split at borders and stuff
    // we will look in another map I guess to determine the kind
};

export type TextEditorFlatNode = {
    indent: {[group_id: string]: TextEditorIndentItem},
    node: TextEditorParagraphNode,
};

export type TextEditorParagraphNodeParagraph = {
    kind: "paragraph",
    children: {[key: string]: TextEditorLeafNode},
};
export type TextEditorParagraphNodeMultilineCodeBlock = {
    kind: "multiline_code_block",
    language: string,
    text: string,
};
export type TextEditorParagraphNodeImage = {
    kind: "image",
    contenthash: string,
    ext: string,
    // ^ for file storage we will use content hashes
    // we can probably mess around with the structure to make it possible
    // to gc unused content

    // images are a bit special in that for one source content hash we might
    // generate thumbnails and stuff
};
export type TextEditorParagraphNodeEmbeddedSchemaEditor = {
    kind: "embedded_schema_editor",
};
export type TextEditorParagraphNode =
    | TextEditorParagraphNodeParagraph
    | TextEditorParagraphNodeMultilineCodeBlock
    | TextEditorParagraphNodeImage
    | TextEditorParagraphNodeEmbeddedSchemaEditor
;

export type TextStyle = {bold?: undefined | boolean};
export type TextEditorLeafNodeText = {
    kind: "text",
    text: string,
    style?: undefined | TextStyle,
};
export type TextEditorLeafNodeInlineCode = {
    kind: "inline_code",
    text: string,
};
export type TextEditorLeafNode = TextEditorLeafNodeText | TextEditorLeafNodeInlineCode;

type TextEditorAnyNode = TextEditorRootNode | TextEditorParagraphNode | TextEditorLeafNode;
// ^ TODO: remove this. temporary hack.

const nc = {
    array<T>(...items: T[]): {[key: string]: T} {
        return Object.fromEntries(items.map(itm => [uuid(), itm] as const));
    },
    root(...ch: [...TextEditorIndentItem[], TextEditorParagraphNode][]): TextEditorRootNode {
        return {
            kind: "root",
            children: nc.array(...ch.map((v): TextEditorFlatNode => {
                const a = [...v];
                const last = a.pop()! as TextEditorParagraphNode;
                const idnt = a as TextEditorIndentItem[];
                return {
                    indent: Object.fromEntries(idnt.map((q, i) => (["<!>"+i, q]))),
                    node: last,
                };
            })),
        };
    },
    par(...ch: TextEditorLeafNode[]): TextEditorParagraphNode {
        return {
            kind: "paragraph",
            children: nc.array(...ch),
        };
    },
    code(lang: string, text: string): TextEditorParagraphNode {
        return {
            kind: "multiline_code_block",
            language: lang,
            text: text,
        };
    },
    img(contenthash: string, ext: string): TextEditorParagraphNode {
        return {
            kind: "image",
            contenthash: contenthash,
            ext: ext,
        };
    },
    embeddedSchemaEditor(): TextEditorParagraphNode {
        return {
            kind: "embedded_schema_editor",
        };
    },
    text(txt: string, styl?: TextStyle | undefined): TextEditorLeafNode {
        return {
            kind: "text",
            text: txt,
            style: styl,
        };
    },
    inlineCode(txt: string): TextEditorLeafNode {
        return {
            kind: "inline_code",
            text: txt,
        };
    },
} as const;

// so we'll have a function Leaf that is a text editor
// gives you basic functions and you can put it where you need it to edit text

const node_renderers: {
    [key in TextEditorAnyNode["kind"]]?: (props: {node: AnNode<Include<TextEditorAnyNode, {kind: key}>>}) => JSX.Element
} = {
    root(props: {node: AnNode<TextEditorRootNode>}): JSX.Element {
        return <RtList>
            <DraggableList
                items={anKeys(props.node.children)}
                setItems={cb => {
                    anSetReconcile(props.node.children, v => {
                        const pv = asObject(v) ?? {};
                        const nv = cb(Object.keys(pv));
                        return Object.fromEntries(nv.map(key => [key, pv[key]! as TextEditorFlatNode]));
                    });
                }}

                wrapper_class="pt-2 first:pt-0"
                nodeClass={() => ""}
            >{(key, dragging, index) => {
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
                                    alert("TODO insert paragraph");
                                }}
                            >
                                +
                            </button>
                        </div>
                        <DragButton class={"px-2 rounded-md h-full "+(dragging() ? "bg-gray-500" : "")}>≡</DragButton>
                    </div>
                    <div class="flex-1 relative">
                        <div
                            class={[
                                "-mt-1 absolute bg-blue-500 w-full h-1 rounded-full",
                                hovering() ? "opacity-100" : "opacity-0",
                                "transition-opacity",
                            ].join(" ")}
                            style="transform: translateY(-50%)"
                        />
                        <EditorNode node={props.node.children[key as UUID]!.node} />
                    </div>
                </div>;
            }}</DraggableList>
        </RtList>;
    },
    paragraph(props): JSX.Element {
        return <p>
            <EditorChildren node={props.node.children} />
            <LeafSignal text=" " setText={() => {
                throw new Error("todo delete the paragraph break");
            }} />
        </p>;
    },
    multiline_code_block(props): JSX.Element {
        return <pre class="bg-gray-800 p-2 rounded-md whitespace-pre-wrap"><code>
            <Leaf node={props.node.text} />
            <LeafSignal text=" " setText={() => {
                throw new Error("todo delete the paragraph break");
            }} />
        </code></pre>;
    },
    image(props): JSX.Element {
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
    embedded_schema_editor(props): JSX.Element {
        return <div class="bg-gray-800 p-2 rounded-md">
            {"ETODO"/*<NodeEditor schema={schema() as NodeSchema} path={[...props.path, "value"]} />*/}
        </div>;
    },
    text(props): JSX.Element {
        return <span class={(() => {

            const styles: string[] = [];
            const style = props.node.style;
            if(anBool(style.bold) ?? false) styles.push("font-bold");

            return styles.join(" ");
        })()}><Leaf node={props.node.text} /></span>;
    },
    inline_code(props): JSX.Element {
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
    const [selection, setSelection] = ctx.selection;

    const node_data: EditorLeafNodeData = {
        moveCursor: props.moveCursor,
        cursorPos: props.cursorPos,
    };
    const node: EditorLeafNode = Object.assign(
        document.createElement("bce:editor-leaf-node"),
        {[editor_leaf_node_data]: node_data},
    );
    node.setAttribute("data-editor-id", ctx.editor_id);
    // so we can querySelector the root node for bce:editor-node[data-editor-id="…"]
    // alternatively, we could maintain an array by having EditorSpan add and remove
    // onCleanup() couldn't we
    insert(node, <>
        {untrack(() => props.children({
            // this is just <props.children />
            get selection() {
                console.log("updating selection");
                if(!ctx.selected(node)) return null;
                const selxn = selection();
                if(selxn == null) return null;
                return selxn.index;
            },
            onSelect: (nv) => {
                const nr: Selection | null = nv == null ? null : {
                    editor_node: node,
                    index: nv,
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
            <Show when={iprops.selection != null}>
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
}): JSX.Element {
    return <RtList>
        <For each={anKeys(props.node)}>{key => {
            return <EditorNode node={props.node[key]!} />;
        }}</For>
    </RtList>;
}

export function EditorNode(props: {
    node: AnNode<TextEditorAnyNode>,
}): JSX.Element {
    const nodeKind = () => anString(props.node.kind);
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
    selected: (key: HTMLElement | null) => boolean,
    selection: Signal<Selection | null>,
    editor_id: UUID,
}>();

const defaultnode = (): TextEditorRootNode => nc.root(
    [nc.par(
        nc.text("hello, "),
        nc.text("world", {bold: true}),
        nc.text("! "),
        nc.inlineCode("fancy!"),
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

export function RichtextEditor(props: {
    node: AnNode<Richtext>,
}): JSX.Element {
    const [selected, setSelected] = createSignal<Selection | null>(null);

    const editor_id = uuid();
    let div!: HTMLDivElement;

    const selector = createSelector<HTMLElement | null, HTMLElement | null>(() => {
        const sel = selected();
        console.log("updating selector value", sel);
        if(sel == null) return null;
        return sel.editor_node;
    });

    // this stylinng can probably be provided by the root node
    return <div
        class="min-h-[130px] p-2 bg-gray-700 rounded-md"
        tabindex="0"
        ref={div}
        onKeyDown={(event) => {
            console.log(event);
            const selection = selected();
            if(!selection) return;
            const editor_nodes = [...div.querySelectorAll(
                "bce\\:editor-leaf-node[data-editor-id="+JSON.stringify(editor_id)+"]",
            )];
                
            const moveCursor = (sel: Selection, stop: number, depth: number): void => {
                if(depth > 30) throw new Error("Failed");
                const node_data = sel.editor_node[editor_leaf_node_data];
                const res = node_data.moveCursor(sel.index, stop);
                if(typeof res !== "number") {
                    const dir = res.dir;
                    const curr_idx = editor_nodes.indexOf(sel.editor_node);
                    if(curr_idx === -1) throw new Error("movecursor from invalid node");
                    const next_idx = curr_idx + dir;
                    if(!editor_nodes[next_idx]) {
                        setSelected({
                            editor_node: sel.editor_node,
                            index: node_data.cursorPos(dir),
                        });
                        return;
                    }

                    const next_node = editor_nodes[next_idx] as EditorLeafNode;
                    return moveCursor({
                        editor_node: next_node,
                        index: next_node[editor_leaf_node_data].cursorPos(-dir as (-1 | 1)),
                    }, res.stop, depth + 1);
                }
                setSelected({
                    editor_node: sel.editor_node,
                    index: res,
                });
            };

            if(event.code === "ArrowLeft") {
                moveCursor(selection, -1, 0);
            }else if(event.code === "ArrowRight") {
                moveCursor(selection, 1, 0);
            }
        }}
    >
        <Show when={isObject(anGet(props.node))} fallback={<div class="bg-gray-800 p-1 rounded-md inline-block">
            <Buttons><Button onClick={() => {
                anSetReconcile(props.node, (): TextEditorRoot => ({
                    node: defaultnode(),
                }));
            }}>click to create</Button></Buttons>
        </div>}>
            <te_context.Provider value={{
                selected: selector,
                selection: [selected, setSelected],
                editor_id,
            }}>
                <EditorNode node={props.node.node} />
            </te_context.Provider>
        </Show>
    </div>;
}
