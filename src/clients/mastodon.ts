import { query } from "../app.js";
import * as Generic from "../types/generic.js";
import {ThreadClient} from "./base.js";

const redirectURI = (host: string) => "https://"+location.host+"/login/mastodon/"+host; // a bit cheaty hmm

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
        actions: [{kind: "link", url: "/"+host+"/statuses/"+post.id, text: post.replies_count + " repl"+(post.replies_count === 1 ? "y" : "ies")}],
        default_collapsed: false,
        raw_value: post,
        replies: opts.replies,
    };
    return res;
}
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
const lsnames = {
    app: (host: string) => "mastodon-application-"+host,
    token: (host: string) => "mastodon-secret-"+host,
    client_credentials: (host: string) => "mastodon-client-secret-"+host,
};
export function mastodon() {
    const isLoggedIn = (host: string) => {
        return !!localStorage.getItem(lsnames.token(host));
    };
    const getAuth = async (host: string): Promise<undefined | TokenResult> => {
        if(!host) return undefined;
        const txtitm = localStorage.getItem(lsnames.token(host)) || localStorage.getItem(lsnames.client_credentials(host));
        if(!txtitm) {
            const txtapp = localStorage.getItem(lsnames.app(host));
            if(!txtapp || localStorage.getItem(lsnames.client_credentials(host)) === "") return undefined;
            const {data: app} = JSON.parse(txtapp) as {data: ApplicationResult};

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
                localStorage.setItem(lsnames.client_credentials(host), "");
                console.log(resv);
                alert("failed to get application token. will not try again. :: "+resv.error);
                return undefined;
            }

            localStorage.setItem(lsnames.client_credentials(host), JSON.stringify(resv));

            return resv;
        };
        return JSON.parse(txtitm);
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

            const preapp = localStorage.getItem(lsnames.app(host));
            if(preapp) {
                const parsed = JSON.parse(preapp) as {host: string, data: ApplicationResult};
                if(parsed.host !== host) throw new Error("TODO support multiple accounts");
                return getLoginURL(host, parsed.data);
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
            localStorage.setItem(lsnames.app(host), JSON.stringify({host, data: resv}));

            return getLoginURL(host, resv);
        },
        login: async (path, query) => {
            if(path.length !== 2) throw new Error("bad login");
            const [_, host] = path;
            const code = query.get("code");
            if(!code) throw new Error("missing code");

            const app_txt = localStorage.getItem(lsnames.app(host));
            if(!app_txt) {
                throw new Error("An app was not registered - how did you even get here?");
            }
            const {data: app} = JSON.parse(app_txt) as {host: string, data: ApplicationResult};

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

            localStorage.setItem(lsnames.token(host), JSON.stringify(resv));

            console.log(resv);
        },

        getThread: async (pathraw) => {
            const pathsplit = pathraw.split("/");
            if(pathsplit.length < 2) return error404();
            const [_, host, ...path] = pathsplit;

            const auth = await getAuth(host);

            if(path[0] === "timelines") {
                const posts = await getResult<Mastodon.Post[]>(auth, mkurl(host, "api/v1", ...path));

                if('error' in posts) return error404("Error! "+posts.error);

                const res: Generic.Page = {
                    header: genericHeader(),
                    replies: posts.map(post => postToThread(host, post)),
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