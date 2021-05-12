import * as Generic from "../types/generic";
import { rt, Richtext } from "../types/generic";
import {encoderGenerator, ThreadClient} from "./base";
import * as commonmark from "commonmark";
import * as variables from "_variables";
import { assertNever } from "../util";

function childrenOf(node: commonmark.Node): commonmark.Node[] {
    const res: commonmark.Node[] = [];
    let current = node.firstChild;
    while(current != null) {
        res.push(current);
        current = current.next;
    }
    return res;
}

function paragraphToRichtextParagraph(node: commonmark.Node): Richtext.Paragraph {
    if(node.type === "heading") {
        return rt.hn(node.level, ...childrenOf(node).flatMap(it => spanToRichtextSpan(it, {})));
    }else if(node.type === "paragraph") {
        return rt.p(...childrenOf(node).flatMap(it => spanToRichtextSpan(it, {})));
    }else if(node.type === "block_quote") {
        return rt.blockquote(...childrenOf(node).map(paragraphToRichtextParagraph));
    }else if(node.type === "thematic_break") {
        return rt.hr();
    }else if(node.type === "code_block") {
        // node.info for the language eg ```zig
        return rt.pre(node.literal ?? "ERR", node.info ?? undefined);
    }else if(node.type === "list") {
        return {
            kind: "list",
            ordered: node.listType === "ordered",
            children: childrenOf(node).map(it => rt.li(...childrenOf(it).map(paragraphToRichtextParagraph))),
        };
    }else return rt.p(rt.error(node.type, node));
}

function spanToRichtextSpan(node: commonmark.Node, styl: Richtext.Style): Richtext.Span[] {
    if(node.type === "text") {
        return [rt.txt(node.literal ?? "ERR", styl)];
    }else if(node.type === "link") {
        return [rt.link(node.destination ?? "ERR", {title: node.title ?? undefined}, ...childrenOf(node).flatMap(it => spanToRichtextSpan(it, styl)))];
    }else if(node.type === "softbreak") {
        return [rt.txt(" ")]; // a newline without two spaces
    }else if(node.type === "strong") {
        return childrenOf(node).flatMap(it => spanToRichtextSpan(it, {...styl, strong: true}));
    }else if(node.type === "emph") {
        return childrenOf(node).flatMap(it => spanToRichtextSpan(it, {...styl, emphasis: true}));
    }else if(node.type === "code") {
        return [rt.code(node.literal ?? "ERR")];
    }else return [rt.error(node.type, node)];
}

function markdownToRichtext(md: string): Richtext.Paragraph[] {
    const reader = new commonmark.Parser();
    const parsed = reader.parse(md);

    return childrenOf(parsed).map(paragraphToRichtextParagraph);
}

() => encoderGenerator;

const sample_preview_links: {
    expected_result: string,
    url: string,
    warn?: string,
}[] = [
    // TODO ….gif?format=mp4, I think this is a reddit link of some kind
    {expected_result: "image", url: "https://i.redd.it/p0y4mrku6xh61.png"},
    {expected_result: "image", url: "https://i.imgur.com/NmMIeSj.png"},
    {expected_result: "image", url: "https://i.imgur.com/NmMIeSj.jpeg"},
    {expected_result: "image", url: "https://i.imgur.com/NmMIeSj.jpg"},
    {expected_result: "image", url: "https://imgur.com/NmMIeSj"},
    {expected_result: "gif (silent)", url: "https://i.imgur.com/kLG36BI.gif"},
    // TODO ….webp
    {expected_result: "image", url: "https://pbs.twimg.com/media/EuYqgG_VcAIGXvs?format=png&name=medium"},
    {expected_result: "gif (silent)", url: "https://i.imgur.com/6r7v2YF.gifv"},
    {expected_result: "gif + sound", url: "https://i.imgur.com/qvGBalc.gifv"},
    {expected_result: "video + sound", url: "https://v.redd.it/14kp64weg9s51"},
    {expected_result: "video + sound", url: "https://www.reddit.com/link/lge4tn/video/rpnqs2bktig61/player"},
    {expected_result: "video (silent)", url: "https://gfycat.com/GrayPeriodicArabianwildcat"},
    {expected_result: "video + sound", url: "https://gfycat.com/orneryimpartialbubblefish"},
    // TODO ….mp4
    {expected_result: "video + sound", url: "http://dl5.webmfiles.org/big-buck-bunny_trailer.webm"},
    {expected_result: "audio", url: "https://mastodon.lol/system/media_attachments/files/105/744/125/873/361/514/original/4ecb82b471e4e067.mp3"},
    {expected_result: "youtube video", url: "https://www.youtube.com/watch?v=JM-NqFX2jU8"},
    {expected_result: "youtube video", url: "https://youtu.be/JM-NqFX2jU8"},
    {expected_result: "youtube video, starts 30sec in", url: "https://youtube.com/watch?v=JM-NqFX2jU8&t=30"},
    {expected_result: "youtube video, starts 30sec in", url: "https://youtu.be/JM-NqFX2jU8?t=30"},
    {expected_result: "(!localhost) single image", url: "https://imgur.com/gallery/HFoOCeg"},
    {expected_result: "(!localhost) image gallery (fullscreenable)", url: "https://imgur.com/gallery/clWTb"},
    {expected_result: "(!localhost) image gallery (fullscreenable)", url: "https://www.imgur.com/a/HJ80Ds9"},
    {expected_result: "(!localhost) image gallery with long captions (fullscreenable)", url: "https://imgur.com/a/YsYb4Gk"},
    {expected_result: "(!localhost) image gallery with mixed in videos (!fullscreenable)", url: "https://imgur.com/gallery/ljoJeal"},
    {expected_result: "video + sound", url: "https://clips.twitch.tv/GlamorousTacitRaccoonWutFace-oMcWnMP8C5xMZhxD"},
    {expected_result: "soundcloud", url: "https://soundcloud.com/dylanbradyyyyyy/blink-180-prod-dylan-brady-elly-golterman"},
    {expected_result: "tiktok", url: "https://www.tiktok.com/@scout2015/video/6718335390845095173"},
    // TODO vocaroo (they seem to expire so maybe there's no easy way to put a test?)
    {expected_result: "giphy gif", url: "https://giphy.com/gifs/KnivesOut-knives-out-IaztG2U4LddJJhv0ra/fullscreen"},
    
    // TODO test error conditions eg : twitch clip with invalid slug
    {expected_result: "error : invalid gfycat gif", url: "https://gfycat.com/QqqqqqqqQqqqqqqQqqq"},
    {expected_result: "error : invalid imgur gallery", url: "https://imgur.com/gallery/qqqq"},
    {expected_result: "error : invalid imgur id", url: "https://www.imgur.com/a/QQQQQq"},
    {expected_result: "error : invalid twitch slug", url: "https://clips.twitch.tv/QqqqqqqqqQqqqqQqqqqqqQqqQqqq-qQqQqQQQQQqQQqqQ"},
    {expected_result: "error : unpreviwewable soundcloud url", url: "https://developers.soundcloud.com/docs/oembed#introduction"},
    {expected_result: "error : empty oembed", url: "https://www.tiktok.com/@scout2015"},
];

function bodyPage(path: string, body: Generic.Body): Generic.Page {
    return {
        title: path,
        navbar: {actions: [], inboxes: []},
        body: {
            kind: "one",
            item: {
                parents: [{
                    kind: "thread",
                    body,
                    display_mode: {body: "visible", comments: "collapsed"},
                    raw_value: sample_preview_links,
                    link: path,
                    layout: "reddit-post",
                    actions: [],
                    default_collapsed: false,
                }],
                replies: [],
            },
        },
        display_style: "comments-view",
    };
}

type UserThreadOpts = {
    content_warning?: string,
    layout: Generic.Thread["layout"],
    collapse_body?: boolean,
    title?: string,
    info?: Generic.Info,
    actions?: Generic.Action[],
};
function userThread(path: string, body: Generic.Body, opts: UserThreadOpts): Generic.Thread {
    return {
        kind: "thread",
        title: opts.title != null ? {text: opts.title} : undefined,
        body,
        display_mode: {body: opts.collapse_body ?? false ? "collapsed" : "visible", comments: "collapsed"},
        raw_value: sample_preview_links,
        link: path,
        info: opts.info,
        layout: opts.layout,
        actions: opts.actions ?? [],
        default_collapsed: false,
        flair: opts.content_warning != null ? [{elems: [{type: "text", text: opts.content_warning}], content_warning: true}] : [],
    };
}

function richtextPost(path: string, richtext: Generic.Richtext.Paragraph[]): Generic.Thread {
    return userThread(path, {kind: "richtext", content: richtext}, {layout: "reddit-post"});
}

function collapsibleComment(path: string, body: Generic.Body, opts: {content_warning?: string}): Generic.Thread {
    return userThread(path, body, {...opts, layout: "reddit-comment"});
}

function commitThread(path: string, entry: variables.LogEntry): Generic.Thread {
    return userThread(path,
        {
            kind: "richtext",
            content: [
                rt.pre(entry.commit_body),
            ],
        },
        {
            title: ""+entry.hash+": "+entry.commit_title,
            layout: "reddit-post",
            collapse_body: true,
            info: {
                author: {
                    name: entry.author_name,
                    flair: [{
                        elems: [{type: "text", text: entry.author_email}],
                        content_warning: false,
                    }],
                    color_hash: entry.author_email,
                    link: "ENOLINK",
                },
                time: +entry.date,
                edited: false,
                pinned: false,
            },
        },
    );
}

type SitemapEntryData = {
    post: Generic.Thread,
    replies?: SitemapEntry[],
};
type SitemapEntry = [string, (path: string) => SitemapEntryData];

const sitemap: SitemapEntry[] = [
    ["link-preview", (urlr) => ({
        post: richtextPost(urlr, [
            rt.h1(rt.txt("Testing Link Preview")),
            rt.p(rt.txt("Check each link and make sure:")),
            rt.ul(
                rt.li(rt.p(rt.txt("It appears as described"))),
                rt.li(rt.p(rt.txt("When collapsing or uncollapsing the comment, it functions as expected"))),
                rt.li(rt.p(rt.txt("When closing the preview, it functions as expected"))),
            ),
        ]),
        replies: sample_preview_links.map((spl, i) => ["" + i, (urlr) => ({post: collapsibleComment(urlr, {
            kind: "richtext",
            content: [
                rt.p(rt.txt(spl.expected_result)),
                rt.p(rt.link(spl.url, {}, rt.txt(spl.url))),
            ],
        }, {content_warning: spl.warn})})]),
    })],
    ["body-preview", (urlr) => ({
        post: richtextPost(urlr, []),
        replies: (() => {
            type ITRes = {desc: string, body: Generic.Body};
            const item = (desc: string, body: Generic.Body) => ({desc, body});
            const body_kinds: {[key in Generic.Body["kind"]]: ITRes[]} = {
                text: [
                    item("text displays", {kind: "text", content: "Hello there! It works.", markdown_format: "none"}),
                    item("reddit markdown functions", {kind: "text", content: [
                        "Level 1 heading:", "",
                        "# Heading level 1", "",
                        "Level 2 heading:", "",
                        "## Heading level 2", "",
                        "Inline styles", "",
                        "Spoiler: >!spoiler!<", "",
                        "TODO blockquotes and lists and stuff",
                    ].join("\n"), markdown_format: "reddit"}),
                ],
                richtext: [
                    item("richtext", {kind: "richtext", content: [
                        rt.p(rt.txt("TODO richtext demo")),
                    ]})
                ],
                link: [],
                captioned_image: [],
                unknown_size_image: [],
                video: [],
                vreddit_video: [],
                gfycat: [],
                youtube: [],
                imgur: [],
                twitch_clip: [],
                reddit_suggested_embed: [],
                audio: [],
                gallery: [],
                poll: [],
                none: [
                    item("no content, hode/show button should not appear, no extra padding should appear", {kind: "none"}),
                ],
                removed: [],
                crosspost: [
                    item("inner post should appear with title and body, width should be as small as possible",
                        {kind: "crosspost", source: userThread(urlr, {
                            kind: "richtext", content: [rt.p(rt.txt("Crossposted Body"))]
                        }, {
                            title: "Crossposted Source", layout: "reddit-post"
                        })},
                    )
                ],
                array: [],
                link_preview: [],
                oembed: [],
                mastodon_instance_selector: [item("mastodon instance selector", {kind: "mastodon_instance_selector"})],
            };
            return Object.entries(body_kinds).map(([key, items]): SitemapEntry => [
                key,
                (urlr) => ({
                    post: userThread(urlr, {kind: "richtext", content: []}, {title: key, collapse_body: true, layout: "reddit-post"}),
                    replies: items.map(({body, desc}, i): SitemapEntry => [
                        "" + i,
                        (urlr) => ({
                            post: userThread(urlr, body, {title: desc, collapse_body: true, layout: "reddit-post"})
                        }),
                    ])
                }),
            ]);
        })(),
    })],
    ["updates", (urlr) => ({
        post: richtextPost(urlr, [
            rt.h1(rt.txt("Version "+variables.version)),
            rt.p(rt.txt("Built "), rt.timeAgo(variables.build_time)),
        ]),
        replies: variables.log.map((entry, i): SitemapEntry => [
            entry.hash_full,
            (urlr) => ({post: commitThread(urlr, entry)}),
        ]),
    })],
    ["markdown", (urlr) => ({
        post: userThread(urlr, {kind: "richtext", content: [rt.p(rt.txt("Press 'Reply'"))]}, {
            layout: "reddit-post",
            actions: [{kind: "reply", text: "Reply", reply_info: reply_encoder.encode({kind: "markdown"})}],
        }),
    })]
];

type ReplyData = {kind: "markdown"} | {kind: "other"};
const reply_encoder = encoderGenerator<ReplyData, "reply">("reply");

type SitemapResult = {current: Generic.Thread, children: SitemapResult | Generic.Thread[]};

function getFromSitemap(path: string[], index: number, replies: SitemapEntry[]): SitemapResult | undefined {
    const current_bit = path[index];
    if(current_bit == null) return undefined;

    const urlr = "/" + path.filter((unused, i) => index <= i).join("/");
    
    const found_value = replies.find(([name, cb]) => {
        if(current_bit === name) return current_bit;
    });

    if(found_value) {
        const called = found_value[1](urlr);
        return {
            current: called.post,
            children: getFromSitemap(path, index + 1, called.replies ?? []) ?? (called.replies ?? []).map(reply => {
                const urlr2 = urlr + "/" + reply[0];
                return reply[1](urlr2).post;
            }),
        };
    }

    return {children: [], current: userThread(urlr, {
        kind: "richtext",
        content: [
            rt.p(rt.txt("404 not found "+path)),
        ],
    }, {title: "404", collapse_body: false, layout: "reddit-post"})};
}

export const client: ThreadClient = {
    id: "test",
    async getThread(path): Promise<Generic.Page> {
        const parsed_path = new URL(path, "http://test/");

        const pathsplit = parsed_path.pathname.split("/").filter(q => q);

        const smres = getFromSitemap(pathsplit, 0, sitemap);

        if(smres) {
            const parent_nodes: Generic.Thread[] = [];
            let children_nodes: Generic.Thread[];
            let last_node: Generic.Thread;
            const evalv = (q: SitemapResult) => {
                parent_nodes.push(q.current);
                if(Array.isArray(q.children)) {
                    children_nodes = q.children;
                    last_node = q.current;
                }else{
                    evalv(q.children);
                }
            };
            evalv(smres);

            return {
                title: last_node!.title?.text ?? "«err no title»",
                navbar: {actions: [], inboxes: []},
                body: {
                    kind: "one",
                    item: {
                        parents: parent_nodes,
                        replies: children_nodes!,
                    },
                },
                display_style: "comments-view",
            };
        }

        return bodyPage(path, {
            kind: "richtext",
            content: [
                rt.h1(rt.txt("Tests:")),
                rt.ul(...[
                    "/body-preview",
                    "/link-preview",
                    "/updates",
                    "/markdown",
                ].map(v => rt.li(rt.p(
                    rt.link(v, {}, rt.txt(v)),
                )))),
                rt.h1(rt.txt("TODO:")),
                rt.p(rt.txt("Test download pages from clients, for example a real sidebar widget or a real post or a real saved inbox")),
                rt.p(rt.txt("Test actual pages from clients. For example:")),
                rt.ul(
                    rt.li(rt.p(rt.txt("Test that logging in and logging out works"))),
                    rt.li(rt.p(rt.txt("Test posting actual replies"))),
                    rt.li(rt.p(rt.txt("Test sending actual reports"))),
                )
            ],
        });
    },
    async act(action) {
        throw new Error("act not supported");
    },
    previewReply(body, reply_info) {
        const decoded = reply_encoder.decode(reply_info);
        if(decoded.kind === "markdown") {
            return richtextPost("/", markdownToRichtext(body));
        }else if(decoded.kind === "other") {
            return richtextPost("/", [rt.p(rt.txt("err!"))]);
        }else assertNever(decoded);
    },
    async sendReply() {throw new Error("preview reply not supported")},
    async loadMore() {throw new Error("load more not supported")},
    async loadMoreUnmounted() {throw new Error("load more unmounted not supported")},
};