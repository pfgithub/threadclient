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
    selftext: string,
    selftext_html?: string, // sanitize this and set innerhtml. spooky.
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
    
    link_flair_richtext: RichtextFlair,
    author_flair_richtext: RichtextFlair,

    num_comments: number,

    crosspost_parent_list?: PostSubmission[],

    media_embed?: {content: string},

    domain: string,
};

export type PostComment = PostBase & PostOrComment & {
    body: string,
    body_html: string,
    replies?: Listing,
    parent_id: string,

    author: string,
    created_utc: number,

    author_flair_richtext: RichtextFlair,

    is_submitter: boolean,

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