/*
// WIP Scraper for `docs.joinmastodon.org/entities/…`
// we might want to try the rb source code instead:
// https://github.com/mastodon/mastodon/blob/main/app/serializers/rest/account_serializer.rb
// although it doesn't have doc comments
// or the markdown docs source

{
let secname;
console.log(Array.from(document.querySelectorAll("h2, h3")).map(itm => {

if(itm.nodeName === "H2") {
const bad = [
"See also", "Sponsored by", "Example"
];
if(bad.includes(itm.textContent)) return;
secname = itm.textContent;
return "\n    // "+itm.textContent+"\n";
}

const name = itm.textContent;
let details = document.querySelector("#"+name+" + p");
if(!details) {
if(name === "favourites_count") {
details = document.querySelector("#favorites_count + p");
}else{
console.error("EDETAILS", name);
}
}

const lines = details.innerText.split("\n");
const itms = {};
let prevl;
for(const line of lines) {
const splres = line.split(": ");
if(splres.length <= 1 && !line.includes(":")) {
if(prevl != null) {
itms[prevl] += "\n"+line
continue;
}
}
prevl = splres[0];
itms[splres[0]] = splres.slice(1).join(": ");
}

console.log(itms['Type'], itms, lines)

function typeOf(desc) {
const map = {
'Boolean': "boolean",
'Number': "number",
'String': "string",
'String (ISO 8601 Datetime)': "DateStr",
'String (URL)': "URLStr",
'String (HTTPS URL)': "URLStr",
'String (HTML)': "HTML",
'String (cast from an integer)': "`${number}`",
'String (cast from an integer, but not guaranteed to be a number)': "ID",
'String (cast from an integer but not guaranteed to be a number)': "ID",
'String (ISO 8601 Datetime) if value is a verified URL. Otherwise, null': "DateStr | null",
'String (ISO 639-1 language two-letter code)': "Lang",
'String (ISO 639 Part 1-5 language codes)': "Lang",
'String (ISO 639 Part 1 two-letter language code)': "Lang",
'String (URL), or null if the attachment is local': "string | null",
'String (UNIX timestamp)': "DateSecStr",
};
if(Object.hasOwnProperty.call(map, desc)) return map[desc];

const base = [
"Account", "Field", "Source", "Emoji", "Card", "Status", "Tag", "Poll", "Mention", "Application", "Attachment", "History"
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

for(const enonof of ["String (Enumerable, oneOf)\n", "String (Enumerable oneOf)\n"]) {
if(desc.startsWith(enonof)) {
const itms = desc.replace(enonof, "").split("\n");
return "(\n" + [...itms, "unsupported = In case new choices are added in the future"].map(itm => {
	const v = itm.split(" = ");
	return "        /** "+v.slice(1).join(" = ")+" *"+"/\n        | " + JSON.stringify(v[0]) + "\n";
}).join("") + "    )"
}
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

let itmty = typeOf(itms['Type']);
if(secname === "Nullable attributes" || secname === "Optional attributes" || secname === "Authorized user attributes" || secname === "Client attributes") {
	itmty = "?: undefined | "+itmty;
}else{
	if(![
"Base attributes", "Rendering attributes", "Informational attributes", "Required attributes", "Deprecated attributes"
].includes(secname)) {
		itmty = itmty + "//!TODO section "+secname
	}
	itmty = ": "+itmty;
}

return "" +
`    /** ${secname === "Deprecated attributes" ? "@deprecated " : ""}${itms['Description']}`+" *"+"/\n"+
`    ${name}${itmty},`
}).join("\n"))
}
*/

export type Card = {
    // Base attributes

    /** Location of linked resource. */
    url: URLStr,
    /** Title of linked resource. */
    title: string,
    /** Description of preview. */
    description: string,
    /** The type of the preview card. */
    type: (
        /** Link OEmbed */
        | "link"
        /** Photo OEmbed */
        | "photo"
        /** Video OEmbed */
        | "video"
        /** iframe OEmbed. Not currently accepted, so won't show up in practice. */
        | "rich"
        /** In case new choices are added in the future */
        | "unsupported"
    ),

    // Optional attributes

    /** The author of the original resource. */
    author_name?: undefined | string,
    /** A link to the author of the original resource. */
    author_url?: undefined | URLStr,
    /** The provider of the original resource. */
    provider_name?: undefined | string,
    /** A link to the provider of the original resource. */
    provider_url?: undefined | URLStr,
    /** HTML to be used for generating the preview card. */
    html?: undefined | HTML,
    /** Width of preview, in pixels. */
    width?: undefined | number,
    /** Height of preview, in pixels. */
    height?: undefined | number,
    /** Preview thumbnail. */
    image?: undefined | URLStr,
    /** Used for photo embeds, instead of custom html. */
    embed_url?: undefined | URLStr,
    /** A hash computed by the BlurHash algorithm, for generating colorful preview thumbnails when media has not been downloaded yet. */
    blurhash?: undefined | string,
};

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
// the documentation lies about attachment, ignore it
export type Attachment = {
    /** The ID of the attachment in the database. */
    id: ID,

    // Optional attributes

    /** The location of the full-size original attachment on the remote website. */
    remote_url?: undefined | string | null,

    /** Alternate text that describes what is in the media attachment, to be used for the visually impaired or when media attachments do not load. */
    description?: undefined | string,
    /** A hash computed by the BlurHash algorithm, for generating colorful preview thumbnails when media has not been downloaded yet. */
    blurhash?: undefined | string,

    /** The location of the original full-size attachment. */
    url: URLStr,
    /** The location of a scaled-down preview of the attachment. */
    preview_url: URLStr,

    // Deprecated attributes

    /** @deprecated A shorter URL for the attachment. */
    text_url: URLStr,
    
    preview_remote_url: string | null, // undocumented but exists
} & 
/** Metadata returned by Paperclip. */
({
    /** Static image */
    type: "image",

    meta?: undefined | {
        original?: undefined | ImageMeta | VideoMeta,
        small?: undefined | ImageMeta,
        focus?: undefined | {x: number, y: number}, // where the image should focus
    },
} | {
    /** Looping, soundless animation | Video clip */
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
    /** Audio track */
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
    /** unsupported or unrecognized file type */
    type: "unknown",
} | {
    // in case paperclip adds new things in the future
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
    privacy?: undefined | (
        /** Public post */
        | "public"
        /** Unlisted post */
        | "unlisted"
        /** Followers-only post */
        | "private"
        /** Direct post */
        | "direct"
        /** In case new choices are added in the future */
        | "unsupported"
    ),
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
    // Required attributes

    /** The account id of the mentioned user. */
    id: ID,
    /** The username of the mentioned user. */
    username: string,
    /** The webfinger acct: URI of the mentioned user. Equivalent to username for local users, or username@domain for remote users. */
    acct: string,
    /** The location of the mentioned user's profile. */
    url: URLStr,
};
export type Status = {
    // Base attributes

    /** ID of the status in the database. */
    id: ID,
    /** URI of the status used for federation. */
    uri: string,
    /** The date when this status was created. */
    created_at: DateStr,
    /** The account that authored this status. */
    account: Account,
    /** HTML-encoded status content. */
    content: HTML,
    /** Visibility of this status. */
    visibility: (
        /** Visible to everyone, shown in public timelines. */
        | "public"
        /** Visible to public, but not included in public timelines. */
        | "unlisted"
        /** Visible to followers only, and to any mentioned users. */
        | "private"
        /** Visible only to mentioned users. */
        | "direct"
        /** In case new choices are added in the future */
        | "unsupported"
    ),
    /** Is this status marked as sensitive content? */
    sensitive: boolean,
    /** Subject or summary line, below which status content is collapsed until expanded. */
    spoiler_text: string,
    /** Media that is attached to this status. */
    media_attachments: Attachment[],
    /** The application used to post this status. */
    application: Application,

    // Rendering attributes

    /** Mentions of users within the status content. */
    mentions: Mention[],
    /** Hashtags used within the status content. */
    tags: Tag[],
    /** Custom emoji to be used when rendering status content. */
    emojis: Emoji[],

    // Informational attributes

    /** How many boosts this status has received. */
    reblogs_count: number,
    /** How many favourites this status has received. */
    favourites_count: number,
    /** How many replies this status has received. */
    replies_count: number,

    // Nullable attributes

    /** A link to the status's HTML representation. */
    url?: undefined | URLStr,
    /** ID of the status being replied. */
    in_reply_to_id?: undefined | ID,
    /** ID of the account being replied to. */
    in_reply_to_account_id?: undefined | ID,
    /** The status being reblogged. */
    reblog?: undefined | Status,
    /** The poll attached to the status. */
    poll?: undefined | Poll,
    /** Preview card for links included within status content. */
    card?: undefined | Card,
    /** Primary language of this status. */
    language?: undefined | Lang,
    /** Plain-text source of a status. Returned instead of content when status is deleted, so the user may redraft from the source text without the client having to reverse-engineer the original text from the HTML content. */
    text?: undefined | string,

    // Authorized user attributes

    /** Have you favourited this status? */
    favourited?: undefined | boolean,
    /** Have you boosted this status? */
    reblogged?: undefined | boolean,
    /** Have you muted notifications for this status's conversation? */
    muted?: undefined | boolean,
    /** Have you bookmarked this status? */
    bookmarked?: undefined | boolean,
    /** Have you pinned this status? Only appears if the status is pinnable. */
    pinned?: undefined | boolean,
};
export type Tag = {
    // Base attributes

    /** The value of the hashtag after the # sign. */
    name: string,
    /** A link to the hashtag on the instance. */
    url: URLStr,

    // Optional attributes

    /** Usage statistics for given days. */
    history?: undefined | History[],
};
export type History = {
    // Required attributes

    /** UNIX timestamp on midnight of the given day. */
    day: DateSecStr,
    /** the counted usage of the tag within that day. */
    uses: `${number}`,
    /** the total of accounts using the tag within that day. */
    accounts: `${number}`,
};

export type Application = {
    // Required attributes

    /** The name of your application. */
    name: string,

    // Optional attributes

    /** The website associated with your application. */
    website?: undefined | URLStr,
    /** Used for Push Streaming API. Returned with POST /api/v1/apps. Equivalent to PushSubscription#server_key */
    vapid_key?: undefined | string,

    // Client attributes

    /** Client ID key, to be used for obtaining OAuth tokens */
    client_id?: undefined | string,
    /** Client secret key, to be used for obtaining OAuth tokens */
    client_secret?: undefined | string,
};

export type Notification = {
   // Required attributes

    /** The id of the notification in the database. */
    id: ID,
    /** The type of event that resulted in the notification. */
    type: (
        /** Someone followed you */
        | "follow"
        /** Someone requested to follow you */
        | "follow_request"
        /** Someone mentioned you in their status */
        | "mention"
        /** Someone boosted one of your statuses */
        | "reblog"
        /** Someone favourited one of your statuses */
        | "favourite"
        /** A poll you have voted in or created has ended */
        | "poll"
        /** Someone you enabled notifications for has posted a status */
        | "status"
        /** In case new choices are added in the future */
        | "unsupported"
    ),
    /** The timestamp of the notification. */
    created_at: DateStr,
    /** The account that performed the action that generated the notification. */
    account: Account,

    // Optional attributes

    /** Status that was the object of the notification, e.g. in mentions, reblogs, favourites, or polls. */
    status?: undefined | Status,
};
export type HTML = string; // symbol & {__opaque_is_html_string: true};
export type DateStr = string;
export type DateSecStr = `${number}`; // sec since epoch (new Date(v * 1000))
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