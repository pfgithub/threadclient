// types that clients return

/// export namespace generic<InternalDataType>?

export type ContentFrame = {
    // clients should provide a method to bundle requests. requestAll([above, content, below])
    // the recommended request order returns the best order and grouping to perform the needed requests
    // eg do a request for [above, content, below] followed by [sidebar, header]
    recommended_request_order: InfoRequest[][],
};
export type InfoRequest = keyof InfoRequestMap;
export type InfoRequestMap = {
    body: Page,
};

// ok "load more"
// situations this may occur:
// - comments:
//   - comment one
//   - load more…
//   - comment two
// here, the load more can load multiple items
//
// - comment one
//   - load more…
//     - comment four
// here, the load more is filling in parent/replies
// like after loading more, you might end up with
// - comment one
//   - comment two
//     - comment three
//       - comment four
// to represent this
// like uuh
// comment four needs to have a parent comment that's a load more
// and that should have the identifier or whatever it is
// are these the same thing or are they different in some fundamental way?
// they seem different

// ok an interesting one
// sometimes, replies→a reply→parent is not the original thing
// eg the reddit homepage
// replies has a bunch of posts but the posts each have subreddit parents

// ok here's something
// rather than returning a filled in content map,
// how about providing functions to rehydrate uuh
// nah provide a content map that's as filled as it
// can be and then use loaders I think.

/// note that this includes cyclic references
/// when stringifying, it's necessary to keep maps of what has been added
export type Page2 = {
    title: string,
    pivot: Link<PostData>,
    content: ContentMap,
};
export type ContentMap = Map<ID<unknown>, unknown>;
export type ID<T> = symbol & {__is_id: T};
export type ParentPost = PostData | PostVerticalLoader;
export type PostData = {
    kind: "post",
    parent: Link<ParentPost> | null,
    replies: ListingData | null,

    content: PostContent, // content should always be in a PostData. eg: crossposts that are embedded in a body also need parent, replies.
    internal_data: unknown,
    display_style: "fullscreen" | "centered",
};
// loads like :: a parent might be known and a replies might be known.
// returns an array of PostData | PostVerticalLoader to place between
// the parent and replies in the node tree.
export type PostVerticalLoader = {
    kind: "vloader",
    parent: Link<ParentPost> | null,
    replies: ListingData | null,
};
export type ListingData = {
    sort: ID<SortData> | null,
    // pinned: …
    // items: …
    reply: ReplyAction | null,
    items: ListingEntry[],
};
export type ListingEntry = {
    kind: "post",
    post: Link<PostData>,
} | {
    kind: "load_more",
} | {
    kind: "loaded",
    entries: ListingEntry[],
};

// ok dealing with sidebars
// so take eg twxtter
// sidebars often contain info relative to the pivoted content
// maybe anything should be able to specify a sidebar and it should only
// be used if it's at or above the pivot?

export type ClientPost = {
    kind: "client",
    navbar: Navbar,
};
export type Link<T> = {ref: T, err: undefined} | {ref: undefined, err: string};
export type PostContentPost = {
    /// the thing containing a post. generally post replies
    /// are only shown when it's at or above the pivot.
    /// this should be clickable if:
    /// - this is below the pivot and show_replies_when… is false
    /// - this is above the pivot
    kind: "post",

    title: null | {
        text: string,
        body_collapsible: null | {default_collapsed: boolean},
    },
    author: null | InfoAuthor,
    body: Body,
    /// if the item should display replies like
    /// item
    /// | reply
    /// | | reply
    show_replies_when_below_pivot: false | {default_collapsed: boolean},
    reddit_vote?: CounterAction,
    actions?: Action[],

    // why no url?
    // the reason for not including a url is so when you click a post it will keep the existing content
    // and then request to fetch the needed data or something
    // posts should have a refresh token though or something similar
    // and refreshing the post should refresh surrounding stuff too

    // if you have a url, you should call like getFrame or something which gives you
    // an empty frame and then you should fetch from there. that might be nice to implement now.

    // basically: call getFrame() which returns a Page2
    // - title will get moved to a property of the pivot
    // - the pivot will be updated to be a single-item loader,
    //   likely with a vertical loader above and a horizontal
    //   loader below
    // - the highest post with a title is used for the title
};

export type PostContent = ClientPost | {
    /// the thing containing the header and sidebar. when rendered below
    /// the pivot, uses an alternate render.
    kind: "page",
    title: null | string,
    wrap_page: {
        sidebar: ListingData,
        header: ListingData,
    },
    overview: Link<PostData>,
} | PostContentPost | {
    kind: "legacy",
    thread: Thread,
};
/// in case the body contains a loader. it should also be supported to have a loader in richtext content.
// export type BodyData = {
//     body: Body,
// };
export type SortData = {
    sort_methods: "TODO",
    current_method: number,
    // this can be more than just sort.
    // eg it should have a way
    // to have stuff like post duplicates and subreddit
    // navbars.
};
// take an example comment
// - client (root)
// - subreddit ("page")
// - link post and comments up to pivot ("")
// - comments below pivot
//
// take an example subreddit view
// - client
// - subreddit (pivot)
// - threads
//
// take an example wiki page
// - client
// - subreddit
// - the wiki page (pivot)


export type Page = {
    title: string,
    navbar: Navbar,
    sidebar?: ContentNode[],
    body: {
        kind: "listing",
        header: ContentNode,
        menu?: Menu,
        previous?: LoadMore,
        items: UnmountedNode[],
        next?: LoadMoreUnmounted,
    } | {
        kind: "one",
        item: UnmountedNode,
    },
    display_style: "comments-view" | "fullscreen-view",
};
export type Navbar = {
    actions: Action[],
    inboxes: Inbox[],
};
export type Inbox = {
    id: string,
    name: string,
    active_color: "orange" | "green",
    hydrate: Opaque<"deferred_inbox">,

    url: string,
};
export type InboxData = {
    messages: {kind: "zero"} | {kind: "exact", value: number} | {kind: "minimum", min: number},

    url: string,
};
export type UnmountedNode = {
    // [...Node[], ContentNode] // requires a newer version of typescript
    parents: Node[], // might contain load_more. the last item in parents is this_node.
    menu?: Menu,
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
        children: ListItem[],
    } | {
        kind: "code_block",
        text: string,
        lang?: string,
    } | {
        kind: "table",
        headings: TableHeading[],
        children: TableItem[][],
    };
    export type ListItem = {
        kind: "list_item",
        children: Paragraph[],
    } | {
        kind: "tight_list_item",
        children: Span[],
    };
    // TODO split this out a bit?
    //
    // InteractiveSpan = SpoilerSpan
    // SpoilerSpan = {spoiler} | LinkSpan
    // LinkSpan = {link} | Span
    // Span = …
    export type Span = {
        kind: "text",
        text: string,
        styles: Style,
    } | ({
        kind: "link",
        url: string,
        children: Span[],
    } & LinkOpts) | {
        kind: "br",
    } | {
        kind: "spoiler",
        children: Span[],
    } | {
        kind: "emoji",
        url: string,
        hover: string,
    } | {
        kind: "flair",
        flair: Flair,
    } | {
        kind: "time-ago",
        start: number,
    } | {
        kind: "error",
        text: string,
        value: unknown,
    } | {
        kind: "code",
        text: string,
    };
    export type TableHeading = {
        align?: "left" | "center" | "right",
        children: Span[],
    };
    export type TableItem = {
        children: Span[],
    };
    export type LinkOpts = {
        is_user_link?: string,
        title?: string,
        style?: LinkStyle,
    };
    export type LinkStyle = "link" | "pill-empty";
}
export type RichText = {
    kind: "richtext",
    content: readonly Richtext.Paragraph[],
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
    w: number | null,
    h: number | null,
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
    kind: "oembed",
    url: string,
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
    removal_message: RemovalMessage,
    fetch_path?: Opaque<"fetch_removed_path">,
    body: Body,
} | {
    kind: "crosspost",
    source: Thread,
} | {
    kind: "array",
    body: (Body | undefined)[],
} | {
    kind: "link_preview",
    thumb?: string, // thumbnail url
    click: Body,
    title: string,
    description: string,
    url: string,
    click_enabled: boolean,
} | {
    kind: "mastodon_instance_selector",
};
export type RemovalMessage = {
    short: string,
    title: string,
    body: string,
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
    display_mode: { // todo revamp, this is useless
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

    moderator?: RedditModState,
};

type Report = {
    content: Richtext.Span[], // 1: … | u/mod_username: …
};

type RedditModState = {
    // report content
    reports: Report[], // reddit ….mod_reports ….user_reports

    // the number of new reports since the last approval
    unseen_reports: number, // reddit .num_reports

    mod_actions: Action[], // reddit: spam | remove<fetch removal reasons> | [a/re/un]approve | ignore reports

    // approved posts may need re-approval if they get new reports
    approved: boolean, // TODO counter index
};

export type InfoAuthor = {
    name: string,
    color_hash: string,
    link: string,
    flair?: Flair[],
    pfp?: {
        url: string,
        hover: string,
    },
};
export type Info = {
    time: false | number, // null | number
    edited: false | number, // null | false | number
    author?: InfoAuthor,
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
    kind: "bio",
    banner: {
        desktop: string,
        mobile?: string,
    } | null,
    icon: {
        url: string,
    } | null,
    name: {
        display?: string,
        link_name: string,
    },
    body: Body | null,
    subscribe?: Action,
    more_actions?: Action[],
    menu: Menu | null,
    raw_value: unknown,
};

export type Menu = MenuItem[];
export type MenuItem = {
    text: string,
    selected: boolean,
    action: {
        kind: "link",
        url: string,
    } | {
        kind: "menu",
        children: MenuItem[],
    } | {
        kind: "show-line-two",
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
    elems: RichTextItem[], // TODO → Richtext.Span[]
    content_warning: boolean,
    system?: string, // tailwind css color class
};
export type ActionLabel = string;
export type ReplyAction = {
    kind: "reply",
    text: ActionLabel,
    reply_info: Opaque<"reply">,
};
export type Action = {
    kind: "link",
    url: string,
    text: ActionLabel,
} | ReplyAction | CounterAction | {
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
} | {
    kind: "flair",
    flair_list: Opaque<"flair_list">, // → FlairList
    current: Flair | null,
} | {
    kind: "code",
    body: Body,
};

export type DataEncodings = 
    | "reply" | "act" | "report" | "send_report" | "fetch_removed_path" | "load_more"
    | "load_more_unmounted" | "login_url" | "flair_list" | "flair_emojis" | "deferred_inbox"
;
export type Opaque<T extends DataEncodings> = {encoding_type: T, encoding_symbol: symbol};

export type FlairList = {
    flair: Flair,
    editable: boolean,
    emojis: Opaque<"flair_emojis">, // → FlairEmoji[]
}[];
export type FlairEmoji = {
    url: string,
    name: string,
};

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

function rtkind<C extends string, T, I extends unknown = undefined>(kind: C, data: T, children?: I[]): (
    {kind: C} & (I extends undefined ? {__nothing: 0} : {children: I[]}) & T
) {
    return {...data, kind, ...children ? {children} : {}} as unknown as {kind: C} & (I extends undefined ? {__nothing: 0} : {children: I[]}) & T;
}

export const rt = {
    kind: rtkind,
    p: (...items: Richtext.Span[]): Richtext.Paragraph => rt.kind("paragraph", {}, items),
    hn: (l: number, ...items: Richtext.Span[]): Richtext.Paragraph => rt.kind("heading", {level: l}, items),
    h1: (...items: Richtext.Span[]): Richtext.Paragraph => rt.hn(1, ...items),
    h2: (...items: Richtext.Span[]): Richtext.Paragraph => rt.hn(2, ...items),
    ul: (...items: Richtext.ListItem[]): Richtext.Paragraph => rt.kind("list", {ordered: false}, items),
    ol: (...items: Richtext.ListItem[]): Richtext.Paragraph => rt.kind("list", {ordered: true}, items),
    li: (...items: Richtext.Paragraph[]): Richtext.ListItem => rt.kind("list_item", {}, items),
    ili: (...items: Richtext.Span[]): Richtext.ListItem => rt.kind("tight_list_item", {}, items),
    blockquote: (...items: Richtext.Paragraph[]): Richtext.Paragraph => rt.kind("blockquote", {}, items),
    txt: (text: string, styles: Richtext.Style = {}): Richtext.Span => rt.kind("text", {text, styles}),
    link: (url: string, opts: Richtext.LinkOpts, ...children: Richtext.Span[]): Richtext.Span => rt.kind("link", {url, ...opts}, children),
    pre: (text: string, lang?: string): Richtext.Paragraph => rt.kind("code_block", {text, lang}),
    error: (text: string, value: unknown): Richtext.Span => rt.kind("error", {text, value}),
    br: (): Richtext.Span => rt.kind("br", {}),
    flair: (flair: Flair): Richtext.Span => rt.kind("flair", {flair}),
    table: (headings: Richtext.TableHeading[], ...rows: Richtext.TableItem[][]): Richtext.Paragraph => rt.kind("table", {headings}, rows),
    th: (align: "left" | "center" | "right" | undefined, ...content: Richtext.Span[]): Richtext.TableHeading => ({align, children: content}),
    td: (...content: Richtext.Span[]): Richtext.TableItem => ({children: content}),
    timeAgo: (time: number): Richtext.Span => rt.kind("time-ago", {start: time}),
    hr: (): Richtext.Paragraph => rt.kind("horizontal_line", {}),
    code: (text: string): Richtext.Span => rt.kind("code", {text}), // this should instead be {kind: "code", text: …}
    spoiler: (...items: Richtext.Span[]): Richtext.Span => rt.kind("spoiler", {}, items),
};

export const mnu = {
    link: (text: string, url: string, selected: boolean): MenuItem => ({selected, action: {kind: "link", url}, text}),
};