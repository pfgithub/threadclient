import * as React from "react";
import { Node, createEditor, Editor, Transforms, Text } from "slate";
import { Slate, Editable, withReact, useSelected, useFocused } from "slate-react";
import {withHistory} from "slate-history";

const { useCallback, useMemo, useState } = React;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CodeElement: React.FC = (props: any): React.ReactElement => {
    return <pre {...props.attributes} className="rte-pre">
        <code>{props.children}</code>
    </pre>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DefaultElement: React.FC = (props: any): React.ReactElement => {
    return <p {...props.attributes} className="rte-p">{props.children}</p>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ImageElement: React.FC = (props: any): React.ReactElement => {
    const selected = useSelected();
    const focused = useFocused();
    return <span {...props.attributes}><span className={"rt-error "+(selected && focused ? "rt-focus " : "")}>{props.element.image_text}</span>{props.children}</span>;
};

const withMentions = (editor: Editor): Editor => {
    const {isInline, isVoid} = editor;
    editor.isInline = element => {
        if(element.type === "error") return true;
        return isInline(element);
    };
    editor.isVoid = element => {
        if(element.type === "error") return true;
        return isVoid(element);
    };
    return editor;
};

type FormatType = "bold" | "italic" | "strike" | "inline_code" | "sup" | "spoiler";
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

// TODO: if the cursor is at the bottom or top of the document, pressing down/up should insert a paragraph below/above
// basically to make sure you don't get stuck in code blocks

// TODO: pressing enter should insert a newline, pressing enter again should make a paragraph break

export const App: React.FC = (): React.ReactElement => {
    const editor = useMemo(() => withHistory(withReact(withMentions(createEditor()))), []);

    const [value, setValue] = useState<Node[]>([
        {type: "paragraph", children: [{text: "A line of text"}]}
    ]);

    // render blocks
    const renderElement = useCallback((props): React.ReactElement => {
        switch(props.element.type) {
            case "error": return <ImageElement {...props} />;
            case "code": return <CodeElement {...props} />;
            default: return <DefaultElement {...props} />;
        }
    }, []);
    // render spans
    const renderLeaf = useCallback((props): React.ReactElement => {
        const leaf_info = props.leaf as {[key in FormatType]: boolean};

        let outer_elem: React.ReactElement = <span>{props.children}</span>;

        if(leaf_info.inline_code) {
            outer_elem = <code className="rt-inline-code">{outer_elem}</code>;
        }else{
            if(leaf_info.bold) outer_elem = <b>{outer_elem}</b>;
            if(leaf_info.italic) outer_elem = <i>{outer_elem}</i>;
            if(leaf_info.strike) outer_elem = <s>{outer_elem}</s>;
            if(leaf_info.sup) outer_elem = <sup>{outer_elem}</sup>;
        }
        // uh oh spoilers don't work right - they might need to be inline, non-void elements instead
        if(leaf_info.spoiler) outer_elem = <Spoiler>{outer_elem}</Spoiler>;

        return <span {...props.attributes}>{outer_elem}</span>;
    }, []);

    return <Slate
        editor={editor}
        value={value}
        onChange={new_value => setValue(new_value)}
    >
        <div className="rt-buttons">
            <FormatButton editor={editor} format="bold">Bold</FormatButton>
            <FormatButton editor={editor} format="italic">Italic</FormatButton>
            <button>Link</button>
            <FormatButton editor={editor} format="strike">Strike</FormatButton>
            <FormatButton editor={editor} format="inline_code">Inline Code</FormatButton>
            <FormatButton editor={editor} format="sup">Superscript</FormatButton>
            <FormatButton editor={editor} format="spoiler">Spoiler</FormatButton>
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