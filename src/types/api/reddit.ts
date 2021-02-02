// types for the public reddit api

export type AccessToken =
    | {error: true}
    | {error: false, access_token: string, refresh_token: string, expires_in: number, scope: string}
;

export type AnyResult = Page | Listing | MoreChildren | WikiPage;

export type WikiPage = {
    kind: "wikipage",
    data: {
        content_md: string,
        content_html: string,
        // not sure how/if it is possible to get richtext

        may_revise: boolean,
        revision_date: number, // s since epoch (utc)
        revision_by: T2,
        revision_id: string,
    },
};

export type MenuItem = {
    text: string,
    children: MenuItem[], 
} | {
    text: string,
    url: string,
};

export type Widget = {
    id: string,
    styles: {
        headerColor: null,
        backgroundColor: null,
    },
} & ({
    kind: "moderators",
    mods: {name: string}[], // TODO flairs
    totalMods: number,
} | {
    kind: "id-card",
    subscribersCount: number,
    currentlyViewingText: string,
    currentlyViewingCount: number,
    description: string,
    shortName: string,
} | {
    kind: "community-list",
    data: ({
        iconUrl: "" | string,
        name: string,
        subscribers: number,
        primaryColor: "" | `#{string}`,
        isSubscribed: boolean,
        type: "subreddit",
        communityIcon: "" | string,
        isNSFW: boolean,
    } | {
        type: "unsupported",
    })[],
    shortName: string,
} | {
    kind: "menu",
    data: MenuItem[],
    showWiki: boolean,
} | {
    kind: "textarea",
    shortName: string,
    text: string,
    textHtml: string,
    // not sure how/if it's possible to get richtext for this
} | {
    kind: "unsupported",
});

export type ApiWidgets = {
    items: {[key: string]: Widget},
    layout: {
        idCardWidget: string,
        topbar: {order: string[]},
        sidebar: {order: string[]},
        moderatorWidget: string,
    },
};

// user info
export type T2 = {
    kind: "t2",
    data: {
        todo: true,
    },
};

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
    all_awardings: Award[],

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

    media_metadata?: MediaMetadata,

    saved: boolean,
};

export type BaseMediaMeta = {
    x: number, y: number,
};
export type ImageMeta = BaseMediaMeta & {
    u: string,
};
export type AnimatedImageMeta = BaseMediaMeta & {
    gif: string,
    mp4?: string,
};
export type BaseMedia = {
    m: string, // eg image/png or image/gif
    status: "valid" | "unsupported", // maybe this can include processing? not sure
};
export type Media = BaseMedia & ({
    e: "Image",
    m: string, // eg image/png

    p: ImageMeta[], // alternate sizes, small → large
    s: ImageMeta, // source size
} | {
    e: "AnimatedImage",
    ext?: string, // external link, eg giphy.com/…
    m: string, // eg image/gif

    p?: ImageMeta[], // alternate sizes
    s: AnimatedImageMeta, // source size
} | {
    e: "RedditVideo",
    dashUrl: string, // https://v.redd.it/link/:postname/asset/:id/DASHPlaylist.mpd?a=…&v=1&f=sd
    hlsUrl: string, // https://v.redd.it/link/:postname/asset/:id/HLSPlaylist.m3u8?a=…&v=1&f=sd
    id: string,
    x: number,
    y: number,
    isGif: boolean,
} | {
    e: "unsupported",
});
export type MediaMetadata = {[key: string]: Media};

export type PostSubmission = PostBase & PostOrComment & {
    title: string,
    
    stickied: boolean,
    subreddit_name_prefixed: string, // post subreddit (u/ or r/)

    // content warnings
    spoiler: boolean,
    over_18: boolean,
    is_original_content: boolean,

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

    // this is only available on posts
    // the new.reddit desktopapi gets a "deletedBy" property on both posts and comments
    // but unfortunately on the public api you have to check the comment body to determine if it is deleted
    removed_by_category: "moderator" | "deleted" | "anti_evil_ops" | "unsupported" | null,
};

export type PostComment = PostBase & PostOrComment & {
    replies?: Listing,
    parent_id: string,

    author: string,
    created_utc: number,

    author_flair_richtext: RichtextFlair,

    is_submitter: boolean,

    rtjson: Richtext.Document,

    stickied: boolean,

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

export type Award = {
    // info about the post awarding
    count: number,
    
    // info about the award
    id: string,
    name: string,
    description: string,

    icon_format: "APNG" | "unsupported",
    icon_width: number,
    icon_height: number,
    icon_url: string,
    resized_icons: {url: string, width: number, height: number}[],

    static_icon_width: number,
    static_icon_height: number,
    static_icon_url: string, // non-animated icon
    resized_static_icons: {url: string, width: number, height: number}[],

    is_enabled: boolean,
    is_new: boolean,

    coin_price: number, // # coins it costs to give this award
    coin_reward: number, // # coins the reciever gets
    giver_coin_reward: number, // # coins the giver gets
    penny_donate: number, // ?
    penny_price: number, // ?

    subreddit_coin_reward: number, // # coins the subreddit gets
    subreddit_id?: string,

    days_of_drip_extension: number, // ??
    days_of_premium: number, // # days premium reciever gets

    start_date?: unknown,
    end_date?: unknown,

    award_type: "global" | "unsupported",
    award_sub_type: "GLOBAL" | "unsupported",
    awardings_required_to_grant_benefits?: unknown,

    tiers_by_required_awardings?: unknown,
};

export type RichtextFlair = ({
    e: "emoji",
    u: string, // url
    a: string, // :emojiname:
} | {
    e: "text",
    t: string, // text
} | {
    e: "unsupported",
})[];

export declare namespace Richtext {
    export type Document = {
        document: Paragraph[],
    };
    export type Paragraph = {
        e: "par",
        c: Span[],
    } | {
        e: "img" | "video" | "gif",
        c: string, // caption, displays below the image
        id: string, // media id. more info in media_metadata including the link.
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
        e: "u/",
        t: string, // user name unprefixed
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
        e: "gif",
        id: string, // information is provided in media_metadata
    } | {
        e: "unsupported",
    };
    export type TableHeading = {
        a?: "L" | "C" | "R", // align
        c: Span[],
    };
    export type TableItem = {
        c: Span[],
    };
    // TODO use hljs or something to detect language and highlight
    export type Raw = {
        e: "raw",
        t: string,
    } | {
        e: "unsupported",
    };
    export type FormatRange = [
        mode: FormatMode,
        start: number, // start index
        length: number // length
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

export type VoteBody = {
    id: string, // fullname of a post/comment
    rank: string, // a number above 1, unclear the purpose
    dir: "-1" | "0" | "1",
};