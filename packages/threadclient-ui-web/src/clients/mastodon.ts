/* eslint-disable max-len */

import { assertNever, encodeQuery, router } from "tmeta-util";
import type * as Generic from "api-types-generic";
import {encoderGenerator, ThreadClient} from "threadclient-client-base";
import type * as Mastodon from "api-types-mastodon";
import { mnu, rt } from "api-types-generic";
import { oembed } from "./oembed";

const redirectURI = (host: string) => "https://"+location.host+"/login/mastodon/"+host; // a bit cheaty hmm

function getNavbar(host: string | null): Generic.Navbar {
    if(host == null || host === "") return {actions: [], inboxes: []};
    return {actions: [
        !isLoggedIn(host) ? {
            kind: "login",
            client_id: client.id,
            data: login_url_encoder.encode({host}),
            // text: "Log In to "+host,
        } : {
            kind: "link",
            client_id: client.id,
            text: "Log Out",
            url: "TODO log out from mastodon",
        },
    ], inboxes: []};
}

const error404 = (host: string | null, msg: string): Generic.Page => ({
    title: "Error",
    navbar: getNavbar(host),
    body: {kind: "one", item: {parents: [{
        kind: "thread",
        title: {text: "Error"},
        body: {
            kind: "text",
            client_id: client.id,
            content: msg,
            markdown_format: "none",
        },
        display_mode: {
            body: "visible",
            comments: "collapsed",
        },
        link: "TODO no link",
        layout: "error",
        actions: [],
        default_collapsed: false,
        raw_value: {},
    }], replies: []}},
    display_style: "comments-view",
});
const genericHeader = (): Generic.Thread => ({
    kind: "thread",
    title: {text: "Listing"},
    body: {kind: "text", client_id: client.id, content: "Listing", markdown_format: "none"},
    display_mode: {body: "collapsed", comments: "collapsed"},
    link: "TODO no link",
    layout: "error",
    actions: [],
    default_collapsed: false,
    raw_value: {},
});
function mkurl(host: string, ...bits: string[]): string {
    return "https://"+host+"/"+bits.join("/");
}
async function getResult<T>(auth: TokenResult | undefined, url: string, method: "GET" | "POST" = "GET"): Promise<T | {error: string}> {
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
        return {error: "Failed to load! "+(e as Error).toString()};
    }
}
function postArrayToReparentedTimeline(host: string, posts: Mastodon.Post[]): Generic.UnmountedNode[] {
    let nextv: Generic.Node[] = [];
    return posts.flatMap((post, i): Generic.UnmountedNode[] => {
        const thread = postToThread(host, post);
        let loadmore_v: Generic.Node[] = [];
        if(post.in_reply_to_id != null) {
            if(posts[i + 1]?.id === post.in_reply_to_id) {
                nextv.unshift(thread);
                return [];
            }
            // parent link:
            // /:host/statuses/:parent_id
            loadmore_v = [{
                kind: "load_more",
                url: "/"+host+"/statuses/"+post.in_reply_to_id,
                raw_value: post,
                load_more: load_more_encoder.encode({kind: "context", host, parent_id: post.in_reply_to_id}),
            }];
        }
        const thispv = nextv;
        nextv = [];
        return [{parents: [...loadmore_v, thread, ...thispv], replies: []}];
    });
}
function postArrayToReparentedThread(host: string, root_id: string, posts: Mastodon.Post[]): Generic.Node[] {
    const id_map = new Map<string, {replies?: undefined | Generic.Node[]}>();

    const root: {replies: Generic.Node[]} = {replies: []};
    id_map.set(root_id, root);

    for(const post of posts) {
        const parent_id = post.in_reply_to_id ?? "nope";
        let parent_v = id_map.get(parent_id);
        if(!parent_v) {
            console.log("Missing parent id in reparented thread", parent_id);
            alert("Reparenting error, check console");
            parent_v = root;
        }
        const thispost = postToThread(host, post);
        parent_v.replies ??= [];
        parent_v.replies.push(thispost);
        id_map.set(post.id, thispost);
    }
    return root.replies;
}
function expectUnsupported(a: "unsupported") {/**/}
function mediaToGalleryItem(host: string, media: Mastodon.Media): Generic.GalleryItem {
    if(media.type === "image") {
        return {
            thumb: media.preview_url ?? "https://dummyimage.com/100x100/ff0000/000000&text=image",
            aspect: media.meta?.small ? media.meta.small.width / media.meta.small.height : undefined,
            body: media.meta ? {
                kind: "captioned_image",
                url: media.url,
                w: media.meta.original?.width ?? null,
                h: media.meta.original?.height ?? null,
                alt: media.description,
            } : {
                kind: "link",
                url: media.url,
                client_id: client.id,
            },
        };
    } else if((media.type === "video" || media.type === "gifv")) {
        return {
            // instead of w and h for thumb, just use the ratio
            // from the original.
            thumb: media.preview_url ?? "https://dummyimage.com/100x100/ff0000/000000&text=video",
            aspect: media.meta?.small ? media.meta.small.width / media.meta.small.height : undefined,
            body: media.meta ? {
                kind: "video",
                source: {
                    kind: "video",
                    sources: [{
                        url: media.url,
                        quality: media.meta.original?.width + "×" + media.meta.original?.width,
                    }],
                },
                aspect: media.meta.original ? media.meta.original.width / media.meta.original.height : undefined,
                gifv: media.type === "gifv"
            } : {
                kind: "link",
                url: media.url,
                client_id: client.id,
            },
        };
    }else if(media.type === "audio") {
        return {
            thumb: media.preview_url ?? "https://winaero.com/blog/wp-content/uploads/2017/12/speaker-sound-audio-icon-256-big.png",
            aspect: 1,
            body: {kind: "audio", url: media.url, alt: media.description},
        };
    }else if(media.type === "unknown") {
        return {
            thumb: media.preview_url ?? "https://dummyimage.com/100x100/ff0000/000000&text=unknown",
            aspect: 1,
            body: {kind: "array", body: [
                {kind: "text", client_id: client.id, content: "alt: " + media.description, markdown_format: "none"},
                {kind: "link", client_id: client.id, url: media.url},
                ...media.remote_url != null ? [
                    {kind: "link", client_id: client.id, url: media.remote_url},
                ] as const : [],
            ]},
        };
    } 
    expectUnsupported(media.type);
    return {
        thumb: "https://dummyimage.com/100x100/ff0000/000000&text="+encodeURIComponent(media.type),
        aspect: 1,
        body: {kind: "link", client_id: client.id, url: media.url},
    };
    
}

type GenMeta = {
    host: string,
    emojis: Map<string, Mastodon.Emoji>,
    mentions: Map<string, Mastodon.Mention>,
};

function childNodesToRichtextParagraphs(meta: GenMeta, nodes: NodeListOf<ChildNode>): Generic.Richtext.Paragraph[] {
    const committed: Generic.Richtext.Paragraph[] = [];
    function commit() {
        if(uncommitted_spans.length > 0) {
            committed.push(rt.p(...uncommitted_spans));
        }
        uncommitted_spans = [];
    }
    let uncommitted_spans: Generic.Richtext.Span[] = [];
    for(const node of Array.from(nodes)) {
        const paragraph = contentParagraphToRichtextParagraph(meta, node);
        if(paragraph) {
            commit();
            committed.push(paragraph);
        }else{
            uncommitted_spans.push(...contentSpanToRichtextSpan(meta, node, {}));
        }
    }
    commit();
    return committed;
}
function contentParagraphToRichtextParagraph(meta: GenMeta, node: Node): Generic.Richtext.Paragraph | undefined {
    if(node instanceof HTMLElement) {
        if(node.nodeName === "P") {
            return rt.p(...contentSpansToRichtextSpans(meta, node.childNodes));
        }
    }
    return undefined;
}
function contentSpansToRichtextSpans(meta: GenMeta, node: NodeListOf<ChildNode>): Generic.Richtext.Span[] {
    return Array.from(node).flatMap(child => contentSpanToRichtextSpan(meta, child, {}));
}
function contentSpanToRichtextSpan(meta: GenMeta, node: Node, styles: Generic.Richtext.Style): Generic.Richtext.Span[] {
    if(node instanceof Text) {
        const node_value = node.nodeValue ?? "[ENoNodeValue]";
        const split_by_col = node_value.split(":");
        const res_segments: Generic.Richtext.Span[] = [];
        let uncommitted_text: string[] = [];
        const commit = () => {
            if(uncommitted_text.length > 0) {
                res_segments.push(rt.txt(uncommitted_text.join(":"), styles));
            }
            uncommitted_text = [];
        };
        for(const text of split_by_col) {
            const emoji_v = meta.emojis.get(text);
            if(emoji_v) {
                commit();
                res_segments.push(rt.kind("emoji", {url: emoji_v.static_url, name: ":"+text+":"}));
            }else{
                uncommitted_text.push(text);
            }
        }
        commit();
        return res_segments;
    }
    if(node instanceof HTMLElement) {
        let classes = Array.from(node.classList).filter(clss => {
            // https://docs.joinmastodon.org/spec/microformats/
            if(clss.startsWith("h-")) return false;
            if(clss.startsWith("p-")) return false;
            if(clss.startsWith("u-")) return false;
            return true;
        });
        const eatClass = (class_name: string): boolean => {
            if(!classes.includes(class_name)) return false;
            classes = classes.filter(clss => clss !== class_name);
            return true;
        };
        const noClasses = (...value: Generic.Richtext.Span[]): Generic.Richtext.Span[] => {
            if(classes.length !== 0) return [rt.error(classes.map(clss => "."+clss).join(""), node.outerHTML)];
            return value;
        };

        if(node.nodeName === "A") {
            const href_v = node.getAttribute("href") ?? "no href";

            if(!href_v.startsWith("http://") && !href_v.startsWith("https://")) {
                return noClasses(rt.error("Bad link", href_v));
            }

            if(eatClass("hashtag")) {
                eatClass("mention");
                const content = Array.from(node.childNodes).flatMap(child => contentSpanToRichtextSpan(meta, child, styles));
                const flat_content = node.textContent;
                if(flat_content == null || !flat_content.startsWith("#")) return [rt.error("bad hashtag", [content, node])];
                return noClasses(rt.link(client, "/"+meta.host+"/timelines/tag/"+encodeURIComponent(flat_content), {},
                    ...content,
                ));
            }
            if(eatClass("mention")) {
                const mention_data = meta.mentions.get(href_v);
                if(mention_data) {
                    return noClasses(rt.link(client, "/"+meta.host+"/accounts/"+mention_data.id, {
                        is_user_link: mention_data.username,
                    }, rt.txt("@"+mention_data.acct, styles)));
                }
            }

            return noClasses(rt.link(client, href_v, {},
                ...Array.from(node.childNodes).flatMap(child => contentSpanToRichtextSpan(meta, child, styles)),
            ));
        }
        if(node.nodeName === "BR") {
            return noClasses(rt.br());
        }
        if(node.nodeName === "SPAN") {
            const res_nodes = Array.from(node.childNodes).flatMap(child => contentSpanToRichtextSpan(meta, child, styles));

            if(classes.includes("invisible")) return [];

            if(eatClass("ellipsis")) {
                res_nodes.push(rt.txt("…", styles));
            }
            eatClass("h-card");

            return noClasses(...res_nodes);
            // return rt.link(href_v ?? "no href", ...Array.from(node.childNodes).map(child => contentSpanToRichtextSpan(host, child, styles)));
        }
        return [rt.error("<"+node.nodeName+">", {node, html: node.outerHTML})];
    }
    return [rt.error("Unsupported Node", node)];
}

function htmlToPlaintext(html: string): string {
    const container = el("div");
    container.innerHTML = html;
    return container.textContent ?? "*no content*";
}

function setupGenMeta(host: string, content: string, meta: ParseContentMeta): [GenMeta, NodeListOf<ChildNode>] {
    const parsed_v = document.createElement("div");
    parsed_v.innerHTML = content; // safe, scripts won't execute and this won't be displayed directly on the screen
    const emojis_by_shortcode = new Map<string, Mastodon.Emoji>();
    for(const emoji of meta.emojis) {
        emojis_by_shortcode.set(emoji.shortcode, emoji);
    }
    const mentions_by_url = new Map<string, Mastodon.Mention>();
    for(const mention of meta.mentions) {
        mentions_by_url.set(mention.url, mention);
    }
    const gen_meta: GenMeta = {
        host,
        emojis: emojis_by_shortcode,
        mentions: mentions_by_url,
    };
    return [gen_meta, parsed_v.childNodes];
}

type ParseContentMeta = {emojis: Mastodon.Emoji[], mentions: Mastodon.Mention[]};
function parseContentHTML(host: string, content: string, meta: ParseContentMeta): Generic.Richtext.Paragraph[] {
    return childNodesToRichtextParagraphs(...setupGenMeta(host, content, meta));
}

function parseContentSpanHTML(host: string, content: string, meta: ParseContentMeta): Generic.Richtext.Span[] {
    const [genmeta, children] = setupGenMeta(host, content, meta);
    return contentSpansToRichtextSpans(genmeta, children);
}
function postToThread(
    host: string,
    post: Mastodon.Post,
    opts: {
        replies?: undefined | Generic.Thread[],
        reblogged_by?: undefined | Generic.RebloggedBy,
    } = {},
): Generic.Thread {
    try {
        return postToThreadCanError(host, post, opts);
    } catch(e) {
        return {
            kind: "thread",
            title: {text: "Error!"},
            body: {kind: "richtext", content: [rt.p(rt.error("Error "+(e as Error).toString(), e))]},
            display_mode: {body: "visible", comments: "collapsed"},
            link: "/"+host+"/statuses/"+post.id,
            layout: "reddit-post",
            default_collapsed: false,
            actions: [],
            raw_value: [host, post, opts],
        };
    }
}
function postToThreadCanError(
    host: string,
    post: Mastodon.Post,
    opts: {
        replies?: undefined | Generic.Thread[],
        reblogged_by?: undefined | Generic.RebloggedBy,
    } = {},
): Generic.Thread {
    const info: Generic.Info = {
        time: new Date(post.created_at).getTime(),
        edited: false,
        author: {
            name: post.account.display_name + " (@"+post.account.acct+")",
            client_id: client.id,
            color_hash: post.account.username,
            link: "/"+host+"/accounts/"+post.account.id,
            flair: post.account.bot ? [{elems: [{kind: "text", text: "bot"}], content_warning: false}] : [],
            pfp: {
                url: post.account.avatar_static,
                hover: post.account.avatar,
            },
        },
        reblogged_by: opts.reblogged_by,
        pinned: false,
    };
    if(post.reblog) {
        return postToThread(host, post.reblog, {...opts, reblogged_by: info});
    }
    const res: Generic.Thread = {
        kind: "thread",
        body: {
            kind: "array",
            body: [
                {kind: "richtext", content: parseContentHTML(host, post.content, {emojis: post.emojis, mentions: post.mentions})},
                post.media_attachments.length === 0 ? undefined
                : {kind: "gallery", images: post.media_attachments.map(ma => mediaToGalleryItem(host, ma))},
                post.poll ? {kind: "poll",
                    choices: post.poll.options.map((opt, i) => ({name: opt.title, votes: opt.votes_count, id: "" + i})),
                    total_votes: post.poll.votes_count,
                    votable: post.poll.expired ? "Expired" : true,
                    vote_data: post.poll.id,
                    select_many: post.poll.multiple,
                    your_votes: (post.poll.own_votes ?? []).map(ov => ({id: "" + ov})),
                    close_time: new Date(post.poll.expires_at).getTime(),
                } : undefined,
                post.card ? oembed(post.card, client.id) : undefined,
            ],
        },
        display_mode: {body: "visible", comments: "visible"},
        link: "/"+host+"/statuses/"+post.id,
        layout: "mastodon-post",
        info,
        flair: post.sensitive || post.spoiler_text ? [{content_warning: post.sensitive, elems: [{kind: "text", text: post.spoiler_text || "Sensitive"}]}] : undefined,
        actions: [
            {kind: "link", client_id: client.id, url: "/"+host+"/statuses/"+post.id, text: post.replies_count + " repl"+(post.replies_count === 1 ? "y" : "ies")},
            {kind: "link", client_id: client.id, url: post.uri, text: "Permalink"},
            {kind: "counter",
                client_id: client.id,
                unique_id: host+"/favourite/"+post.id+"/",
                neutral_icon: "star",
                time: Date.now(),

                increment: {
                    icon: "star",
                    color: "yellow",
                    label: "Favourite",
                    undo_label: "Unfavourite",
                    // done_label: "Favourited"
                },
                decrement: null,

                count_excl_you: post.favourites_count + (post.favourited ? -1 : 0),
                you: post.favourited ? "increment" : undefined,

                actions: {
                    increment: action_encoder.encode({kind: "favourite", direction: "", status: post.id, host}),
                    reset: action_encoder.encode({kind: "favourite", direction: "un", status: post.id, host}),
                },
            },
        ],
        default_collapsed: false,
        raw_value: post,
        replies: opts.replies,
    };
    return res;
}
function splitURL(path: string): [string, URLSearchParams] {
    const [pathname, ...query] = path.split("?");
    return [pathname ?? "", new URLSearchParams(query.join("?"))];
}
function updateQuery(path: string, update: {[key: string]: string | undefined}) {
    const [pathname, query] = splitURL(path);
    for(const [k, v] of Object.entries(update)) {
        if(v != null) query.set(k, v);
        else query.delete(k);
    }
    return pathname + "?" + query.toString();
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
function getLoginURL(host: string, appres: ApplicationResult) {
    return "raw!https://"+host+"/oauth/authorize?"+encodeQuery({
        client_id: appres.client_id,
        scope: "read write follow push",
        redirect_uri: redirectURI(host),
        response_type: "code"
    });
}
function lsgetter<T>(namegtr: (host: string) => string): {
    get: (host: string) => T | undefined,
    set: (host: string, newval: T | undefined) => void,
} {
    return {
        get(host): undefined | T {
            if(!host) return undefined;
            const rtxt = localStorage.getItem(namegtr(host));
            if(rtxt == null || rtxt === "") return undefined;
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
type Action =
    | {kind: "favourite", direction: "" | "un", status: string, host: string}
    | {kind: "follow", direction: "" | "un", account_id: string, host: string}
;

const action_encoder = encoderGenerator<Action, "act">("act");

function isLoggedIn(host: string) {
    return !!lsitems.token.get(host);
}
async function getAuth(host: string): Promise<undefined | TokenResult> {
    if(!host) return undefined;
    const authv = lsitems.token.get(host) ?? lsitems.client_creds.get(host);
    if(!authv) {
        const appraw = lsitems.app.get(host);
        if(!appraw || (lsitems.client_did_error.get(host) ?? false)) return undefined;

        const {data: app} = appraw;

        const resv = await fetch(mkurl(host, "oauth", "token"), {
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
        }).then(v => v.json()) as {error: string} | TokenResult;

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
}

function bodyPage(host: string, title: string, body: Generic.Body): Generic.Page {
    return {
        title,
        navbar: getNavbar(null),
        body: {
            kind: "one",
            item: {
                parents: [{
                    kind: "thread",
                    body,
                    display_mode: {body: "visible", comments: "collapsed"},
                    raw_value: null,
                    link: "/",
                    layout: "reddit-post",
                    actions: [],
                    default_collapsed: false,
                }],
                replies: [],
            },
        },
        display_style: "comments-view",
    };
}

type ParseResult = {
    kind: "timeline",
    tmname: "home" | "public" | "local" | "tag",
    api_path: string,
    host: string,
} | {
    kind: "status",
    status: string,
    host: string,
} | {
    kind: "account",
    account: string,
    host: string,
    api_url: string,
} | {
    kind: "404",
    reason: string,
    host: string,
} | {
    kind: "instance-selector",
} | {
    kind: "instance-home",
    host: string,
} | {
    kind: "raw",
    path: string,
    host: string,
} | {
    kind: "notifications",
    host: string,
};

const url_parser = router<ParseResult>();

url_parser.with([{host: "any"}] as const, urlr => {
    urlr.route(["raw", {path: "rest"}] as const, opts => ({
        kind: "raw",
        path: "/" + opts.path.join("/") + "?"+encodeQuery(opts.query),
        host: opts.host,
    }));
    urlr.route([] as const, opts => ({
        kind: "instance-home",
        host: opts.host,
    }));
    urlr.with(["timelines"] as const, urlr => {
        urlr.route(["home"] as const, opts => ({
            kind: "timeline",
            tmname: "home",
            api_path: "/api/v1/timelines/home?"+encodeQuery(opts.query),
            host: opts.host,
        }));
        urlr.route(["public", "local"] as const, opts => ({
            kind: "timeline",
            tmname: "local",
            api_path: "/api/v1/timelines/public?"+encodeQuery({...opts.query, local: "true"}),
            host: opts.host,
        }));
        urlr.route(["public"] as const, opts => ({
            kind: "timeline",
            tmname: "public",
            api_path: "/api/v1/timelines/public?"+encodeQuery({...opts.query, local: "false"}),
            host: opts.host,
        }));
        urlr.route(["local"] as const, opts => ({
            kind: "timeline",
            tmname: "local",
            api_path: "/api/v1/timelines/public?"+encodeQuery({...opts.query, local: "true"}),
            host: opts.host,
        }));
        urlr.route(["tag", {hashtag: "any"}] as const, opts => ({
            kind: "timeline",
            tmname: "tag",
            api_path: "/api/v1/timelines/tag/"+opts.hashtag+"?"+encodeQuery(opts.query),
            host: opts.host,
        }));
        urlr.catchall(opts => ({
            kind: "404",
            reason: "Unsupported timeline",
            host: opts.host,
        }));
    });
    urlr.route(["statuses", {statusid: "any"}] as const, opts => ({
        kind: "status",
        status: opts.statusid,
        host: opts.host,
    }));
    urlr.route(["accounts", {accountid: "any"}] as const, opts => ({
        kind: "account",
        account: opts.accountid,
        host: opts.host,
        api_url: "/api/v1/accounts/"+opts.accountid+"/statuses?"+encodeQuery({...opts.query}),
    }));
    urlr.route(["notifications"], opts => ({
        kind: "notifications",
        host: opts.host,
    }));
    urlr.catchall(opts => ({
        kind: "404",
        reason: "Not Found",
        host: opts.host,
    }));
});
url_parser.catchall(() => ({
    kind: "instance-selector"
}));

type LoginURL = {
    host: string,
};
const login_url_encoder = encoderGenerator<LoginURL, "login_url">("login_url");
export const client: ThreadClient = {
    id: "mastodon",
    // isLoggedIn: (pathraw: string) => {
    //     const [, host] = pathraw.split("/");
    //     if(host == null) return false;
    //     return isLoggedIn(host);
    // },
    getLoginURL: async (requested: Generic.Opaque<"login_url">): Promise<string> => {
        const {host} = login_url_encoder.decode(requested);
        if(host == null) throw new Error("can't login without selecting host first");

        const preapp = lsitems.app.get(host);
        if(preapp) {
            if(preapp.host !== host) throw new Error("This should never happen.");
            return getLoginURL(host, preapp.data);
        }

        const resv = await fetch(mkurl(host, "api/v1", "apps"), {
            method: "post", mode: "cors", credentials: "omit",
            headers: {
                'Content-Type': "application/json",
                'Accept': "application/json",
            },
            body: JSON.stringify({
                client_name: "ThreadClient",
                redirect_uris: redirectURI(host),
                scopes: "read write follow push",
                website: "https://thread.pfg.pw",
            }),
        }).then(v => v.json()) as {error: string} | ApplicationResult;

        if('error' in resv) {
            console.log(resv);
            throw new Error("Got error:"+resv.error);
        }
        lsitems.app.set(host, {host, data: resv});

        return getLoginURL(host, resv);
    },
    login: async (path, query) => {
        if(path.length !== 2) throw new Error("bad login");
        const host = path[1]!;
        const code = query.get("code");
        if(code == null) throw new Error("missing code");

        const appv = lsitems.app.get(host);
        if(!appv) {
            throw new Error("An app was not registered - how did you even get here?");
        }
        const {data: app} = appv;

        const resv = await fetch(mkurl(host, "oauth", "token"), {
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
        }).then(v => v.json()) as {error: string} | TokenResult;

        if('error' in resv) {
            console.log(resv);
            throw new Error("Got error (check console): "+resv.error);
        }

        lsitems.token.set(host, resv);

        console.log(resv);
    },

    getThread: async (pathraw): Promise<Generic.Page> => {
        const parsed = url_parser.parse(pathraw) ?? {kind: "404", reason: "This should never happen"};

        if(parsed.kind === "instance-selector") {
            return bodyPage("", "Choose Instance", {
                kind: "mastodon_instance_selector",
                client_id: client.id,
            });
        }else if(parsed.kind === "404") {
            return error404("", parsed.reason);
        }
        
        const host = parsed.host;
        const auth = await getAuth(host);

        if(parsed.kind === "instance-home") {
            return bodyPage(host, "Links | "+host, {
                kind: "richtext",
                content: [
                    rt.h1(rt.txt(host)),
                    rt.ul(...([
                        ["/"+host+"/timelines/public", "Federated Timeline"],
                        ["/"+host+"/timelines/local", "Local Timeline"],
                    ] as const).map(([url, text]) => rt.li(rt.p(rt.link(client, url, {}, rt.txt(text)))))),
                ],
            });
        }else if(parsed.kind === "timeline") {
            const timelines_navbar: Generic.Menu = [
                mnu.link(client, "Home", "/"+host+"/timelines/home", parsed.tmname === "home"),
                mnu.link(client, "Local", "/"+host+"/timelines/local", parsed.tmname === "local"),
                mnu.link(client, "Federated", "/"+host+"/timelines/public", parsed.tmname === "public"),
                mnu.link(client, "Notifications", "/"+host+"/notifications", false),
            ];
            return await timelineView(host, auth, parsed.api_path, pathraw, genericHeader(), timelines_navbar, "Timeline "+parsed.tmname);
        }else if(parsed.kind === "status") {
            const [postinfo, context] = await Promise.all([
                getResult<Mastodon.Post>(auth, mkurl(host, "api/v1", "statuses", parsed.status)),
                getResult<{ancestors: Mastodon.Post[], descendants: Mastodon.Post[]}>(auth, mkurl(host, "api/v1", "statuses", parsed.status, "context")),
            ]);

            if('error' in postinfo) return error404(host, "Error! "+postinfo.error);
            if('error' in context) return error404(host, "Error! "+context.error);
            
            return {
                title: postinfo.account.acct + " on Mastodon: \""+htmlToPlaintext(postinfo.content)+"\"",
                navbar: getNavbar(host),
                body: {
                    kind: "one",
                    item: {
                        parents: [
                            ...context.ancestors.map(a => postToThread(host, a)),
                            postToThread(host, postinfo),
                        ],
                        replies: [
                            ...postArrayToReparentedThread(host, postinfo.id, context.descendants),
                        ],
                    },
                },
                display_style: "comments-view",
            };
        }else if(parsed.kind === "account") {
            const acc_id = parsed.account;

            const [account_info, account_relations] = await Promise.all([
                getResult<Mastodon.Account>(auth, mkurl(host, "api/v1", "accounts", acc_id)),
                getResult<Mastodon.AccountRelation[]>(auth, mkurl(host, "api/v1/accounts/relationships/?id[]="+acc_id)),
            ]);
            
            if('error' in account_info) return error404(host, "Error! "+account_info.error);
            if('error' in account_relations) console.log(account_relations);
            
            const relation = ('error' in account_relations ? [] : account_relations).find(acc => acc.id === acc_id);

            const pcmeta: ParseContentMeta = {
                emojis: account_info.emojis ?? [],
                mentions: account_info.mentions ?? [],
            };

            return await timelineView(host, auth, parsed.api_url, pathraw, {
                kind: "bio",
                banner: {
                    kind: "image",
                    desktop: account_info.header_static ?? account_info.header ?? "none",
                },
                icon: {
                    url: account_info.avatar_static ?? account_info.avatar ?? "none",
                },
                name: {
                    display: account_info.display_name,
                    link_name: account_info.acct,
                },
                body: {
                    kind: "richtext",
                    content: [...parseContentHTML(host, account_info.note, pcmeta), rt.table([
                        rt.th(undefined, rt.txt("Key")),
                        rt.th(undefined, rt.txt("Value")),
                        rt.th(undefined, rt.txt("V")),
                    ], ...account_info.fields.map((field): Generic.Richtext.TableItem[] => {
                        return [
                            rt.td(rt.txt(field.name)),
                            rt.td(...parseContentSpanHTML(host, field.value, pcmeta)),
                            rt.td(rt.txt(field.verified_at != null ? "✓" : "✗")),
                        ];
                    }))],
                },
                subscribe: {
                    kind: "counter",
                    client_id: client.id,
                    unique_id: "/follow/"+account_info.id+"/",
                    time: Date.now(),
                    neutral_icon: "join",
                    increment: {
                        icon: "join",
                        color: "white",
                        label: account_info.locked ? "Request Follow" : "Follow",
                        undo_label: "Following",
                    },
                    decrement: null,
                    count_excl_you: account_info.followers_count === -1
                        ? "hidden"
                        : account_info.followers_count + (relation?.following ?? false ? -1 : 0)
                    ,
                    you: relation?.following ?? false ? "increment" : undefined, // uuh how do I not know if I'm following or not…?
                    style: "pill-filled",
                    incremented_style: "pill-empty",

                    actions: {
                        increment: action_encoder.encode({kind: "follow", account_id: account_info.id, host, direction: ""}),
                        reset: action_encoder.encode({kind: "follow", account_id: account_info.id, host, direction: "un"}),
                    },
                },
                more_actions: [{
                    kind: "link",
                    client_id: client.id,
                    url: account_info.url,
                    text: "Permalink",
                }],
                menu: null, // … Posts | … Following | … Followers
                // link: "/"+host+"/accounts/"+acc_id,
                raw_value: account_info,
            }, [], (account_info.display_name ?? "") + " (" + account_info.acct + ")");
        }else if(parsed.kind === "notifications") {
            const notifications = await getResult<Mastodon.Notification[]>(auth, mkurl(host, "api/v1/notifications"));
            if('error' in notifications) return error404(host, "error: "+notifications.error);
            const notification_types = {
                follow: "Someone followed you",
                follow_request: "Someone requested to follow you",
                mention: "Someone mentioned you in a status",
                reblog: "Someone reblogged your status",
                favourite: "Someone favourited your status",
                poll: "A poll you interacted with has ended",
                status: "Smomeone you have notifications on for posted a status",
                unsupported: "Unsupported notification type. Error.",
            } as const;
            return {
                title: "Notifications",
                navbar: getNavbar(host),
                body: {
                    kind: "listing",
                    header: genericHeader(),
                    menu: undefined,
                    items: notifications.map((notif): Generic.UnmountedNode => {
                        return {parents: [{
                            kind: "thread",
                            title: {text: notification_types[notif.type] ?? notification_types.unsupported},
                            body: {kind: "none"},
                            display_mode: {body: "visible", comments: "collapsed"},
                            link: "/"+host+"/notifications/"+notif.id,
                            layout: "reddit-post",
                            default_collapsed: false,
                            actions: [],
                            raw_value: notif,
                        }, ...notif.status ? [postToThread(host, notif.status)] : []], replies: []};
                    }),
                    next: undefined,
                },
                display_style: "comments-view",
            };
        }else if(parsed.kind === "raw") {
            const result = await getResult<unknown>(auth, "https://"+host+parsed.path);
            return {
                title: "Error View",
                navbar: getNavbar(host),
                body: {
                    kind: "one",
                    item: {
                        parents: [{
                            kind: "thread",
                            raw_value: result,
                            body: {kind: "richtext", content: [rt.pre(JSON.stringify(result, null, "\t"), "json")]},
                            display_mode: {body: "visible", comments: "visible"},
                            link: parsed.path,
                            layout: "error",
                            actions: [],
                            default_collapsed: false,
                        }],
                        replies: [],
                    },
                },
                sidebar: [{
                    kind: "widget",
                    title: "Raw",
                    widget_content: {kind: "body", body: {kind: "richtext", content: [
                        rt.p(rt.txt("This is a raw page.")),
                        rt.p(rt.link(client, parsed.path, {}, rt.txt("View Rendered"))),
                    ]}},
                    raw_value: parsed,
                }],
                display_style: "comments-view",
            };
        }
        assertNever(parsed);
    },
    async act(action_raw): Promise<void> {
        const action = action_encoder.decode(action_raw);
        if(action.kind === "favourite") {
            await performBasicPostAction(action.host, "api/v1/statuses/"+action.status+"/"+action.direction+"favourite");
            // this returns a result, TODO use it
        }else if(action.kind === "follow") {
            await performBasicPostAction(action.host, "api/v1/accounts/"+action.account_id+"/"+action.direction+"follow");
            // this returns a result, TODO use it
        }else assertUnreachable(action);
    },
    previewReply(reply_text: string, reply_info): Generic.PostContent {
        throw new Error("TODO");
    },
    sendReply(reply_text, reply_info) {
        throw new Error("NIY");
    },

    async loadMore(action) {
        throw new Error("not used");
    },
    async loadMoreUnmounted(action) {
        const act = load_more_unmounted_encoder.decode(action);
        const auth = await getAuth(act.tl_info.host);
        const timeline_view = await timelineView(act.tl_info.host, auth, act.tl_info.api_path, act.tl_info.web_path, genericHeader(), [], "*unused*");
        if(timeline_view.body.kind === "listing") {
            return {children: timeline_view.body.items, next: timeline_view.body.next};
        }
        console.log("ERROR got", timeline_view);
        throw new Error("TODO support "+timeline_view.body.kind);
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

async function timelineView(host: string, auth: undefined | TokenResult, api_path: string, web_path: string, header: Generic.ContentNode, navbar: Generic.Menu, timeline_title: string): Promise<Generic.Page> {
    const thisurl = mkurl(host, api_path);
    const posts = await getResult<Mastodon.Post[]>(auth, thisurl);

    if('error' in posts) return error404(host, "Error! "+posts.error);

    const last_post = posts[posts.length - 1];

    let next: Generic.LoadMoreUnmounted | undefined;
    if(last_post) {
        const updated_link = updateQuery("/"+host+web_path, {since_id: undefined, min_id: undefined, max_id: last_post.id});
        const updated_api_path = updateQuery(api_path, {since_id: undefined, min_id: undefined, max_id: last_post.id});
        next = {
            kind: "load_more_unmounted",
            load_more_unmounted: load_more_unmounted_encoder.encode({kind: "timeline", tl_info: {host, api_path: updated_api_path, web_path: updated_link}}),
            url: updated_link,
            raw_value: last_post,
        };
    }

    const res: Generic.Page = {
        title: timeline_title,
        navbar: getNavbar(host),
        body: {
            kind: "listing",
            header,
            menu: navbar,
            items: postArrayToReparentedTimeline(host, posts),
            next: next,
        },
        display_style: "comments-view",
    };
    return res;
}

type LoadMoreUnmountedData = {
    kind: "timeline",
    tl_info: {host: string, api_path: string, web_path: string},
};
const load_more_unmounted_encoder = encoderGenerator<LoadMoreUnmountedData, "load_more_unmounted">("load_more_unmounted");

type LoadMoreData = {
    kind: "context",
    host: string,
    parent_id: string,
};
const load_more_encoder = encoderGenerator<LoadMoreData, "load_more">("load_more");