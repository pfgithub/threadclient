// https://docs.joinmastodon.org/entities/card/
// https://oembed.com/
export type OEmbed = {
    url?: string,
    title: string,
    description: string,
    blurhash: string | null,

    type: "video" | "photo" | "link" | "rich" | "unsupported",

    image: string | null, // thumbnail

    embed_url: string | "", // {kind: url}
    html: string | "", // reddit suggested embed

    // more info : author name, provider name, …
} | {
    status_msg: string,
};