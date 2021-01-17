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

const error404 = (): Generic.Page => ({
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
});
const genericHeader = (): Generic.Thread => ({
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
});
const mkurl = (host: string, ...bits: string[]): string => {
    return "https://"+host+"/api/"+bits.join("/");
}
const getResult = async<T>(url: string): Promise<T> => {
    const [status, posts] = await fetch(url).then(async (v) => {
        return [v.status, await v.json() as T] as const;
    });
    if(status !== 200) {
        console.log("Error! got", posts, "with status code", status);
        throw new Error("Status code "+status);
    }
    return posts;
}
const postArrayToReparentedThread = (host: string, root: Mastodon.Post, posts: Mastodon.Post[]): Generic.Thread => {
    const root_thread = postToThread(host, root);
    const id_map = new Map<string, Generic.Thread>();
    id_map.set(root.id, root_thread);
    for(const post of posts) {
        const parent_id = post.in_reply_to_id ?? "nope";
        let parent_v = id_map.get(parent_id);
        if(!parent_v) {
            console.log("Missing parent id in reparented thread", parent_id);
            alert("Reparenting error, check console");
            parent_v = root_thread;
        }
        const thispost = postToThread(host, post);
        if(!parent_v.replies) parent_v.replies = [];
        parent_v.replies.push(thispost);
        id_map.set(post.id, thispost);
    }
    return root_thread;
};
const postToThread = (host: string, post: Mastodon.Post, opts: {replies?: Generic.Thread[]} = {}): Generic.Thread => {
    const res: Generic.Thread = {
        kind: "thread",
        body: {kind: "text", content: post.content, markdown_format: "unsafe-html"},
        display_mode: {body: "visible", comments: "collapsed"},
        link: "/"+host+"/statuses/"+post.id,
        layout: "reddit-comment",
        info: {time: new Date(post.created_at).getTime(),
            author: {name: post.account.display_name + " (@"+post.account.acct+")", link: post.account.url},
        },
        flair: post.sensitive ? [{content_warning: true, elems: [{type: "text", text: post.spoiler_text ?? "*no label*"}]}] : undefined,
        actions: [],
        default_collapsed: false,
        raw_value: post,
        replies: opts.replies,
    };
    return res;
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
            if(pathsplit.length < 2) return error404();
            const [_, host, ...path] = pathsplit;

            if(path[0] === "timelines") {
                const posts = await getResult<Mastodon.Post[]>(mkurl(host, "v1", ...path));

                const res: Generic.Page = {
                    header: genericHeader(),
                    replies: posts.map(post => postToThread(host, post)),
                    display_style: "comments-view",
                };
                return res;
            }else if(path[0] === "statuses") {
                if(!path[1]) return error404();
                const postid = path[1];
                const postinfo = await getResult<Mastodon.Post>(mkurl(host, "v1", "statuses", postid));
                const context = await getResult<{ancestors: Mastodon.Post[], descendants: Mastodon.Post[]}>(mkurl(host, "v1", "statuses", postid, "context"));
                
                const res: Generic.Page = {
                    header: genericHeader(),
                    replies: [
                        ...context.ancestors.map(a => postToThread(host, a)),
                        postArrayToReparentedThread(host, postinfo, context.descendants),
                    ],
                    display_style: "comments-view",
                };
                return res;
            }
            return error404();
        },
    };
    return res;
}