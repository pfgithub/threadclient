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
    category?: string,
};
// https://docs.joinmastodon.org/entities/attachment
export type Media = {
    id: string,

    url: string,
    text_url: string | null,
    remote_url: string | null,
    preview_remote_url: string | null, // undocumented but exists
    description?: string,
} & ({
    type: "image",

    blurhash: string | null, // https://github.com/woltapp/blurhash
    preview_url: string,

    meta?: {
        original: ImageMeta | VideoMeta,
        small?: ImageMeta,
    },
} | {
    type: "gifv" | "video",

    blurhash: string | null, // https://github.com/woltapp/blurhash
    preview_url: string,

    meta?: {
        length: string,
        duration: number,
        fps: number,
        size: string,
        width: number,
        height: number,
        aspect: number,
        audio_encode?: string, // video only
        audio_bitrate?: string, // video only
        audio_channels?: string, // video only
        original: VideoMeta,
        small?: ImageMeta,
    },
} | {
    type: "audio",
    url: string,
    // supposedly has a preview url but it's lying

    text_url: string,
    remote_url: string | null,

    meta?: {
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

    followers_count: number,
    following_count: number,

    header: string,
    header_static: string,

    note: string,

    last_status_at: string,
    
    fields: {name: string, value: string, verified_at: null}[],

    avatar: string,
    avatar_static: string,
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
// https://docs.joinmastodon.org/entities/card/
export type Card = {
    url: string,
    title: string,
    description: string,
    blurhash: string | null,

    type: "video" | "photo" | "link" | "unsupported",

    image: string | null, // thumbnail

    embed_url: string | "", // {kind: url}
    html: string | "", // reddit suggested embed

    // more info : author name, provider name, …
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
    reblog?: Post,
    account: Account,
    media_attachments: Media[],
    mentions: never[],
    tags: never[],
    emojis: Emoji[],
    card: null | Card,
    poll: null | Poll,
};