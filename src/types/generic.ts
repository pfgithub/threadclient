// types that clients return

export type Page = {
    title: string,
    header: ContentNode,
    sidebar?: ContentNode[],
    reply_button?: Action,
    replies?: Node[],
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
    choices: {name: string, votes: number | "hidden", id: string}[],
    vote_data: string,
    select_many: boolean,
    your_votes: {id: string}[],
    close_time: number, // ms since epoch utc
} | {
    kind: "none",
} | {
    kind: "removed",
    by: "author" | "moderator" | "anti_evil_ops" | "error",
    fetch_path?: Opaque<"fetch_removed_path">,
    body: Body,
} | {
    kind: "crosspost",
    source: Thread,
} | {
    kind: "array",
    body: (Body | undefined)[],
};
export type GalleryItem = {body: Body, thumb: string, w: number | null | undefined, h: number | null | undefined};
export type ThumbType = "self" | "default" | "image" | "spoiler" | "error" | "nsfw" | "account";
export type Thread = {
    kind: "thread",

    body: Body,
    thumbnail?: {
        kind: "image",
        url: string,
    } | {
        kind: "default",
        thumb: ThumbType,
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
    edited: false | number,
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
export type HList = {
    kind: "hlist",
    items: ContentNode[],
};

export type WidgetListItem = {
    icon?: string,
    name: {kind: "text", text: string} | {kind: "username", username: string} | {kind: "flair", flair: Flair},
    click: {kind: "link", url: string} | {kind: "body", body: Body},
    action?: Action,
};

export type Widget = {
    kind: "widget",
    title: string,
    actions_top?: Action[],
    actions_bottom?: Action[],
    widget_content: {
        kind: "list",
        items: WidgetListItem[],
    } | {
        kind: "community-details",
        description: string,
    } | {
        kind: "body",
        body: Body,
    },
    raw_value: unknown,
};

export type ContentNode = Thread | Profile | HList | Widget;
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
    reply_info: Opaque<"reply">,
} | CounterAction | {
    kind: "delete",
    data: Opaque<"act">,
} | {
    kind: "report",
    data: Opaque<"report">,
};

export type DataEncodings = "reply" | "act" | "report" | "fetch_removed_path";
export type Opaque<T extends DataEncodings> = {encoding_type: T, encoding_symbol: symbol};

// a counter or a button with 2-3 states
export type CounterAction = {
    kind: "counter",

    special?: "reddit-points",

    label: ActionLabel,
    incremented_label: ActionLabel,
    decremented_label?: ActionLabel,

    count_excl_you: number | "hidden" | "none",
    you: "increment" | "decrement" | undefined,

    actions: {
        increment: Opaque<"act">,
        reset: Opaque<"act">,
        decrement?: Opaque<"act">,
    } | {error: string},

    percent?: number,
};

export type ReportFlow = ReportScreen[];
export type ReportScreen = {
    title: string,
    description?: Body,
    report: ReportAction,
};

export type ReportAction = {
    kind: "submit",
    data: string,
} | {
    kind: "textarea",
    char_limit: number,
} | {
    kind: "link",
    url: string,
} | {
    kind: "more",
    screens: ReportScreen[],
};