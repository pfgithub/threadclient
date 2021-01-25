import { escapeHTML, encodeQuery } from "../app";
import * as Generic from "../types/generic";
import {ThreadClient} from "./base";

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
        meta?: {
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
    type Account = {
        id: string,
        username: string,
        acct: string,
        display_name: string,
        url: string,
        bot: boolean,

        followers_count: number,
        following_count: number,

        header: string,
        header_static: string,

        note: string,

        last_status_at: string,
        
        fields: {name: string, value: string, verified_at: null}[],

        avatar: string,
        avatar_static: string,
    };
    type AccountRelation = {
        id: string,
        following: boolean,
        showing_reblogs: boolean,
        notifying: boolean,
        followed_by: boolean,
        blocking: boolean,
        muting: boolean,
        muting_notifications: boolean,
        requested: boolean,
        endorsed: boolean,
        note: string,
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
        favourited: boolean,
        content: string, // unsafe html
        reblog?: Post,
        account: Account,
        media_attachments: Media[],
        mentions: never[],
        tags: never[],
        emojis: Emoji[],
        card: null,
        poll: null | Poll,
    };
}

const error404 = (msg = "404 not found"): Generic.Page => ({
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
        raw_value: {},
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
    raw_value: {},
});
const mkurl = (host: string, ...bits: string[]): string => {
    return "https://"+host+"/"+bits.join("/");
};
const getResult = async<T>(auth: TokenResult | undefined, url: string, method: "GET" | "POST" = "GET"): Promise<T | {error: string}> => {
    try {
        const [status, posts] = await fetch(url, {
            method,
            headers: {
                'Accept': "application/json",
                ...auth ? {
                    'Authorization': auth.token_type + " " + auth.access_token
                } : {},
            },
        }).then(async (v) => {
            return [v.status, await v.json() as T | {error: string}] as const;
        });
        if(status !== 200) console.log("got status "+status, posts);
        return posts;
    }catch(e) {
        return {error: "Failed to load! "+e.toString()};
    }
};
const wrapWithParentLink = (thread: Generic.Thread, host: string, parent_id: string): Generic.Thread => {
    const parentlink = "/"+host+"/statuses/"+parent_id;
    return {
        kind: "thread",
        body: {
            kind: "text",
            content: "<a href=\""+escapeHTML(parentlink)+"\">View Parent</a>",
            markdown_format: "mastodon",
        },
        display_mode: {body: "visible", comments: "collapsed"},
        link: parentlink,
        layout: "reddit-post",
        default_collapsed: false,
        actions: [],
        raw_value: parentlink,
        replies: [thread],
    };
};
const postArrayToReparentedTimeline = (host: string, posts: Mastodon.Post[]): Generic.Thread[] => {
    let nextv: Generic.Thread | undefined;
    return posts.flatMap((post, i) => {
        let thread = postToThread(host, post);
        if(nextv) {
            if(!thread.replies) thread.replies = [];
            thread.replies.push(nextv);
            nextv = undefined;
        }
        if(post.in_reply_to_id) {
            if(posts[i + 1]?.id == post.in_reply_to_id) {
                nextv = thread;
                return [];
            }
            thread = wrapWithParentLink(thread, host, post.in_reply_to_id);
        }
        return [thread];
    });
};
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
    if(media.type === "image" && media.meta) {
        resbody = {kind: "captioned_image", url: media.url, w: media.meta.original.width, h: media.meta.original.height, alt: media.description};
    } else if((media.type === "video" || media.type === "gifv") && media.meta) {
        resbody = {kind: "video", url: media.url, w: media.meta.original.width, h: media.meta.original.height, gifv: media.type === "gifv"};
    } else {
        resbody = {kind: "link", url: media.url};
    }

    return {thumb: media.preview_url, w: media.meta?.small.width, h: media.meta?.small.height, body: resbody};
};
const postToThread = (host: string, post: Mastodon.Post, opts: {replies?: Generic.Thread[], include_parentlink?: boolean, reblogged_by?: Generic.RebloggedBy} = {}): Generic.Thread => {
    const info: Generic.Info = {time: new Date(post.created_at).getTime(),
        author: {
            name: post.account.display_name + " (@"+post.account.acct+")",
            link: "/"+host+"/accounts/"+post.account.id+"/@"+post.account.acct,
            flair: post.account.bot ? [{elems: [{type: "text", text: "bot"}], content_warning: false}] : [],
            pfp: {
                url: post.account.avatar_static,
                hover: post.account.avatar,
            },
        },
        reblogged_by: opts.reblogged_by,
    };
    if(post.reblog) {
        return postToThread(host, post.reblog, {...opts, reblogged_by: info});
    }
    let res: Generic.Thread = {
        kind: "thread",
        body: {
            kind: "array",
            body: [
                {
                    kind: "text",
                    content: post.content,
                    markdown_format: "mastodon",
                },
                post.media_attachments.length === 0 ? undefined
                : {kind: "gallery", images: post.media_attachments.map(ma => mediaToGalleryItem(host, ma))},
                post.poll ? {kind: "poll",
                    choices: post.poll.options.map((opt, i) => ({name: opt.title, votes: opt.votes_count, id: "" + i})),
                    total_votes: post.poll.votes_count,
                    votable: post.poll.expired ? "Expired" : true,
                    vote_data: post.poll.id,
                    select_many: post.poll.multiple,
                    your_votes: (post.poll.own_votes ?? []).map(ov => ({id: "" + ov})),
                } : undefined
            ],
        },
        display_mode: {body: "visible", comments: "collapsed"},
        link: "/"+host+"/statuses/"+post.id,
        layout: "mastodon-post",
        info,
        flair: post.sensitive || post.spoiler_text ? [{content_warning: post.sensitive, elems: [{type: "text", text: post.spoiler_text || "Sensitive"}]}] : undefined,
        actions: [
            {kind: "link", url: "/"+host+"/statuses/"+post.id, text: post.replies_count + " repl"+(post.replies_count === 1 ? "y" : "ies")},
            {kind: "counter",
                label: "Favourite",
                incremented_label: "Favourited",

                count_excl_you: post.favourites_count + (post.favourited ? -1 : 0),
                you: post.favourited ? "increment" : undefined,

                actions: {
                    error: undefined,
                    increment: encodeAction({kind: "favourite", direction: "", status: post.id, host}),
                    reset: encodeAction({kind: "favourite", direction: "un", status: post.id, host}),
                },
            },
        ],
        default_collapsed: false,
        raw_value: post,
        replies: opts.replies,
    };
    if((opts.include_parentlink ?? false) && post.in_reply_to_id) {
        res = wrapWithParentLink(res, host, post.in_reply_to_id);
    }
    return res;
};
const splitURL = (path: string): [string, URLSearchParams] => {
    const [pathname, ...query] = path.split("?");
    return [pathname, new URLSearchParams(query.join("?"))];
};
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
    return "https://"+host+"/oauth/authorize?"+encodeQuery({
        client_id: appres.client_id,
        scope: "read write follow push",
        redirect_uri: redirectURI(host),
        response_type: "code"
    });
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
};
const lsitems = {
    app: lsgetter<{host: string, data: ApplicationResult}>((host: string) => "mastodon-application-"+host),
    token: lsgetter<TokenResult>((host: string) => "mastodon-secret-"+host),
    client_creds: lsgetter<TokenResult>((host: string) => "mastodon-client-secret-"+host),
    client_did_error: lsgetter<boolean>((host: string) => "mastodon-client-did-error-"+host),
};
type Action =
    | {kind: "favourite", direction: "" | "un", status: string, host: string}
    | {kind: "follow", direction: "" | "un", account_id: string, host: string}
;
function encodeAction(action: Action): string {
    return JSON.stringify(action);
}
function decodeAction(action: string): Action {
    return JSON.parse(action);
}
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
    }
    return authv;
};
export const client: ThreadClient = {
    id: "mastodon",
    links: () => [],
    isLoggedIn: (pathraw: string) => {
        const [, host] = pathraw.split("/");
        if(!host) return false;
        return isLoggedIn(host);
    },
    loginURL: async (pathraw: string): Promise<string> => {

        const pathsplit = pathraw.split("/");
        const [, host] = pathsplit;
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
        const [, host] = path;
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
        const [beforequery, afterquery_raw] = pathraw.split("?") as [string, string | undefined];
        const afterquery = afterquery_raw ?? "";
        const pathsplit = beforequery.split("/");
        if(pathsplit.length < 2) return error404();
        const [, host, ...path] = pathsplit;
        
        const auth = await getAuth(host);
        
        const path0 = path.shift();
        if(!path0) return error404();
        if(path0 === "timelines") {
            return await timelineView(host, auth, "/api/v1/"+["timelines", ...path].join("/")+"?"+afterquery, "/"+["timelines", ...path].join("/")+"?"+afterquery, genericHeader());
        }else if(path0 === "statuses") {
            const postid = path.shift();
            if(!postid) return error404();
            const [postinfo, context] = await Promise.all([
                getResult<Mastodon.Post>(auth, mkurl(host, "api/v1", "statuses", postid)),
                getResult<{ancestors: Mastodon.Post[], descendants: Mastodon.Post[]}>(auth, mkurl(host, "api/v1", "statuses", postid, "context")),
            ]);

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
        }else if(path0 === "accounts") {
            const acc_id = path.shift();
            if(!acc_id) return error404();
            const [account_info, account_relations] = await Promise.all([
                getResult<Mastodon.Account>(auth, mkurl(host, "api/v1", "accounts", acc_id)),
                getResult<Mastodon.AccountRelation[]>(auth, mkurl(host, "api/v1/accounts/relationships/?id[]="+acc_id)),
            ]);
            
            if('error' in account_info) return error404("Error! "+account_info.error);
            if('error' in account_relations) console.log(account_relations);
            
            const relation = ('error' in account_relations ? [] : account_relations).find(acc => acc.id === acc_id);

            return await timelineView(host, auth, "/api/v1/accounts/"+acc_id+"/statuses?"+afterquery, "/accounts/"+acc_id+"?"+afterquery, {
                kind: "user-profile",
                username: account_info.display_name,
                bio: {
                    kind: "text",
                    content: account_info.note,
                    markdown_format: "mastodon",
                },
                actions: [{
                    kind: "counter",
                    label: "Follow",
                    incremented_label: "Following",
                    count_excl_you: account_info.followers_count === -1
                        ? "hidden"
                        : account_info.followers_count + (relation?.following ? -1 : 0)
                    ,
                    you: relation?.following ? "increment" : undefined, // uuh how do I not know if I'm following or not…?

                    actions: {
                        increment: encodeAction({kind: "follow", account_id: account_info.id, host, direction: ""}),
                        reset: encodeAction({kind: "follow", account_id: account_info.id, host, direction: "un"}),
                    },
                }],
                link: "/"+host+"/accounts/"+acc_id,
                raw_value: account_info,
            });
        }
        return error404();
    },
    async act(action_raw: string): Promise<void> {
        const action = decodeAction(action_raw);
        if(action.kind === "favourite") {
            await performBasicPostAction(action.host, "api/v1/statuses/"+action.status+"/"+action.direction+"favourite");
        }else if(action.kind === "follow") {
            await performBasicPostAction(action.host, "api/v1/accounts/"+action.account_id+"/"+action.direction+"follow");
        }else assertUnreachable(action);
    },
    previewReply(reply_text: string, reply_info: string): Generic.Thread {
        return genericHeader();
    },
};

async function performBasicPostAction(host: string, url: string): Promise<void> {
    const auth = await getAuth(host);
    const resp = await getResult<Mastodon.Post>(auth, mkurl(host, url), "POST");
    if('error' in resp) {
        console.log(resp);
        throw new Error("Got error: "+resp.error);
    }
    return;
}

function assertUnreachable(value: never): never {
    console.log(value);
    throw new Error("Expected unreachable: "+value);
}

async function timelineView(host: string, auth: undefined | TokenResult, api_path: string, web_path: string, header: Generic.ContentNode): Promise<Generic.Page> {
    const thisurl = mkurl(host, api_path);
    const posts = await getResult<Mastodon.Post[]>(auth, thisurl);

    if('error' in posts) return error404("Error! "+posts.error);

    const last_post = posts[posts.length - 1];

    const res: Generic.Page = {
        header: header,
        replies: [...postArrayToReparentedTimeline(host, posts), ...last_post ? [{
            kind: "load_more",
            load_more: updateQuery("/"+host+web_path, {since_id: undefined, min_id: undefined, max_id: last_post.id}),
            raw_value: "",
        } as Generic.LoadMore] : []],
        display_style: "comments-view",
    };
    return res;
}