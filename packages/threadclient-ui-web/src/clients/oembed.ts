import type * as Generic from "api-types-generic";
import {rt} from "api-types-generic";
import type {OEmbed} from "api-types-oembed";

// TODO return {error: …} | {body: …}
// then let the main thing display a link if error was returned
export function oembed(card: OEmbed, client_id: string): Generic.Body {
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
        thumb: card.embed_url || card.image || undefined,
        click: card.embed_url ? {
            kind: "captioned_image",
            url: card.embed_url,
            w: null, h: null,
        } : {
            kind: "link",
            client_id,
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
