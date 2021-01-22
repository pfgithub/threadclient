// types for the public reddit api

export type Page = [Listing, Listing];
export type Listing = {
    kind: "Listing",
    data: {
        before: string | null,
        children: Post[],
        after: string | null,
    },
};
export type MoreChildren = {
    json: {
        errors: string[],
        data: {
            things: PostCommentLike[],
        },
    },
};

export type PostBase = {
    name: string, // post id

    // use to fetch replies I guess
    permalink: string,
};

export type PostOrComment = {
    likes?: true | false,

    score_hidden: boolean,
    score: number,

    upvote_ratio?: number, // on posts
    controversiality?: 0 | 1, // on comments

    archived?: boolean,

    distinguished?: "admin",

    author_flair_type: "text" | "richtext" | "unsupported",
    author_flair_text: string,
    author_flair_richtext?: RichtextFlair,
    author_flair_background_color: string,
    author_flair_text_color: "light" | "dark",
};

export type PostSubmission = PostBase & PostOrComment & {
    title: string,
    
    stickied: boolean,
    subreddit_name_prefixed: string, // post subreddit (u/ or r/)

    // content warnings
    spoiler: boolean,
    over_18: boolean,

    // content
    url: string,
    is_self: boolean,
    rtjson: Richtext.Document, // deleted comments are <p>[deleted]</p>.
    // I don't see any other field in the api for this. if author == u/[deleted] then check body.
    thumbnail?: string,

    gallery_data?: {items: {
        caption?: string,
        media_id: string, // →media_metadata
    }[]},

    media_metadata?: {[key: string]: {
        // e: "Image",
        p: {y: number, x: number, u: string}[], // preview
        s: {y: number, x: number, u: string}, // source
    }},

    preview?: {
        images: {
            id: string,
            source: {url: string, width: number, height: number},
            resolutions: {url: string, width: number, height: number}[],
            // variants: {?}
        }[],
        enabled: boolean,
    },

    author: string,
    created_utc: number,
    
    link_flair_type: "text" | "richtext" | "unsupported",
    link_flair_text: string,
    link_flair_richtext: RichtextFlair,
    link_flair_background_color: string,
    link_flair_text_color: "light" | "dark",

    num_comments: number,

    crosspost_parent_list?: PostSubmission[],

    media_embed?: {content: string},

    domain: string,
};

export type PostComment = PostBase & PostOrComment & {
    replies?: Listing,
    parent_id: string,

    author: string,
    created_utc: number,

    author_flair_richtext: RichtextFlair,

    is_submitter: boolean,

    rtjson: Richtext.Document,

    collapsed: boolean,
    // collapsed_reason: ?,
    // collapsed_because_crowd_control: ?,
};

export type PostMore = PostBase & {
    count: number,
    depth: number,
    id: string,
    name: string,
    parent_id: string,
    children: string[],
};

export type PostCommentLike = {
    kind: "t1",
    data: PostComment,
} | {
    kind: "more",
    data: PostMore,
};

export type Post = {
    kind: "t3",
    data: PostSubmission,
} | PostCommentLike | {
    kind: "unknown",
};

export type RichtextFlair = ({
    e: "emoji",
    u: string, // url
    a: string, // :emojiname:
} | {
    e: "text",
    t: string, // text
} | {
    e: "unsupported"
})[];

export declare namespace Richtext {
    export type Document = {
        document: Paragraph[],
    };
    export type Paragraph = {
        e: "par",
        c: Span[],
    } | {
        e: "img",
        c: string, // caption, displays below the image
        id: string, // media id. more info in media_metadata including the link.
    } | {
        e: "video",
        c: string, // caption
        id: string, // media id. more info in media_metadata.
    } | {
        e: "h",
        l: number, // h1 h2 …
        c: Span[],
    } | {
        e: "hr", // horizontal line
    } | {
        e: "blockquote",
        c: Paragraph[],
    } | {
        e: "list",
        o: false, // if the list is ordered
        c: Paragraph[],
    } | {
        e: "li",
        c: Paragraph[],
    } | {
        e: "code",
        c: Raw[], // I guess they didn't want to use white-space: pre?
    } | {
        e: "table",
        h: TableHeading[],
        c: TableItem[][],
    } | {
        e: "unsupported",
    };
    export type Span = {
        e: "text",
        t: string,
        f?: FormatRange[],
    } | {
        e: "r/",
        t: string, // subreddit name unprefixed
        l: boolean, // leading slash
    } | {
        e: "link",
        u: string, // url
        t: string, // link text
        a?: string, // tooltip text
        f?: FormatRange[],
    } | {
        e: "br", // <br />, a line break within a paragraph
    } | {
        e: "spoilertext",
        c: Span[],
    } | {
        e: "raw", // only in headings idk
        t: string,
    } | {
        e: "unsupported",
    };
    export type TableHeading = {
        a?: "L" | "C" | "R", // align
        c: Span[],
    };
    export type TableItem = {
        c: Span[],
    }
    // TODO use hljs or something to detect language and highlight
    export type Raw = {
        e: "raw",
        t: string,
    } | {
        e: "unsupported"
    };
    export type FormatRange = [
        FormatMode,
        number, // start index
        number // length
    ]; // note: format ranges never overlap. this makes it easier to translate this to generic

    // FormatMode is a bitfield
    export enum FormatMode {
        strong = 1,          // 1 << 0      1
        emphasis = 2,       // 1 << 1      10
        strikethrough = 8, // 1 << 3     1000
        superscript = 32, // 1 << 5    100000
        code = 64,       // 1 << 6    1000000
    }
}
