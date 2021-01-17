import * as Generic from "../types/generic.js";
import {ThreadClient} from "./base.js";

declare namespace Mastodon {
    type Media = {
        id: string,
        type: "video" | "todo",
        url: string,
        preview_url: string,
        remote_url: string,
        preview_remote_url: string | null,
        text_url: string | null,
        meta: {
            original: {
                width: number,
                height: number,
                frame_rate: string,// probably only on video
                duration: string, //  probably only on video
                bitrate: string, //   probably only on video. todo.
            },
            small: {
                width: number,
                height: number,
                // size: string, // width + "x" + height
                // aspect: number, // width / height
            },
        },
        mentions: never[],
        tags: never[],
        emojis: never[],
        card: null,
        poll: null,
    };
    type Post = {
        id: string,
        created_at: string,
        in_reply_to_id: null | string,
        in_reply_to_account_id: null | string,
        sensitive: boolean,
        spoiler_text: string,
        visibility: "public",
        language: string,
        uri: string,
        url: string,
        replies_count: number,
        reblogs_count: number,
        favourites_count: number,
        content: string, // unsafe html
        // reblog: ?
        account: {
            id: string,
            username: string,
            acct: string,
            display_name: string,
            url: string,
        },
        media_attachments: Media,
    };
}

export function mastodon() {
    const res: ThreadClient = {
        id: "mastodon",
        links: () => [],
        isLoggedIn: () => false,
        getLoginURL: () => "/404",
        login: () => {throw new Error("nah");},

        getThread: async (pathraw) => {
            const pathsplit = pathraw.split("/");
            if(pathsplit.length < 2) return {
                header: {
                    kind: "thread",
                    title: {text: "Error"},
                    body: {
                        kind: "text",
                        content: `404 not found`,
                        markdown_format: "none",
                    },
                    display_mode: {
                        body: "visible",
                        comments: "collapsed",
                    },
                    link: "TODO no link",
                    layout: "error",
                    info: {time: 0,
                        author: {name: "no one", link: "TODO no link"},
                    },
                    actions: [],
                    default_collapsed: false,
                },
                display_style: "comments-view",
            };
            const [_, host, ...path] = pathsplit;

            const finalurl = "https://"+decodeURIComponent(host)+"/api/v1/"+path.join("/");

            const [status, posts] = await fetch(finalurl).then(async (v) => {
                return [v.status, await v.json() as Mastodon.Post[]] as const;
            });
            if(status !== 200) {
                console.log("Error! got", posts, "with status code", status);
                throw new Error("Status code "+status);
            }

            console.log(posts);

            const res: Generic.Page = {
                header: {
                    kind: "thread",
                    title: {text: "Listing"},
                    body: {kind: "text", content: "Listing", markdown_format: "none"},
                    display_mode: {body: "collapsed", comments: "collapsed"},
                    link: "TODO no link",
                    layout: "error",
                    info: {time: 0,
                        author: {name: "no one", link: "TODO no link"},
                    },
                    actions: [],
                    default_collapsed: false,
                },
                replies: posts.map(post => {
                    const res: Generic.Thread = {
                        kind: "thread",
                        body: {kind: "text", content: post.content, markdown_format: "none"},
                        display_mode: {body: "visible", comments: "collapsed"},
                        link: "TODO no link",
                        layout: "error",
                        info: {time: new Date(post.created_at).getTime(),
                            author: {name: post.account.display_name + " ("+post.account.acct+")", link: post.account.url},
                        },
                        actions: [],
                        default_collapsed: false,
                        raw_value: post,
                    };
                    return res;
                }),
                display_style: "comments-view",
            };
            return res;
        },
    };
    return res;
}