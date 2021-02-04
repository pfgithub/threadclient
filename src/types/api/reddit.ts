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
    kind: "subreddit-rules",
    display: "compact" | "unsupported",
    shortName: string,
    data: {
        createdUtc: number, // s since epoch
        description: string, // markdown
        descriptionHtml: string,
        // again, not sure if there is a way to get richtext.
        priority: number, // ?
        shortName: string,
        violationReason: string,
    }[],
} | {
    kind: "image",
    data: {
        url: string,
        width: number,
        height: number,
    }[], // only contains one item unless progressive_images is enabled
    shortName: string,
} | {
    kind: "post-flair",
    shortName: string,
    order: string[], // keys into the templates map
    templates: {[key: string]: {
        backgroundColor: string,
        templateId: typeof key,
        textColor: "light" | "dark",
        text: string,
        richtext?: RichtextFlair,
        type: "text" | "richtext" | "unsupported",
    }},
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

export type Markdown = string & {__distinct_fakeprop: "markdown"};
export type HTML = string & {__distinct_fakeprop: "html"};

export declare namespace Date {
    export type Sec = number & {__distinct_fakeprop: "sec"}; // sec since epoch (utc)
    export type Ms = number & {__distinct_fakeprop: "ms"};  // ms since epoch (utc)
}

type LoginState<LoggedIn, NotLoggedIn> = {_logged_in: LoggedIn, _not_logged_in: NotLoggedIn};
type LoginWrap<T extends {[key: string]: LoginState<unknown, unknown>}> =
    {[key in keyof T]: T[key]["_logged_in"]} | {[key in keyof T]: T[key]["_not_logged_in"]}
;

// outdated documentation: https://github.com/reddit-archive/reddit/wiki/JSON
// more here: https://github.com/Pyprohly/reddit-api-doc-notes/blob/master/docs/api-reference/subreddit.rst
// oh my this is a mess
export type T5 = {
    kind: "t5",
    data: {
        // basic info
        id: string,
        name: `t5_${string}`, // fullname
        display_name: string, // :subreddit
        display_name_prefixed: string, // r/:subreddit 
    } & {
        // information displayed on the sidebar
        subscribers: number,

        title: string,

        public_description: Markdown,
        public_description_html: HTML,

        description: Markdown,
        description_html: HTML, // old.reddit sidebar text

        header_title: string,
        header_size: null,

        subreddit_type: "public" | "private" | "restricted" | "gold_restricted" | "archived" | "unsupported",
        user_is_contributor: boolean | null, // note, only contributers can create posts in restricted subs

        key_color: string,

        created: Date.Sec,
        created_utc: Date.Sec,

        user_is_subscriber: boolean | null,
    } & {
        // information required for when creating posts
        submit_text: Markdown,
        submit_text_html: HTML,
        original_content_tag_enabled: boolean,

        allow_polls: boolean,
        allow_galleries: boolean,
        allow_videogifs: boolean,
        allow_videos: boolean,
        allow_images: boolean,

        can_assign_link_flair: boolean,

        is_crosspostable_subreddit: boolean,

        allow_chat_post_creation: boolean,
    } & {
        // flair assignment info
        can_assign_user_flair: boolean,

        user_flair_background_color: null,
        user_flair_position: "right" | "unsupported",
        user_flair_type: "text" | "unsupported",
    } & LoginWrap<{
        // information about the signed in user
        user_is_banned: LoginState<boolean, null>,
        user_is_moderator: LoginState<boolean, null>,

        user_is_muted: LoginState<boolean, null>,
        user_flair_richtext: LoginState<never[], never[]>,
        user_has_favorited: LoginState<boolean, null>,
        user_flair_template_id: LoginState<null, null>,
        notification_level: LoginState<"low" | "unsupported", null>,
        user_sr_flair_enabled: LoginState<boolean, null>,
        user_sr_theme_enabled: LoginState<boolean, null>,
        user_flair_text: LoginState<null, null>,
        user_flair_text_color: LoginState<null, null>,
        user_flair_css_class: LoginState<null, null>,
    }> & {
        // uncategorized stuff
        emojis_enabled: boolean,
        spoilers_enabled: boolean,

        lang: "en" | "unsupported",
        whitelist_status: "some_ads" | "unsupported",
        url: string, // eg /r/…/

        banner_size: null,
        mobile_banner_image: "",

        over18: boolean,

        restrict_commenting: boolean,

        is_chat_post_feature_enabled: boolean,
        submit_link_label: "",

        restrict_posting: boolean,
        allow_predictions_tournament: boolean,

        icon_size: [number, number],
        icon_img: string, // url

        all_original_content: boolean,

        link_flair_enabled: boolean,

        banner_background_color: "",
        show_media: boolean,

        allow_discovery: boolean,

        suggested_comment_sort: null,
        banner_img: "",

        primary_color: "",

        active_user_count: number,
        accounts_active_is_fuzzed: boolean,

        submit_text_label: "",
        link_flair_position: "left" | "right" | "unsupported",

        disable_contributer_requests: boolean,

        user_flair_enabled_in_sr: boolean,

        public_traffic: boolean,

        collapse_deleted_comments: boolean,

        emojis_custom_size: null,

        wls: number,

        show_media_preview: boolean,
        submission_type: "any" | "unsupported",

        community_icon: "",
        banner_background_image: "",
        
        quarrentine: boolean,
        hide_ads: boolean,
        prediction_leaderboard_entry_type: "IN_FEED" | "unsupported",
        advertiser_category: "",

        videostream_links_count: number,

        comment_score_hide_mins: number,

        allow_predictions: boolean, // allow gambling polls

        free_form_reports: boolean,
        wiki_enabled: null,

        user_can_flair_in_sr: true | null,

        header_img: null,
    } & {
        // experiments with 100% enrollment
        is_enrolled_in_new_modmail: null,
    } & Depricated<{
        // depricated in favor of different props
        has_menu_widget: boolean,
        accounts_active: number, // active_user_count
    }>,
};

type Depricated<T> = T;

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
    edited: false | number,
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

    poll_data?: {
        options: {
            text: string, id: string,
            vote_count?: number,
        }[],
        resolved_option_id: null,
        total_vote_count: number,
        user_selection: string | null,
        voting_end_timestamp: number, // ms since epoch
        
        // for gambling polls
        is_prediction: boolean,
        total_stake_amount: null,
        user_won_amount: null,
    },

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