import type { OEmbed } from "api-types-oembed";

/*
// WIP Scraper for `docs.joinmastodon.org/entities/…`
// we might want to try the rb source code instead:
// https://github.com/mastodon/mastodon/blob/main/app/serializers/rest/account_serializer.rb
// although it doesn't have doc comments
// or the markdown docs source

console.log(Array.from(document.querySelectorAll("h2, h3")).map(itm => {

if(itm.nodeName === "H2") {
const bad = [
"See also", "Sponsored by", "Example"
];
if(bad.includes(itm.textContent)) return;
return "    // "+itm.textContent+"\n";
}

const name = itm.textContent;
const details = document.querySelector("#"+name+" + p");

const lines = details.innerText.split("\n");
const itms = {};
let prevl;
for(const line of lines) {
const splres = line.split(": ");
if(splres.length < 1) {
if(prevl != null) {
itms[prevl] += "\n"+line
continue;
}
}
prevl = splres[0];
itms[splres[0]] = splres.slice(1).join(": ");
}

function typeOf(desc) {
const map = {
'Boolean': "boolean",
'Number': "number",
'String': "string",
'String (ISO 8601 Datetime)': "DateStr",
'String (URL)': "URLStr",
'String (HTTPS URL)': "URLStr",
'String (HTML)': "HTML",
'String (cast from an integer, but not guaranteed to be a number)': "ID",
'String (ISO 8601 Datetime) if value is a verified URL. Otherwise, null': "DateStr | null",
'String (ISO 639-1 language two-letter code)': "Lang",
'String (ISO 639 Part 1-5 language codes)': "Lang",
};
if(Object.hasOwnProperty.call(map, desc)) return map[desc];

const base = [
"Account", "Field", "Source", "Emoji"
];
if(base.includes(desc)) return desc;

const aof = "Array of ";
if(desc.startsWith(aof)){
return typeOf(desc.substring(aof.length)) + "[]";
}
const onul = " or null";
if(desc.endsWith(onul)) {
return typeOf(desc.substring(0, desc.length - onul.length)) + 
" | null";
}


const ish = desc.match(/^Hash \((.+)\)$/);
if(ish) {
const v = ish[1].split(", ");
return "{" + v.map(m => {
return m+": "+(({
'user_count': "number",
'status_count': "number",
'domain_count': "number",
'streaming_api': "string",
})[m] ?? "TODO<\""+m+"\">")
}).join(", ") + "}";
}

return "TODO<"+JSON.stringify(desc)+">";
}

return "" +
`    /** ${itms['Description']}`+" *"+"/\n"+
`    ${name}: ${typeOf(itms['Type'])},`
}).join("\n"))
*/

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

// https://docs.joinmastodon.org/entities/account/
export type Account = {
    // Base Attributes

    /** The account idheader. */
    id: ID,
    /** The username of the account, not including domain. */
    username: string,
    /** The Webfinger account URI. Equal to username for local users, or username@domain for remote users. */
    acct: string,
    /** The location of the user's profile page. */
    url: URLStr,

    // Display Attributes

    /** The profile's display name. */
    display_name: string,
    /** The profile's bio / description. */
    note: HTML,
    /** An image icon that is shown next to statuses and in the profile. */
    avatar: URLStr,
    /** A static version of the avatar. Equal to avatar if its value is a static image; different if avatar is an animated GIF. */
    avatar_static: URLStr,
    /** An image banner that is shown above the profile and in profile cards. */
    header: URLStr,
    /** A static version of the header. Equal to header if its value is a static image; different if header is an animated GIF. */
    header_static: URLStr,
    /** Whether the account manually approves follow requests. */
    locked: boolean,
    /** Custom emoji entities to be used when rendering the profile. If none, an empty array will be returned. */
    emojis: Emoji[],
    /** Whether the account has opted into discovery features such as the profile directory. */
    discoverable: boolean,
    /** not in documentatino */
    group: boolean,

    // Statistical Attributes

    /** When the account was created. */
    created_at: DateStr,
    /** When the most recent status was posted. */
    last_status_at: DateStr,
    /** How many statuses are attached to this account. */
    statuses_count: number,
    /** The reported followers of this profile. */
    followers_count: number,
    /** The reported follows of this profile. */
    following_count: number,

    // Optional Attributes

    /** Indicates that the profile is currently inactive and that its user has moved to a new account. */
    moved?: undefined | Account,
    /** Additional metadata attached to a profile as name-value pairs. */
    fields?: undefined | Field[],
    /** A presentational flag. Indicates that the account may perform automated actions, may not be monitored, or identifies as a robot. */
    bot?: undefined | boolean,
    /** An extra entity to be used with API methods to verify credentials and update credentials. */
    source?: undefined | Source,
    /** An extra entity returned when an account is suspended. */
    suspended?: undefined | boolean,
    /** When a timed mute will expire, if applicable. */
    mute_expires_at?: undefined | DateStr,
};

// https://docs.joinmastodon.org/entities/field/
export type Field = {
    /** The key of a given field's key-value pair. */
    name: string,
    /** The value associated with the name key. */
    value: HTML,
    /** Timestamp of when the server verified a URL value for a rel="me” link. */
    verified_at: DateStr | null,
};

// https://docs.joinmastodon.org/entities/source/
export type Source = {
    // Base attributes

    /** Profile bio. */
    note: string,
    /** Metadata about the account. */
    fields: Field[],

    // Nullable attributes

    /** The default post privacy to be used for new statuses. */
    privacy?:
        | undefined
        | "public" /** Public post */
        | "unlisted" /** Unlisted post */
        | "private" /** Followers-only post */
        | "direct" /** Direct post */
    ,
    /** Whether new statuses should be marked sensitive by default. */
    sensitive?: undefined | boolean,
    /** The default posting language for new statuses. */
    language?: undefined | Lang,
    /** The number of pending follow requests. */
    follow_requests_count?: undefined | number,
};

export type AccountRelation = {
    // Required attributes

    /** The account id. */
    id: ID,
    /** Are you following this user? */
    following: boolean,
    /** Do you have a pending follow request for this user? */
    requested: boolean,
    /** Are you featuring this user on your profile? */
    endorsed: boolean,
    /** Are you followed by this user? */
    followed_by: boolean,
    /** Are you muting this user? */
    muting: boolean,
    /** Are you muting notifications from this user? */
    muting_notifications: boolean,
    /** Are you receiving this user's boosts in your home timeline? */
    showing_reblogs: boolean,
    /** Have you enabled notifications for this user? */
    notifying: boolean,
    /** Are you blocking this user? */
    blocking: boolean,
    /** Are you blocking this user's domain? */
    domain_blocking: boolean,
    /** Is this user blocking you? */
    blocked_by: boolean,
    /** This user's profile bio */
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
export type HTML = string; // symbol & {__opaque_is_html_string: true};
export type DateStr = string;
export type URLStr = string;
export type ID = string;
export type Lang = string;

// https://docs.joinmastodon.org/entities/instance/
export type Instance = {
    // Required attributes

    /** The domain name of the instance. */
    uri: string,
    /** The title of the website. */
    title: string,
    /** Admin-defined description of the Mastodon site. */
    description: string,
    /** A shorter description defined by the admin. */
    short_description: string,
    /** An email that may be contacted for any inquiries. */
    email: string,
    /** The version of Mastodon installed on the instance. */
    version: string,
    /** Primary languages of the website and its staff. */
    languages: Lang[],
    /** Whether registrations are enabled. */
    registrations: boolean,
    /** Whether registrations require moderator approval. */
    approval_required: boolean,
    /** Whether invites are enabled. */
    invites_enabled: boolean,
    /** URLs of interest for clients apps. */
    urls: {streaming_api: string},
    /** Statistics about how much information the instance contains. */
    stats: {user_count: number, status_count: number, domain_count: number},

    // Optional attributes

    /** Banner image for the website. */
    thumbnail: URLStr | null,
    /** A user that can be contacted, as an alternative to email. */
    contact_account: Account | null,


    // not documented:
    configuration: {
        statuses: {
            max_characters: number,
            max_media_attachments: number,
            characters_reserved_per_url: number,
        },
        media_attachments: {
            supported_mime_types: string[],
            image_size_limit: number,
            image_matrix_limit: number,
            video_size_limit: number,
            video_frame_rate_limit: number,
            video_matrix_limit: number,
        },
        polls: {
            max_options: number,
            max_characters_per_option: number,
            min_expiration: number,
            max_expiration: number,
        },
    },
    rules: {id: string, text: string}[],
};

// https://github.com/neet/masto.js/tree/main/src/entities
// consider using this lib for the types