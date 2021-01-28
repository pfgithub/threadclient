// types that clients return

export type Page = {
    header: ContentNode,
    reply_button?: Action,
    replies?: Node[],
    sidebar?: ContentNode,
    display_style: string,
};
export type BodyText = {
    kind: "text",
    content: string,
    markdown_format: "reddit" | "none" | "mastodon",
};
export declare namespace Richtext {
    export type Style = {
        strong?: boolean,
        emphasis?: boolean,
        strikethrough?: boolean,
        superscript?: boolean,
        code?: boolean,
        error?: string,
    };
    export type Paragraph = {
        kind: "paragraph",
        children: Span[],
    } | {
        kind: "body",
        body: Body,
    } | {
        kind: "heading",
        level: number,
        children: Span[],
    } | {
        kind: "horizontal_line",
    } | {
        kind: "blockquote",
        children: Paragraph[],
    } | {
        kind: "list",
        ordered: boolean,
        children: Paragraph[],
    } | {
        kind: "list_item",
        children: Paragraph[],
    } | {
        kind: "code_block",
        text: string,
    } | {
        kind: "table",
        headings: TableHeading[],
        children: TableItem[][],
    };
    export type Span = {
        kind: "text",
        text: string,
        styles: Style,
    } | {
        kind: "link",
        url: string,
        title?: string,
        children: Span[],
    } | {
        kind: "br",
    } | {
        kind: "spoiler",
        children: Span[],
    };
    export type TableHeading = {
        align?: "left" | "center" | "right",
        children: Span[],
    };
    export type TableItem = {
        children: Span[],
    };
}
export type RichText = {
    kind: "richtext",
    content: Richtext.Paragraph[],
};
export type Body = BodyText | RichText | {
    kind: "link",
    url: string,
    embed_html?: string,
} | {
    kind: "captioned_image",
    url: string,
    caption?: string,
    alt?: string,
    w: number,
    h: number,
} | {
    kind: "video",
    url?: string,
    url_backup_image?: string,
    w: number,
    h: number,
    gifv: boolean,
    caption?: string,
    alt?: string,
} | {
    kind: "vreddit_video",
    id: string,
    w: number,
    h: number,
    gifv: boolean,
    caption?: string,
} | {
    kind: "gallery",
    images: GalleryItem[],
} | {
    kind: "poll",
    votable: true | string,
    total_votes: number,
    choices: {name: string, votes: number, id: string}[],
    vote_data: string,
    select_many: boolean,
    your_votes: {id: string}[],
} | {
    kind: "none",
} | {
    kind: "removed",
    by: "author" | "moderator",
    fetch_path: string,
} | {
    kind: "crosspost",
    source: Thread,
} | {
    kind: "array",
    body: (Body | undefined)[],
};
export type GalleryItem = {body: Body, thumb: string, w: number | null | undefined, h: number | null | undefined};
export type Thread = {
    kind: "thread",

    body: Body,
    thumbnail?: {
        url: string,
    },
    display_mode: {
        body: "visible" | "collapsed",
        body_default?: "open" | "closed",
        comments: "visible" | "collapsed",
    },
    replies?: Node[],
    raw_value: unknown,

    link: string,

    layout: "reddit-post" | "reddit-comment" | "mastodon-post" | "error",

    title?: {
        text: string,
    },

    info?: Info,
    actions: Action[],
    
    default_collapsed: boolean,

    flair?: Flair[],
};
export type Info = {
    time: number,
    author: {
        name: string, link: string, flair?: Flair[],
        pfp?: {
            url: string,
            hover: string,
        },
    },
    in?: {name: string, link: string},
    reblogged_by?: RebloggedBy,
    pinned: boolean,
};
export type RebloggedBy = Info;
export type LoadMore = {
    kind: "load_more",
    load_more: string,
    count?: number,
    includes_parent?: boolean,

    raw_value: unknown,
    next?: LoadMore,
};
export type Profile = {
    kind: "user-profile",
    username: string,
    link: string,
    bio: Body,
    raw_value: unknown,
    actions: Action[],
};
export type ContentNode = Thread | Profile;
export type Node = Thread | LoadMore;
export type RichTextItem = {
    type: "text",
    text: string,
} | {
    type: "emoji",
    url: string,
    name: string,
};
export type Flair = {
    color?: string,
    fg_color?: "light" | "dark",
    elems: RichTextItem[],
    content_warning: boolean,
};
export type ActionLabel = string;
export type Action = {
    kind: "link",
    url: string,
    text: ActionLabel,
} | {
    kind: "reply",
    text: ActionLabel,
    reply_info: string,
    // there will be a function to generate post previews given markdown you typed
    // so this doesn't need to know the markdown format (maybe it should know it
    // though for syntax highlighting or editor features or whatever)
} | CounterAction;
export type CounterAction = {
    kind: "counter",

    special?: "reddit-points",

    label: ActionLabel,
    incremented_label: ActionLabel,
    decremented_label?: ActionLabel,

    count_excl_you: number | "hidden",
    you: "increment" | "decrement" | undefined,

    actions: {
        increment: string,
        reset: string,
        decrement?: string,
    } | {error: string},

    percent?: number,
};