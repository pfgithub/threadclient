import * as Generic from "../types/generic";
import {encoderGenerator, ThreadClient} from "./base";

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
    // TODO youtube video (start and end timestamp)
    {expected_result: "(prod. only) single image", url: "https://imgur.com/gallery/HFoOCeg"},
    {expected_result: "(prod. only) image gallery (fullscreenable)", url: "https://imgur.com/gallery/clWTb"},
    {expected_result: "(prod. only) image gallery (fullscreenable)", url: "https://www.imgur.com/a/HJ80Ds9"},
    {expected_result: "video + sound", url: "https://clips.twitch.tv/GlamorousTacitRaccoonWutFace-oMcWnMP8C5xMZhxD"},
    
    // TODO test error conditions eg : twitch clip with invalid slug
    {expected_result: "error : invalid imgur gallery", url: "https://imgur.com/gallery/qqqq"},
    {expected_result: "error : invalid imgur id", url: "https://www.imgur.com/a/QQQQQq"},
    {expected_result: "error : invalid twitch slug", url: "https://clips.twitch.tv/QqqqqqqqqQqqqqQqqqqqqQqqQqqq-qQqQqQQQQQqQQqqQ"},
];

function bodyPage(path: string, body: Generic.Body): Generic.Page {
    return {
        title: path,
        navbar: [],
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

function listingPage(path: string, header: Generic.Thread, items: Generic.Thread[]): Generic.Page {
    return {
        title: path,
        navbar: [],
        body: {
            kind: "listing",
            header: header,
            items: items.map(item => ({parents: [item], replies: []})),
        },
        display_style: "comments-view",
    };
}

type UserThreadOpts = {
    content_warning?: string,
    layout: Generic.Thread["layout"],
    collapse_body?: true,
    title?: string,
};
function userThread(path: string, body: Generic.Body, opts: UserThreadOpts): Generic.Thread {
    return {
        kind: "thread",
        title: opts.title != null ? {text: opts.title} : undefined,
        body,
        display_mode: {body: opts.collapse_body ?? false ? "collapsed" : "visible", comments: "collapsed"},
        raw_value: sample_preview_links,
        link: path,
        layout: opts.layout,
        actions: [],
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

const rt = {
    p: (...items: Generic.Richtext.Span[]): Generic.Richtext.Paragraph => ({kind: "paragraph", children: items}),
    h1: (...items: Generic.Richtext.Span[]): Generic.Richtext.Paragraph => ({kind: "heading", level: 1, children: items}),
    ul: (...items: Generic.Richtext.Paragraph[]): Generic.Richtext.Paragraph => ({kind: "list", ordered: false, children: items}),
    ol: (...items: Generic.Richtext.Paragraph[]): Generic.Richtext.Paragraph => ({kind: "list", ordered: true, children: items}),
    li: (...items: Generic.Richtext.Paragraph[]): Generic.Richtext.Paragraph => ({kind: "list_item", children: items}),
    txt: (text: string): Generic.Richtext.Span => ({kind: "text", text, styles: {}}),
    link: (url: string, ...children: Generic.Richtext.Span[]): Generic.Richtext.Span => ({kind: "link", url, children}),
};

export const client: ThreadClient = {
    id: "test",
    async getThread(path): Promise<Generic.Page> {
        if(path === "/link-preview") return listingPage(path, richtextPost(path, [
            rt.h1(rt.txt("Testing Link Preview")),
            rt.p(rt.txt("Check each link and make sure:")),
            rt.ul(
                rt.li(rt.p(rt.txt("It appears as described"))),
                rt.li(rt.p(rt.txt("When collapsing or uncollapsing the comment, it functions as expected"))),
                rt.li(rt.p(rt.txt("When closing the preview, it functions as expected"))),
            ),
        ]), sample_preview_links.map(spl => collapsibleComment(path, {
            kind: "richtext",
            content: [
                rt.p(rt.txt(spl.expected_result)),
                rt.p(rt.link(spl.url, rt.txt(spl.url))),
            ],
        }, {content_warning: spl.warn})));
        if(path === "/body-preview") return listingPage(path, richtextPost(path, []), ((): Generic.Thread[] => {
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
                none: [],
                removed: [],
                crosspost: [],
                array: [],
            };
            return Object.entries(body_kinds).flatMap(([key, items]): ITRes[] => {
                if(items.length === 0) return [item("ERROR! Missing for "+key, {kind: "none"})];
                return items;
            }).map(({desc, body}) => {
                return userThread(path, body, {title: desc, collapse_body: true, layout: "reddit-post"});
            });
        })());
        return bodyPage(path, {
            kind: "richtext",
            content: [
                ...path === "/" ? [] : [rt.p(rt.txt("404 not found "+path))],
                rt.h1(rt.txt("Tests:")),
                rt.ul(...[
                    "/body-preview",
                    "/link-preview",
                ].map(v => rt.li(rt.p(
                    rt.link(v, rt.txt(v)),
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
    previewReply() {throw new Error("preview reply not supported")},
    async sendReply() {throw new Error("preview reply not supported")},
    async loadMore() {throw new Error("load more not supported")},
    async loadMoreUnmounted() {throw new Error("load more unmounted not supported")},
};