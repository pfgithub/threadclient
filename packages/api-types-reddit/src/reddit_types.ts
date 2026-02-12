// types for the public reddit api

export type AccessToken =
    | {error: true}
    | {error: false, access_token: string, refresh_token: string, expires_in: number, scope: string}
;

export type AnyResult = Page | Listing | WikiPage | UserList | T5 | UnsupportedResult;

export type UnsupportedResult = {kind: "unsupported", extra: unknown};

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

export type TrophyList = {
    kind: "TrophyList",
    data: {
        trophies: Trophy[],
    },
};
export type Trophy = {
    kind: "t6",
    data: {
        name: string,
        url: string | null,
        icon_70: string,
        icon_40: string,
        award_id: string,
        description: string | null,
        granted_at: number | null,
    },
};

export type ModeratedList = {
    kind: "ModeratedList",
    data: ModeratedSub[],
};

export type ModeratedSub = {
    community_icon: "" | string,
    display_name: string,
    title: string,
    over_18: boolean,
    icon_size: null,
    primary_color: "" | string, // ?
    icon_img: "" | string, // ?
    display_name_prefixed: string, // r/…
    sr_display_name_prefixed: string, // r/…
    subscribers: number,
    whitelist_status: null | "some_ads" | "unsupported",
    subreddit_type: SubredditType,
    key_color: "" | `#${string}`,
    name: `t5_${string}`,
    // created: number,
    url: string,
    sr: string,
    created_utc: number,
    banner_size: null,
    mod_permissions: [],
    user_can_crosspost: boolean,
};

export type LabeledMulti = {
    kind: "LabeledMulti",
    data: {
        name: string,
        description_md: Markdown,
        description_html: HTML,
        owner: string, // /u/…
        
        can_edit: boolean,
        display_name: string,
        num_subscribers: number,
        copied_from: null,
        icon_url: string,
        subreddits: {name: string}[],
        created_utc: Date.Sec,
        visibility: SubredditType,
        over_18: boolean,
        path: string,
        key_color: "",
        owner_id: `t2_${string}`,
        is_favorited: boolean,
    },
};

export type InboxMsg = {
    kind: "t1" | "t4",
    data: {
        first_message: null,
        first_message_name: null,
        subreddit: string | null,
        likes: true | false | null,
        author_fullname: null | string,
        id: string,
        subject: string,
        associated_awarding_id: null | string, // for "your comment has been given the … award" messages
        score: number,
        author: null | string,
        num_comments: number | null,
        parent_id: string | null,
        subreddit_name_prefixed: string | null,
        new: boolean,
        body: Markdown,
        dest: string, // your username unprefixed | probably a subreddit name idk
        was_comment: boolean,
        body_html: HTML,
        name: string, // t1_:id | t3_:id
        // created: unusable
        created_utc: Date.Sec,
        context: string | "", // link to context | empty string
        distinguished: null | "gold-auto" | "moderator" | "unsupported",
        replies: "" | {
            kind: "Listing",
            data: {
                after: null,
                before: null,
                children: InboxMsg[],
            },
        },
        type: null | "unknown",
    },
} | {
    kind: "unsupported",
};

// /r/…/api/user_flair_v2
// /r/…/api/link_flair_v2
export type FlairTemplate = {
    type: FlairBits.Type,
    text_editable: boolean, // when text_editable is true, you are allowed to put up to max_emojis emojis also
    max_emojis: number,
    allowable_content: "all" | "unsupported",
    text: FlairBits.Text, // when is this null? it should be filled for both text and richtext emojis
    text_color: FlairBits.TextColor,
    mod_only: boolean, // you don't have to filter these out, reddit will only return valid items
    background_color: `#${string}`,
    richtext: FlairBits.Richtext,
    id: string, // uuid
    css_class: string,
    override_css?: undefined | boolean,
};
// /api/v1/:sub/emojis/all
export type SREmojis = {
    snoomojis: {[key: string]: Emoji},
    [key: string]: {[key: string]: Emoji}, // key: `t5_${string}`
};
export type Emoji = {
    url: string,
    user_flair_allowed: boolean,
    post_flair_allowed: boolean,
    mod_flair_only: boolean, // hopefully filtered out automatically
    created_by: `t2_${string}`, // id of user who created it. note that there is no api request you can use to get usernames from user ids.
};
// /api/selectflair
// - api_type=json
// - return_rtjson=all
// - flair_template_id=template_id
// - name: "your_username"
// - text: "text:emoji_name:"
// note new.reddit uses 'content-type': "application/json; charset=UTF-8" but still posts urlencoded data. weird.
// →
// {json: {errors: []}} and also probably the richtext content

// ALSO at the same time post
// /r/…/api/setflairenabled
// - api_type=json
// - flair_enabled: true
// →
// {json: {errors: []}} and also probably the richtext content

export declare namespace FlairBits {
    export type Richtext = RichtextFlair | null;
    export type Type = "text" | "richtext" | "unsupported";
    export type Text = string | null;
    export type TextColor = "light" | "dark" | null;
    export type BackgroundColor = string | null;
}

export type UserList = {
    kind: "UserList", // very consistent naming capitalization here. t1…t5 wikipage Listing UserList
    data: {
        children: {
            name: string,
            author_flair_text: string,
            author_flair_css_class: null,
            date: Date.Sec,
            rel_id: string,
            id: string,
            mod_permissions: ModPerm[],
        }[],
    },
};
type ModPerm = "all" | "wiki" | "mail" | "posts" | "flair" | "access" | "unsupported";

// almost the same as the rules in the rules widget but different capitalization
export type Rule = {
    kind: "link" | "comment" | "all" | "unsupported",
    description: Markdown, // optional, might be empty
    description_html?: undefined | HTML,
    short_name: string, // send this one as the rule_reason
    violation_reason: string, // show this one when submitting a report
    created_utc: Date.Sec,
    priority: number,
};

// return of /api/sitewide_rules
export type SitewideRules = {
    sitewide_rules: SitewideRulesFlow,
};

// return of /r/…/about/rules
// note: also check /r/…/about to see if free_form reports are enabled
export type Rules = {
    rules: Rule[],
    site_rules_flow: SitewideRulesFlow,

    // depricated
    // site_rules: string[],
};
// note "best" is "confidence"
export type Sort = "confidence" | "top" | "new" | "controversial" | "old" | "random" | "qa" | "live" | "unsupported";

export type SitewideRulesFlow = FlowRule[];

export type ReportResponse = {
    jquery: unknown, // says to hide the post in jquery
    success: boolean,
};

export type FlowRule = {
    reasonText: string, // rule id, to be sent in the api request `site_reason`

    reasonTextToShow: string,
} & (
    {
        __nothing?: undefined,
    } | {
        nextStepHeader: string,
        nextStepReasons: FlowRule[],
    } | {
        fileComplaint: true,

        complaintPrompt: string,
        complaintButtonText: string,
        complaintUrl: string, // NOTE: replace urldecoded `(thing)` with thing id, then re-urlencode the url (or don't, it doesn't seem to matter)
        complaintPageTitle: string,
    } | {
        canWriteNotes: true,
        notesInputTitle: string,
        isAbuseOfReportButton?: undefined | true,
    } | {
        // when reporting a specific post or comment, automatically fill in the username
        // and don't show the prompt to pick a username
        canSpecifyUsernames: true,
        usernamesInputTitle: string,
        
        requestCrisisSupport?: undefined | boolean,
        oneUsername?: undefined | boolean,
    }
);

export type TopLevelMenuItem = {
    text: string,
    children: MenuItem[], 
} | MenuItem;
export type MenuItem = {
    text: string,
    url: string,
};

// documented here https://www.reddit.com/dev/api/#POST_api_widget
// (note, that's for POST while this is for GET so there is a chance of differences)
export type Widget = {
    id: `widget_${string}`,
    styles: {
        headerColor: null,
        backgroundColor: null,
    },
} & ({
    kind: "moderators",
    mods: {
        name: string,
        authorFlairType: FlairBits.Type,
        authorFlairTextColor: FlairBits.TextColor,
        authorFlairText: FlairBits.Text,
        authorFlairRichText: FlairBits.Richtext,
        authorFlairBackgroundColor: FlairBits.BackgroundColor,
    }[],
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
        name: string,
        subscribers: number,
        primaryColor: "" | `#{string}`,
        isSubscribed: boolean,
        type: "subreddit",
        communityIcon: "" | string,
        iconUrl: "" | string, // some use "communityIcon" and some use "iconUrl"
        isNSFW: boolean,
    } | {
        type: "unsupported",
    })[],
    shortName: string,
} | {
    kind: "menu",
    data: TopLevelMenuItem[],
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
        linkUrl?: undefined | string,
        width: number,
        height: number,
    }[], // only contains one item unless progressive_images is enabled
    shortName: string,
} | {
    kind: "post-flair",
    shortName: string,
    order: string[], // keys into the templates map
    templates: {[key: string]: {
        templateId: typeof key,
        backgroundColor: FlairBits.BackgroundColor,
        textColor: FlairBits.TextColor,
        text: FlairBits.Text,
        richtext: FlairBits.Richtext,
        type: FlairBits.Type,
    }},
} | {
    kind: "custom",
    // display this in a shadow dom and use a html renderer with no class modifications
    // or just display it in an iframe srcdoc like new.reddit does. that seems easier.
    imageData: {width: number, height: number, name: string, url: string}[],
    css: string, // replace %%name%% with url() imagedata.url

    text: Markdown,
    textHtml: HTML,

    stylesheetUrl: string, // pre-replaced css. use this instead of css, why not

    height: number,

    shortName: string,
} | {
    kind: "button",
    shortName: string,

    description: Markdown,
    descriptionHtml: HTML,

    buttons: ({
        kind: "text",
        text: string,
        url: string,

        color?: undefined | string,
        textColor?: undefined | string,
        fillColor?: undefined | string,
    } | {
        kind: "image",
        linkUrl: string,
        
        text: string, // alt
        url: string,
        width: number,
        height: number,
    } | {
        kind: "unsupported",
    })[],
} | {
    kind: "calendar",
    shortName: string,
    requiresSync: boolean, // not sure what this is, maybe used for the reddit backend?
    data: CalendarItem[],
} | {
    kind: "unsupported",
});

export type CalendarItem = {
    allDay: boolean,
    
    startTime: Date.Sec,
    endTime: Date.Sec,
    
    location: Markdown | null,
    locationHtml?: never | HTML,

    description: Markdown | null,
    descriptionHtml?: never | HTML,

    title: Markdown,
    titleHtml: HTML,

    // display:
    //   title
    //   startTime
    //   location
    //   description
};

export type ApiWidgets = {
    items: {[key: string]: Widget},
    layout: {
        idCardWidget: `widget_id-card-${string}`,
        topbar: {order: `widget_${string}`[]}, // ??? what are topbar widgets
        sidebar: {order: `widget_${string}`[]},
        moderatorWidget: `widget_moderators-${string}`,
    },
};

export type T2DataBase = {
    is_employee: boolean,
    is_friend: boolean,
    subreddit: T5Data,
    snoovatar_size: null,
    awardee_karma: number,
    id: string,
    gilded_last_month: unknown, // {}
    verified: boolean,
    is_gold: boolean,
    is_mod: boolean,
    awarder_karma: number,
    has_verified_email: boolean,
    icon_img: string | "", // idk what this looks like for people with no icon
    hide_from_robots: boolean,
    link_karma: number,
    pref_show_snoovatar: boolean,
    total_karma: number,
    accept_chats: boolean,
    name: string,
    created_utc: number,
    snoovatar_img: "",
    comment_karma: number,
    has_subscribed: boolean,
    accept_pms: boolean,
};
export type T2DataOtherUser = T2DataBase & {__is_the_logged_in_user: false};
export type T2DataLoggedIn = T2DataBase & LoggedInT2Data;

export type T2Data = T2DataOtherUser | T2DataLoggedIn;

// user info
export type T2 = {
    kind: "t2",
    data: T2Data,
};

// info only available for the logged in user
export type LoggedInT2Data = {
    inbox_count: number,
    new_modmail_exists: boolean,

    features: {
        // likely this is information about features where rollout is in progress and this doesn't matter to threadclient
        mod_service_mute_writes: boolean,
        promoted_trend_blanks: boolean,
        show_amp_link: boolean,
        report_service_handles_report_writes_to_db_for_helpdesk_reports: boolean,
        report_service_handles_self_harm_reports: boolean,
        report_service_handles_report_writes_to_db_for_modmail_reports: boolean,
        chat: boolean,
        reports_double_write_to_report_service_for_spam: boolean,
        is_email_permission_required: boolean,
        reports_double_write_to_report_service_for_modmail_reports: boolean,
        mod_awards: boolean,
        report_service_handles_report_writes_to_db_for_sendbird_chats: boolean,
        econ_wallet_service: boolean,
        mweb_xpromo_revamp_v2: {
            owner: string,
            variant: string,
            experiment_id: number,
        },
        webhook_config: boolean,
        awards_on_streams: boolean,
        report_service_handles_accept_report: boolean,
        mweb_xpromo_modal_listing_click_daily_dismissible_ios: boolean,
        reports_double_write_to_report_service_for_som: boolean,
        live_orangereds: boolean,
        reports_double_write_to_report_service_for_users: boolean,
        modlog_copyright_removal: boolean,
        report_service_handles_report_writes_to_db_for_users: boolean,
        show_nps_survey: boolean,
        do_not_track: boolean,
        report_service_handles_report_writes_to_db: boolean,
        reports_double_write_to_report_service_for_helpdesk_reports: boolean,
        report_service_handles_report_writes_to_db_for_spam: boolean,
        reports_double_write_to_report_service_for_sendbird_chats: boolean,
        mod_service_mute_reads: boolean,
        mweb_xpromo_interstitial_comments_ios: boolean,
        chat_subreddit: boolean,
        noreferrer_to_noopener: boolean,
        chat_user_settings: boolean,
        premium_subscriptions_table: boolean,
        reports_double_write_to_report_service: boolean,
        mweb_xpromo_interstitial_comments_android: boolean,
        report_service_handles_report_writes_to_db_for_awards: boolean,
        reports_double_write_to_report_service_for_awards: boolean,
        mweb_xpromo_revamp_v3: {
            "owner": string,
            "variant": string,
            "experiment_id": number,
        },
        chat_group_rollout: boolean,
        resized_styles_images: boolean,
        spez_modal: boolean,
        mweb_xpromo_modal_listing_click_daily_dismissible_android: boolean,
        expensive_coins_package: boolean,
        report_service_handles_report_writes_to_db_for_som: boolean,
    },
};

export type Markdown = string;// & {__distinct_fakeprop: "markdown"};
export type HTML = string;// & {__distinct_fakeprop: "html"};

export declare namespace Date {
    export type Sec = number;// & {__distinct_fakeprop: "sec"}; // sec since epoch (utc)
    export type Ms = number;// & {__distinct_fakeprop: "ms"};  // ms since epoch (utc)
}

type LoginState<LoggedIn, NotLoggedIn> = {_logged_in: LoggedIn, _not_logged_in: NotLoggedIn};
type LoginWrap<T extends {[key: string]: LoginState<unknown, unknown>}> =
    {[key in keyof T]: T[key]["_logged_in"]} | {[key in keyof T]: T[key]["_not_logged_in"]}
;

export type SubredditType =
    | "public"
    | "private"
    | "restricted"
    | "gold_restricted"
    | "archived"
    | "user"
    | "unsupported"
;

// outdated documentation: https://github.com/reddit-archive/reddit/wiki/JSON
// more here: https://github.com/Pyprohly/reddit-api-doc-notes/blob/master/docs/api-reference/subreddit.rst
// oh my this is a mess
export type T5 = {
    kind: "t5",
    data: T5Data,
};

export type T5Data = { // T5_Data? pascal_underscore case?
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
    // public_description_html: HTML, // doesn't exist on user profile pages

    description: Markdown,
    description_html: HTML, // old.reddit sidebar text

    header_title: string,
    header_size: null | [w: number, h: number],
    header_img: null | string,

    subreddit_type: SubredditType,
    user_is_contributor: boolean | null, // note, only contributers can create posts in restricted subs

    key_color: string,

    created: Date.Sec,
    created_utc: Date.Sec,

    user_is_subscriber: boolean | null,

    community_icon: "" | string,
    banner_background_image: "" | string,
    banner_img?: undefined | "" | string,
    mobile_banner_image: "" | string,
    banner_size: null | [w: number, h: number],
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
    allow_talks: boolean,

    submission_type: "any" | "self" | "unsupported",

    can_assign_link_flair: boolean,

    is_crosspostable_subreddit: boolean,

    allow_chat_post_creation: boolean,
} & {
    // information required when reporting posts
    free_form_reports: boolean,
    // most information is in /about/report, not sure why this one bit is here
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

    primary_color: `#${string}` | "",

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
    
    quarrentine: boolean,
    hide_ads: boolean,
    prediction_leaderboard_entry_type: "IN_FEED" | "unsupported",
    advertiser_category: "",

    videostream_links_count: number,

    comment_score_hide_mins: number,

    allow_predictions: boolean, // allow gambling polls
    wiki_enabled: null,

    user_can_flair_in_sr: true | null,
} & {
    // experiments with 100% enrollment
    is_enrolled_in_new_modmail: null,
} & Depricated<{
    // depricated in favor of different props
    has_menu_widget: boolean,
    accounts_active: number, // active_user_count
}>;

type Depricated<T> = T;

export type ModmailUnreadCount = {
    archived: number,
    appeals: number,
    highlighted: number,
    notifications: number,
    join_requests: number,
    new: number,
    inprogress: number,
    mod: number,
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
        data: {
            things: PostCommentLike[],
        },
    },
};

type ModReport = [text: string, reporter: string];
type UserReport = [text: string, count: number];

export type BaseMediaMeta = {
    x: number, y: number,
};
export type ImageMeta = BaseMediaMeta & {
    u: string,
};
export type AnimatedImageMeta = BaseMediaMeta & {
    gif: string,
    mp4?: undefined | string,
};
export type BaseMedia = {
    m: string, // eg image/png or image/gif
    status: "valid",
    id: string,
};
export type ErroredMedia = {
    status: "failed" | "unsupported",
};
export type Media = (BaseMedia & ({
    e: "Image",
    m: string, // eg image/png

    p?: undefined | ImageMeta[], // alternate sizes, small → large
    s: ImageMeta, // source size

    t: "emoji" | "sticker" | "unsupported",
} | {
    e: "AnimatedImage",
    ext?: undefined | string, // external link, eg giphy.com/…
    m: string, // eg image/gif

    p?: undefined | ImageMeta[], // alternate sizes
    s: AnimatedImageMeta, // source size
} | {
    e: "RedditVideo",
    dashUrl: string, // https://v.redd.it/link/:postname/asset/:id/DASHPlaylist.mpd?a=…&v=1&f=sd
    hlsUrl: string, // https://v.redd.it/link/:postname/asset/:id/HLSPlaylist.m3u8?a=…&v=1&f=sd
    x: number,
    y: number,
    isGif: boolean,
} | {
    e: "unsupported",
})) | ErroredMedia;
export type MediaMetadata = {[key: string]: Media};

export type UserDistinguished = "admin" | "moderator" | "unsupported";

export type PostOrComment = {
    id: string,
    name: `${string}_${string}`, // post fullname

    author: string,
    author_fullname: `t2_${string}`,
    author_cakeday?: undefined | boolean,
    profile_img?: undefined | string,
    profile_over_18?: undefined | boolean,

    link_id: `t3_${string}`,
    
    likes: true | false | null,

    score: number, // uuh why do inbox entries have score but not score_hidden

    distinguished: UserDistinguished | null,

    created_utc: Date.Sec, // there's also created but that's not utc

    permalink: string,

    all_awardings: Award[],

    score_hidden: boolean,

    upvote_ratio?: undefined | number, // on posts
    controversiality?: undefined | 0 | 1, // on comments

    archived?: undefined | boolean,

    author_flair_type: FlairBits.Type,
    author_flair_text: FlairBits.Text,
    author_flair_richtext: FlairBits.Richtext,
    author_flair_background_color: FlairBits.BackgroundColor,
    author_flair_text_color: FlairBits.TextColor,

    media_metadata?: undefined | MediaMetadata,

    saved: boolean,
    edited: false | number,

    subreddit: string,
    subreddit_name_prefixed: string, // post subreddit (u/ or r/)
    subreddit_id: `t5_${string}`, // fullname
    subreddit_type: SubredditType,

    locked: boolean,

    approved?: undefined | boolean,
    pinned?: undefined | boolean,
    stickied?: undefined | boolean,

    mod_reports: ModReport[],
    mod_reports_dismissed?: undefined | ModReport[],
    user_reports: UserReport[],

    // moderator stuff. always null unless you're moderator
    // maybe do a LoginWrap<{}> for this?
    approved_at_utc: null,
    mod_reason_title: null,

    depth: number, // use this to determine the number for "load x more" when going up
};

type VariantSource = {
    source: {url: string, width: number, height: number},
    resolutions: {url: string, width: number, height: number}[],
};

export type PostSubmission = PostOrComment & {
    title: string,

    // content warnings
    spoiler: boolean,
    over_18: boolean,
    is_original_content: boolean,

    // content
    url: string,
    is_self: boolean,
    rtjson: Richtext.Document, // deleted comments are <p>[deleted]</p>.
    // I don't see any other field in the api for this. if author == u/[deleted] then check body.
    thumbnail?: undefined | string,

    selftext: Markdown | "",
    selftext_html: HTML | null,

    gallery_data?: undefined | {items: {
        caption?: undefined | string,
        media_id: string, // →media_metadata
        id: number,
    }[]},

    preview?: undefined | {
        images: ({
            id: string,
            variants: {
                gif?: undefined | VariantSource,
                mp4?: undefined | VariantSource,
            },
        } & VariantSource)[],
        enabled: boolean,
    },
    
    link_flair_type: FlairBits.Type,
    link_flair_text: FlairBits.Text,
    link_flair_richtext: FlairBits.Richtext,
    link_flair_background_color: FlairBits.BackgroundColor,
    link_flair_text_color: FlairBits.TextColor,

    num_comments: number,

    crosspost_parent_list?: undefined | PostSubmission[],

    media_embed?: undefined | {content?: undefined | string},

    can_mod_post: boolean,
    contest_mode: boolean,

    domain: string,

    poll_data?: undefined | {
        options: {
            text: string, id: string,
            vote_count?: undefined | number,
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
    // https://thread.pfg.pw/reddit/r/redditdev/comments/kypjmk/check_if_submission_has_been_removed_by_a_mod/gjpjyw3/?context=3&sort=confidence
    removed_by_category: null | RemovedByCategory,

    suggested_sort?: undefined | Sort | null,

    rpan_video?: undefined | {
        hls_url: string, // https://watch.redd.it/hls/…/index.m3u8 // note this can be fetched, it allows cross-origin requests
        scrubber_media_url: string, // https://watch.redd.it/hls/…/thumbnail.jpg // not sure why this would be a jpg file
    },

    // chat threads must be "unrolled" and all comments should be sorted by time
    // then, comments with parents should act like on mastodon and have a "show thread" button
    // alternatively, they should be a link that scrolls the page
    // actually that might not work properly when loading more
    // uuh
    // that's unfortunate I guess
    discussion_type: "CHAT" | "unsupported" | null,
};

export type RemovedByCategory =
    // This post was removed by Reddit's Anti-Evil Operations
    // For violating the https://thread.pfg.pw/reddit/help/contentpolicy content policy
    | "anti_evil_ops"
    // Sorry, this post was removed by Reddit's Community team.
    // It's rare, but Reddit's Community Team will occasionally remove posts from feeds to keep communities safe and civil.
    | "community_ops"
    // This post was removed for legal reasons
    | "legal_operations"
    // Removed for copyright infringement.
    | "copyright_takedown"
    // Spam filter
    | "reddit"
    // Removed by the post author (?)
    | "author"
    // Deleted by the post author
    | "deleted"
    // Removed by a moderator of r/subreddit
    | "moderator"
    // Filtered by automoderator
    | "automod_filtered"
    // Sorry, this post was removed by Reddit.
    // Reddit administrators occasionally remove posts that violate Reddit's User Agreement and Content Policy.
    // [I would give an example but pushshift cached it so nvm]
    | "content_takedown"
    // other
    | "unsupported"
;

export type PostComment = PostOrComment & {
    replies: Listing | "",
    parent_id: Fullname,

    author_flair_richtext: RichtextFlair,

    is_submitter: boolean, // is OP of post

    rtjson: Richtext.Document,
    body: string,
    body_html: string,

    collapsed: boolean,
    // collapsed_reason: ?,
    // collapsed_because_crowd_control: ?,

    /// sometimes this will be null even when collapsed is true. not sure why
    /// it could be crowd control?
    /// one of these I saw didn't have score visible yet and seemed like it could
    /// have been due to low score.
    /// not sure if this is something I should rely on.
    /// ok I found one 100% collapsed due to crowd control and it did not have a reason
    /// code.
    collapsed_reason_code: "DELETED" | "LOW_SCORE" | null,
} & ({
    link_id: `t3_${string}`,
    link_author: string,
    link_permalink: string,
    link_title: string,
    link_url: string,
} | {
    __nothing?: undefined,
});

export type Fullname = `${string}_${string}`;

export type PostMore = {
    // /api/morechildren loader
    count: number,
    depth: number,
    id: string,
    name: Fullname,
    parent_id: Fullname,
    children: string[],
} | {
    // depth-based loader
    count: number,
    depth: number,
    id: string,
    name: "t1__",
    parent_id: Fullname,
    children: [],
};

export type T1 = {
    kind: "t1",
    data: PostComment,
};

export type More = {
    kind: "more",
    data: PostMore,
};

export type PostCommentLike = T1 | More;

export type T3 = {
    kind: "t3",
    data: PostSubmission,
};

export type Post = T3 | T5 | PostCommentLike | {
    kind: "unsupported",
    data: {name: string},
};

export type APIError = {
    json: {
        errors: [id: string, message: string, unknown: null | unknown][],
    // some ids I've seen:
    // USER_REQUIRED - "Please log in to do that."
    },
} | {
    jquery: [number, number, ...JQueryItem][],
    success: false,
};
export type JQueryItem = [method: "call", args: unknown[]] | [method: "unsupported"];

export type Award = {
    // info about the post awarding
    count: number,
    
    // info about the award
    id: string,
    name: string,
    description: string,

    icon_format: "PNG" | "APNG" | "unsupported" | null,
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
    giver_coin_reward: number | null, // # coins the giver gets
    penny_donate: number | null, // ?
    penny_price: number | null, // ?

    subreddit_coin_reward: number, // # coins the subreddit gets
    subreddit_id: string | null,

    days_of_drip_extension: number, // ??
    days_of_premium: number, // # days premium reciever gets

    start_date?: undefined | unknown,
    end_date?: undefined | unknown,

    award_type: "global" | "unsupported",
    award_sub_type: "GLOBAL" | "PREMIUM" | "APPRECIATION" | "unsupported",
    awardings_required_to_grant_benefits?: undefined | unknown,

    tiers_by_required_awardings?: undefined | unknown,
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
        c: LI[],
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
    export type LI = {
        e: "li",
        c: Paragraph[],
    };
    export type Span = {
        e: "text",
        t: string,
        f?: undefined | FormatRange[],
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
        a?: undefined | string, // tooltip text
        f?: undefined | FormatRange[],
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
        e: "img",
        id: string, // information is provided in media_metadata
        o?: undefined | string, // no clue. a link -> reddit external link safety -> http://img&token=...
    } | {
        e: "unsupported",
    };
    export type TableHeading = {
        a?: undefined | "L" | "C" | "R", // align
        c?: undefined | Span[],
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

export type ApiLinkFlair = FlairTemplate[];

// i want to be able to type the types
// like export type Requests: {[key: string]: RequestInfo} = {};
// I think I can do that with like a "extends" but not sure

export type JStr<T> = string & {__is_jstr_of: T};

// TODO: auto convert top levels to JStr in redditRequest and define types
// using normal json types
export type ApiSubmitBody = {
    api_type: "json",
    collection_id?: undefined | string, // a uuid of the collection it belongs to
    event_start?: undefined | string, // ie 2018-09-11T12:00:00 :: Date.toISOString()
    event_end?: undefined | string, // ie 2018-09-11T12:00:00 :: Date.toISOString()
    event_tz?: undefined | string, // pytz timezone ie 'America/Los_Angeles'
    extension?: undefined | string, // no clue what this is. "extension used for redirects" = ?
    flair_id?: undefined | string, // uuid
    flair_text?: undefined | string, // string
    'g-recaptcha-response'?: undefined | string, // n/a
    kind: "link" | "self" | "image" | "video" | "videogif",
    nsfw: JStr<boolean>,
    post_set_default_post_id?: undefined | string, // not sure what this is
    post_set_id?: undefined | string, // not sure what this is
    richtext_json?: undefined | JStr<Richtext.Document>,
    // ^ note that if richtext_json is specified, text must not be specified
    sendreplies: JStr<boolean>, // TODO add a checkbox for this in UI
    spoiler: JStr<boolean>,
    sr: string, // sub name
    text?: undefined | Markdown, // mutually incompatable with richtext_json
    title: string, // max 300 chars
    url?: undefined | string,
    video_poster_url?: undefined | string, // likely used in video submit process. I'll have to try it and see.

    discussion_type?: undefined | "CHAT",
    original_content: JStr<boolean>,
    validate_on_submit: "true",
    show_error_list: "true",

    // submit_type: "subreddit",
    // presumably "subreddit" | "user" but I have to test

    // post_to_twitter: undefined | JStr<boolean> // ??? desktopapi uses this
};
export type ApiSubmitResponse = {
    // errors are handled by redditRequest(), we don't have to handle them here.
    json: {
        data: {
            url: string,
            drafts_count: number,
            id: string,
            name: `t3_${string}`,
            // sample: {"json": {"errors": [], "data": {"url": "https://www.reddit.com/r/threadclient/comments/xl6dwx/test2/", "drafts_count": 0, "id": "xl6dwx", "name": "t3_xl6dwx"}}}
        },
    },
};
export type ApiCommentOrEditComment = {
    api_type: "json",
    return_rtjson: JStr<boolean>,
    richtext_json?: undefined | JStr<Richtext.Document>,
    text?: undefined | string,
    thing_id: string,
};

export type IsRequest<T extends RequestInfo> = T;
export type RequestInfo = {
    body?: never | {[key: string]: string | undefined},
    response: unknown,
    query?: never | {[key: string]: string | null | undefined},
};
export type PathBit<T extends string = string> = `«ENCODED_${T}»`;
export type Requests = {
    // !!NOTE: Does not include possible errors in responses.
    // All responses should be treated as `Response | Reddit.APIError`
    //
    // !!NOTE: Queries exclude values which are required in every URL for these api responses to be correct:
    // ?raw_json=1&rtj=yes&emotes_as_images=true&gilding_detail=1&profile_img=true
    //
    // note: an alternative to this could be providing types for a generic url builder
    // eg like thing.api.test("somebit").post(data);
    "/api/comment": IsRequest<{
        body: ApiCommentOrEditComment,
        response: PostComment,
    }>,
    "/api/editusertext": IsRequest<{
        body: ApiCommentOrEditComment,
        response: PostComment,
    }>,
    "/api/submit": IsRequest<{
        query: {
            resubmit: "true" | "false",
        },
        body: ApiSubmitBody,
        response: ApiSubmitResponse,
        /*
        */
    }>,
    "/api/submit_poll_post": IsRequest<{
        body: {'TODO': "TODO"},
        response: {'TODO': "TODO"},
    }>,
    /*
    https://oauth.reddit.com/api/submit_poll_post.json?resubmit=true&rtj=both&raw_json=1&gilding_detail=1
    // !note: this might actually be a content-type json thing
    // check it again
    {
        "sr":"threadclient", "submit_type":"subreddit",
        "api_type":"json", "show_error_list":true,
        "title":"test poll", "spoiler":false,
        "nsfw":false, "post_to_twitter":false,
        "sendreplies":true, "duration":3, // num days (1-7)
        "options":["poll option 1","poll option 2"], "text":"markdown body text", // supports richtext, likely with "richtext_json"=… instead of "text"=…
        "raw_rtjson":null, "validate_on_submit":true,
    }
    */
    "/api/test/0": IsRequest<{
        query: {
            a: "b",
        },
        response: "no",
    }>,
    [key: `/r/${PathBit}/api/widgets`]: IsRequest<{
        query?: {
            progressive_images?: JStr<boolean> | undefined,
        },
        response: ApiWidgets,
    }>,
    [key: `/r/${PathBit}/about`]: IsRequest<{
        response: T5,
    }>,
    [key: `/r/${PathBit}/about/rules`]: IsRequest<{
        response: Rules,
    }>,
    [key: `/r/${PathBit}/api/link_flair_v2`]: IsRequest<{
        response: ApiLinkFlair,
    }>,
    "/api/multi/__unknown_base": IsRequest<{
        response: LabeledMulti,
    }>,
    [key: `/comments/${PathBit}`]: IsRequest<{
        query: {
            sort: Sort | null,
            comment: string | null,
            context: string | null,
        },
        response: Page,
    }>,
    [key: `/duplicates/${PathBit}`]: IsRequest<{ // could even enforce it has to be an unprefixed post fullname with distincts
        query: {
            after: string | null,
            before: string | null,
            sort: DuplicatesSort | null,
            crossposts_only: string,
        },
        response: Page,
    }>,
    // if bases are updated to start with a slash and not end with a slash, i think we can support them properly
    "/__unknown_base/__unknown_sort": IsRequest<{
        query: {
            t: SortTime | null, before: string | null, after: string | null,
        },
        response: Listing,
    }>,
    "/__any": IsRequest<{
        response: AnyResult,
    }>,
    "/__any_page": IsRequest<{
        response: Page,
    }>,
    "/__any_listing": IsRequest<{
        response: Listing,
    }>,
    "/message/unread": IsRequest<{
        response: Listing,
    }>,
    "/api/mod/conversations/unread/count": IsRequest<{
        response: ModmailUnreadCount,
    }>,
    "/__unknown": IsRequest<{
        response: unknown,
    }>,
    [key: `/user/${PathBit}/about`]: IsRequest<{
        response: T2,
    }>,
    [key: `/api/v1/user/${PathBit}/trophies`]: IsRequest<{
        response: TrophyList,
    }>,
    [key: `/user/${PathBit}/moderated_subreddits`]: IsRequest<{
        response: ModeratedList,
    }>,
    "/api/vote": IsRequest<{
        body: VoteBody,
        response: EmptyResult,
    }>,
    "/api/del": IsRequest<{
        body: {id: string},
        response: EmptyResult,
    }>,
    "/api/subscribe": IsRequest<{
        body: {
            action: "sub" | "unsub",
            sr_name: string,
        },
        response: EmptyResult,
    }>,
    "/api/report": IsRequest<{
        body: {
            sr_name: string,
            thing_id: string,
            rule_reason?: undefined | string,
            site_reason?: undefined | string,
            report_reason?: undefined | string,
            reason?: undefined | string,
        },
        response: ReportResponse,
    }>,
    "/api/morechildren": IsRequest<{
        query: {
            api_type: "json",
            limit_children: "false",
            children: string,
            link_id: `t3_${string}`,
            sort: Sort,
        },
        response: MoreChildren,
    }>,
    "/api/me": IsRequest<{
        response: ApiMe,
    }>,

    // i gave up, typescript was erroring with both `[key: …]` and `[key in …]`
    // might need to do PathBit<"a_or_un"> to make it a normal template string thing instead of a union
    "/api/save": IsRequest<ApiEntrySave>, "/api/unsave": IsRequest<ApiEntrySave>,
    "/api/read_message": IsRequest<ApiEntryReadMessage>, "/api/unread_message": IsRequest<ApiEntryReadMessage>,
};

type ApiEntrySave = {// [key in "/api/save" | "/api/unsave"]: { // `/api/${"" | "un"}save`
    body: {id: string},
    response: EmptyResult,
};
type ApiEntryReadMessage = {
    body: {id: string},
    response: EmptyResult,
};

export type EmptyResult = {_?: undefined};

export type DuplicatesSort = "num_comments" | "new" | "unsupported";


export type SortMode = "hot" | "new" | "rising" | "top" | "controversial" | "gilded" | "best" | "awarded" | "unsupported";
export type SortTime = "hour" | "day" | "week" | "month" | "year" | "all" | "unsupported";

export type ApiMe = {
    loid: string,
    loid_created: Date.Ms,
    kind: "t2",
    data: LoggedInT2Data,
};