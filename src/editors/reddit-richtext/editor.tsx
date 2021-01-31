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
        return element.type === "image" ? true : isInline(element);
    };
    editor.isVoid = element => {
        return element.type === "image" ? true : isVoid(element);
    };
    return editor;
}

export const App: React.FC = (): React.ReactElement => {
    const editor = useMemo(() => withMentions(withHistory(withReact(createEditor()))), []);

    const [value, setValue] = useState<Node[]>([
        {type: "paragraph", children: [{text: "A line of text"}]}
    ]);

    // render blocks
    const renderElement = useCallback((props): React.ReactElement => {
        switch(props.element.type) {
            case "image": return <ImageElement {...props} />;
            case "code": return <CodeElement {...props} />;
            default: return <DefaultElement {...props} />;
        }
    }, []);
    // render spans
    const renderLeaf = useCallback((props): React.ReactElement => {
        return <span {...props.attributes} style={{fontWeight: props.leaf.bold ? "bold" : "normal"}}>{props.children}</span>;
    }, []);

    return <Slate
        editor={editor}
        value={value}
        onChange={new_value => setValue(new_value)}
    >
        <Editable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            // todo update newline to isnert a br then a parargraph break if there alreads aflk
            // uh oh! this code block doesn't respond properly to newlines
            onKeyDown={(event: KeyboardEvent) => {
                if(event.code === "Enter") {
                    event.preventDefault();
                    // this does not show the cursor in the right position in firefox
                    return Transforms.insertText(editor, "\n");
                }
                if(event.key === "m" && event.ctrlKey) {
                    event.preventDefault();
                    return Transforms.insertNodes(editor, {image_text: "Hi!", type: "image", children: [{text: ""}]});
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
                    const [match] = Editor.nodes(editor, {
                        match: n => Text.isText(n) && !!n.bold,
                    });
                    Transforms.setNodes(editor, {bold: !match}, {match: n => Text.isText(n), split: true});
                }
            }}
        />
    </Slate>;
};

export const main = (): React.ReactElement => <App />;