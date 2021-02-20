// types that clients return

export type Page = {
    title: string,
    navbar: Action[],
    sidebar?: ContentNode[],
    reply_button?: Action,
    body: {
        kind: "listing",
        header: ContentNode,
        previous?: LoadMore,
        items: UnmountedNode[],
        next?: LoadMoreUnmounted,
    } | {
        kind: "one",
        item: UnmountedNode,
    },
    display_style: string,
};
export type UnmountedNode = {
    // [...Node[], ContentNode] // requires a newer version of typescript
    parents: Node[], // might contain load_more. the last item in parents is this_node.
    sort?: Menu,
    replies: Node[],
};
export type BodyText = {
    kind: "text",
    content: string,
    markdown_format: "reddit" | "reddit_html" | "none",
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
        is_user_link?: string,
        url: string,
        title?: string,
        children: Span[],
    } | {
        kind: "br",
    } | {
        kind: "spoiler",
        children: Span[],
    } | {
        kind: "emoji",
        url: string,
        hover: string,
    } | {
        kind: "error",
        text: string,
        value: unknown,
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
    kind: "unknown_size_image",
    url: string,
} | {
    kind: "video",
    source: VideoSource,
    w?: number,
    h?: number,
    gifv: boolean,
    caption?: string,
    alt?: string,
} | {
    kind: "vreddit_video",
    id: string,
    w?: number,
    h?: number,
    gifv: boolean,
    caption?: string,
} | {
    kind: "gfycat",
    id: string,
    host: string,
} | {
    kind: "youtube",
    id: string,
    search: string,
} | {
    kind: "imgur",
    imgur_id: string,
    imgur_kind: "album" | "gallery",
} | {
    kind: "twitch_clip",
    slug: string,
} | {
    kind: "reddit_suggested_embed",
    suggested_embed: string,
} | {
    kind: "audio",
    url: string,
    caption?: string,
    alt?: string,
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
} | {
    kind: "link-preview",
    thumb?: string, // thumbnail url
    click: Body,
    title: string,
    description: string,
    url: string,
    click_enabled: boolean,
};
export type VideoSource = {
    kind: "video",
    sources: {
        url: string,
        type?: string,
    }[],
} | {
    kind: "img",
    url: string,
} | {
    kind: "m3u8",
    url: string,
    poster?: string,
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
    time: false | number,
    edited: false | number,
    author: {
        name: string,
        color_hash: string,
        link: string,
        flair?: Flair[],
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
    load_more: Opaque<"load_more">,
    url: string, // right click, open in new tab
    count?: number,

    raw_value: unknown,
};
export type LoadMoreUnmounted = {
    kind: "load_more_unmounted",
    load_more_unmounted: Opaque<"load_more_unmounted">,
    url: string,
    count?: number,
    
    raw_value: unknown,
};
export type Profile = {
    kind: "user-profile",
    username: string,
    link: string,
    bio: Body,
    raw_value: unknown,
    actions: Action[],
};
export type RedditHeader = {
    kind: "reddit-header",
    banner?: {
        desktop: string,
        mobile?: string,
    },
    icon?: {
        url: string,
    },
    name: {
        display?: string,
        link_name: string,
    },
    subscribe?: Action,
    menu?: Menu,
    raw_value: unknown,
};

export type Menu = TopLevelMenuItem[];
export type TopLevelMenuItem = MenuItem & {selected: boolean};
export type MenuItem = {
    text: string,
    action: {
        kind: "link",
        url: string,
    } | {
        kind: "menu",
        children: MenuItem[],
    },
};

export type WidgetListItem = {
    icon?: string,
    name: {kind: "text", text: string} | {kind: "username", username: string} | {kind: "flair", flair: Flair} | {kind: "image", src: string, w: number, h: number, alt?: string},
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
        above_text?: Body,
        items: WidgetListItem[],
    } | {
        kind: "community-details",
        description: string,
    } | {
        kind: "body",
        body: Body,
    } | {
        kind: "iframe",
        srcdoc: string,
        height: string,
    } | {
        kind: "image",
        width: number,
        height: number,
        src: string,
        link_url?: string,
    },
    raw_value: unknown,
};

export type ContentNode = Thread | Profile | RedditHeader | Widget;
export type Node = Thread | LoadMore;
export type RichTextItem = {
    type: "text",
    text: string,
} | {
    type: "emoji",
    url: string,
    name: string,
    w: number,
    h: number,
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
} | {
    kind: "login",
    data: Opaque<"login_url">,
} | {
    kind: "act",
    action: Opaque<"act">,
    text: string,
};

export type DataEncodings = "reply" | "act" | "report" | "send_report" | "fetch_removed_path" | "load_more" | "load_more_unmounted" | "login_url";
export type Opaque<T extends DataEncodings> = {encoding_type: T, encoding_symbol: symbol};

// a counter or a button with 2-3 states
export type CounterAction = {
    kind: "counter",

    unique_id: string | null, // identifier that refers to this counter, unique per-client
    time: number, // when this was found

    special?: "reddit-points",

    label: ActionLabel,
    incremented_label: ActionLabel,
    decremented_label?: ActionLabel,

    style?: ButtonStyle,
    incremented_style?: ButtonStyle,
    decremented_style?: ButtonStyle,

    count_excl_you: number | "hidden" | "none",
    you: "increment" | "decrement" | undefined,

    actions: {
        increment: Opaque<"act">,
        reset: Opaque<"act">,
        decrement?: Opaque<"act">,
    } | {error: string},

    percent?: number,
};

type ButtonStyle = "action-button" | "save-button-saved" | "pill-empty" | "pill-filled";

export type ReportFlow = ReportScreen[];
export type ReportScreen = {
    title: string,
    description?: Body,
    report: ReportAction,
};

export type ReportAction = {
    kind: "submit",
    data: Opaque<"send_report">,
} | {
    kind: "textarea",
    input_title: string,
    char_limit: number,
    data: Opaque<"send_report">,
} | {
    kind: "link",
    url: string,
    text: string,
} | {
    kind: "more",
    screens: ReportScreen[],
};
export type SentReport = {
    title: string,
    body: Body,
};