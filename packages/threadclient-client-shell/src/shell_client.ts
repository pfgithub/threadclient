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

// there's 0 chance this is possible but what if we could automatically extract the urls from the posts to
// make text typesafe
// maybe if we change it to an object like {"/url": u => {…, u}} and call all of them
// ok we can do that actually why not
function linkToPost(text: AllLinks): Generic.Link<Generic.Post> {
    return text as Generic.Link<Generic.Post>;
}

function autoPostContent(value: {content: Generic.Richtext.Paragraph[], url: string}): Generic.PostContentPost {
    return {
        kind: "post",
        title: null,
        body: {kind: "richtext", content: value.content},
        show_replies_when_below_pivot: true,
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
function autoPost<T extends string>(value: {
    url: T,
    content: Generic.Richtext.Paragraph[],
    parent: null | string,
    replies: null | string[],
}): AllContentRawItemExtends<T> {
    const {url, parent, replies} = value;
    return {v: value.url, post: {
        kind: "post",
        parent: parent != null ? linkToPost(parent) : null,
        replies: replies != null ? {items: replies.map(linkToPost)} : null,
        url: url,
        client_id: client.id,
        internal_data: value,
        display_style: "centered",
        content: autoPostContent({url, content: value.content}),
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
            rt.txt("Unthreading"),
        )],
        parent: "/",
        replies: ["/homepage/unthreading/0"],
    }),
    autoPost({
        url: "/homepage/unthreading/0",
        content: [rt.p(
            rt.txt("It often gets difficult to read long comment chains because the indentation gets too deep"),
        )],
        parent: "/homepage/unthreading",
        replies: ["/homepage/unthreading/0/0"],
    }),
    autoPost({
        url: "/homepage/unthreading/0/0",
        content: [rt.p(
            rt.txt("ThreadClient improves this by unthreading comment chains, like this!"),
        )],
        parent: "/homepage/unthreading/0",
        replies: ["/homepage/unthreading/0/0/0"],
    }),
    autoPost({
        url: "/homepage/unthreading/0/0/0",
        content: [rt.p(
            rt.txt("Use the toggle switch above to see the difference"),
        )],
        parent: "/homepage/unthreading/0/0",
        replies: [],
    }),

    autoPost({
        url: "/homepage/link-previews",
        content: [rt.p(
            rt.txt("ThreadClient supports previewing links from many different sources, directly inline."),
        ), rt.p(
            rt.link({id: client.id}, "TODO a link", {}, rt.txt("Try it out!")),
        )],

        parent: "/",
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
];
const all_content: Generic.Page2Content = Object.fromEntries(
    all_content_raw_dontuse.map(itm => [itm.v, {data: itm.post}]),
);
