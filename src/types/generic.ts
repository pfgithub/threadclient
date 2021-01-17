// types that clients return

export type Page = {
    header: Thread,
    replies?: Node[],
    display_style: string,
};
export type BodyText = {
    kind: "text",
    content: string,
    markdown_format: "reddit" | "none" | "unsafe-html",
    attached_media?: Body,
};
export type RichTextSpan = {
    kind: "text",
    text: string,
};
export type RichTextParagraph = {
    kind: "paragraph",
    nodes: RichTextSpan[],
} | {
    kind: "image", url: string, caption?: string
};
export type RichText = {
    kind: "richtext",
    content: RichTextParagraph[],
};
export type Body = BodyText | RichText | {
    kind: "link",
    url: string,
    embed_html?: string,
} | {
    kind: "captioned_image",
    url: string,
    caption?: string,
    w: number,
    h: number,
} | {
    kind: "gallery",
    images: GalleryItem[],
} | {
    kind: "none",
} | {
    kind: "removed",
    by: "author" | "moderator",
    fetch_path: string,
} | {
    kind: "crosspost",
    source: Thread,
};
export type GalleryItem = {body: Body, thumb: string, w: number, h: number};
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
    raw_value?: any,

    link: string,

    layout: "reddit-post" | "reddit-comment" | "mastodon-post" | "error",

    title?: {
        text: string,
    },

    info: {
        time: number,
        author: {
            name: string, link: string, flair?: Flair[],
            pfp?: {
                url: string,
                hover: string,
            },
        },
        in?: {name: string, link: string},
        reddit_points?: RedditPoints,
    },
    actions: Action[],
    
    default_collapsed: boolean,

    flair?: Flair[],
};
export type LoadMore = {
    kind: "load_more",
    load_more: string,
    count?: number,

    raw_value: any,
};
export type Node = Thread | LoadMore;
export type RedditPoints = {
    your_vote?: 'up' | 'down',
    count?: number,
    percent?: number,
    vote: {error: string} | {
        error: undefined,
        up: string,
        down: string,
        reset: string,
    }
};
export type RichTextItem = {
    type: "text",
    text: string,
} | {
    type: "emoji",
    url: string,
    name: string,
};
export type Flair = {
    elems: RichTextItem[],
    content_warning: boolean,
};
export type Action = {
    kind: "link",
    url: string,
    text: string,
} | {
    kind: "reply",
    text: string,
};