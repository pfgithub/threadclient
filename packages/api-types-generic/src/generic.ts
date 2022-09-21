import type {OEmbed} from "api-types-oembed";

// always use object.hasownpropertyvalue because this isn't a Map();
// TODO: store history?
// this will likely be backed by a solid Store to provide updates when
// individual pieces of content change.
export type Page2Content = {
    [key: string | symbol]: {data: unknown} | {error: string} | undefined,
};

export const p2 = {
    symbolLink<T>(debug_msg: string): Link<T> {
        const value = Symbol(debug_msg) as Link<T>;
        return value;
    },
    createSymbolLinkToError(content: Page2Content, emsg: string, data: unknown): Link<any> {
        // TODO provide data for additional info about the error
        const link = p2.symbolLink<any>("immediate error value");
        content[link] = {error: emsg};
        return link;
    },
    createSymbolLinkToValue<T>(content: Page2Content, value: T): Link<T> {
        const link = p2.symbolLink<T>("immediate value");
        content[link] = {data: value};
        return link;
    },

    stringLink<T>(link: string): Link<T> {
        return link as Link<T>;
    },
    fillLink<T>(content: Page2Content, link: Link<T>, value: T): Link<T> {
        content[link] = {data: value};
        return link;
    },
    fillLinkOnce<T>(content: Page2Content, link: Link<T>, value: () => T): Link<T> {
        if(content[link] == null) p2.fillLink(content, link, value());
        return link;
    },

    /// a vertical loader that has filled content, so there's no need to describe how to load it
    /// todo: reflect this in the data rather than requiring this mess
    prefilledVerticalLoader(
        content: Page2Content,
        key: Link<VerticalLoaded>,
        fill: VerticalLoaded | undefined,
    ): VerticalLoader {
        // eslint-disable-next-line eqeqeq
        if(fill !== undefined) p2.fillLink(content, key, fill);
        return {
            kind: "vertical_loader",
            key,
            temp_parent: p2.createSymbolLinkToError(content, "vertical loader claimed to be prefilled", fill),
            load_count: null,
            request: p2.createSymbolLinkToError(content, "vertical loader claimed to be prefilled @2", fill),
            client_id: "@E@UNNECESSARY",
            autoload: false,
        };
    },
    prefilledHorizontalLoader(
        content: Page2Content,
        key: Link<HorizontalLoaded>,
        fill: HorizontalLoaded | undefined,
    ): HorizontalLoader {
        // eslint-disable-next-line eqeqeq
        if(fill !== undefined) p2.fillLink(content, key, fill);
        return {
            kind: "horizontal_loader",
            key,
            load_count: null,
            request: p2.createSymbolLinkToError(content, "horizontal loader claimed to be prefilled", fill),
            client_id: "@E@UNNECESSARY",
            autoload: false,
        };
    },
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
export function readLink<T>(content: Page2Content, link: Link<T>): null | ReadLinkResult<T> {
    const root_context = content;
    const value = root_context[link]; // get the value first to put a solid js watcher on it
    if(!value) return null;
    if(Object.hasOwnProperty.call(root_context, link)) {
        if('error' in value) return {error: value.error, value: null};
        return {value: value.data as T, error: null};
    }else{
        return {error: "[read]Link found but not in hasOwnProperty: "+link.toString(), value: null};
    }
}

export type PostParent = {
    loader: VerticalLoader,
};
export type PostReplies = {
    reply?: undefined | {
        action: ReplyAction,
        locked: boolean,
    }, // does this even belong here? feels like it should be part of the post. having it here just makes
    // a mess that clients have to deal with and the ui has to deal with. anyway it's staying here for now
    // but it really doesn't belong here.

    display: "tree" | "repivot_list",

    loader: HorizontalLoader,

    sort_options?: undefined | SortOption[],
    // ^ should this go in the post?
};
export type SortOption = ({
    kind: "url",
    name: string,
    url: string,
} | {
    kind: "post",
    name: string,
    post: Link<Post>,
} | {
    kind: "more",
    name: string,
    submenu: SortOption[],
});

// ok two options:
// - tabbed replies
//   - issue is in switching the url of all the posts when changing tabs
// - tabbed post
//   - issue is in us having like 20 copies of the same data if there are 20 sort methods
//     - maybe as long as we make sure post content is a reference, that won't be much of an issue

// export type TabbedPost = {
//     // I don't like this, this requires us to generate like 8 copies of each post if there are 8 sort methods
//     // I'd rather this used a loader, when you click a tab it switches to an unfilled link and the description
//     // for how to fill it is here
//     // ok actually 
//     selected_tab: Link<string>,
//     default_tab: Link<Post>,
//     tabs: {
//         [key: string]: Link<Post>,
//     },
// };
export type VerticalLoaded = Post;
export type VerticalLoader = {
    kind: "vertical_loader",
    key: Link<VerticalLoaded>, // null = no parent. unfilled = not yet loaded

    temp_parent: null | Link<Post>, // temporary parent until the link is fliled. we could, after loading, assert that
    // this parent is somewhere in the loaded post's tree because if it isn't, it's likely an error.
} & BaseLoader;
export type HorizontalLoaded = (Link<Post> | HorizontalLoader)[];
export type HorizontalLoader = {
    kind: "horizontal_loader",
    key: Link<HorizontalLoaded>, // unfilled = not yet loaded
} & BaseLoader;

export type BaseLoader = {
    load_count: null | number, // number of items to be loaded, or null if it is not known.
    request: Link<Opaque<"loader">>, // ← never load when another loader with the same link is loading.
    // this is how we create linked loaders, they are two loaders that have the same request key.
    client_id: string,
    autoload: boolean,
};

// vv we don't know typesafely that it's unloaded but don't call something this unless it's unloaded
export type PostOrUnloadedLoader = Post | HorizontalLoader | VerticalLoader;

export type Post = {
    kind: "post",

    content: PostContent, // content should always be in a PostData. eg: crossposts that are embedded in a body also need parent, replies.
    internal_data: unknown,

    disallow_pivot?: undefined | boolean,
    parent: null | PostParent,
    replies: null | PostReplies,
    
    url: string | null, // if a thing does not have a url, it cannot be the pivot
    client_id: string,
};

export type TabSet = {
    link: Link<Post>,
    text: string,
}[];

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
        text: string, // make this null | string instead of this null | {text: string} thing
    },
    flair?: Flair[] | undefined, // maybe content warnings should be seperate
    thumbnail?: Thumbnail | undefined,
    info?: PostInfo | undefined,

    // TODO: author?: Link<Post> | undefined
    // - author will be rendered using a different post renderer
    // - it will render the thumbnail and title
    // - if we use a Bio content type instead of a normal Post content type, we could maybe make it a little
    //   better
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

    sidebar?: PostReplies | undefined,
};

export type PostContent = ClientPost | {
    // TODO: delete this and use the sidebar property on post instead

    /// the thing containing the header and sidebar. when rendered below
    /// the pivot, uses an alternate render.
    kind: "page",
    title: null | string,
    wrap_page: {
        sidebar: PostReplies,
        header: RedditHeader, // todo this needs to be able to be a loader
    },
    // overview: ClientPost, // I think this is supposed to be for if rendered below the pivot
} | PostContentPost | {
    kind: "legacy",
    thread: Thread,
    client_id: string,
} | {
    kind: "special",
    tag_uuid: `${string}@-${string}`,
    not_typesafe_data?: undefined | unknown,
    fallback: PostContentPost,
} | {
    kind: "submit",
    submission_data: Submit.SubmitPost,
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
        // w: number, h: number, // assumed 1:1 aspect ratio
        hover?: undefined | {
            url: string,
            w: number, h: number,
            description: string,
        },
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
export type BodyGallery = {
    kind: "gallery",
    images: GalleryItem[],
};
// TODO declare namespace Body {}
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
} | BodyGallery | {
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
} | {
    kind: "iframe_srcdoc",
    srcdoc: string,
    height_estimate: number,
};
export type OEmbedBody = {
    kind: "oembed",
    client_id: string,
} & ({
    url: string,
} | {
    card: OEmbed,
});
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

export type InfoPfp = {
    cw_masked?: undefined | boolean,
    url: string,
    full_size_animated?: undefined | string,
    view?: undefined | null | "reddit-nft",
};
export type InfoAuthor = {
    name: string,
    color_hash: string,
    link: string,
    client_id: string,
    flair?: Flair[] | undefined,
    pfp?: undefined | InfoPfp,
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
export type SystemKind = "none" | "op" | "cake" | "admin" | "moderator" | "approved" | "error";
export type Flair = {
    color?: string | undefined,
    elems: Richtext.Span[],
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
    icon?: undefined | Icon,
    page1_style?: undefined | ButtonStyle,
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
    icon?: undefined | Icon,
} | {
    kind: "flair",
    flair_list: Opaque<"flair_list">, // → FlairList
    current: Flair | null,
} | CodeAction;

export type CodeAction = {
    kind: "code",
    body: Body,
};

/*
reddit posts:
- richtext
- images & video gallery (this will require a proxy. we'll have to get the threadclient extension to a usable state and release it.)
- link
- poll
- talk (not sure what this is)

api samples:
https://oauth.reddit.com/api/validate_submission_field?raw_json=1&gilding_detail=1
req: sr=threadclient&field=body&kind=self&title=&url&text=%E2%80%A6&flair_id&show_error_list=true
→ {errors: []}
deleting a post: /api/del?id=…

// SubmitPost is a content type for a page2 object
// so it has a url and parent and all that
// it's toggled when you click 'reply'
// or you can get it by navigating to /submit
*/
export declare namespace Submit {
    export type SubmitPost = {
        fields: Field[],
        // ValidateField(field)
        // ⇒ /api/validate_submission_field
    };
    export type Field = {
        kind: "title",
    } | {
        kind: "content",
        content_types: ContentType[],
    } | {
        kind: "flair",
        flairs: FlairChoice[],
        mode: "radio" | "toggle",
    };
    export type ContentType = ({
        kind: "text",
        mode: "reddit",
    } | {
        kind: "link",
    } | {
        kind: "todo",
        title: string,
        reason: string,
        linkout: string,
    }) & {
        disabled?: undefined | null | string,
    };
    export type FlairChoice = {
        id: string,
        flairs: Flair[],
        disabled?: undefined | null | string,
    };
}

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
    | "ellipsis"
    | "external"
    | "trash"
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