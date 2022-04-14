import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { ThreadClient } from "threadclient-client-base";

export const client: ThreadClient = {
    id: "shell",

    async getPage(path: string): Promise<Generic.Page2> {
        // we can just return all the content i guess
        // might be nice if we structured it so it can be dynamically imported in the future but this
        // is okay for now
        return {
            pivot: linkToPost("/"+path.split("/").filter(v => v).join("/")),
            content: all_content,
        };
    }
};

function linkToPost(text: string): Generic.Link<Generic.Post> {
    return text as Generic.Link<Generic.Post>;
}

function autoPost(value: {
    url: string,
    content: Generic.Richtext.Paragraph[],
    parent: null | string,
    replies: null | string[],
}): Generic.Post {
    const {url, parent, replies} = value;
    return {
        kind: "post",
        parent: parent != null ? linkToPost(parent) : null,
        replies: replies != null ? {items: replies.map(linkToPost)} : null,
        url: url,
        client_id: client.id,
        internal_data: value,
        display_style: "centered",
        content: {
            kind: "post",
            title: null,
            body: {kind: "richtext", content: value.content},
            show_replies_when_below_pivot: true,
            collapsible: {default_collapsed: false},

            actions: {
                vote: {
                    kind: "counter",
                    client_id: client.id,
                    unique_id: "VOTE_"+url,
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
        },
    };
}

const all_content: Generic.Page2Content = Object.fromEntries([
    autoPost({
        url: "/",
        content: [],
        parent: null,
        replies: ["/homepage/unthreading", "/homepage/swipe-actions"],
    }),

    autoPost({
        url: "/homepage/unthreading",
        content: [rt.p(
            rt.txt("It often gets difficult to read long comment chains because the indentation gets too deep"),
        )],
        parent: null,
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
            rt.link({id: client.id}, "TODO a link", {}, rt.txt("Try it out!")),
        )],

        parent: null,
        replies: [],
    }),

    autoPost({
        url: "/homepage/swipe-actions",
        content: [rt.p(
            rt.txt("something or other"),
        )],

        parent: null,
        replies: [],
    }),
].map((v: Generic.Post): [Generic.Link<Generic.Post>, Generic.Page2Content[Generic.Link<Generic.Post>]] => [
    linkToPost(v.url ?? (() => {throw new Error("no url")})()), {data: v},
]));
