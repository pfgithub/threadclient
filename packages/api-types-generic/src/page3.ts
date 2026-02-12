import { Flair, Info } from "./generic";

// we can do a slow migration instead of all-at-once by modifying page2 to add this

type Document = {
    root: Link<Node>,
    contents: Record<string, unknown>,
};
type Node = Container<NodeTheme>;

type Link<T> = string & {__is_link: true};

type NodeTheme = {
    kind: "todo",
} | {
    kind: "post",
    display: "post" | "comment",
    title?: Driver<string | undefined>,
};

type Driver<T> = string & {__value: T};
type Container<T> = {
    theme: Link<T>,
    data: Record<string, unknown>;
};

const example: Document = {
    root: "demo:homepage" as Link<Node>,
    contents: {
        "demo:homepage<Node>": {
            theme: "demo:homepage<NodeTheme>" as Link<NodeTheme>,
            data: {
                title: "hello" satisfies string | undefined,
            },
        } satisfies Node,
        "demo:homepage<NodeTheme>": {
            kind: "post",
            display: "post",
            title: "title" as Driver<string | undefined>,
        } satisfies NodeTheme,
    },
};
