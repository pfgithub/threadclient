import * as Generic from "../types/generic";
const rt = Generic.rt;

// TODO return {error: …} | {body: …}
// then let the main thing display a link if error was returned
export function oembed(card: OEmbed): Generic.Body {
    if('status_msg' in card) {
        return {
            kind: "richtext",
            content: [
                rt.p(rt.error("Could not preview oembed", card)),
                // TODO add a link here
            ],
        };
    }
    return card.url != null ? {
        kind: "link_preview",
        thumb: card.image ?? undefined,
        click: card.embed_url ? {
            kind: "unknown_size_image",
            url: card.embed_url,
        } : {
            kind: "link",
            url: card.url,
            embed_html: card.html || undefined,
        },
        click_enabled: !!(card.embed_url || card.html || false),
        title: card.title,
        description: card.description,
        url: card.url,
    } : {
        kind: "reddit_suggested_embed",
        suggested_embed: card.html,
    };
}


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