// types that clients return

export type Page = {
    header: ContentNode,
    replies?: Node[],
    display_style: string,
};
export type BodyText = {
    kind: "text",
    content: string,
    markdown_format: "reddit" | "none" | "mastodon",
    attached_media?: (Body | undefined)[],
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
    kind: "video",
    url: string,
    w: number,
    h: number,
    gifv: boolean,
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
    raw_value: any,

    link: string,

    layout: "reddit-post" | "reddit-comment" | "mastodon-post" | "error",

    title?: {
        text: string,
    },

    info?: {
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
export type Profile = {
    kind: "user-profile",
    username: string,
    link: string,
    bio: Body,
    raw_value: any,
};
export type ContentNode = Thread | Profile;
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
    // there will be a function to generate post previews given markdown you typed
    // so this doesn't need to know the markdown format (maybe it should know it
    // though for syntax highlighting or editor features or whatever)
} | {
    kind: "counter",

    label: ActionLabel,
    incremented_label: ActionLabel,
    decremented_label?: ActionLabel,

    count_excl_you: number | "hidden",
    you: "increment" | "decrement" | undefined,

    increment: string,
    reset: string,
    decrement?: string,

    percent?: number,
};