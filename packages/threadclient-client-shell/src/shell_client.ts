import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { ThreadClient } from "threadclient-client-base";

export const client: ThreadClient = {
    id: "shell",

    async getPage(path: string): Promise<Generic.Page2> {
        // we can just return all the content i guess
        // might be nice if we structured it so it can be dynamically imported in the future but this
        // is okay for now
        const link = linkToPost("/"+path.split("/").filter(v => v && !v.startsWith("~")).join("/"));
        if(all_content[link] == null) return {
            pivot: link,
            content: {[link]: {data: autoPost({
                url: link as string,
                parent: null,
                replies: null,
            }, {
                content: [
                    rt.p(rt.error("404 not found", "ERROR")),
                    rt.p(rt.link({id: client.id}, "/", {}, rt.txt("Back to homepage"))),
                ],
            }).post}},
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
type AutoPostProps<T> = {
    url: T,
    parent: null | AllLinks,
    replies: null | AllLinks[],
};
function autoPost<T extends string>(
    props: AutoPostProps<T>,
    content: AutoPostContentProps | ((url: T) => Generic.PostContentPost),
): AllContentRawItemExtends<T> {
    const {url, parent, replies} = props;
    return {v: props.url, post: {
        kind: "post",
        parent: parent != null ? linkToPost(parent) : null,
        replies: replies != null ? {display: "tree", items: replies.map(linkToPost)} : null,
        url: url,
        client_id: client.id,
        internal_data: props,
        display_style: "centered",
        content: (typeof content === "function" ? content : autoPostContent(content))(url),
    }};
}

function u<V extends string>(v: V, cb: (v: V) => Generic.Post): AllContentRawItemExtends<V> {
    return {v, post: cb(v)};
}
type AllContentRawItemExtends<V> = {
    v: V,
    post: Generic.Post,
};
// type AllLinks = (typeof all_content_raw_dontuse)["v"];
// ^ dang it circular references. i think we have to use a Record<string, post> instead.
type AllLinks = string;

const all_content_raw_dontuse = [
    u("/@special-navbar", url => ({
        kind: "post",
        parent: null,
        replies: null,
        url,
        client_id: client.id,
        internal_data: "",
        display_style: "centered",
        content: {
            kind: "client",
            navbar: {
                actions: [],
                inboxes: [],
            },
        },
    })),
    u("/", url => ({
        kind: "post",
        parent: linkToPost("/@special-navbar"),
        replies: null,
        url,
        client_id: client.id,
        internal_data: "",
        display_style: "centered",
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

    autoPost({
        url: "/client-picker",
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(rt.txt("TODO client picker. should link to homepages for different clients."))],    
    }),

    autoPost({
        url: "/homepage/unthreading",
        parent: "/",
        replies: ["/homepage/unthreading/0"],
    }, {
        content: [rt.p(
            rt.txt("It often gets difficult to read long comment chains because the indentation gets too deep"),
        )],
    }),
    autoPost({
        url: "/homepage/unthreading/0",
        parent: "/homepage/unthreading",
        replies: ["/homepage/unthreading/0/0"],
    }, {
        content: [rt.p(
            rt.txt("ThreadClient improves this by unthreading comment chains, like this!"),
        )],
    }),
    autoPost({
        url: "/homepage/unthreading/0/0",
        parent: "/homepage/unthreading/0",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("Use the toggle switch above to see the difference"),
        )],
    }),

    autoPost({
        url: "/homepage/link-previews",
        
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("ThreadClient supports previewing links from many different sources, directly inline."),
        ), rt.p(
            rt.link({id: client.id}, "https://i.redd.it/p0y4mrku6xh61.png", {}, rt.txt("Try it out!")),
        )],
    }),

    autoPost({
        url: "/homepage/repivot",
        
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

    autoPost({
        url: "/homepage/repivot/0",
        
        parent: "/homepage/repivot",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("Now you can see just the replies to the comment you pressed"),
        )],
    }),
    autoPost({
        url: "/homepage/repivot/1",
        
        parent: "/homepage/repivot",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("Use the back button or swipe from the left side of the screen to go back"),
        )],
    }),

    autoPost({
        url: "/homepage/swipe-actions",
        
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("something or other"),
        )],
    }),

    autoPost({
        url: "/homepage/syntax-highlighting",
            
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
    autoPost({
        url: "/homepage/braille-art-fix",

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
    autoPost({
        url: "/homepage/percent-upvoted",
        
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("TODO; Demonstrate % upvoted on a post"),
        )],
    }),
    autoPost({
        url: "/homepage/see-comment-markdown",
        
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
    autoPost({
        url: "/homepage/pwa",
        
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("TODO; Explain how to install ThreadClient as a PWA"),
        )],
    }),
    autoPost({
        url: "/homepage/offline-mode",
        
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("TODO; Support Offline Mode and explain how to use it"),
        )],
    }),
    autoPost({
        url: "/homepage/hide-automod",
        
        parent: "/",
        replies: [],
    }, {
        content: [rt.p(
            rt.txt("TODO; Support 'Hide Automod' and have an example AutoModerator comment below"),
        )],
    }),

    autoPost({
        url: "/changelog",
        
        parent: "/",
        replies: [
            // oh we could have sorting options on this
            "/changelog/-N02c8ctxITU-BqvlytL"
        ],
    }, {
        content: [rt.p(rt.txt("Changelog"))],
    }),
    // v we could make changelog entries loaders so they don't have to be loaded in order to load the homepagee
    // put all the changelog stuff in "changelog.ts" or something
    autoPost({
        url: "/changelog/-N02c8ctxITU-BqvlytL", // "/~ThreadClient-Apr-19.-2022",
        parent: "/changelog",
        replies: [],
        // vv we could implement these as replies instead of just a richtext list
    }, changelogEntry({
        title: "Apr 19, 2022 ThreadClient Update",

        changes: [
            rt.ili(rt.txt("Added a changelog and a banner when a new version is released. Disable in "),
                rt.link({id: ""}, "/settings", {}, rt.txt("Settings")),
            ),
            rt.ili(rt.txt("New colors - the background grays are a bit different. This improves contrast in dark "
            +"mode and makes the colors more consistent across the UI.")),
            rt.ili(rt.txt("Fancy new animated toggle switch in "),
                rt.link({id: ""}, "/settings", {}, rt.txt("Settings")),
            ),
            rt.ili(rt.txt("Updates the focus outline color to be more visible when tabbing through elements")),
        ],
        bugfixes: [
            rt.ili(rt.txt("Fixed headers not having the gradient")),
            rt.ili(rt.txt("Fixed unnecessary reloads when using the browser url bar to navigate to a new page")),
            rt.ili(rt.txt("Fixes flairs so the text should always be readable")),
        ],
        previews: [
            rt.ili(
                rt.txt("Started work on a new landing page for ThreadClient. You can see it at "),
                rt.link({id: client.id}, "/", {}, rt.txt("https://thread.pfg.pw/#shell")),
            ),
            rt.ili(
                rt.txt("Updated title links in page2 to act as a repivot rather than a full reload"),
            ),
            rt.ili(rt.txt("Set titles of some page2 pages now")),
        ],
    })),
];

// ok changelog display
// we can have a banner on update that doesn't go away until you press "dismiss"
// the banner will store a value "listest viewed changelog" in localstorage. the banner will show if there
// is a changelog available `>` the current localstorage latest. if there is no localstorage latest, set it to
// the current version.

function changelogEntry(props: {
    title: string,

    features?: undefined | Generic.Richtext.Paragraph[],
    changes?: undefined | Generic.Richtext.ListItem[],
    bugfixes?: undefined | Generic.Richtext.ListItem[],
    previews?: undefined | Generic.Richtext.ListItem[],
}): (url: string) => Generic.PostContentPost {
    return (url): Generic.PostContentPost => ({
        kind: "post",
        title: {text: props.title},
        body: {kind: "richtext", content: [
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
        ]},
        // collapsible: {default_collapsed: true},
        collapsible: false, // TODO make this {default_collapsed: true} unless it's the most recent one
    });
}

const all_content: Generic.Page2Content = Object.fromEntries(
    all_content_raw_dontuse.map(itm => [itm.v, {data: itm.post}]),
);
