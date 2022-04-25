import * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import type * as Mastodon from "api-types-mastodon";
import { client } from "./mastodon";

export type GenMeta = {
    host: string,
    emojis: Map<string, Mastodon.Emoji>,
    mentions: Map<string, Mastodon.Mention>,
};

export function childNodesToRichtextParagraphs(
    meta: GenMeta,
    nodes: NodeListOf<ChildNode>,
): Generic.Richtext.Paragraph[] {
    const committed: Generic.Richtext.Paragraph[] = [];
    function commit() {
        if(uncommitted_spans.length > 0) {
            committed.push(rt.p(...uncommitted_spans));
        }
        uncommitted_spans = [];
    }
    let uncommitted_spans: Generic.Richtext.Span[] = [];
    for(const node of Array.from(nodes)) {
        const paragraph = contentParagraphToRichtextParagraph(meta, node);
        if(paragraph) {
            commit();
            committed.push(paragraph);
        }else{
            uncommitted_spans.push(...contentSpanToRichtextSpan(meta, node, {}));
        }
    }
    commit();
    return committed;
}
export function contentParagraphToRichtextParagraph(meta: GenMeta, node: Node): Generic.Richtext.Paragraph | undefined {
    if(node instanceof HTMLElement) {
        if(node.nodeName === "P") {
            return rt.p(...contentSpansToRichtextSpans(meta, node.childNodes));
        }
    }
    return undefined;
}
export function contentSpansToRichtextSpans(meta: GenMeta, node: NodeListOf<ChildNode>): Generic.Richtext.Span[] {
    return Array.from(node).flatMap(child => contentSpanToRichtextSpan(meta, child, {}));
}
export function contentSpanToRichtextSpan(
    meta: GenMeta,
    node: Node,
    styles: Generic.Richtext.Style,
): Generic.Richtext.Span[] {
    if(node instanceof Text) {
        const node_value = node.nodeValue ?? "[ENoNodeValue]";
        const split_by_col = node_value.split(":");
        const res_segments: Generic.Richtext.Span[] = [];
        let uncommitted_text: string[] = [];
        const commit = () => {
            if(uncommitted_text.length > 0) {
                res_segments.push(rt.txt(uncommitted_text.join(":"), styles));
            }
            uncommitted_text = [];
        };
        for(const text of split_by_col) {
            const emoji_v = meta.emojis.get(text);
            if(emoji_v) {
                commit();
                res_segments.push(rt.kind("emoji", {url: emoji_v.static_url, name: ":"+text+":"}));
            }else{
                uncommitted_text.push(text);
            }
        }
        commit();
        return res_segments;
    }
    if(node instanceof HTMLElement) {
        let classes = Array.from(node.classList).filter(clss => {
            // https://docs.joinmastodon.org/spec/microformats/
            if(clss.startsWith("h-")) return false;
            if(clss.startsWith("p-")) return false;
            if(clss.startsWith("u-")) return false;
            return true;
        });
        const eatClass = (class_name: string): boolean => {
            if(!classes.includes(class_name)) return false;
            classes = classes.filter(clss => clss !== class_name);
            return true;
        };
        const noClasses = (...value: Generic.Richtext.Span[]): Generic.Richtext.Span[] => {
            if(classes.length !== 0) return [rt.error(classes.map(clss => "."+clss).join(""), node.outerHTML)];
            return value;
        };

        if(node.nodeName === "A") {
            const href_v = node.getAttribute("href") ?? "no href";

            if(!href_v.startsWith("http://") && !href_v.startsWith("https://")) {
                return noClasses(rt.error("Bad link", href_v));
            }

            if(eatClass("hashtag")) {
                eatClass("mention");
                const content = Array.from(node.childNodes).flatMap(child => (
                    contentSpanToRichtextSpan(meta, child, styles)
                ));
                const flat_content = node.textContent;
                if(flat_content == null || !flat_content.startsWith("#")) return [
                    rt.error("bad hashtag", [content, node]),
                ];
                return noClasses(rt.link(client, "/"+meta.host+"/timelines/tag/"+encodeURIComponent(flat_content), {},
                    ...content,
                ));
            }
            if(eatClass("mention")) {
                const mention_data = meta.mentions.get(href_v);
                if(mention_data) {
                    return noClasses(rt.link(client, "/"+meta.host+"/accounts/"+mention_data.id, {
                        is_user_link: mention_data.username,
                    }, rt.txt("@"+mention_data.acct, styles)));
                }
            }

            return noClasses(rt.link(client, href_v, {},
                ...Array.from(node.childNodes).flatMap(child => contentSpanToRichtextSpan(meta, child, styles)),
            ));
        }
        if(node.nodeName === "BR") {
            return noClasses(rt.br());
        }
        if(node.nodeName === "SPAN") {
            const res_nodes = Array.from(node.childNodes).flatMap(child => (
                contentSpanToRichtextSpan(meta, child, styles)
            ));

            if(classes.includes("invisible")) return [];

            if(eatClass("ellipsis")) {
                res_nodes.push(rt.txt("…", styles));
            }
            eatClass("h-card");

            return noClasses(...res_nodes);
            // return rt.link(href_v ?? "no href", ...Array.from(node.childNodes).map(child => contentSpanToRichtextSpan(host, child, styles)));
        }
        return [rt.error("<"+node.nodeName+">", {node, html: node.outerHTML})];
    }
    return [rt.error("Unsupported Node", node)];
}

export function htmlToPlaintext(html: string): string {
    const container = document.createElement("div");
    container.innerHTML = html;
    return container.textContent ?? "*no content*";
}

export function setupGenMeta(host: string, content: string, meta: ParseContentMeta): [GenMeta, NodeListOf<ChildNode>] {
    const parsed_v = document.createElement("div");
    parsed_v.innerHTML = content; // safe, scripts won't execute and this won't be displayed directly on the screen
    const emojis_by_shortcode = new Map<string, Mastodon.Emoji>();
    for(const emoji of meta.emojis) {
        emojis_by_shortcode.set(emoji.shortcode, emoji);
    }
    const mentions_by_url = new Map<string, Mastodon.Mention>();
    for(const mention of meta.mentions) {
        mentions_by_url.set(mention.url, mention);
    }
    const gen_meta: GenMeta = {
        host,
        emojis: emojis_by_shortcode,
        mentions: mentions_by_url,
    };
    return [gen_meta, parsed_v.childNodes];
}

export type ParseContentMeta = {emojis: Mastodon.Emoji[], mentions: Mastodon.Mention[]};
export function parseContentHTML(host: string, content: string, meta: ParseContentMeta): Generic.Richtext.Paragraph[] {
    return childNodesToRichtextParagraphs(...setupGenMeta(host, content, meta));
}

export function parseContentSpanHTML(host: string, content: string, meta: ParseContentMeta): Generic.Richtext.Span[] {
    const [genmeta, children] = setupGenMeta(host, content, meta);
    return contentSpansToRichtextSpans(genmeta, children);
}