// https://docs.joinmastodon.org/entities/card/
// https://oembed.com/
export type OEmbed = {
    url?: undefined | null | string,
    title: string,
    description: string,
    blurhash?: string | undefined | null,

    type: "video" | "photo" | "link" | "rich" | "unsupported",

    image?: string | undefined | null, // thumbnail

    embed_url?: string | undefined | null | "", // {kind: url}
    html?: string | undefined | null | "", // reddit suggested embed

    // more info : author name, provider name, …
} | {
    status_msg: string,
};