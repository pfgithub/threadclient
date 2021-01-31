import * as React from "react";
import { Node, createEditor, Editor, Transforms } from "slate";
import { Slate, Editable, withReact } from "slate-react";

const { useCallback, useMemo, useState } = React;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CodeElement: React.FC = (props: any): React.ReactElement => {
    return <pre {...props.attributes}>
        <code>{props.children}</code>
    </pre>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DefaultElement: React.FC = (props: any): React.ReactElement => {
    return <p {...props.attributes}>{props.children}</p>;
};

export const App: React.FC = (): React.ReactElement => {
    const editor = useMemo(() => withReact(createEditor()), []);

    const [value, setValue] = useState<Node[]>([
        {type: "paragraph", children: [{text: "A line of text"}]}
    ]);

    const renderElement = useCallback((props): React.ReactElement => {
        switch(props.element.type) {
            case "code": return <CodeElement {...props} />;
            default: return <DefaultElement {...props} />;
        }
    }, []);

    return <Slate
        editor={editor}
        value={value}
        onChange={new_value => setValue(new_value)}
    >
        <Editable
            renderElement={renderElement}
            // todo update newline to isnert a br then a parargraph break if there alreads aflk
            // uh oh! this code block doesn't respond properly to newlines
            onKeyDown={(event: KeyboardEvent) => {
                if(event.key === "`" && event.ctrlKey) {
                    event.preventDefault();
                    Transforms.setNodes(editor, {type: "code"}, {match: n => Editor.isBlock(editor, n)});
                }
            }}
        />
    </Slate>;
};

export const main = (): React.ReactElement => <App />;