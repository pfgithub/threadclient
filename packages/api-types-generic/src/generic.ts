// always use object.hasownpropertyvalue because this isn't a Map();
// TODO: store history?
// this will likely be backed by a solid Store to provide updates when
// individual pieces of content change.
export type Page2Content = {
    [key: string | symbol]: {data: unknown} | {error: string} | undefined,
};

export type Page2 = {
    pivot: Link<Post>,
    content: Page2Content,
};
export type LoaderResult = {
    content: Page2Content,
};

// !NOTE: the empty string is not a valid link due to eslint limitations
export type Link<T> = (string | symbol) & {__is_link: T};

export type ReadLinkResult<T> = {value: T, error: null} | {error: string, value: null};
export function readLink<T>(content: Page2Content, link: Link<T>): ReadLinkResult<T> {
    const root_context = content;
    const value = root_context[link]; // get the value first to put a solid js watcher on it
    if(!value) return {error: "[read]Link not found: "+link.toString(), value: null};
    if(Object.hasOwnProperty.call(root_context, link)) {
        if('error' in value) return {error: value.error, value: null};
        return {value: value.data as T, error: null};
    }else{
        return {error: "[read]Link found but not in hasOwnProperty: "+link.toString(), value: null};
    }
}

export type Post = PostNotLoaded | Loaded;
export type PostNotLoaded = PostData | Loader;

export type PostData = BasePost & {
    kind: "post",

    content: PostContent, // content should always be in a PostData. eg: crossposts that are embedded in a body also need parent, replies.
    internal_data: unknown,
    display_style: "fullscreen" | "centered",
};

export type Loader = BasePost & {
    kind: "loader",
    // note: horizontal loaders are not allowed to have replies

    // a loader:

    // loadLoader(replies) -> tree

    // note: when a loader is used, the ui should pass the sort mode to the client
    key: Opaque<"loader">,
    // loaded_key: Link<Loaded>, // when displaying a loader, check if this
    // key is present and display it instead

    load_count: null | number,

    autoload: boolean,
};

export type Loaded = BasePost & {
    kind: "loaded",
    // i hate this. delete it.

    // replace it with:
    // - seperate vertical and horizontal loaders
    // - a vertical loader is put in place of a parent for a node
    // - a horizontal loader is put in place of a reply for a node
    // - a horizontal loader returns an array of post links
    // - a vertical loader returns an array of post links
    // - neither loader has BasePost props. no 'parent', no 'replies', …
};

export type BasePost = {
    disallow_pivot?: undefined | boolean,
    parent: Link<Post> | null,
    replies: ListingData | null,
    
    url: string | null, // if a thing does not have a url, it cannot be the pivot
    client_id: string,
};

export type ListingData = {
    // TODO redo sort. sort should be preserved when loading more comments
    sort?: undefined | SortData,
    reply?: undefined | {
        action: ReplyAction,
        locked: boolean, // only moderators can comment
    },

    // - "tree" displays a full replies tree
    // - "repivot_list" does not show any replies
    //   - if a post should be displayed in a repivot list:
    //     - it should not be possible to change its collapse state
    //     - there should be a click handler over the whole post, not just the title bar
    //   - note that all parent posts (except the pivoted one) are displayed in a repivot list

    display: "tree" | "repivot_list",

    // pinned: Post[],
    items: Link<Post>[],
};

export type ClientPost = {
    kind: "client",
    navbar: Navbar,
};
export type PostInfo = {
    creation_date?: number | undefined,
    edited?: {date?: number | undefined} | undefined,
    pinned?: boolean | undefined, // TODO remove this, use the "pinned" section in a ListingData instead
    in?: {name: string, link: string, client_id: string} | undefined,
    comments?: number | undefined, // TODO consider removing this, instead add up the
    // totals of all the replies and loader counts in the ui.
};
export type PostContentPost = {
    kind: "post",

    title: null | {
        text: string,
    },
    flair?: Flair[] | undefined, // maybe content warnings should be seperate
    thumbnail?: Thumbnail | undefined,
    info?: PostInfo | undefined,
    author?: InfoAuthor | undefined,
    body: Body,

    collapsible: false | {default_collapsed: boolean},
    actions?: undefined | {
        // puts the up and down arrow in the gutter and points/% voted in the info line. could do
        // something similar but with a star for mastodon.
        vote?: CounterAction | undefined,
        code?: CodeAction | undefined,
        // delete?: DeleteAction | undefined,
        // save?: SaveAction | undefined,
        // report?: ReportAction | undefined,
        other?: Action[] | undefined,

        moderator?: RedditModState | undefined,
    },
};

export type PostContent = ClientPost | {
    /// the thing containing the header and sidebar. when rendered below
    /// the pivot, uses an alternate render.
    kind: "page",
    title: null | string,
    wrap_page: {
        sidebar: ListingData,
        header: RedditHeader,
    },
    // overview: ClientPost, // I think this is supposed to be for if rendered below the pivot
} | PostContentPost | {
    kind: "legacy",
    thread: Thread,
    client_id: string,
} | {
    kind: "special",
    tag_uuid: `${string}@-${string}`,
    fallback: PostContentPost,
};
export type SortData = {
    sort_methods: "TODO",
    current_method: number,
    // this can be more than just sort.
    // eg it should have a way
    // to have stuff like post duplicates and subreddit
    // navbars.
};

// /---------------\
// |---- page1 ----|
// \---------------/

export type Page = {
    title: string,
    navbar: Navbar,
    sidebar?: ContentNode[] | undefined,
    body: {
        kind: "listing",
        header: ContentNode,
        menu?: Menu | undefined,
        previous?: LoadMore | undefined,
        items: UnmountedNode[],
        next?: LoadMoreUnmounted | undefined,
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
    menu?: Menu | undefined,
    replies: Node[],
};
export type BodyText = {
    kind: "text",
    content: string,
    client_id: string,
    markdown_format: "reddit" | "reddit_html" | "none",
};
export declare namespace Richtext {

    export type Style = {
        strong?: boolean | undefined,
        emphasis?: boolean | undefined,
        strikethrough?: boolean | undefined,
        superscript?: boolean | undefined,
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
        lang?: string | undefined,
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
        // TODO if any list items are not tight, wrap all the tight ones in a paragraph
    };
    export type LinkSpan = ({
        kind: "link",
        url: string,
        client_id: string,
        children: Span[],
    } & LinkOpts);
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
    } | LinkSpan | {
        kind: "br",
    } | {
        kind: "spoiler",
        children: Span[],
    } | {
        kind: "emoji",
        url: string,
        name: string,
    } | {
        kind: "flair",
        flair: Flair,
    } | {
        kind: "time_ago",
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
        align?: "left" | "center" | "right" | undefined,
        children: Span[],
    };
    export type TableItem = {
        children: Span[],
    };
    export type LinkOpts = {
        is_user_link?: string | undefined,
        title?: string | undefined,
        style?: LinkStyle | undefined,
    };
    export type LinkStyle = "link" | "pill-empty";
}
export type RichText = {
    kind: "richtext",
    content: readonly Richtext.Paragraph[],
    // whitespace_sensitive: boolean (for easier html -> richtext conversions, use false)
};
export type Video = {
    kind: "video",
    source: VideoSource,
    aspect?: number | undefined,
    gifv: boolean,
    caption?: string | undefined,
    alt?: string | undefined,
};
export type Body = BodyText | RichText | {
    kind: "link",
    url: string,
    client_id: string,
    embed_html?: string | undefined,
} | {
    kind: "captioned_image",
    url: string,
    caption?: string | undefined,
    alt?: string | undefined,
    w: number | null,
    h: number | null,
} | Video | {
    kind: "gfycatv1",
    id: string,
    host: string,
} | {
    kind: "gfycatv2",
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
} | OEmbedBody | {
    kind: "reddit_suggested_embed",
    suggested_embed: string,
} | {
    kind: "audio",
    url: string,
    caption?: string | undefined,
    alt?: string | undefined,
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
    fetch_path?: Opaque<"fetch_removed_path"> | undefined,
    body: Body,
    client_id: string,
} | {
    kind: "crosspost",
    source: Thread,
    client_id: string, // won't be needed after this is migrated to page2
} | {
    kind: "array",
    body: (Body | undefined)[],
} | LinkPreview | {
    kind: "mastodon_instance_selector",
    client_id: string,
};
export type OEmbedBody = {
    kind: "oembed",
    url: string,
    client_id: string,
};
export type LinkPreview = {
    kind: "link_preview",
    client_id: string,
    thumb?: string | undefined, // thumbnail url
    click: Body,
    title: string,
    description: string,
    url: string,
    click_enabled: boolean,
};
export type RemovalMessage = {
    short: string,
    title: string,
    body: string,
};
export type VideoSourceVideo = {
    kind: "video",
    sources: {
        url: string,
        quality?: string | undefined,
    }[],
    preview?: undefined | { // for the seekbar
        url: string,
        type?: string | undefined,
    }[],
    thumbnail?: string | undefined, // TODO use the reddit post thumbnail for this
};
export type VideoSource = VideoSourceVideo | {
    kind: "img",
    url: string,
};
export type GalleryItem = {
    body: Body,
    thumb: string | null,
    aspect: number | undefined, // w / h
};
export type ThumbType = "self" | "default" | "image" | "spoiler" | "error" | "nsfw" | "account";
export type Thumbnail = {
    kind: "image",
    url: string,
} | {
    kind: "default",
    thumb: ThumbType,
};
export type Thread = {
    kind: "thread",

    body: Body,
    thumbnail?: Thumbnail | undefined,
    display_mode: { // todo revamp, this is useless
        body: "visible" | "collapsed",
        body_default?: "open" | "closed" | undefined,
        comments: "visible" | "collapsed",
    },
    replies?: Node[] | undefined,
    raw_value: unknown,

    link: string,

    layout: "reddit-post" | "reddit-comment" | "mastodon-post" | "error",

    title?: undefined | {
        text: string,
    },

    info?: Info | undefined,
    actions: Action[],
    
    default_collapsed: boolean,

    flair?: Flair[] | undefined,

    moderator?: RedditModState | undefined,
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
    client_id: string,
    flair?: Flair[] | undefined,
    pfp?: undefined | {
        url: string,
        hover: string,
    },
    // system_perms?: {moderator?: …, admin?: …} | undefined, or something idk
};
export type Info = {
    time: false | number, // null | number
    edited: false | number, // null | false | number
    author?: InfoAuthor | undefined,
    in?: {name: string, link: string} | undefined,
    reblogged_by?: RebloggedBy | undefined,
    pinned: boolean,
};
export type RebloggedBy = Info;
export type LoadMore = {
    kind: "load_more",
    load_more: Opaque<"load_more">,
    url: string, // right click, open in new tab
    count?: number | undefined,

    raw_value: unknown,
};
export type LoadMoreUnmounted = {
    kind: "load_more_unmounted",
    load_more_unmounted: Opaque<"load_more_unmounted">,
    url: string,
    count?: number | undefined,
    
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
        kind: "image",
        desktop: string,
        mobile?: string | undefined,
    } | {
        kind: "color",
        color: `#${string}`,
    } | null,
    icon: {
        url: string,
    } | null,
    name: {
        display?: string | undefined,
        link_name: string,
    },
    body: Body | null,
    subscribe?: Action | undefined,
    more_actions?: Action[] | undefined,
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
        client_id: string,
    } | {
        kind: "menu",
        children: MenuItem[],
    } | {
        kind: "show-line-two",
        children: MenuItem[],
    },
};

export type WidgetListItem = {
    icon?: string | undefined,
    name:
        | {kind: "text", text: string}
        | {kind: "username", username: string}
        | {kind: "flair", flair: Flair}
        | {kind: "image", src: string, w: number, h: number, alt?: string | undefined}
    ,
    click: {kind: "link", url: string} | {kind: "body", body: Body},
    action?: Action | undefined,
};

export type Widget = {
    kind: "widget",
    title: string,
    actions_top?: Action[] | undefined,
    actions_bottom?: Action[] | undefined,
    widget_content: {
        kind: "list",
        above_text?: Body | undefined,
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
        link_url?: string | undefined,
    },
    raw_value: unknown,
};

export type ContentNode = Thread | Profile | RedditHeader | Widget;
export type Node = Thread | LoadMore;
export type RichTextItem = {
    kind: "text",
    text: string,
} | {
    kind: "emoji",
    url: string,
    name: string,
    w: number,
    h: number,
};
export type SystemKind = "none" | "op" | "cake" | "admin" | "moderator" | "approved" | "error";
export type Flair = {
    color?: string | undefined,
    elems: RichTextItem[], // TODO → Richtext.Span[]
    content_warning: boolean,
    system?: undefined | SystemKind,
    // note: this should be moved to being a property of the user or post in page2
    //       (actually what should it be? admin is a property of the user, moderator
    //        is a property of the user & the subreddit, op is a property of the
    //        user & the post. maybe the highest level where the thing applies should
    //        be the place where the tag is assigned? eg - actually moderator and
    //        admin are both properties of the post, they have to be manually
    //        distinguished nvm. and eg: a user who was a mod but no longer is.)
    //       (could be nice though, some slightly more structured info about this)
    // op: text-blue-500
    // cake: text-gray-500
    // admin: text-red-500
    // moderator: text-green-500
    // approved: text-green-500 (move this to be a part of special moderator
    //                           functionality in page2. moderator stuff probably
    //                           isn't super generalizable across platforms, not sure)
};
export type ActionLabel = string;
export type ReplyAction = {
    kind: "reply",
    key: string, // draft replies will be saved with this key
    text: ActionLabel,
    reply_info: Opaque<"reply">,
    client_id: string,
    mode: "reply" | "edit",
};
export type Action = {
    kind: "link",
    url: string,
    client_id: string,
    text: ActionLabel,
} | ReplyAction | CounterAction | {
    kind: "delete",
    data: Opaque<"act">,
    client_id: string,
} | {
    kind: "report",
    data: Opaque<"report">,
    client_id: string,
} | {
    kind: "login",
    data: Opaque<"login_url">,
    client_id: string,
} | {
    kind: "act",
    action: Opaque<"act">,
    client_id: string,
    text: string,
} | {
    kind: "flair",
    flair_list: Opaque<"flair_list">, // → FlairList
    current: Flair | null,
} | CodeAction;

export type CodeAction = {
    kind: "code",
    body: Body,
};

export type DataEncodings = 
    | "reply" | "act" | "report" | "send_report" | "fetch_removed_path" | "load_more"
    | "load_more_unmounted" | "login_url" | "flair_list" | "flair_emojis" | "deferred_inbox"
    | "loader" | "edit"
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

export type Icon =
    | "comments"
    | "creation_time"
    | "edit_time"
    | "up_arrow"
    | "down_arrow"
    | "controversiality"
    | "pinned"
    | "bookmark"
    | "envelope"
    | "envelope_open"
    | "star"
    | "join"
    | "heart"
    | "code"
    | "link"
    | "eye"
    | "reply"
    | "chevron_up"
    | "chevron_down"
;
export type Color =
    | "orange"
    | "indigo"
    | "blue"
    | "green"
    | "yellow"
    | "pink"
    | "white"
;

type CounterButton = {
    icon: Icon,
    color: Color,
    label: string,
    undo_label: string,
};

// a counter or a button with 2-3 states
export type CounterAction = {
    kind: "counter",
    client_id: string,

    unique_id: string | null, // identifier that refers to this counter, unique per-client

    neutral_icon?: undefined | Icon,
    increment: CounterButton,
    decrement: null | CounterButton,

    count_excl_you: number | "hidden" | "none",
    you: "increment" | "decrement" | undefined,

    actions: {
        increment?: undefined | Opaque<"act">,
        reset?: undefined | Opaque<"act">,
        decrement?: undefined | Opaque<"act">,
    } | {error: string},

    percent?: undefined | number,

    // TODO: remove these:
    time: number, // when this was found. TODO: remove this
    special?: undefined | "reddit-points",
    style?: undefined | ButtonStyle,
    incremented_style?: undefined | ButtonStyle,
    decremented_style?: undefined | ButtonStyle,
};

type ButtonStyle = "action-button" | "save-button-saved" | "pill-empty" | "pill-filled";

export type ReportFlow = ReportScreen[];
export type ReportScreen = {
    title: string,
    description?: undefined | Body,
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

function rtkind<C extends string, T, I = undefined>(kind: C, data: T, children?: I[]): (
    {kind: C} & (I extends undefined ? {__nothing: 0} : {children: I[]}) & T
) {
    return {
        ...data, kind, ...children ? {children} : {}
    } as unknown as {kind: C} & (I extends undefined ? {__nothing: 0} : {children: I[]}) & T;
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
    link: (client: {id: string}, url: string, opts: Richtext.LinkOpts, ...children: Richtext.Span[]): Richtext.Span => (
        rt.kind("link", {url, client_id: client.id, ...opts}, children)
    ),
    pre: (text: string, lang?: string): Richtext.Paragraph => rt.kind("code_block", {text, lang}),
    error: (text: string, value: unknown): Richtext.Span => rt.kind("error", {text, value}),
    br: (): Richtext.Span => rt.kind("br", {}),
    flair: (flair: Flair): Richtext.Span => rt.kind("flair", {flair}),
    table: (headings: Richtext.TableHeading[], ...rows: Richtext.TableItem[][]): Richtext.Paragraph => (
        rt.kind("table", {headings}, rows)
    ),
    th: (align: "left" | "center" | "right" | undefined, ...content: Richtext.Span[]): Richtext.TableHeading => ({
        align, children: content
    }),
    td: (...content: Richtext.Span[]): Richtext.TableItem => ({children: content}),
    timeAgo: (time: number): Richtext.Span => rt.kind("time_ago", {start: time}),
    hr: (): Richtext.Paragraph => rt.kind("horizontal_line", {}),
    code: (text: string): Richtext.Span => rt.kind("code", {text}), // this should instead be {kind: "code", text: …}
    spoiler: (...items: Richtext.Span[]): Richtext.Span => rt.kind("spoiler", {}, items),
};

export const mnu = {
    link: (client: {id: string}, text: string, url: string, selected: boolean): MenuItem => ({
        selected, action: {kind: "link", client_id: client.id, url}, text,
    }),
};