import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { ThreadClient } from "threadclient-client-base";

export const client: ThreadClient = {
    id: "shell",

    async getPage(path: string): Promise<Generic.Page2> {
        // we can just return all the content i guess
        // might be nice if we structured it so it can be dynamically imported in the future but this
        // is okay for now
        const link = linkToPost("/"+path.split("/").filter(v => v).join("/"));
        if(all_content[link] == null) return {
            pivot: link,
            content: {[link]: {data: autoPost({
                url: link as string,
                parent: null,
                replies: null,
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
    }
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
    url: string,
    show_replies_when_below_pivot?: undefined | boolean,
};
function autoPostContent(value: AutoPostContentProps): Generic.PostContentPost {
    return {
        kind: "post",
        title: null,
        body: Array.isArray(value.content) ? {kind: "richtext", content: value.content} : value.content,
        show_replies_when_below_pivot: value.show_replies_when_below_pivot ?? true,
        collapsible: {default_collapsed: false},

        actions: {
            vote: {
                kind: "counter",
                client_id: client.id,
                unique_id: "VOTE_"+value.url,
                increment: {
                    icon: "up_arrow",
                    color: "reddit-upvote",
                    label: "Upvote",
                    undo_label: "Undo Upvote",
                },
                decrement: {
                    icon: "down_arrow",
                    color: "reddit-downvote",
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
    };
}
type AutoPostProps<T> = {
    url: T,
    parent: null | string,
    replies: null | string[],
} & AutoPostContentProps;
function autoPost<T extends string>(value: AutoPostProps<T>): AllContentRawItemExtends<T> {
    const {url, parent, replies} = value;
    return {v: value.url, post: {
        kind: "post",
        parent: parent != null ? linkToPost(parent) : null,
        replies: replies != null ? {items: replies.map(linkToPost)} : null,
        url: url,
        client_id: client.id,
        internal_data: value,
        display_style: "centered",
        content: autoPostContent(value),
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
            fallback: autoPostContent({
                url,
                content: [
                    rt.p(rt.error("TODO fallback", 0)),
                ],
            }),
        },
    })),

    autoPost({
        url: "/homepage/unthreading",
        content: [rt.p(
            rt.txt("It often gets difficult to read long comment chains because the indentation gets too deep"),
        )],
        parent: "/",
        replies: ["/homepage/unthreading/0"],
    }),
    autoPost({
        url: "/homepage/unthreading/0",
        content: [rt.p(
            rt.txt("ThreadClient improves this by unthreading comment chains, like this!"),
        )],
        parent: "/homepage/unthreading",
        replies: ["/homepage/unthreading/0/0"],
    }),
    autoPost({
        url: "/homepage/unthreading/0/0",
        content: [rt.p(
            rt.txt("Use the toggle switch above to see the difference"),
        )],
        parent: "/homepage/unthreading/0",
        replies: [],
    }),

    autoPost({
        url: "/homepage/link-previews",
        content: [rt.p(
            rt.txt("ThreadClient supports previewing links from many different sources, directly inline."),
        ), rt.p(
            rt.link({id: client.id}, "https://i.redd.it/p0y4mrku6xh61.png", {}, rt.txt("Try it out!")),
        )],

        parent: "/",
        replies: [],
    }),

    autoPost({
        url: "/homepage/repivot",
        content: [rt.p(
            rt.txt(
                "When you're getting deep in a comment thread, press the top bar (next to the username)"
                +" to repivot. ↑",
            ),
        )],
        show_replies_when_below_pivot: false,

        parent: "/",
        replies: ["/homepage/repivot/0", "/homepage/repivot/1"],
    }),

    autoPost({
        url: "/homepage/repivot/0",
        content: [rt.p(
            rt.txt("Now you can see just the replies to the comment you pressed"),
        )],

        parent: "/homepage/repivot",
        replies: [],
    }),
    autoPost({
        url: "/homepage/repivot/1",
        content: [rt.p(
            rt.txt("Use the back button or swipe from the left side of the screen to go back"),
        )],

        parent: "/homepage/repivot",
        replies: [],
    }),

    autoPost({
        url: "/homepage/swipe-actions",
        content: [rt.p(
            rt.txt("something or other"),
        )],

        parent: "/",
        replies: [],
    }),

    autoPost(((c = (v: string): AutoPostProps<"/homepage/syntax-highlighting"> => ({
        url: "/homepage/syntax-highlighting",
        content: [rt.p(
            rt.txt("Here's my code:"),
        ), {
            kind: "code_block",
            lang: "json",
            text: v,
        }],

        parent: "/",
        replies: [],
    })) => c(JSON.stringify(c("{{value}}"), null, "  ")))()),
    autoPost({
        url: "/homepage/braille-art-fix",
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

        parent: "/",
        replies: [],
    }),
    autoPost({
        url: "/homepage/percent-upvoted",
        content: [rt.p(
            rt.txt("TODO; Demonstrate % upvoted on a post"),
        )],

        parent: "/",
        replies: [],
    }),
    autoPost({
        url: "/homepage/see-comment-markdown",
        content: {kind: "text", client_id: client.id, markdown_format: "reddit", content: ""
             + "I put one line right after another  \n"
             + "Click the 'Code' button below to see how I did it\n"
             + "\n"
             + "TODO; ADD CODE BUTTON CONTAINING THIS"
        },

        parent: "/",
        replies: [],
    }),
    autoPost({
        url: "/homepage/pwa",
        content: [rt.p(
            rt.txt("TODO; Explain how to install ThreadClient as a PWA"),
        )],

        parent: "/",
        replies: [],
    }),
    autoPost({
        url: "/homepage/offline-mode",
        content: [rt.p(
            rt.txt("TODO; Support Offline Mode and explain how to use it"),
        )],

        parent: "/",
        replies: [],
    }),
    autoPost({
        url: "/homepage/hide-automod",
        content: [rt.p(
            rt.txt("TODO; Support 'Hide Automod' and have an example AutoModerator comment below"),
        )],

        parent: "/",
        replies: [],
    }),
];
const all_content: Generic.Page2Content = Object.fromEntries(
    all_content_raw_dontuse.map(itm => [itm.v, {data: itm.post}]),
);
