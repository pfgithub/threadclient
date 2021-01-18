import { escapeHTML, query } from "../app.js";
import * as Generic from "../types/generic.js";
import {ThreadClient} from "./base.js";

const redirectURI = (host: string) => "https://"+location.host+"/login/mastodon/"+host; // a bit cheaty hmm

type ImageMeta = {
    width: number,
    height: number,
};
type VideoMeta = { // video | gifv
    width: number,
    height: number,
    frame_rate: string,// #/# eg 20/1
    duration: string, // # secs
    bitrate: string, //
};

declare namespace Mastodon {
    type Emoji = never;
    type Media = {
        id: string,
        type: "video" | "image" | "gifv" | "todo",

        url: string,
        preview_url: string,

        description?: string,

        preview_remote_url: string | null,
        text_url: string | null,
        meta: {
            original: ImageMeta | VideoMeta,
            small: ImageMeta,
        },
    };
    type Poll = {
        id: string,
        expires_at: string,
        expired: boolean,
        multiple: boolean,
        votes_count: number,
        voters_count: null,
        voted: boolean,
        own_votes: number[] | null,
        options: {title: string, votes_count: number}[],
    };
    type Post = {
        id: string,
        created_at: string,
        in_reply_to_id: null | string,
        in_reply_to_account_id: null | string,
        sensitive: boolean,
        spoiler_text: string,
        visibility: "public",
        language: string, // iso language code
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

            avatar: string,
            avatar_static: string,
        },
        media_attachments: Media[],
        mentions: never[],
        tags: never[],
        emojis: Emoji[],
        card: null,
        poll: null | Poll,
    };
}

const error404 = (msg: string = "404 not found"): Generic.Page => ({
    header: {
        kind: "thread",
        title: {text: "Error"},
        body: {
            kind: "text",
            content: msg,
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
    return "https://"+host+"/"+bits.join("/");
}
const getResult = async<T>(auth: TokenResult | undefined, url: string): Promise<T | {error: string}> => {
    try {
        const [status, posts] = await fetch(url, {
            headers: {
                "Accept": "application/json",
                ...auth ? {
                    'Authorization': auth.token_type + " " + auth.access_token
                } : {},
            },
        }).then(async (v) => {
            return [v.status, await v.json() as T | {error: string}] as const;
        });
        return posts;
    }catch(e) {
        return {error: "Failed to load! "+e.toString()};
    }
}
const postArrayToReparentedTimeline = (host: string, posts: Mastodon.Post[]): Generic.Thread[] => {
    return posts.map(post => {
        let thread = postToThread(host, post);
        if(post.in_reply_to_id) {
            const parentlink = "/"+host+"/statuses/"+post.in_reply_to_id;
            thread = {
                kind: "thread",
                body: {
                    kind: "text",
                    content: "<a href=\""+escapeHTML(parentlink)+"\">View Parent</a>",
                    markdown_format: "mastodon",
                },
                display_mode: {body: "visible", comments: "collapsed"},
                link: parentlink,
                layout: "mastodon-post",
                default_collapsed: false,
                actions: [],
                raw_value: parentlink,
                replies: [thread],
            };
        }
        return thread;
    });
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
const mediaToGalleryItem = (host: string, media: Mastodon.Media): Generic.GalleryItem => {
    
    let resbody: Generic.Body;
    if(media.type === "image") {
        resbody = {kind: "captioned_image", url: media.url, w: media.meta.original.width, h: media.meta.original.height, caption: media.description};
    } else if(media.type === "video" || media.type === "gifv") {
        resbody = {kind: "video", url: media.url, w: media.meta.original.width, h: media.meta.original.height, gifv: media.type === "gifv"};
    } else {
        resbody = {kind: "link", url: media.url};
    }

    return {thumb: media.preview_url, w: media.meta.small.width, h: media.meta.small.height, body: resbody};
}
const as = <T>(v: T): T => v;
const postToThread = (host: string, post: Mastodon.Post, opts: {replies?: Generic.Thread[]} = {}): Generic.Thread => {
    const res: Generic.Thread = {
        kind: "thread",
        body: {
            kind: "text",
            content: post.content,
            markdown_format: "mastodon",

            attached_media: [post.media_attachments.length === 0 ? undefined :
                {kind: "gallery", images: post.media_attachments.map(ma => mediaToGalleryItem(host, ma))},
                post.poll ? {kind: "poll",
                    choices: post.poll.options.map((opt, i) => ({name: opt.title, votes: opt.votes_count, id: "" + i})),
                    total_votes: post.poll.votes_count,
                    votable: post.poll.expired ? "Expired" : true,
                    vote_data: post.poll.id,
                    select_many: post.poll.multiple,
                    your_votes: (post.poll.own_votes ?? []).map(ov => ({id: "" + ov})),
                } : undefined,
            ],
        },
        display_mode: {body: "visible", comments: "collapsed"},
        link: "/"+host+"/statuses/"+post.id,
        layout: "mastodon-post",
        info: {time: new Date(post.created_at).getTime(),
            author: {
                name: post.account.display_name + " (@"+post.account.acct+")",
                link: post.account.url,
                pfp: {
                    url: post.account.avatar_static,
                    hover: post.account.avatar,
                },
            },
        },
        flair: post.sensitive || post.spoiler_text ? [{content_warning: post.sensitive, elems: [{type: "text", text: post.spoiler_text || "Sensitive"}]}] : undefined,
        actions: [{kind: "link", url: "/"+host+"/statuses/"+post.id, text: post.replies_count + " repl"+(post.replies_count === 1 ? "y" : "ies")}],
        default_collapsed: false,
        raw_value: post,
        replies: opts.replies,
    };
    return res;
}
const splitURL = (path: string): [string, URLSearchParams] => {
    const [pathname, ...query] = path.split("?");
    return [pathname, new URLSearchParams(query.join("?"))];
}
const updateQuery = (path: string, update: {[key: string]: string | undefined}) => {
    const [pathname, query] = splitURL(path);
    for(const [k, v] of Object.entries(update)) {
        if(v) query.set(k, v);
        else query.delete(k);
    }
    return pathname + "?" + query.toString();
};
type ApplicationResult = {
    client_id: string,
    client_secret: string,
    id: string,
    name: string,
    redirect_uri: string,
    vapid_key: string,
    website: string,
};
type TokenResult = {
    access_token: string,
    created_at: number, // seconds
    scope: string,
    token_type: "Bearer",
};
const getLoginURL = (host: string, appres: ApplicationResult) => {
    return "https://"+host+"/oauth/authorize?"+query({
        client_id: appres.client_id,
        scope: "read write follow push",
        redirect_uri: redirectURI(host),
        response_type: "code"
    });
};
const lsnameonly = {
    app: (host: string) => "mastodon-application-"+host,
    token: (host: string) => "mastodon-secret-"+host,
    client_credentials: (host: string) => "mastodon-client-secret-"+host,
};
const lsgetter = <T>(namegtr: (host: string) => string): {
    get: (host: string) => T | undefined,
    set: (host: string, newval: T | undefined) => void,
} => {
    return {
        get(host): undefined | T {
            if(!host) return undefined;
            const rtxt = localStorage.getItem(namegtr(host));
            if(!rtxt) return undefined;
            return JSON.parse(rtxt) as T;

        },
        set(host, newval) {
            if(!host) {
                console.log(host, newval);
                alert("bad set. check console.");
                throw new Error("set performed with no host");
            }
            localStorage.setItem(namegtr(host), JSON.stringify(newval));
        }
    };
}
const lsitems = {
    app: lsgetter<{host: string, data: ApplicationResult}>((host: string) => "mastodon-application-"+host),
    token: lsgetter<TokenResult>((host: string) => "mastodon-secret-"+host),
    client_creds: lsgetter<TokenResult>((host: string) => "mastodon-client-secret-"+host),
    client_did_error: lsgetter<boolean>((host: string) => "mastodon-client-did-error-"+host),
};
export function mastodon() {
    const isLoggedIn = (host: string) => {
        return !!lsitems.token.get(host);
    };
    const getAuth = async (host: string): Promise<undefined | TokenResult> => {
        if(!host) return undefined;
        const authv = lsitems.token.get(host) ?? lsitems.client_creds.get(host);
        if(!authv) {
            const appraw = lsitems.app.get(host);
            if(!appraw || lsitems.client_did_error.get(host)) return undefined;

            const {data: app} = appraw;

            const resv: {error: string} | TokenResult = await fetch(mkurl(host, "oauth", "token"), {
                method: "post", mode: "cors", credentials: "omit",
                headers: {
                    'Content-Type': "application/json",
                    'Accept': "application/json",
                },
                body: JSON.stringify({
                    client_id: app.client_id,
                    client_secret: app.client_secret,
                    redirect_uri: redirectURI(host),
                    grant_type: "client_credentials",
                }),
            }).then(v => v.json());

            if('error' in resv) {
                lsitems.client_did_error.set(host, true);
                console.log(resv);
                alert("failed to get application token. will not try again. :: "+resv.error);
                return undefined;
            }

            lsitems.client_creds.set(host, resv);

            return resv;
        };
        return authv;
    };

    const res: ThreadClient = {
        id: "mastodon",
        links: () => [],
        isLoggedIn: (pathraw: string) => {
            const [_, host] = pathraw.split("/");
            if(!host) return false;
            return isLoggedIn(host);
        },
        loginURL: async (pathraw: string): Promise<string> => {

            const pathsplit = pathraw.split("/");
            const [_, host] = pathsplit;
            if(!host) throw new Error("can't login without selecting host first");

            const preapp = lsitems.app.get(host);
            if(preapp) {
                if(preapp.host !== host) throw new Error("This should never happen.");
                return getLoginURL(host, preapp.data);
            }

            const resv: {error: string} | ApplicationResult = await fetch(mkurl(host, "api/v1", "apps"), {
                method: "post", mode: "cors", credentials: "omit",
                headers: {
                    'Content-Type': "application/json",
                    'Accept': "application/json",
                },
                body: JSON.stringify({
                    client_name: "ThreadReader",
                    redirect_uris: redirectURI(host),
                    scopes: "read write follow push",
                    website: "https://thread.pfg.pw",
                }),
            }).then(v => v.json());

            if('error' in resv) {
                console.log(resv);
                throw new Error("Got error:"+resv.error);
            }
            lsitems.app.set(host, {host, data: resv});

            return getLoginURL(host, resv);
        },
        login: async (path, query) => {
            if(path.length !== 2) throw new Error("bad login");
            const [_, host] = path;
            const code = query.get("code");
            if(!code) throw new Error("missing code");

            const appv = lsitems.app.get(host);
            if(!appv) {
                throw new Error("An app was not registered - how did you even get here?");
            }
            const {data: app} = appv;

            const resv: {error: string} | TokenResult = await fetch(mkurl(host, "oauth", "token"), {
                method: "post", mode: "cors", credentials: "omit",
                headers: {
                    'Content-Type': "application/json",
                    'Accept': "application/json",
                },
                body: JSON.stringify({
                    client_id: app.client_id,
                    client_secret: app.client_secret,
                    redirect_uri: redirectURI(host),
                    grant_type: "authorization_code",
                    code,
                    scope: "read write follow push",
                }),
            }).then(v => v.json());

            if('error' in resv) {
                console.log(resv);
                throw new Error("Got error (check console): "+resv.error);
            }

            lsitems.token.set(host, resv);

            console.log(resv);
        },

        getThread: async (pathraw) => {
            const pathsplit = pathraw.split("/");
            if(pathsplit.length < 2) return error404();
            const [_, host, ...path] = pathsplit;

            const auth = await getAuth(host);

            if(path[0] === "timelines") {
                const urlbits = path.join("/");
                const thisurl = mkurl(host, "api/v1", urlbits);
                const posts = await getResult<Mastodon.Post[]>(auth, thisurl);

                if('error' in posts) return error404("Error! "+posts.error);

                const last_post = posts[posts.length - 1];

                const res: Generic.Page = {
                    header: genericHeader(),
                    replies: [...postArrayToReparentedTimeline(host, posts), ...last_post ? [{
                        kind: "load_more",
                        load_more: updateQuery("/"+host+"/"+urlbits, {since_id: undefined, min_id: undefined, max_id: last_post.id}),
                        raw_value: "",
                    } as Generic.LoadMore] : []],
                    display_style: "comments-view",
                };
                return res;
            }else if(path[0] === "statuses") {
                if(!path[1]) return error404();
                const postid = path[1];
                const postinfo = await getResult<Mastodon.Post>(auth, mkurl(host, "api/v1", "statuses", postid));
                const context = await getResult<{ancestors: Mastodon.Post[], descendants: Mastodon.Post[]}>(auth, mkurl(host, "api/v1", "statuses", postid, "context"));

                if('error' in postinfo) return error404("Error! "+postinfo.error);
                if('error' in context) return error404("Error! "+context.error);
                
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