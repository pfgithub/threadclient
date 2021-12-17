/* eslint-disable max-len */

import * as commonmark from "commonmark";
import { LogEntry, variables } from "virtual:_variables";
import type * as Generic from "api-types-generic";
import { Richtext, rt } from "api-types-generic";
import { assertNever } from "tmeta-util";
import { encoderGenerator, ThreadClient } from "threadclient-client-base";

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
        return [rt.link(client, node.destination ?? "ERR", {title: node.title ?? undefined}, ...childrenOf(node).flatMap(it => spanToRichtextSpan(it, styl)))];
    }else if(node.type === "linebreak") {
        return [rt.br()];
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
    {expected_result: "(!localhost) image gallery (!fullscreenable)", url: "https://imgur.com/gallery/clWTb"},
    {expected_result: "(!localhost) image gallery (fullscreenable)", url: "https://www.imgur.com/a/HJ80Ds9"},
    {expected_result: "(!localhost) image gallery with long captions (fullscreenable)", url: "https://imgur.com/a/YsYb4Gk"},
    {expected_result: "(!localhost) image gallery with mixed in videos (!fullscreenable)", url: "https://imgur.com/gallery/ljoJeal"},
    {expected_result: "video + sound", url: "https://clips.twitch.tv/GlamorousTacitRaccoonWutFace-oMcWnMP8C5xMZhxD"},
    {expected_result: "reddit rpan (check manually, not previewable)", url: "https://www.reddit.com/r/RedditSessions"},
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
    content_warning?: undefined | string,
    layout: Generic.Thread["layout"],
    collapse_body?: undefined | boolean,
    title?: undefined | string,
    info?: undefined | Generic.Info,
    actions?: undefined | Generic.Action[],
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
        flair: opts.content_warning != null ? [{elems: [{kind: "text", text: opts.content_warning}], content_warning: true}] : [],
    };
}

function richtextPost(path: string, richtext: Generic.Richtext.Paragraph[]): Generic.Thread {
    return userThread(path, {kind: "richtext", content: richtext}, {layout: "reddit-post"});
}

function commitThread(path: string, entry: LogEntry): Generic.PostContent {
    return {
        kind: "post",
        title: {text: "" + entry.hash + ": " + entry.commit_title},
        collapsible: {default_collapsed: true},
        author: {
            name: entry.author_name,
            client_id: client.id,
            flair: [{
                elems: [{kind: "text", text: entry.author_email}],
                content_warning: false,
            }],
            color_hash: entry.author_email,
            link: "ENOLINK",
        },
        body: {kind: "richtext", content: [
            rt.pre(entry.commit_body),
        ]},
        show_replies_when_below_pivot: true,
    };
}

type SitemapEntryData = {
    content: Generic.PostContent,
    replies?: undefined | SitemapEntry[],
    replyopts?: undefined | Partial<Generic.ListingData>,
};
type SitemapEntry = [string, (path: string) => SitemapEntryData];

const replyable = (): Partial<Generic.ListingData> => ({
    reply: {
        action: {
            kind: "reply",
            client_id: client.id,
            key: "" + Math.random(),
            text: "Reply",
            reply_info: reply_encoder.encode({kind: "markdown"}),
            mode: "reply",
        },
        locked: false,
    },
});

const sitemap: SitemapEntry[] = [
    ["link-preview", (urlr): SitemapEntryData => ({
        content: {
            kind: "post",
            title: null,
            body: {kind: "richtext", content: [
                rt.h1(rt.txt("Testing Link Preview")),
                rt.p(rt.txt("Check each link and make sure:")),
                rt.ul(
                    rt.li(rt.p(rt.txt("It appears as described"))),
                    rt.li(rt.p(rt.txt("When collapsing or uncollapsing the comment, it functions as expected"))),
                    rt.li(rt.p(rt.txt("When closing the preview, it functions as expected"))),
                ),
            ]},
            collapsible: false,
            show_replies_when_below_pivot: false,
        },
        replies: sample_preview_links.map((spl, i) => ["" + i, (urlr): SitemapEntryData => ({
            content: {
                kind: "post",
                title: null,
                body: {kind: "richtext", content: [
                    rt.p(rt.txt(spl.expected_result)),
                    rt.p(rt.link(client, spl.url, {}, rt.txt(spl.url))),
                ]},
                actions: {
                    other: [
                        {kind: "link", client_id: client.id, text: "View", url: urlr}
                    ],
                },
                collapsible: {default_collapsed: false},
                show_replies_when_below_pivot: true,
            },
        })]),
    })],
    ["body-preview", (urlr): SitemapEntryData => ({
        content: {
            kind: "post",
            title: {text: "Body Preview"},
            body: {kind: "none"},
            collapsible: false,
            show_replies_when_below_pivot: false,
        },
        replies: ((): SitemapEntry[] => {
            type ITRes = {desc: string, body: Generic.Body};
            const item = (desc: string, body: Generic.Body) => ({desc, body});
            const body_kinds: {[key in Generic.Body["kind"]]: ITRes[]} = {
                text: [
                    item("text displays", {kind: "text",
                        client_id: client.id,
                        content: "Hello there! It works.",
                        markdown_format: "none",
                    }),
                    item("reddit markdown functions", {kind: "text", client_id: client.id, content: [
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
                        rt.h1(rt.txt("Heading level 1 and a horizontal line below")),
                        rt.hr(),
                        rt.p(
                            rt.txt("Richtext paragraph containing text. Styles: "),
                            rt.txt("Bold", {strong: true}),
                            rt.txt(", "),
                            rt.txt("Italic", {emphasis: true}),
                            rt.txt(", "),
                            rt.txt("Strikethrough", {strikethrough: true}),
                            rt.txt(", "),
                            rt.txt("Superscript", {superscript: true}),
                            rt.txt(", "),
                            rt.txt("Mixed Bold/Italic/Strike/Sup", {strong: true, emphasis: true, strikethrough: true, superscript: true}),
                        ),
                        rt.p(
                            rt.txt("Soft break:"), rt.br(),
                            rt.txt("Next line"), rt.br(),
                        ),
                        rt.h2(rt.txt("Heading level 2. Tight list of links:")),
                        rt.hr(),
                        rt.ul(
                            rt.ili(
                                rt.txt("Sample link: "), rt.link(client, "/", {}, rt.txt("Goes to '/'")),
                            ),
                            rt.ili(
                                rt.txt("Error link: "), rt.link(client, "javascript:alert(\"xss\")", {}, rt.txt("Uh oh!")),
                            ),
                            rt.ili(
                                rt.txt("Raw link: "), rt.link(client, "raw:https://www.reddit.com/", {}, rt.txt("Goes to www.reddit.com")),
                            ),
                            rt.ili(
                                rt.txt("Link with title: "), rt.link(client, "/", {title: "Title is working!"}, rt.txt("Hover me!")),
                            ),
                            rt.ili(
                                rt.txt("User link: "), rt.link(client, "/", {is_user_link: "u/sample_user"}, rt.txt("I should be light pink (or dark pink/'cab sav' in light mode)")),
                            ),
                            rt.ili(
                                rt.link(client, "https://i.imgur.com/Cnm26CH.png", {}, rt.txt("Preview me!")),
                            ),
                        ),
                        rt.p(
                            rt.txt("Pill link: "), rt.link(client, "/", {style: "pill-empty"}, rt.txt("I should be an unfilled pill")),
                        ),
                        rt.p(
                            rt.txt("Link containing a spoiler? should this even be allowed?: "),
                            rt.link(client, "/", {}, rt.txt("Spoiler: "), rt.spoiler(rt.txt("No."))),
                        ),
                        rt.p(rt.txt("Assorted span items:")),
                        rt.ul(
                            rt.ili(rt.txt("Recent time: "), rt.timeAgo(Date.now())),
                            rt.ili(rt.txt("Long past time: "), rt.timeAgo(0)),
                            rt.ili(
                                rt.txt("Here's a fun emoji: "),
                                {kind: "emoji", url: "https://i.imgur.com/2zGFZM2.png", name: ":smiley:"},
                                rt.txt(". It's not quite square, hopefully that's okay. Hover it, it should say its name."),
                            ),
                            rt.ili(
                                rt.txt("My user flair: "),
                                rt.flair({content_warning: false, elems: [{kind: "text", text: "Hi!"}]}),
                                rt.txt(". Flairs should eventually be normal richtext but aren't yet.")
                            ),
                            rt.ili(
                                rt.txt("An error button. Should log some text to the console when clicked: "),
                                rt.error("Uh oh!", "some text"),
                            ),
                        ),
                        rt.p(rt.txt("A list that isn't tight:")),
                        rt.ul(
                            rt.ili(rt.txt("I shouldn't be tight")),
                            rt.li(rt.p(rt.txt("Neither should I")), rt.p(rt.txt("Especially b/c I contain multiple paragraphs"))),
                            rt.ili(rt.txt("Me neither")),
                            rt.ili(rt.txt("Wow!")),
                            rt.ili(rt.txt("None of us are tight :(")),
                        ),
                        rt.p(rt.txt("A list that is tight:")),
                        rt.ul(
                            rt.li(rt.p(rt.txt("Look at me! I'm a single paragraph"))),
                            rt.ili(rt.txt("And yet, this list is not tight")),
                            rt.ili(rt.txt("Amazing!")),
                        ),
                        rt.hn(3, rt.txt("Heading level 3. Blockquote:")),
                        rt.hr(),
                        rt.blockquote(
                            rt.p(
                                rt.txt("Hi! Here's a spoiler for Star Wars: Infinity War: "), rt.spoiler(rt.txt("Han's last name is Solo")),
                            ),
                            rt.p(
                                rt.txt("Make sure links work within spoilers and aren't clickable until revealed: "),
                                rt.spoiler(rt.link(client, "/", {}, rt.txt("I shouldn't be clickable until the spoiler is opened"))),
                            ),
                        ),
                        rt.blockquote(
                            rt.p(rt.txt("What happens if we stack two blockquotes on top of eachother? Hopefully nothing bad")),
                            rt.blockquote(rt.p(rt.txt("btw this inner blockquote should end at the same level as the outer one, no extra padding"))),
                        ),
                        rt.hn(4, rt.txt("Heading level 4. Code:")),
                        rt.hr(),
                        {kind: "code_block", lang: "demo", text: "Here is a sample code block\n← there was a newline\n  two spaces at the start of this line"},
                        {kind: "code_block", text: "This one doesn't have a language set."},
                        rt.p(rt.code("Some inline code"), rt.txt(", amazing!")),
                        rt.hn(5, rt.txt("Heading level 5. Table:")),
                        rt.hr(),
                        rt.table(
                            [
                                rt.th(undefined, rt.txt("Default")),
                                rt.th("left", rt.txt("Left-aligned")),
                                rt.th("center", rt.txt("Center-aligned")),
                                rt.th("right", rt.txt("Right-aligned")),
                            ],
                            [
                                rt.td(rt.txt("1")),
                                rt.td(rt.txt("2")),
                                rt.td(rt.txt("3")),
                                rt.td(rt.txt("4")),
                            ],
                            [
                                rt.td(rt.txt("5")),
                                rt.td(rt.txt("6")),
                                rt.td(rt.txt("7")),
                                rt.td(rt.txt("8")),
                            ],
                        ),
                        rt.hn(6, rt.txt("Heading level 6. Should be normal and underlined. Body:")),
                        {kind: "body", body:
                            {kind: "crosspost", client_id: client.id, source: userThread(urlr, {
                                kind: "richtext", content: [rt.p(rt.txt("Crossposted Body"))]
                            }, {
                                title: "Crossposted Source", layout: "reddit-post"
                            })}
                        },
                    ]})
                ],
                link: [],
                captioned_image: [
                    item("image that loads with specified height", {
                        kind: "captioned_image",
                        url: "https://i.redd.it/handl2uwf5j71.jpg",
                        caption: "Sample Caption",
                        w: 1080,
                        h: 621,
                    }),
                    item("image that does not load, with specified height", {
                        kind: "captioned_image",
                        url: "error:no-image",
                        caption: "Sample Caption",
                        w: 1080,
                        h: 621,
                    }),
                ],
                video: [],
                gfycatv1: [],
                gfycatv2: [],
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
                        {kind: "crosspost", client_id: client.id, source: userThread(urlr, {
                            kind: "richtext", content: [rt.p(rt.txt("Crossposted Body"))]
                        }, {
                            title: "Crossposted Source", layout: "reddit-post"
                        })},
                    )
                ],
                array: [],
                link_preview: [],
                oembed: [],
                mastodon_instance_selector: [
                    item("mastodon instance selector", {
                        kind: "mastodon_instance_selector",
                        client_id: client.id,
                    }),
                ],
            };
            return Object.entries(body_kinds).map(([key, items]): SitemapEntry => [
                key,
                (urlr): SitemapEntryData => ({
                    content: {
                        kind: "post",
                        title: {text: key},
                        body: {kind: "none"},
                        collapsible: {default_collapsed: false},
                        show_replies_when_below_pivot: true,
                    },
                    replies: items.map(({body, desc}, i): SitemapEntry => [
                        "" + i,
                        (urlr): SitemapEntryData => ({
                            content: {
                                kind: "post",
                                title: {text: desc},
                                body,
                                collapsible: {default_collapsed: true},
                                show_replies_when_below_pivot: true,
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
            body: {kind: "richtext", content: [
                rt.h1(rt.txt("Version "+variables.version)),
                rt.p(rt.txt("Built "), rt.timeAgo(variables.build_time)),
            ]},
            collapsible: false,
            show_replies_when_below_pivot: false,
        },
        replies: variables.log.map((entry, i): SitemapEntry => [
            entry.hash_full,
            (urlr): SitemapEntryData => ({content: commitThread(urlr, entry)}),
        ]),
    })],
    ["markdown", urlr => demoPost(urlr, b.richtext(
        rt.p(rt.txt("Press 'Reply'")),
    ), [
        ["0", urlr => demoPost(urlr, b.richtext(
            rt.p(rt.txt("Here is a comment")),
        ), [
            ["0", urlr => demoPost(urlr, b.richtext(
                rt.p(rt.txt("It has standard hierarchical replies")),
            ), [])],
            ["1", urlr => demoPost(urlr, b.richtext(
                rt.p(rt.txt("Like these")),
            ), [])],
        ])],
        ["1", urlr => demoPost(urlr, b.richtext(
            rt.p(rt.txt("Here is another comment")),
        ), [
            ["0", urlr => demoPost(urlr, b.richtext(
                rt.p(rt.txt("It has threaded replies")),
            ), [
                ["0", urlr => demoPost(urlr, b.richtext(
                    rt.p(rt.txt("See?")),
                ), [])],
            ])],
        ])],
    ])],
    ["header", (urlr): SitemapEntryData => ({
        content: {
            kind: "page",
            title: null,
            wrap_page: {
                sidebar: {
                    items: [],
                },
                header: {
                    kind: "bio",
                    banner: {
                        desktop: "https://images.sadhguru.org/sites/default/files/media_files/iso/en/"
                        + "64083-natures-temples.jpg",
                    },
                    icon: {
                        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Flat_tick_icon.svg/"
                        + "1200px-Flat_tick_icon.svg.png",
                    },
                    name: {
                        display: "Display Name",
                        link_name: "~sample",
                    },
                    body: {kind: "richtext", content: [
                        rt.p(rt.txt("Some text for the bio")),
                        rt.p(rt.txt("The bio can have any body for some reason, not sure why")),
                    ]},
                    menu: null, // sort replaces this
                    raw_value: 0,
                },
            },
        },
        replies: [],
    })],
    // ["reddit_html", (urlr): SitemapEntryData => ({
    //     content: {
    //         kind: "post",
    //         title: {text: "Reddit HTML", body_collapsible: null},
    //         author: null,
    //         body: {kind: "none"},
    //         show_replies_when_below_pivot: false,
    //     },
    //     replies: reddit_html_tests.map((test, i): SitemapEntry => [
    //         "" + i,
    //         (urlr): SitemapEntryData => ({
    //             content: {
    //                 kind: "post",
    //                 title: {text: "Test "+(i + 1), body_collapsible: null},
    //                 author: null,
    //                 body: {kind: "none"},
    //                 show_replies_when_below_pivot: {default_collapsed: true},
    //             },
    //             replies: [
    //                 ["markdown", (urlr): SitemapEntryData => ({
    //                     content: {
    //                         kind: "post",
    //                         title: {text: "Markdown", body_collapsible: {default_collapsed: true}},
    //                         author: null,
    //                         body: {kind: "text", markdown_format: "reddit", content: test[0]},
    //                         show_replies_when_below_pivot: false,
    //                     },
    //                 })],
    //                 ["html", (urlr): SitemapEntryData => ({
    //                     content: {
    //                         kind: "post",
    //                         title: {text: "HTML", body_collapsible: {default_collapsed: true}},
    //                         author: null,
    //                         body: {kind: "text", markdown_format: "reddit_html", content: test[1]},
    //                         show_replies_when_below_pivot: false,
    //                     },
    //                 })],
    //                 ["richtext", (urlr): SitemapEntryData => ({
    //                     content: {
    //                         kind: "post",
    //                         title: {text: "Richtext", body_collapsible: {default_collapsed: true}},
    //                         author: null,
    //                         body: {kind: "richtext", content: test[2] ?? []},
    //                         show_replies_when_below_pivot: false,
    //                     },
    //                 })],
    //             ],
    //         }),
    //     ]),
    // })],
];

// export b from Generic with eg b.richtext b.captioned_image b…?
const b = {
    richtext(...content: Generic.Richtext.Paragraph[]): Generic.Body {
        return {kind: "richtext", content};
    },
};
function demoPost(path: string, content: Generic.Body, replies: SitemapEntry[]): SitemapEntryData {
    return {
        content: {
            kind: "post",
            title: null,
            body: content,
            collapsible: {default_collapsed: false},
            show_replies_when_below_pivot: true,
        },
        replyopts: replyable(),
        replies,
    };
}

// import {reddit_html_tests} from "./reddit/html_to_richtext.spec";

type ReplyData = {kind: "markdown"} | {kind: "other"};
const reply_encoder = encoderGenerator<ReplyData, "reply">("reply");

function getFromSitemap(path: string[], index: number, replies: SitemapEntry[], parent: Generic.PostData | null): Generic.PostData | undefined {
    const current_bit = path[index];
    if(current_bit == null) return undefined;

    const urlr = "/" + path.filter((unused, i) => i <= index).join("/");
    
    const found_value = replies.find(([name, cb]) => {
        return current_bit === name;
    });

    if(found_value) {
        console.log(urlr);
        const called = found_value[1](urlr);
        const this_post: Generic.PostData = {
            kind: "post",
            url: urlr,
            client_id: client.id,
            parent: parent ? {ref: parent, err: undefined} : null,
            replies: {...called.replyopts, items: [{ref: {
                kind: "loader", parent: null, replies: null, url: null,
                client_id: client.id,
                key: 0 as unknown as Generic.Opaque<"loader">,
                load_count: null,
            }}]},
            content: called.content,
            internal_data: 0,
            display_style: "centered",
        };
        if(called.replies) {
            const subv = getFromSitemap(path, index + 1, called.replies, this_post);
            if(subv) return subv;
            const mapReplies = (
                parentv: Generic.PostData,
                nreplies: SitemapEntry[],
                urlr: string,
            ): Generic.Link<Generic.Post>[] => (
                nreplies.map((reply): Generic.Link<Generic.Post> => {
                    const urlr2 = urlr + "/" + reply[0];
                    const replyitm = reply[1](urlr2);
                    // reply count estimate: replyitm.replies.length
                    const thispost: Generic.Link<Generic.Post> = {ref: {
                        kind: "post",
                        url: urlr2,
                        client_id: client.id,
                        parent: {ref: parentv, err: undefined},
                        replies: null,
                        content: replyitm.content,
                        internal_data: 0,
                        display_style: "centered",
                    }, err: undefined};
                    if(replyitm.replies) thispost.ref.replies = {
                        ...replyitm.replyopts,
                        items: (
                            replyitm.content.kind === "post"
                            &&
                            replyitm.content.show_replies_when_below_pivot !== false
                        ) ? (
                            mapReplies(thispost.ref as Generic.PostData, replyitm.replies, urlr2)
                        ) : [{ref: {
                            kind: "loader", parent: null, replies: null, url: null,
                            client_id: client.id,
                            key: 0 as unknown as Generic.Opaque<"loader">,
                            load_count: null,
                        }}],
                    };
                    return thispost;
                })
            );
            this_post.replies = {
                ...called.replyopts, items: mapReplies(this_post, called.replies, urlr),
            };
        }else{
            this_post.replies = null;
        }
        return this_post;
    }

    const this_post: Generic.PostData = {
        kind: "post",
        url: "/"+path.join("/"),
        client_id: client.id,
        parent: parent ? {ref: parent, err: undefined} : null,
        replies: null,
        content: {
            kind: "post",
            title: {text: "404"},
            body: {kind: "richtext", content: [
                rt.p(rt.txt("404 not found "+path)),
            ]},
            collapsible: false,
            show_replies_when_below_pivot: false,
        },
        internal_data: 0,
        display_style: "centered",
    };
    return this_post;
}

function clientWrapperAdd(): Generic.PostData {
    return {
        kind: "post",
        url: null,
        client_id: client.id,
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

    const client_wrapper = clientWrapperAdd();

    // if(pathsplit[0] === "reddit") {
    //     const reddit_client = await import("./reddit");
    //     const reddit_comments = await import("./test/sample_comment");

    //     const sample_reddit_comments: Reddit.Post[] = [reddit_comments.sample_comment];

    //     const comment_map: IDMap = new Map();
    //     for(const comment of sample_reddit_comments) {
    //         reddit_client.setUpMap(comment_map, comment, {}, {
    //             permalink: "/",
    //             sort: "unsupported",
    //             is_chat: false,
    //         }, {parent: null, replies: null});
    //     }

    //     const pivot: Generic.PostData = {
    //         kind: "post",
    //         url: path,
    //         parent: {ref: client_wrapper, err: undefined},
    //         replies: {
    //             sort: null,
    //             reply: null, // this can be the reddit reply button
    //             items: sample_reddit_comments.map(comment => {
    //                 return {kind: "post", post: reddit_client.getPostData(comment_map, comment.data.name)};
    //             }),
    //         },

    //         display_style: "centered",
    //         content: {
    //             kind: "post",
    //             title: null,
    //             author: null,
    //             body: {kind: "none"},
    //             show_replies_when_below_pivot: false,
    //         },
    //         internal_data: 0,
    //     };
    //     return {
    //         title: "reddit",
    //         pivot: {ref: pivot, err: undefined},
    //     };
    // }

    const smres = getFromSitemap(pathsplit, 0, sitemap, client_wrapper);

    if(smres) {
        return {
            pivot: {ref: smres, err: undefined},
        };
    }

    const home_page: Generic.PostContent = {
        kind: "post",
        title: null,
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
                    "/header",
                ].map(v => rt.li(rt.p(
                    rt.link(client, v, {}, rt.txt(v)),
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
        collapsible: false,
        show_replies_when_below_pivot: false,
    };
    const pivot: Generic.PostData = {
        kind: "post",
        url: "/",
        client_id: client.id,
        parent: {ref: client_wrapper, err: undefined},
        replies: null,

        display_style: "centered",
        content: home_page,
        internal_data: 0,
    };
    return {
        pivot: {ref: pivot, err: undefined},
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
    previewReply(body, reply_info): Generic.PostContent {
        const decoded = reply_encoder.decode(reply_info);
        if(decoded.kind === "markdown") {
            return {
                kind: "post",
                title: null,
                body: {kind: "richtext", content: markdownToRichtext(body)},
                collapsible: false,
                show_replies_when_below_pivot: false,
            };
            // return richtextPost("/", markdownToRichtext(body));
        }else if(decoded.kind === "other") {
            throw new Error("Other not supported");
        }else assertNever(decoded);
    },
    async sendReply(body, reply_info) {
        const decoded = reply_encoder.decode(reply_info);
        if(decoded.kind === "markdown") {
            const res = richtextPost("/", markdownToRichtext(body));
            res.actions.push({
                kind: "reply",
                client_id: client.id,
                text: "Reply",
                key: "" + Math.random(),
                reply_info: reply_encoder.encode({kind: "markdown"}),
                mode: "reply",
            });
            return res;
        }else if(decoded.kind === "other") {
            throw new Error("Other not supported");
        }else assertNever(decoded);
    },
};