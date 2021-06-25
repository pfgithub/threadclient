import * as Generic from "../types/generic";
import { rt, Richtext } from "../types/generic";
import {encoderGenerator, ThreadClient} from "./base";
import * as commonmark from "commonmark";
import * as variables from "_variables";
import { assertNever } from "../util";
import * as Reddit from "../types/api/reddit";
import { IDMap } from "./reddit";

function childrenOf(node: commonmark.Node): commonmark.Node[] {
    const res: commonmark.Node[] = [];
    let current = node.firstChild;
    while(current != null) {
        res.push(current);
        current = current.next;
    }
    return res;
}

// switch to marked it has a better structure and supports more things
//https://marked.js.org/demo/?outputType=lexer&text=Test%20~~hmm~~%20Interesting%0A%0A%7Ctable%7C1%7C2%7C%0A%7C-%7C-%7C-%7C%0A%7Ca%7Cb%7Cc%7C&options=%7B%0A%20%22baseUrl%22%3A%20null%2C%0A%20%22breaks%22%3A%20false%2C%0A%20%22gfm%22%3A%20true%2C%0A%20%22headerIds%22%3A%20true%2C%0A%20%22headerPrefix%22%3A%20%22%22%2C%0A%20%22highlight%22%3A%20null%2C%0A%20%22langPrefix%22%3A%20%22language-%22%2C%0A%20%22mangle%22%3A%20true%2C%0A%20%22pedantic%22%3A%20false%2C%0A%20%22sanitize%22%3A%20false%2C%0A%20%22sanitizer%22%3A%20null%2C%0A%20%22silent%22%3A%20false%2C%0A%20%22smartLists%22%3A%20false%2C%0A%20%22smartypants%22%3A%20false%2C%0A%20%22tokenizer%22%3A%20null%2C%0A%20%22walkTokens%22%3A%20null%2C%0A%20%22xhtml%22%3A%20false%0A%7D&version=master

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
        return rt.kind("list", {
            ordered: node.listType === "ordered",
        }, childrenOf(node).map(it => rt.li(...childrenOf(it).map(paragraphToRichtextParagraph))));
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

function commitThread(path: string, entry: variables.LogEntry): Generic.PostContent {
    return {
        kind: "post",
        title: {text: "" + entry.hash + ": " + entry.commit_title, body_collapsible: {default_collapsed: true}},
        author: {
            name: entry.author_name,
            flair: [{
                elems: [{type: "text", text: entry.author_email}],
                content_warning: false,
            }],
            color_hash: entry.author_email,
            link: "ENOLINK",
        },
        body: {kind: "richtext", content: [
            rt.pre(entry.commit_body),
        ]},
        show_replies_when_below_pivot: {default_collapsed: false},
    };
}

type SitemapEntryData = {
    content: Generic.PostContent,
    replies?: SitemapEntry[],
    replyopts?: Partial<Exclude<Generic.ListingData, "reply">>,
};
type SitemapEntry = [string, (path: string) => SitemapEntryData];

const sitemap: SitemapEntry[] = [
    ["link-preview", (urlr): SitemapEntryData => ({
        content: {
            kind: "post",
            title: null,
            author: null,
            body: {kind: "richtext", content: [
                rt.h1(rt.txt("Testing Link Preview")),
                rt.p(rt.txt("Check each link and make sure:")),
                rt.ul(
                    rt.li(rt.p(rt.txt("It appears as described"))),
                    rt.li(rt.p(rt.txt("When collapsing or uncollapsing the comment, it functions as expected"))),
                    rt.li(rt.p(rt.txt("When closing the preview, it functions as expected"))),
                ),
            ]},
            show_replies_when_below_pivot: false,
        },
        replies: sample_preview_links.map((spl, i) => ["" + i, (urlr): SitemapEntryData => ({
            content: {
                kind: "post",
                title: null,
                author: null,
                body: {kind: "richtext", content: [
                    rt.p(rt.txt(spl.expected_result)),
                    rt.p(rt.link(spl.url, {}, rt.txt(spl.url))),
                ]},
                show_replies_when_below_pivot: {default_collapsed: false},
            },
        })]),
    })],
    ["body-preview", (urlr): SitemapEntryData => ({
        content: {
            kind: "post",
            title: {text: "Body Preview", body_collapsible: null},
            author: null,
            body: {kind: "none"},
            show_replies_when_below_pivot: false,
        },
        replies: ((): SitemapEntry[] => {
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
                (urlr): SitemapEntryData => ({
                    content: {
                        kind: "post",
                        title: {text: key, body_collapsible: null},
                        author: null,
                        body: {kind: "none"},
                        show_replies_when_below_pivot: {default_collapsed: false},
                    },
                    replies: items.map(({body, desc}, i): SitemapEntry => [
                        "" + i,
                        (urlr): SitemapEntryData => ({
                            content: {
                                kind: "post",
                                title: {text: desc, body_collapsible: {default_collapsed: true}},
                                author: null,
                                body,
                                show_replies_when_below_pivot: {default_collapsed: false},
                            },
                        }),
                    ])
                }),
            ]);
        })(),
    })],
    ["updates", (urlr): SitemapEntryData => ({
        content: {
            kind: "post",
            title: null,
            author: null,
            body: {kind: "richtext", content: [
                rt.h1(rt.txt("Version "+variables.version)),
                rt.p(rt.txt("Built "), rt.timeAgo(variables.build_time)),
            ]},
            show_replies_when_below_pivot: false,
        },
        replies: variables.log.map((entry, i): SitemapEntry => [
            entry.hash_full,
            (urlr): SitemapEntryData => ({content: commitThread(urlr, entry)}),
        ]),
    })],
    ["markdown", (urlr): SitemapEntryData => ({
        content: {
            kind: "post",
            title: null,
            author: null,
            body: {kind: "richtext", content: [rt.p(rt.txt("Press 'Reply'"))]},
            show_replies_when_below_pivot: false,
        },
        replyopts: {
            reply: {
                kind: "reply",
                text: "Reply",
                reply_info: reply_encoder.encode({kind: "markdown"}),
            },
        },
        replies: [],
    })]
];

type ReplyData = {kind: "markdown"} | {kind: "other"};
const reply_encoder = encoderGenerator<ReplyData, "reply">("reply");

function getFromSitemap(path: string[], index: number, replies: SitemapEntry[], parent: Generic.PostData | null): Generic.PostData | undefined {
    const current_bit = path[index];
    if(current_bit == null) return undefined;

    const urlr = "/" + path.filter((unused, i) => i <= index).join("/");
    
    const found_value = replies.find(([name, cb]) => {
        if(current_bit === name) return current_bit;
    });

    if(found_value) {
        console.log(urlr);
        const called = found_value[1](urlr);
        const this_post: Generic.PostData = {
            kind: "post",
            parent: parent ? {ref: parent, err: undefined} : null,
            replies: {sort: null, reply: null, ...called.replyopts, items: [{kind: "load_more"}]},
            content: called.content,
            internal_data: 0,
            display_style: "centered",
        };
        if(called.replies) {
            const subv = getFromSitemap(path, index + 1, called.replies, this_post);
            if(subv) return subv;
            const mapReplies = (parentv: Generic.PostData, nreplies: SitemapEntry[], urlr: string): Generic.ListingEntry[] => (
                nreplies.map((reply): Generic.ListingEntry => {
                    const urlr2 = urlr + "/" + reply[0];
                    const replyitm = reply[1](urlr2);
                    // reply count estimate: replyitm.replies.length
                    const thispost: Generic.ListingEntry = {
                        kind: "post",
                        post: {ref: {
                            kind: "post",
                            parent: {ref: parentv, err: undefined},
                            replies: null,
                            content: replyitm.content,
                            internal_data: 0,
                            display_style: "centered",
                        }, err: undefined},
                    };
                    if(replyitm.replies) thispost.post.ref!.replies = {
                        sort: null,
                        reply: null,
                        ...replyitm.replyopts,
                        items: replyitm.content.kind === "post" && replyitm.content.show_replies_when_below_pivot !== false ? (
                            mapReplies(thispost.post.ref!, replyitm.replies, urlr2)
                        ) : [{kind: "load_more"}],
                    };
                    return thispost;
                })
            );
            this_post.replies = {sort: null, reply: null, ...called.replyopts, items: mapReplies(this_post, called.replies, urlr)};
        }else{
            this_post.replies = null;
        }
        return this_post;
    }

    const this_post: Generic.PostData = {
        kind: "post",
        parent: parent ? {ref: parent, err: undefined} : null,
        replies: null,
        content: {
            kind: "post",
            title: {text: "404", body_collapsible: null},
            author: null,
            body: {kind: "richtext", content: [
                rt.p(rt.txt("404 not found "+path)),
            ]},
            show_replies_when_below_pivot: false,
        },
        internal_data: 0,
        display_style: "centered",
    };
    return this_post;
}

function clientWrapperAdd(map: Map<Generic.ID<unknown>, unknown>): Generic.PostData {
    return {
        kind: "post",
        parent: null,
        replies: null,

        display_style: "centered",
        content: {
            kind: "client",
            navbar: {actions: [], inboxes: []},
        },
        internal_data: 0,
    };
}

export async function getPage(path: string): Promise<Generic.Page2> {
    const parsed_path = new URL(path, "http://test/");
    const pathsplit = parsed_path.pathname.split("/").filter(q => q);

    const content = new Map<Generic.ID<unknown>, unknown>();
    const client_wrapper = clientWrapperAdd(content);

    if(pathsplit[0] === "reddit") {
        const reddit_client = await import("./reddit");
        const reddit_comments = await import("./test/sample_comment");

        const sample_reddit_comments: Reddit.Post[] = [reddit_comments.sample_comment];

        const comment_map: IDMap = new Map();
        for(const comment of sample_reddit_comments) {
            reddit_client.setupMap(comment_map, comment, {}, {
                permalink: "/",
                sort: "unsupported",
                is_chat: false,
            });
        }

        const pivot: Generic.PostData = {
            kind: "post",
            parent: {ref: client_wrapper, err: undefined},
            replies: {
                sort: null,
                reply: null, // this can be the reddit reply button
                items: sample_reddit_comments.map(comment => {
                    return {kind: "post", post: reddit_client.getPostData(comment_map, comment.data.name)};
                }),
            },

            display_style: "centered",
            content: {
                kind: "post",
                title: null,
                author: null,
                body: {kind: "none"},
                show_replies_when_below_pivot: false,
            },
            internal_data: 0,
        };
        return {
            title: "reddit",
            pivot: {ref: pivot, err: undefined},
            content,
        };
    }

    const smres = getFromSitemap(pathsplit, 0, sitemap, client_wrapper);

    if(smres) {
        return {
            title: "«err no title»",
            pivot: {ref: smres, err: undefined},
            content,
        };
    }

    const home_page: Generic.PostContent = {
        kind: "post",
        title: null,
        author: null,
        body: {
            kind: "richtext",
            content: [
                rt.h1(rt.txt("Tests:")),
                rt.ul(...[
                    "/body-preview",
                    "/link-preview",
                    "/updates",
                    "/markdown",
                    "/reddit",
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
        },
        show_replies_when_below_pivot: false,
    };
    const pivot: Generic.PostData = {
        kind: "post",
        parent: {ref: client_wrapper, err: undefined},
        replies: null,

        display_style: "centered",
        content: home_page,
        internal_data: 0,
    };
    return {
        title: "home",
        pivot: {ref: pivot, err: undefined},
        content,
    };
}

// function postFromLegacy(content: Generic.ContentMap, parent: Generic.PostData | null, legacy: Generic.Thread): Generic.PostData {
//     const replies = legacy.replies ? {
//         sort: null,
//         items: legacy.replies.map((reply): Generic.ListingEntry => {
//             if(reply.kind === "load_more") return {kind: "load_more"};
//             return {
//                 kind: "post",
//                 post: postFromLegacy(content, parent, reply),
//             }
//         })
//     } : null;
//     return {
//         kind: "post",
//         parent,
//         replies,

//         display_style: "centered",
//         content: {
//             kind: "legacy",
//             thread: {...legacy, replies: undefined},
//         },
//         internal_data: 0,
//     };
// }

export const client: ThreadClient = {
    id: "test",
    getPage,
    async getThread(path): Promise<Generic.Page> {
        throw new Error("Not supported.");
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
    async sendReply(body, reply_info) {
        const decoded = reply_encoder.decode(reply_info);
        if(decoded.kind === "markdown") {
            const res = richtextPost("/", markdownToRichtext(body));
            res.actions.push({
                kind: "reply",
                text: "Reply",
                reply_info: reply_encoder.encode({kind: "markdown"}),
            });
            return res;
        }else if(decoded.kind === "other") {
            throw new Error("Other not supported");
        }else assertNever(decoded);
    },
    async loadMore() {throw new Error("load more not supported")},
    async loadMoreUnmounted() {throw new Error("load more unmounted not supported")},
};