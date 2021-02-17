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
    {expected_result: "video + sound", url: "https://\x72\x65\x64gifs.com/watch/rigidlankyosprey", warn: "NSFW"},
    // TODO ….mp4
    {expected_result: "video + sound", url: "http://dl5.webmfiles.org/big-buck-bunny_trailer.webm"},
    {expected_result: "audio", url: "https://mastodon.lol/system/media_attachments/files/105/744/125/873/361/514/original/4ecb82b471e4e067.mp3"},
    {expected_result: "youtube video", url: "https://www.youtube.com/watch?v=JM-NqFX2jU8"},
    {expected_result: "youtube video", url: "https://youtu.be/JM-NqFX2jU8"},
    // TODO youtube video (starts at timestamp)
    // TODO youtube video (start and end timestamp)
    {expected_result: "single image", url: "https://imgur.com/gallery/HFoOCeg", warn: "thread.pfg.pw"},
    {expected_result: "image gallery (fullscreenable)", url: "https://imgur.com/gallery/clWTb", warn: "thread.pfg.pw"},
    {expected_result: "image gallery (fullscreenable)", url: "https://www.imgur.com/a/HJ80Ds9", warn: "thread.pfg.pw"},
    {expected_result: "video + sound", url: "https://clips.twitch.tv/GlamorousTacitRaccoonWutFace-oMcWnMP8C5xMZhxD"},
    
    // TODO test error conditions eg : twitch clip with invalid slug
    {expected_result: "error : invalid imgur gallery", url: "https://imgur.com/gallery/qqqq"},
    {expected_result: "error : invalid imgur id", url: "https://www.imgur.com/a/QQQQQq"},
    {expected_result: "error : invalid twitch slug", url: "https://clips.twitch.tv/QqqqqqqqqQqqqqQqqqqqqQqqQqqq-qQqQqQQQQQqQQqqQ"},
];

function bodyPage(path: string, body: Generic.Body): Generic.Page {
    return {
        title: path + " | Test",
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

export const client: ThreadClient = {
    id: "test",
    async getThread(path): Promise<Generic.Page> {
        if(path === "/link-preview") return bodyPage(path, {
            // TODO put each of these in a seperate collapsable comment
            // to test that hideshow works correctly
            kind: "richtext",
            content: [{kind: "list", ordered: false, children: sample_preview_links.map((spl): Generic.Richtext.Paragraph => {
                const link_node: Generic.Richtext.Span = {kind: "link", url: spl.url, children: [{kind: "text", text: spl.expected_result, styles: {}}]};
                return {kind: "list_item", children: [{kind: "paragraph", children: 
                    spl.warn != null ? [{kind: "text", text: spl.warn+": ", styles: {}}, {kind: "spoiler", children: [link_node]}] : [link_node],
                }]};
            })}],
        });
        return bodyPage(path, {
            kind: "richtext",
            content: [
                {kind: "paragraph", children: [{kind: "text", styles: {}, text: "404 not found "+path}]},
                {kind: "heading", level: 1, children: [{kind: "text", styles: {}, text: "Tests:"}]},
                {kind: "list", ordered: false, children: [
                    "/link-preview",
                ].map((v): Generic.Richtext.Paragraph => ({kind: "list_item", children: [{kind: "paragraph", children: [
                    {kind: "link", url: v, children: [{kind: "text", text: v, styles: {}}]}
                ]}]}))},
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