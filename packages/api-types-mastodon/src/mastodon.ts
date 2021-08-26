import type { OEmbed } from "api-types-oembed";

export type ImageMeta = {
    width: number,
    height: number,
};
export type VideoMeta = { // video | gifv
    width: number,
    height: number,
    frame_rate: string,// #/# eg 20/1
    duration: string, // # secs
    bitrate: string, //
};

export type Emoji = {
    shortcode: string,
    static_url: string,
    url: string,
    visible_in_picker: boolean,
    category?: undefined | string,
};
// https://docs.joinmastodon.org/entities/attachment
export type Media = {
    id: string,

    blurhash: string | null, // https://github.com/woltapp/blurhash
    
    url: string,
    text_url: string | null,
    remote_url: string | null,
    preview_url: string | null,
    preview_remote_url: string | null, // undocumented but exists
    description?: undefined | string,
} & ({
    type: "image",

    meta?: undefined | {
        original?: undefined | ImageMeta | VideoMeta,
        small?: undefined | ImageMeta,
        focus?: undefined | {x: number, y: number}, // where the image should focus
    },
} | {
    type: "gifv" | "video",

    meta?: undefined | {
        length: string,
        duration: number,
        fps: number,
        size: string,
        width: number,
        height: number,
        aspect: number,
        audio_encode?: undefined | string, // video only
        audio_bitrate?: undefined | string, // video only
        audio_channels?: undefined | string, // video only
        original?: undefined | VideoMeta,
        small?: undefined | ImageMeta,
    },
} | {
    type: "audio",
    url: string,
    // supposedly has a preview url but it's lying

    text_url: string,
    remote_url: string | null,

    meta?: undefined | {
        length: string,
        duration: number,
        audio_encode: string,
        audio_bitrate: string,
        audio_channels: "stereo" | "unsupported",
        original: {
            duration: number,
            bitrate: number,
        },
    },

} | {
    type: "unknown", // the server doesn't support it
} | {
    type: "unsupported",
});
export type Poll = {
    id: string,
    expires_at: string,
    expired: boolean,
    multiple: boolean,
    votes_count: number,
    voters_count: null,
    voted: boolean,
    own_votes: number[] | null,
    options: {title: string, votes_count: number}[],
};
export type Account = {
    id: string,
    username: string,
    acct: string,
    display_name: string,
    url: string,
    bot: boolean,
    locked: boolean,

    followers_count: number,
    following_count: number,

    header: string,
    header_static: string,

    note: string,

    last_status_at: string,
    
    fields: {name: string, value: string, verified_at: null}[],

    avatar: string,
    avatar_static: string,

    mentions?: undefined | Mention[],
    emojis?: undefined | Emoji[],
    tags?: undefined | Tag[],
};
export type AccountRelation = {
    id: string,
    following: boolean,
    showing_reblogs: boolean,
    notifying: boolean,
    followed_by: boolean,
    blocking: boolean,
    muting: boolean,
    muting_notifications: boolean,
    requested: boolean,
    endorsed: boolean,
    note: string,
};
export type Mention = {
    acct: string, // username@instan.ce
    id: string,
    url: string, // external link
    username: string,
};
export type Post = {
    id: string,
    created_at: string,
    in_reply_to_id: null | string,
    in_reply_to_account_id: null | string,
    sensitive: boolean,
    spoiler_text: string,
    visibility: "public",
    language: string, // iso language code
    uri: string,
    url: string,
    replies_count: number,
    reblogs_count: number,
    favourites_count: number,
    favourited: boolean,
    content: string, // unsafe html
    reblog?: undefined | Post,
    account: Account,
    media_attachments: Media[],
    mentions: Mention[],
    tags: Tag[],
    emojis: Emoji[],
    card: null | OEmbed,
    poll: null | Poll,
};
export type Tag = {name: string, url: string}; // this isn't very useful

export type Notification = {
    id: string,
    // https://docs.joinmastodon.org/entities/notification/
    type: "follow" | "follow_request" | "mention" | "reblog" | "favourite" | "poll" | "status" | "unsupported",
    created_at: string,
    account: Account,
    status?: undefined | Post,
};