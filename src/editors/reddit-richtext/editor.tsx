import * as React from "react";
import { Node as UntypedNode, createEditor, Editor, Transforms, Text, Path } from "slate";
import { Slate, Editable, withReact, useSelected, useFocused } from "slate-react";
import {withHistory} from "slate-history";

const { useCallback, useMemo, useState } = React;

const CodeElement = (props: RProps<CodeElement>): React.ReactElement => {
    return <pre {...props.attributes} className="rte-pre">
        <code>{props.children}</code>
    </pre>;
};

const ParagraphElement = (props: RProps<ParagraphElement>): React.ReactElement => {
    return <p {...props.attributes} className="rte-p">{props.children}</p>;
};

const NeverElement = (props: RProps<AnyElement>): React.ReactElement => {
    return <p {...props.attributes} className="rte-never">{props.children}</p>;
};

const BlockquoteElement = (props: RProps<BlockquoteElement>): React.ReactElement => {
    return <blockquote {...props.attributes} className="rte-quote">{props.children}</blockquote>;
};

const ImageElement = (props: RProps<ErrorSpan>): React.ReactElement => {
    const selected = useSelected();
    const focused = useFocused();
    return <span {...props.attributes}><span className={"rt-error "+(selected && focused ? "rt-focus " : "")}>{props.element.image_text}</span>{props.children}</span>;
};

type FormatType = "bold" | "italic" | "strike" | "inline_code" | "sup";
function updateFormat(editor: Editor, new_fmt: FormatType) {
    const [match] = Editor.nodes(editor, {
        match: n => Text.isText(n) && !!(n[new_fmt] as boolean),
    });
    Transforms.setNodes(editor, {[new_fmt]: !match}, {match: n => Text.isText(n), split: true});
}

const Spoiler: React.FC = (props): React.ReactElement => {
    const selected = useSelected();
    const focused = useFocused();
    return <span className={"rt-spoiler "+(selected && focused ? "rt-spoiler-reveal " : "")}><span className="rt-spoiler-content">{props.children}</span></span>;
};

const FormatButton = (props: {editor: Editor, format: FormatType, children?: React.ReactNode}): React.ReactElement => {
    return <button onMouseDown={e => {
        e.preventDefault();
        e.stopPropagation();
        updateFormat(props.editor, props.format);
    }}>{props.children}</button>;
};

// either block or inline
type ParagraphElement = {
    type: "paragraph",
    children: AnySpan[],
};
type CodeElement = {
    type: "code",
    children: UnformattedLeaf[],
};
type BlockquoteElement = {
    type: "blockquote",
    children: BlockElement[],
};
type BlockElement = ParagraphElement | CodeElement | BlockquoteElement;

type SpoilerSpan = {
    type: "spoiler",
    children: AnySpan[],
};
type ErrorSpan = {
    type: "error",
    image_text: string,
    children: [EmptyLeaf],
};
const inline_vs: {[key in InlineElementType]: true} = {
    spoiler: true,
    error: true,
};
const void_vs: {[key in VoidElementType]: true} = {
    error: true,
};

type SpanElement = SpoilerSpan | ErrorSpan;
type VoidElement = ErrorSpan;

type InlineElementType = SpanElement["type"];
type BlockElementType = BlockElement["type"];
type VoidElementType = VoidElement["type"];

type AnySpan = Leaf | SpanElement;
type AnyElement = BlockElement | SpanElement;

// a text node
type UnformattedLeaf = {text: string};
type Leaf = UnformattedLeaf & ({
    [key in FormatType]?: boolean;
});
type EmptyLeaf = {text: ""};

type Node = BlockElement | Leaf;

type RProps<T> = {attributes: {[key: string]: unknown}, children: React.ReactElement}
    & (T extends {children: unknown[]} ? {element: T} : T extends {text: string} ? {leaf: T} : unknown)
;
type RenderElement = (props: RProps<BlockElement>) => React.ReactElement;
type RenderLeaf = (props: RProps<Leaf>) => React.ReactElement;

// should the start and end of spoilers have a text node like `>` and `<`? that way it's easier to choose if you are adding to the spoiler or not?

const withPlugin = (editor: Editor): Editor => {
    const {isInline, isVoid, normalizeNode} = editor;

    editor.normalizeNode = entry => {
        const [node, path] = entry as [Node, Path];

        if('children' in node && node.type === "blockquote") {
            for(const [child_raw, child_path] of UntypedNode.children(editor, path)) {
                const child = child_raw as Node;
                if('text' in child) {
                    Transforms.wrapNodes(editor, {type: "blockquote", children: []}, {at: child_path});
                    return;
                }
            }
        }
        if('text' in node && (node.inline_code ?? false)) {
            Transforms.setNodes(editor, {bold: false, italic: false, strike: false, sup: false} as Partial<Leaf>, {at: path});
            return;
        }

        return normalizeNode(entry);
    };
    editor.isInline = (element_raw) => {
        const element = element_raw as AnyElement;
        if(element.type in inline_vs) return true;
        return isInline(element);
    };
    editor.isVoid = (element_raw) => {
        const element = element_raw as AnyElement;
        if(element.type in void_vs) return true;
        return isVoid(element);
    }

    return editor;
};

function expectNeverValue<T>(a: never, b: T): T {
    return b;
};

// TODO: down arrow at bottom of page : insert a paragraph below if the outer element is not a paragraph
export const App: React.FC = (): React.ReactElement => {
    const editor = useMemo(() => withHistory(withReact(withPlugin(createEditor()))), []);

    const [value, setValue] = useState<Node[]>([
        {type: "paragraph", children: [{text: "Hello and welcome!"}]},
        {type: "paragraph", children: [{text: "Lorem ipsum is simply dummy text of the printing and typesetting industry"}]},
        {type: "blockquote", children: [{type: "paragraph", children: [{text: "Lorem ipsum is simply dummy text of the printing and typesetting industry"}]}]},
        {type: "paragraph", children: [{text: "Here is a spoiler: "}, {type: "spoiler", children: [{text: "Star wars dies in infinity war"}]}]},
    ]);

    // render blocks
    const renderElement: RenderElement = useCallback((props: RProps<AnyElement>): React.ReactElement => {
        switch(props.element.type) {
            case "error": return <ImageElement {...{...props, element: props.element}} />;
            case "code": return <CodeElement {...{...props, element: props.element}} />;
            case "blockquote": return <BlockquoteElement {...{...props, element: props.element}} />;
            case "paragraph": return <ParagraphElement {...{...props, element: props.element}} />;
            case "spoiler": return <span {...props.attributes}><Spoiler>{props.children}</Spoiler></span>;
            default: return expectNeverValue(props.element, <NeverElement {...props} />);
        }
    }, []);
    // render spans
    const renderLeaf: RenderLeaf = useCallback((props: RProps<Leaf>): React.ReactElement => {
        let outer_elem: React.ReactElement = <span>{props.children}</span>;
        const leaf = props.leaf;

        if(leaf.inline_code ?? false) {
            outer_elem = <code className="rt-inline-code">{outer_elem}</code>;
        }else{
            if(leaf.bold ?? false) outer_elem = <b>{outer_elem}</b>;
            if(leaf.italic ?? false) outer_elem = <i>{outer_elem}</i>;
            if(leaf.strike ?? false) outer_elem = <s>{outer_elem}</s>;
            if(leaf.sup ?? false) outer_elem = <sup>{outer_elem}</sup>;
        }

        return <span {...props.attributes}>{outer_elem}</span>;
    }, []);

    return <Slate
        editor={editor}
        value={value}
        onChange={new_value => setValue(new_value as Node[])}
    >
        <div className="rt-buttons">
            <FormatButton editor={editor} format="bold">Bold</FormatButton>
            <FormatButton editor={editor} format="italic">Italic</FormatButton>
            <button>Link</button>
            <FormatButton editor={editor} format="strike">Strike</FormatButton>
            <FormatButton editor={editor} format="inline_code">Inline Code</FormatButton>
            <FormatButton editor={editor} format="sup">Superscript</FormatButton>
            <button>Spoiler</button>
            <div className="rt-button-sep" />
            <button>Heading lv</button>
            <button>Bulleted List</button>
            <button>Numbered List</button>
            <button>Blockquote</button>
            <button>Block Code</button>
            <div className="rt-button-sep" />
            <button>Table</button>
        </div>
        <Editable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            // todo update newline to isnert a br then a parargraph break if there alreads aflk
            // uh oh! this code block doesn't respond properly to newlines
            onKeyDown={(event: KeyboardEvent) => {
                if(event.code === "Enter") {
                    const [match] = Editor.nodes(editor, {
                        match: n => Editor.isBlock(editor, n) && n.type === "code",
                    });
                    if(!event.shiftKey && !match) return;
                    event.preventDefault();
                    // this does not show the cursor in the right position in firefox
                    return Transforms.insertText(editor, "\n");
                }
                if(event.key === "m" && event.ctrlKey) {
                    event.preventDefault();
                    return Transforms.insertNodes(editor, {image_text: "Hi!", type: "error", children: [{text: ""}]});
                }
                if(event.key === "`" && event.ctrlKey) {
                    event.preventDefault();

                    const [match] = Editor.nodes(editor, {
                        match: n => n.type === "code",
                    });
                    Transforms.setNodes(editor, {type: match ? "paragraph" : "code"}, {match: n => Editor.isBlock(editor, n)});
                }
                if(event.key === "b" && event.ctrlKey) {
                    event.preventDefault();
                    updateFormat(editor, "bold");
                }
            }}
        />
    </Slate>;
};

export const main = (): React.ReactElement => <App />;