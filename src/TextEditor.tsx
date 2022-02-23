import { createContext, createEffect, createRenderEffect, createSelector, createSignal, For, Show, untrack, useContext } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Dynamic, insert } from "solid-js/web";
import { Button } from "./components";
import { modValue, Path } from "./editor_data";
import NodeEditor from "./NodeEditor";
import { NodeSchema, RichtextSchema, sc } from "./schema";
import { text_editor_selection } from "./symbols";
import { uuid, UUID } from "./uuid";

// [!]NOTES
// we're going to do binary-search based text leaf measurement
// so::
// - for pressing the up arrow, do that
// but we can also:
// - rather than using browser selection, we can use pointer events manually
//   ourselves for selecting text
// - that'll be way nicer than trying to hack around the text selection api I think
// so basically:
// - make a range over the text node
// - measure
//
// oh and once we're doing that, we can also do that for showing the cursor
// that may be more difficult though

// okay so
// ::
// we get to pick how the ui works
// basically there is a choice
// - flat paragraphs
// or
// - higherarchical paragraphs
//
// flat paragraphs make for better ui and are easier to work with in code
// higherarchical paragraphs are what is currently programmed
//
// flat would basically mean a paragraph has an array of things before it
// like "blockquote" then "list item" then "blockquote" before the actual content
//
// flat paragraphs make room for adding a table paragraph
//
// flat paragraphs make room for very high quality ui for like inserting paragraphs
// and changing paragraphs and all that stuff
//
//
//
// we currently have higherarchical
//
// I guess the question is how to implement tables in flat
//
// or if maybe we can treat flat as hierarchical
//
// ok well let's try see if we can
// basically that would mean Root contains like the fancy editor thing and most paragraph
// nodes except for a few rare ones that end up inside containers or something

// here's something interesting
//
//   > paragraph one
//   >
//   > |paragraph two
//
// pressing left should move your cursor here
//
//   > paragraph one
//   > |
//   > paragraph two
//
// but delete should make this:
//
// pressing left should move your cursor here

//   > paragraph one
//   
//   |paragraph two
//
// I guess we will have to be able to know what the
// selection is going to be used for. the indent nodes
// should only work that way under some conditions.
//
// alternatively, we can use the enter key for that

// https://brooknovak.wordpress.com/2013/06/11/find-the-character-position-using-javascript-fast-big-pages-all-browsers-no-preprocessing/
// that's outdated so it doesn't know you can measure ranges now
//
// but basically we'll want to search the text node by measuring ranges and stuff
//
// this is really annoying because the browser already knows all this information
// (it's possible it has forgotten it if it just renders to a canvas and then
//  discards that info)

export type Selection = [editor_node: HTMLElement, index: CursorIndex] | null;

export type TextEditorRoot = {
    node: TextEditorRootNode,
    [text_editor_selection]: Selection,
};

export type TextEditorRootNode = {
    kind: "root",
    children: {[key: UUID]: TextEditorFlatNode};
    // ^ right, we didn't want this because we want the manager to be able to handle this
    // I think we can actually use real dom nodes though
    // eg we can have <Leaf> and <EditorSelectable ondelete={}>
    // that should work alright
};

export type TextEditorIndentItem = {
    group_id: UUID, // so we can properly split at borders and stuff
    // we will look in another map I guess to determine the kind
};

export type TextEditorFlatNode = {
    indent: TextEditorIndentItem[],
    node: TextEditorParagraphNode,
};

export type TextEditorParagraphNode = {
    kind: "paragraph",
    children: {[key: UUID]: TextEditorLeafNode};
} | {
    kind: "multiline_code_block",
    language: string,
    text: string,
} | {
    kind: "image",
    contenthash: string,
    ext: string,
    // ^ for file storage we will use content hashes
    // we can probably mess around with the structure to make it possible
    // to gc unused content

    // images are a bit special in that for one source content hash we might
    // generate thumbnails and stuff
} | {
    kind: "embedded_schema_editor",
    schema: NodeSchema,
    value?: undefined | unknown,
};

export type TextStyle = {bold?: undefined | boolean};
export type TextEditorLeafNode = {
    kind: "text",
    text: string,
    style?: undefined | TextStyle,
} | {
    kind: "inline_code",
    text: string,
};

// these are debugging tools. eventually we won't have any use for them anymore
const nc = {
    array<T>(...items: T[]): {[key: UUID]: T} {
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
                    indent: idnt,
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
            text,
        };
    },
    img(contenthash: string, ext: string): TextEditorParagraphNode {
        return {
            kind: "image",
            contenthash,
            ext,
        };
    },
    embeddedSchemaEditor(schema: NodeSchema): TextEditorParagraphNode {
        return {
            kind: "embedded_schema_editor",
            schema,
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

const node_renderers: {[key: string]: (props: {path: Path}) => JSX.Element} = {
    root(props): JSX.Element {
        const [value, setValue] = modValue(() => [...props.path, "children"]);

        return <div class="space-y-2">
            <For each={Object.keys(value())}>{key => {
                // TODO add the indent
                return <EditorNode path={[...props.path, "children", key, "node"]} />;
            }}</For>
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
    embedded_schema_editor(props): JSX.Element {
        const [schema, setSchema] = modValue(() => [...props.path, "schema"]);

        return <div class="bg-gray-800 p-2 rounded-md">
            <NodeEditor schema={schema() as NodeSchema} path={[...props.path, "value"]} />
        </div>;
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
    const [selection, setSelection] = modValue(() => [...ctx.root_path(), text_editor_selection]);

    const node: HTMLElement = document.createElement("bce:editor-node");
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

const defaultnode: TextEditorRootNode = nc.root(
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
    [nc.embeddedSchemaEditor(
        sc.object({
            name: sc.string(),
            description: sc.richtext(),
        }),
    )],
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
    schema: RichtextSchema,
    path: Path,
}): JSX.Element {
    const [value, setValue] = modValue(() => props.path);

    const editor_id = uuid();

    const selector = createSelector<HTMLElement | null, HTMLElement | null>(() => {
        const v = value();
        console.log("updating selector value", v);
        if(v == null || typeof v !== "object") return null;
        const sel = v[text_editor_selection] as Selection;
        if(sel == null) return null;
        return sel[0];
    });

    // this stylinng can probably be provided by the root node
    return <div class="min-h-[130px] p-2 bg-gray-700 rounded-md">
        <Show when={value()} fallback={<div class="bg-gray-800 p-1 rounded-md inline-block">
            <Button onClick={() => {
                const nv: TextEditorRootNode = JSON.parse(JSON.stringify(defaultnode));
                const nv_n: TextEditorRoot = {
                    node: nv,
                    [text_editor_selection]: null,
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
