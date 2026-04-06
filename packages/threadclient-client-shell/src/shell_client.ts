import * as Generic from "api-types-generic";
import { p2, rt } from "api-types-generic";
import { ThreadClient } from "threadclient-client-base";
import { splitURL } from "tmeta-util";
import { changelog1, changelog2, changelog3, changelog4 } from "./changelog";

export const client: ThreadClient = {
    id: "shell",

    async getPage(path: string): Promise<Generic.Page2> {
        console.log("!!ALL_CONTENT", all_content);

        // we can just return all the content i guess
        // might be nice if we structured it so it can be dynamically imported in the future but this
        // is okay for now
        const [pathurl] = splitURL(path);
        const link = "/"+pathurl.split("/").filter(v => v && !v.startsWith("~")).join("/") as Generic.Link<Generic.Post>;
        if(all_content[link] == null) return {
            pivot: link,
            content: {[link]: {data: autoPost({
                parent: null,
                replies: null,
            }, {
                content: [
                    rt.p(rt.error("404 not found", "ERROR")),
                    rt.p(rt.link({id: client.id}, "/", {}, rt.txt("Back to homepage"))),
                ],
            })(link.toString() as AllLinks)}},
        };
        return {
            pivot: link,
            content: all_content,
        };
    },

    previewReply(body, reply_info) {
        return autoPostContent({
            content: {kind: "text", content: body, markdown_format: "reddit", client_id: client.id},
        })("/@reply-demo");
    },
};

// there's 0 chance this is possible but what if we could automatically extract the urls from the posts to
// make text typesafe
// maybe if we change it to an object like {"/url": u => {…, u}} and call all of them
// ok we can do that actually why not
function linkToPost(text: AllLinks): Generic.Link<Generic.Post> {
    return text as Generic.Link<Generic.Post>;
}

type AutoPostContentProps = {
    content: Generic.Richtext.Paragraph[] | Generic.Body,
};
function autoPostContent(value: AutoPostContentProps): (url: string) => Generic.PostContentPost {
    return (url): Generic.PostContentPost => ({
        kind: "post",
        title: null,
        body: Array.isArray(value.content) ? {kind: "richtext", content: value.content} : value.content,
        collapsible: {default_collapsed: false},

        actions: {
            vote: {
                kind: "counter",
                client_id: client.id,
                unique_id: "VOTE_"+url,
                increment: {
                    icon: "up_arrow",
                    color: "orange",
                    label: "Upvote",
                    undo_label: "Undo Upvote",
                },
                decrement: {
                    icon: "down_arrow",
                    color: "indigo",
                    label: "Downvote",
                    undo_label: "Undo Downvote",
                },
                count_excl_you: 5,
                you: undefined,
                actions: {error: "TODO"},
                time: Date.now(),
            },
        },
        author: {
            name: "pfg___",
            color_hash: "pfg___",
            link: "https://www.reddit.com/user/pfg___",
            client_id: client.id,
        },
    });
}
export type AutoPostProps = {
    parent: null | AllLinks,
    replies: null | AllLinks[],
};
export function autoPost(
    props: AutoPostProps,
    content: AutoPostContentProps | ((url: AllLinks) => Generic.PostContentPost),
): AllContentRawItem {
    return url => {
        const {parent, replies} = props;
        return {
            kind: "post",
            parent: parent != null ? parentLink(linkToPost(parent)) : null,
            replies: replies != null ? repliesLink(url, replies.map(linkToPost)) : null,
            url: url,
            client_id: client.id,
            internal_data: props,
            content: (typeof content === "function" ? content : autoPostContent(content))(url),
        };
    };
}

function u(cb: (v: AllLinks) => Generic.Post): AllContentRawItem {
    return url => cb(url);
}
type AllContentRawItem = (url: AllLinks) => Generic.Post;
type AllLinks = keyof typeof all_content_raw_dontuse;

function parentLink(post: Generic.Link<Generic.Post>): Generic.PostParent {
    return {loader: p2.prefilledVerticalLoader(extra_content, post, undefined)};
}
function repliesLink(post_id: AllLinks, replies: Generic.Link<Generic.Post>[]): Generic.PostReplies {
    return {
        display: "tree",
        loader: p2.prefilledHorizontalLoader(extra_content, p2.stringLink("replies_"+post_id.toString()), replies),
    };
}

const extra_content: Generic.Page2Content = {};

const all_content_raw_dontuse = {
    "/@special-navbar": () => u(url => ({
        kind: "post",
        parent: null,
        replies: null,
        url,
        client_id: client.id,
        internal_data: "",
        content: {
            kind: "client",
            navbar: {
                actions: [],
                inboxes: [],
                client_id: client.id,
            },
        },
    })),
    "/": () => u(url => ({
        kind: "post",
        parent: parentLink(linkToPost("/@special-navbar")),
        replies: null,
        url,
        client_id: client.id,
        internal_data: "",
        content: {
            kind: "special",
            tag_uuid: "LandingPage@-N-ry9qt3N1VTG0iKMHy",
            fallback: {
                kind: "post",
                title: {text: "ThreadClient Home"},
                thumbnail: {kind: "image", url: "/images/threadclient_96.png"},
                body: {kind: "none"},
                collapsible: {default_collapsed: true},
            },
        },
    })),

    "/client-picker": () => autoPost({
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(rt.txt("TODO client picker. should link to homepages for different clients."))],    
    }),

    "/homepage/unthreading": () => autoPost({
        parent: "/",
        replies: ["/homepage/unthreading/0"],
    }, {
        content: [rt.p(
            rt.txt("It often gets difficult to read long comment chains because the indentation gets too deep"),
        )],
    }),
    "/homepage/unthreading/0": () => autoPost({
        parent: "/homepage/unthreading",
        replies: ["/homepage/unthreading/0/0"],
    }, {
        content: [rt.p(
            rt.txt("ThreadClient improves this by unthreading comment chains, like this!"),
        )],
    }),
    "/homepage/unthreading/0/0": () => autoPost({
        parent: "/homepage/unthreading/0",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("Use the toggle switch above to see the difference"),
        )],
    }),

    "/homepage/link-previews": () => autoPost({
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("ThreadClient supports previewing links from many different sources, directly inline."),
        ), rt.p(
            rt.link({id: client.id}, "https://i.redd.it/p0y4mrku6xh61.png", {}, rt.txt("Try it out!")),
        )],
    }),

    "/homepage/repivot": () => autoPost({
        parent: "/",
        replies: ["/homepage/repivot/0", "/homepage/repivot/1"],
    }, {
        content: [rt.p(
            rt.txt(
                "When you're getting deep in a comment thread, press the top bar (next to the username)"
                +" to repivot. ↑",
            ),
        )],
    }),

    "/homepage/repivot/0": () => autoPost({
        parent: "/homepage/repivot",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("Now you can see just the replies to the comment you pressed"),
        )],
    }),
    "/homepage/repivot/1": () => autoPost({
        parent: "/homepage/repivot",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("Use the back button or swipe from the left side of the screen to go back"),
        )],
    }),

    "/homepage/swipe-actions": () => autoPost({
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("something or other"),
        )],
    }),

    "/homepage/syntax-highlighting": () => autoPost({
        parent: "/",
        replies: [],
    }, ((c = (v: string): Generic.Richtext.Paragraph[] => ([
        rt.p(
            rt.txt("Here's my code:"),
        ), {
                kind: "code_block",
                lang: "json",
                text: v,
        },
    ])) => ({
        content: c(JSON.stringify(c("{{value}}"), null, "  "))
    }))()),
    "/homepage/braille-art-fix": () => autoPost({
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("ThreadClient will correctly display braille art on desktop and mobile")
        ), rt.p(
            rt.txt(`
                ⠀⠀⠘⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡜⠀⠀⠀
                ⠀⠀⠀⠑⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡔⠁⠀⠀⠀
                ⠀⠀⠀⠀⠈⠢⢄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠴⠊⠀⠀⠀⠀⠀
                ⠀⠀⠀⠀⠀⠀⠀⢸⠀⠀⠀⢀⣀⣀⣀⣀⣀⡀⠤⠄⠒⠈⠀⠀⠀⠀⠀⠀⠀⠀
                ⠀⠀⠀⠀⠀⠀⠀⠘⣀⠄⠊⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                ⠀
                ⣿⣿⣿⣿⣿⣿⣿⣿⡿⠿⠛⠛⠛⠋⠉⠈⠉⠉⠉⠉⠛⠻⢿⣿⣿⣿⣿⣿⣿⣿
                ⣿⣿⣿⣿⣿⡿⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⢿⣿⣿⣿⣿
                ⣿⣿⣿⣿⡏⣀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣤⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣿⣿
                ⣿⣿⣿⢏⣴⣿⣷⠀⠀⠀⠀⠀⢾⣿⣿⣿⣿⣿⣿⡆⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿
                ⣿⣿⣟⣾⣿⡟⠁⠀⠀⠀⠀⠀⢀⣾⣿⣿⣿⣿⣿⣷⢢⠀⠀⠀⠀⠀⠀⠀⢸⣿
                ⣿⣿⣿⣿⣟⠀⡴⠄⠀⠀⠀⠀⠀⠀⠙⠻⣿⣿⣿⣿⣷⣄⠀⠀⠀⠀⠀⠀⠀⣿
                ⣿⣿⣿⠟⠻⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠶⢴⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⣿
                ⣿⣁⡀⠀⠀⢰⢠⣦⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⡄⠀⣴⣶⣿⡄⣿
                ⣿⡋⠀⠀⠀⠎⢸⣿⡆⠀⠀⠀⠀⠀⠀⣴⣿⣿⣿⣿⣿⣿⣿⠗⢘⣿⣟⠛⠿⣼
                ⣿⣿⠋⢀⡌⢰⣿⡿⢿⡀⠀⠀⠀⠀⠀⠙⠿⣿⣿⣿⣿⣿⡇⠀⢸⣿⣿⣧⢀⣼
                ⣿⣿⣷⢻⠄⠘⠛⠋⠛⠃⠀⠀⠀⠀⠀⢿⣧⠈⠉⠙⠛⠋⠀⠀⠀⣿⣿⣿⣿⣿
                ⣿⣿⣧⠀⠈⢸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠟⠀⠀⠀⠀⢀⢃⠀⠀⢸⣿⣿⣿⣿
                ⣿⣿⡿⠀⠴⢗⣠⣤⣴⡶⠶⠖⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⡸⠀⣿⣿⣿⣿
                ⣿⣿⣿⡀⢠⣾⣿⠏⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠛⠉⠀⣿⣿⣿⣿
                ⣿⣿⣿⣧⠈⢹⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣿⣿⣿⣿
                ⣿⣿⣿⣿⡄⠈⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣴⣾⣿⣿⣿⣿⣿
                ⣿⣿⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿
                ⣿⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
                ⣿⣿⣿⣿⣿⣦⣄⣀⣀⣀⣀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
                ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡄⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
                ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠙⣿⣿⡟⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿
                ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠇⠀⠁⠀⠀⠹⣿⠃⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿
                ⣿⣿⣿⣿⣿⣿⣿⣿⡿⠛⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⢐⣿⣿⣿⣿⣿⣿⣿⣿⣿
                ⣿⣿⣿⣿⠿⠛⠉⠉⠁⠀⢻⣿⡇⠀⠀⠀⠀⠀⠀⢀⠈⣿⣿⡿⠉⠛⠛⠛⠉⠉
                ⣿⡿⠋⠁⠀⠀⢀⣀⣠⡴⣸⣿⣇⡄⠀⠀⠀⠀⢀⡿⠄⠙⠛⠀⣀⣠⣤⣤⠄⠀
            `.trim().split("\n").map(l => l.trim()).join("\n")),
        )],
    }),
    "/homepage/percent-upvoted": () => autoPost({
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("TODO; Demonstrate % upvoted on a post"),
        )],
    }),
    "/homepage/see-comment-markdown": () => autoPost({
        parent: "/",
        replies: [],
    }, {
        content: {kind: "text", client_id: client.id, markdown_format: "reddit", content: ""
             + "I put one line right after another  \n"
             + "Click the 'Code' button below to see how I did it\n"
             + "\n"
             + "TODO; ADD CODE BUTTON CONTAINING THIS"
        },
    }),
    "/homepage/pwa": () => autoPost({
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("TODO; Explain how to install ThreadClient as a PWA"),
        )],
    }),
    "/homepage/offline-mode": () => autoPost({
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("TODO; Support Offline Mode and explain how to use it"),
        )],
    }),
    "/homepage/hide-automod": () => autoPost({
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("TODO; Support 'Hide Automod' and have an example AutoModerator comment below"),
        )],
    }),

    "/changelog": () => autoPost({
        parent: "/",
        replies: [
            // oh we could have sorting options on this. right now it's newest to oldest
            "/changelog/-NCaXsguXmNc8qPj9etM",
            "/changelog/-NBV3onJ3vJScBQJuFSK",
            "/changelog/-N0l8jcINFK5F9MkDcyT",
            "/changelog/-N02c8ctxITU-BqvlytL",
        ],
    }, {
        content: [rt.p(rt.txt("Changelog"))],
    }),
    "/changelog/-NCaXsguXmNc8qPj9etM": changelog4,
    "/changelog/-NBV3onJ3vJScBQJuFSK": changelog3,
    "/changelog/-N0l8jcINFK5F9MkDcyT": changelog2,
    // v we could make changelog entries loaders so they don't have to be loaded in order to load the homepagee
    // put all the changelog stuff in "changelog.ts" or something
    "/changelog/-N02c8ctxITU-BqvlytL": changelog1,
};

// ok changelog display
// we can have a banner on update that doesn't go away until you press "dismiss"
// the banner will store a value "listest viewed changelog" in localstorage. the banner will show if there
// is a changelog available `>` the current localstorage latest. if there is no localstorage latest, set it to
// the current version.

export type ChangelogContent = {
    features?: undefined | Generic.Richtext.Paragraph[],
    changes?: undefined | Generic.Richtext.ListItem[],
    bugfixes?: undefined | Generic.Richtext.ListItem[],
    previews?: undefined | Generic.Richtext.ListItem[],
    internal?: undefined | Generic.Richtext.ListItem[],
};

export function changelogEntry(props: {
    title: string,

    notes?: undefined | Generic.Richtext.Paragraph[],

    merge?: undefined | {[key: string]: ChangelogContent},
} & ChangelogContent): (url: string) => Generic.PostContentPost {
    const merged: ChangelogContent = props;
    for(const itm of Object.values(props.merge ?? {})) {
        // TODO: maybe include a link to all the commits that worked on a feature?
        if(itm.features != null) (merged.features ??= []).push(...(itm.features ?? []));
        for(const mode of ["changes", "bugfixes", "previews", "internal"] as const) {
            if(itm[mode] != null) (merged[mode] ??= []).push(...(itm[mode] ?? []));
        }
    }

    return (url): Generic.PostContentPost => ({
        kind: "post",
        title: {text: props.title},
        body: {kind: "richtext", content: [
            ...(props.notes ?? []),
            ...(props.features != null ? [
                rt.h2(rt.txt("New Features")),
                ...props.features,
            ] : []),
            ...(props.changes != null ? [
                rt.h2(rt.txt("Minor Changes")),
                rt.ul(...props.changes),
            ] : []),
            ...(props.bugfixes != null ? [
                rt.h2(rt.txt("Bugfixes")),
                rt.ul(...props.bugfixes),
            ] : []),
            ...(props.previews != null ? [
                rt.h2(rt.txt("WIP Feature Previews")),
                rt.blockquote(rt.p(rt.txt("These features are not ready yet, but you can try them out before "+
                "release here"))),
                rt.ul(...props.previews),
            ] : []),
            // ...(props.internal != null ? [
            //     rt.h2(rt.txt("WIP Internal Changes")),
            //     rt.blockquote(rt.p(rt.txt("These changes are internal to ThreadClient and will not affect "
            //     +"your experience."))),
            //     rt.ul(...props.internal),
            // ] : []),
        ]},
        // collapsible: {default_collapsed: true},
        collapsible: false, // TODO make this {default_collapsed: true} unless it's the most recent one
    });
}

const evaluated_content = Object.fromEntries(
    Object.entries(all_content_raw_dontuse).map(([k, v]) => [k, {data: v()(k as AllLinks)}]),
);
const all_content: Generic.Page2Content = {...extra_content, ...evaluated_content};
