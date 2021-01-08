declare const uhtml: any;
declare const client_id: string;
declare const redirect_uri: string;

const raw = (string: string) => ({__raw: "" + string, toString: () => string});
const templateGenerator = <InType>(helper: (str: InType) => string) => {
    type ValueArrayType = (InType | string | {__raw: string})[];
    return (strings: TemplateStringsArray | InType, ...values: ValueArrayType) => {
        if(!(strings as TemplateStringsArray).raw && !Array.isArray(strings)) {
            return helper(strings as any);
        }
        const result: ValueArrayType = [];
        (strings as TemplateStringsArray).forEach((string, i) => {
            result.push(raw(string), values[i] || "");
        });
        return result.map((el: any) => typeof el.__raw === "string" ? el.__raw : helper(el)).join("");
    };
};
const url = templateGenerator<string>(str => encodeURIComponent(str));
const html = uhtml.html;

const query = (items: {[key: string]: string}) => {
    let res = "";
    for(const [key, value] of Object.entries(items)) {
        if(!res) res += "?";
        else res += "&";
        res += url`${key}=${value}`;
    }
    return res;
};

type RedditPage = [RedditListing, RedditListing];
type RedditListing = {
    kind: "Listing",
    data: {
        before: string | null,
        children: RedditPost[],
        after: string | null,
    },
};

type RedditPostBase = {
    name: string, // post id
    subreddit_name_prefixed: string, // post subreddit (u/ or r/)
    stickied: boolean,

    // use to fetch replies I guess
    permalink: string,
};

type RedditPostSubmission = RedditPostBase & {
    title: string,

    // content warnings
    spoiler: boolean,
    over_18: boolean,

    // content
    url: string,
    is_self: boolean,
    selftext: string,
    selftext_html?: string, // sanitize this and set innerhtml. spooky.
    thumbnail?: string,

    gallery_data?: {items: {
        caption?: string,
        media_id: string, // →media_metadata
    }[]},

    media_metadata?: {[key: string]: {
        // e: "Image",
        p: {y: number, x: number, u: string}[], // preview
        s: {y: number, x: number, u: string}, // source
    }},

    preview?: {
        images: {
            id: string,
            source: {url: string, width: number, height: number},
            resolutions: {url: string, width: number, height: number}[],
            // variants: {?}
        }[],
        enabled: boolean,
    },

    author: string,
    created_utc: number,
    
    link_flair_richtext: RedditRichtextFlair,
    author_flair_richtext: RedditRichtextFlair,

    num_comments: number,

    crosspost_parent_list?: RedditPostSubmission[],

    media_embed?: {content: string},
};

type RedditPostComment = RedditPostBase & {
    body: string,
    body_html: string,
    replies?: RedditListing,

    author: string,
    created_utc: number,

    author_flair_richtext: RedditRichtextFlair,
};

type RedditPost = {
    kind: "t3",
    data: RedditPostSubmission,
} | {
    kind: "t1",
    data: RedditPostComment,
} | {
    kind: "more",
};

type RedditRichtextFlair = ({
    e: "emoji",
    u: string, // url
    a: string, // :emojiname:
} | {
    e: "text",
    t: string, // text
} | {
    e: "unsupported"
})[];

type GenericPage = {
    header: GenericThread,
    replies?: {load_prev?: string, loaded: GenericThread[], load_next?: string},
};
type GenericBody = {
    kind: "text",
    content: string,
    markdown_format: "reddit" | "none",
} | {
    kind: "link",
    url: string,
    embed_html?: string,
} | {
    kind: "image_gallery",
    images: GenericGalleryImages,
} | {
    kind: "none",
} | {
    kind: "removed",
    by: "author" | "moderator",
    fetch_path: string,
} | {
    kind: "crosspost",
    source: GenericThread,
};
type GenericThread = {
    body: GenericBody,
    thumbnail?: {
        url: string,
    },
    display_mode: {
        body: "visible" | "collapsed",
        comments: "visible" | "collapsed",
    },
    replies?: {
        load_prev?: string,
        loaded: GenericThread[],
        load_next?: string,
    },
    raw_value?: any,

    link: string,

    layout: "reddit-post" | "reddit-comment" | "error",

    title?: {
        text: string,
    },

    info: {
        time: number,
        author: {name: string, link: string, flair?: GenericFlair[]},
    },
    actions: GenericAction[],
    
    flair?: GenericFlair[],
};
type GenericFlair = {
    elems: ({
        type: "text",
        text: string,
    } | {
        type: "emoji",
        url: string,
        name: string,
    })[],
    content_warning: boolean,
};
type GenericAction = {
    kind: "link",
    url: string,
    text: string,
} | {
    kind: "reply",
    text: string,
};
type GenericGalleryImages = {
    thumb: string,
    thumb_w: number,
    thumb_h: number,
    url: string,
    w: number,
    h: number,
    caption?: string,
}[];

type ThreadClient = {
    id: string,
    links: () => [string, () => string][]
    isLoggedIn: () => boolean,
    getLoginURL: () => string,
    getThread: (path: string) => Promise<GenericPage>,
    login: (query: URLSearchParams) => Promise<void>,
    fetchRemoved?: (fetch_removed_path: string) => Promise<GenericBody>,
};

function assertNever(content: never): never {
    console.log("not never:", content);
    throw new Error("is not never");
}

function escapeHTML(html: string) {
	return html
		.split("&").join("&amp;")
		.split('"').join("&quot;")
		.split("<").join("&lt;")
        .split(">").join("&gt;")
    ;
}

const safehtml = templateGenerator((v: string) => escapeHTML(v));

function flairToGenericFlair(flair: RedditRichtextFlair): GenericFlair[] {
    if(!flair) return [];
    if(flair.length === 0) return [];
    let flair_text = flair.map(v => v.e === "text" ? v.t : "").join("");
    return [{elems: flair.map(v => {
        if(v.e === "text") {
            return {type: "text", text: v.t};
        }else if(v.e === "emoji") {
            return {type: "emoji", url: v.u, name: v.a};
        }
        // this is where zig-style enums with a `_` option are nice
        // a switch can check that all cases are handled even if
        // not all cases are known.
        return {type: "text", text: "#TODO("+v.e+")"};
    }), content_warning: flair_text.toLowerCase().startsWith("cw:")}];
}

function reddit() {
    const isLoggedIn = () => {
        return !!localStorage.getItem("reddit-secret");
    };

    const pathURL = (path: string) => {;
        if(!isLoggedIn()) return "https://www.reddit.com"+path+".json?raw_json=1";
        return "https://oauth.reddit.com"+path+".json?raw_json=1";
    };

    // ok so the idea::
    // reddit listings are [pageinfo], [comments]
    // so::
    // if this is the outermost listing, the pageinfo is needed to display info about the current page
    // so like
    // when we return a result from getThread it can be like this
    // {
    //     parent: Post
    //     children: Post[]
    // }
    // and then also the client viewer thing can update the parent post if eg you load the comments
    // ok part 2:: there are different types of posts

    const getAccessToken = async () => {
        const data = localStorage.getItem("reddit-secret");
        if(!data) return null;
        const json = JSON.parse(data);
        console.log(json.expires, Date.now());
        if(json.expires < Date.now()) {
            // refresh token
            console.log("Token expired, refreshing…");
            const [status, v] = await fetch("https://www.reddit.com/api/v1/access_token", {
                method: "POST", mode: "cors", credentials: "omit",
                headers: {
                    'Authorization': "Basic "+btoa(client_id+":"),
                    'Content-Type': "application/x-www-form-urlencoded",
                },
                body: url`grant_type=refresh_token&refresh_token=${json.refresh_token}`,
            }).then(async (v) => {
                return [v.status, await v.json()] as const;
            });
            if(status !== 200) {
                console.log("Error! got", v, "with status code", status);
                throw new Error("Status code "+status);
            }
            const res_data = {
                access_token: v.access_token,
                refresh_token: v.refresh_token || json.refresh_token,
                expires: Date.now() + (v.expires_in * 1000),
                scope: v.scope,
            };
            console.log("Refresh info:", v, res_data);
            localStorage.setItem("reddit-secret", JSON.stringify(res_data));
            console.log("Refreshed √");
            return res_data.access_token;
        }
        return json.access_token;
    }

    const getAuthorization = async () => {
        const access_token = await getAccessToken();
        if(!access_token) return '';
        return 'Bearer '+access_token;
    }

    const pageFromListing = (listing: RedditPage | RedditListing): GenericPage => {
        if(Array.isArray(listing)) {
            return {
                header: threadFromListing(listing[0].data.children[0], {force_expand: true}),
                replies: {
                    load_prev: "TODO listing[1].data.before",
                    loaded: listing[1].data.children.map(child => threadFromListing(child)),
                    load_next: "TODO listing[1].data.after",
                },
            };
        }
        return {
            header: {
                title: {text: "Listing"},
                body: {kind: "text", content: "Listing", markdown_format: "none"},
                display_mode: {body: "collapsed", comments: "collapsed"},
                link: "TODO no link",
                layout: "error",
                info: {time: 0,
                    author: {name: "no one", link: "TODO no link"},
                },
                actions: [],
            },
            replies: {
                load_prev: "TODO listing.data.before",
                loaded: listing.data.children.map(child => threadFromListing(child)),
                load_next: "TODO listing.data.after",
            },
        };
    };
    const threadFromListing = (listing_raw: RedditPost, options: {force_expand?: boolean} = {}): GenericThread => {
        options.force_expand ??= false;
        // TODO filter out 'more' listings and make them into load_next items on the replies item
        if(listing_raw.kind === "t1") {
            // Comment
            const listing = listing_raw.data;

            const is_deleted = listing.author === "[deleted]";
            const post_id_no_pfx = listing.name.substring(3);

            const result: GenericThread = {
                body: is_deleted
                    ? {kind: "removed", by: listing.body === "[removed]" ? "moderator" : "author",
                        fetch_path: "https://api.pushshift.io/reddit/comment/search?ids="+post_id_no_pfx,
                    }
                    : {kind: "text", content: listing.body, markdown_format: "reddit"},
                display_mode: {body: "visible", comments: "visible"},
                raw_value: listing_raw,
                link: listing.permalink,
                layout: "reddit-comment",
                info: {
                    time: listing.created_utc * 1000,
                    author: {
                        name: "u/"+listing.author,
                        link: "/u/"+listing.author,
                        flair: flairToGenericFlair(listing.author_flair_richtext),
                    },
                },
                actions: [{
                    kind: "reply",
                    text: "Reply",
                }, {
                    kind: "link",
                    text: "Permalink",
                    url: listing.permalink,
                }],
            };
            if(listing.replies) {
                result.replies = {
                    load_prev: "TODO listing.replies.data.before",
                    loaded: listing.replies.data.children.map(v => threadFromListing(v)),
                    load_next: "TODO listing.replies.data.after",
                };
            }
            return result;
        }else if(listing_raw.kind === "t3") {
            const listing = listing_raw.data;
            // if((listing as any).preview) console.log((listing as any).preview);

            const is_deleted = listing.author === "[deleted]";
            const post_id_no_pfx = listing.name.substring(3);

            const content_warnings: GenericFlair[] = [];
            if(listing.spoiler) content_warnings.push({elems: [{type: "text", text: "Spoiler"}], content_warning: true});
            if(listing.over_18) content_warnings.push({elems: [{type: "text", text: "NSFW"}], content_warning: true});

            const result: GenericThread = {
                title: {
                    text: listing.title,
                },
                flair: [...flairToGenericFlair(listing.link_flair_richtext), ...content_warnings],
                body: is_deleted && listing.is_self
                    ? {kind: "removed", by: listing.selftext === "[removed]" ? "moderator" : "author",
                        fetch_path: "https://api.pushshift.io/reddit/submission/search?ids="+post_id_no_pfx,
                    }
                    : listing.crosspost_parent_list && listing.crosspost_parent_list.length === 1
                    ? {kind: "crosspost", source:
                        threadFromListing({kind: "t3", data: listing.crosspost_parent_list[0]}, {force_expand: true})
                    }
                    : listing.is_self
                    ? listing.selftext_html
                        ? {kind: "text", content: listing.selftext, markdown_format: "reddit"}
                        : {kind: "none"}
                    : listing.gallery_data
                    ? {kind: "image_gallery", images: listing.gallery_data.items.map(gd => {
                        const moreinfo = listing.media_metadata![gd.media_id];
                        return {
                            thumb: moreinfo.p[0].u,
                            thumb_w: moreinfo.p[0].x,
                            thumb_h: moreinfo.p[0].y,
                            url: moreinfo.s.u,
                            w: moreinfo.s.x,
                            h: moreinfo.s.y,
                            caption: gd.caption,
                        };
                    })}
                    : {kind: "link", url: listing.url, embed_html: listing.media_embed?.content}
                ,
                display_mode: {body: options.force_expand ? "visible" : "collapsed", comments: "collapsed"},
                raw_value: listing_raw,
                link: listing.permalink,
                thumbnail: options.force_expand
                    ? undefined
                    : listing.preview
                    ? {url: listing.preview.images[0].resolutions[0].url}
                    : {url: listing.thumbnail ?? "none"}
                ,
                layout: "reddit-post",
                info: {
                    time: listing.created_utc * 1000,
                    author: {
                        name: "u/"+listing.author,
                        link: "/u/"+listing.author,
                        flair: flairToGenericFlair(listing.author_flair_richtext),
                    },
                },
                actions: [{
                    kind: "link",
                    url: listing.permalink,
                    text: listing.num_comments + " comment"+(listing.num_comments === 1 ? "" : "s"),
                }],
            };
            return result;
        }else{
            return {
                title: {text: "unsupported listing kind "+(listing_raw as any).data.kind},
                body: {kind: "text", content: "unsupported", markdown_format: "none"},
                display_mode: {body: "collapsed", comments: "collapsed"},
                raw_value: listing_raw,
                link: "TODO no link",
                layout: "error",
                info: {time: 0,
                    author: {name: "no one", link: "TODO no link"},
                },
                actions: [],
            };
        }
        // console.log("Post: ",listing);
        
    }

    const res: ThreadClient = {
        id: "reddit",
        links: () => [
            ["Home", () => "/"],
            ["r/test", () => "/r/test"],
            ["Notifications", () => "/message/inbox"],
        ],
        isLoggedIn,
        getLoginURL() {
            const state = location.host;
            const scope =
                "identity edit flair history modconfig modflair modlog" + " " +
                "modposts modwiki mysubreddits privatemessages read report save" + " " +
                "submit subscribe vote wikiedit wikiread"
            ;

            const url = `https://www.reddit.com/api/v1/authorize` +
                query({client_id, response_type: "code", state, redirect_uri, duration: "permanent", scope})
            ;
            return url;
        },
        async getThread(path): Promise<GenericPage> {
            try {
                const [status, listing] = await fetch(pathURL(path), {
                    mode: "cors", credentials: "omit",
                    headers: isLoggedIn() ? {
                        'Authorization': await getAuthorization(),
                    } : {},
                }).then(async (v) => {
                    return [v.status, await v.json() as RedditPage | RedditListing] as const;
                });
                if(status !== 200) {
                    console.log(status, listing);
                    throw new Error("Got status "+status);
                }

                return pageFromListing(listing);
            }catch(e) {
                console.log(e);
                const is_networkerror = e.toString().includes("NetworkError");
                
                return {
                    header: {
                        title: {text: "Error"},
                        body: {
                            kind: "text",
                            content: `Error ${e.toString()}`+ (is_networkerror
                                ? `. If using Firefox, try disabling 'Enhanced Tracker Protection' ${""
                                    } for this site. Enhanced tracker protection indiscriminately blocks all ${""
                                    } requests to social media sites, including Reddit.`
                                : `.`
                            ),
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
                    },
                };
            }
        },
        async login(query) {
            const code = query.get("code");
            const state = query.get("state");

            if(!code || !state) {
                throw new Error("No login requested");
            }
            if(state !== location.host) {
                throw new Error("Login was for "+state);
            }

            const v = await fetch("https://www.reddit.com/api/v1/access_token", {
                method: "POST", mode: "cors", credentials: "omit",
                headers: {
                    'Authorization': "Basic "+btoa(client_id+":"),
                    'Content-Type': "application/x-www-form-urlencoded",
                },
                body: url`grant_type=authorization_code&code=${code}&redirect_uri=${redirect_uri}`,
            }).then(v => v.json());
        
            if(v.error) {
                console.log(v.error);
                throw new Error("error "+v.error);
            }

            const res_data = {
                access_token: v.access_token,
                refresh_token: v.refresh_token,
                expires: Date.now() + (v.expires_in * 1000),
                scope: v.scope,
            };

            console.log(v, res_data);

            localStorage.setItem("reddit-secret", JSON.stringify(res_data));
        },
        async fetchRemoved(frmlink: string): Promise<GenericBody> {
            type PushshiftResult = {data: {selftext?: string, body?: string}[]};
            const [status, res] = await fetch(frmlink).then(async (v) => {
                return [v.status, await v.json() as PushshiftResult] as const;
            });
            if(status !== 200) {
                console.log(status, res);
                throw new Error("Got status "+status);
            }
            if(res.data.length === 0) {
                console.log(status, res);
                throw new Error("Did not find post "+status);
            }
            if(res.data[0].selftext) {
                return {
                    kind: "text",
                    content: res.data[0].selftext,
                    markdown_format: "reddit",
                };
            }
            if(res.data[0].body) {
                return {
                    kind: "text",
                    content: res.data[0].body,
                    markdown_format: "reddit",
                };
            }
            throw new Error("no selftext or body");
        }
    };
    return res;
}

function clientLogin(client: ThreadClient, on_complete: () => void) { return {insertBefore(parent: Node, before_once: Node | null) {
    const frame = document.createElement("div");
    parent.insertBefore(frame, before_once);

    const login_url = client.getLoginURL();
    uhtml.render(frame, html`<a href="${login_url}" rel="noreferrer noopener" target="_blank">Log In</a>`);

    let done = false;
    const event_listener = () => {
        if(!done && client.isLoggedIn()) {
            done = true;
            uhtml.render(frame, html`Logged In!`);
            on_complete();
        }
    };
    document.addEventListener("focus", event_listener);

    return {removeSelf() {
        frame.remove();
        document.removeEventListener("focus", event_listener)
    } };
} } }

type MakeDeferReturn = ((handler: () => void) => void) & {cleanup: () => void};
const makeDefer = () => {
	let list: (() => void)[] = [];
	let res = (cb => {list.unshift(cb)}) as MakeDeferReturn;
	res.cleanup = () => {list.forEach(cb => cb())};
	return res;
};

function isModifiedEvent(event: MouseEvent) {
    return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

function linkButton(href: string) {
    // TODO get this to support links like https://….reddit.com/… and turn them into SPA links
    const res = el("a").attr({href, target: "_blank", rel: "noreferrer noopener"});
    if(href.startsWith("/")) res.onclick = event => {
        if (
            !event.defaultPrevented && // onClick prevented default
            event.button === 0 && // ignore everything but left clicks
            !isModifiedEvent(event) // ignore clicks with modifier keys
        ) {
            event.preventDefault();
            event.stopPropagation();
            navigate({path: href});
        }
    };
    return res;
}

function embedYoutubeVideo(youtube_video_id: string, opts: {autoplay: boolean}): {node: Node, onhide?: () => void, onshow?: () => void} {
    const yt_player = el("iframe").attr({
        allow: "fullscreen",
        src: "https://www.youtube.com/embed/"+youtube_video_id+"?version=3&enablejsapi=1&playerapiid=ytplayer"+(opts.autoplay ? "&autoplay=1" : ""),
    });
    return {node: el("div").clss("resizable-iframe").styl({width: "640px", height: "360px"}).adch(yt_player), onhide: () => {
        yt_player.contentWindow?.postMessage(JSON.stringify({event: "command", func: "pauseVideo", args: ""}), "*");
    }};
}

function renderLinkPreview(link: string, opts: {autoplay: boolean, suggested_embed?: string}): {node: Node, onhide?: () => void, onshow?: () => void} {
    let url: URL | undefined;
    try { 
        url = new URL(link);
    }catch(e) {console.log("could not parse preview url:", link, e);}
    const path = url?.pathname ?? link;
    if(link.startsWith("https://i.redd.it/")
        || path.endsWith(".png") || path.endsWith(".jpg")
        || path.endsWith(".jpeg")|| path.endsWith(".gif")
    ) {
        let img = el("img").clss("preview-image").attr({src: link});
        // a resizable image can be made like this
        // .resizable { display: inline-block; resize: both; overflow: hidden; line-height: 0; }
        return {node: el("a").adch(img).attr({href: link, target: "_blank", rel: "noreferrer noopener"})};
    }
    if(link.startsWith("https://v.redd.it/")) {
        let container = el("div");

        let video = el("video").attr({controls: ""}).clss("preview-image").adto(container);
        el("source").attr({src: link+"/DASH_720.mp4", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_480.mp4", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_360.mp4", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_240.mp4", type: "video/mp4"}).adto(video);
        
        let audio = el("audio").adto(container);
        el("source").attr({src: link+"/DASH_audio.mp4", type: "video/mp4"}).adto(audio);

        // TODO:
        // - proper sync accounting for audio buffering
        // - custom player:
        //   - audio volume controls
        //   - /DASH_96.mp4 preview when hovering the scrubber bar

        const sync = () => {
            audio.currentTime = video.currentTime;
            audio.playbackRate = video.playbackRate;
        };
        video.onplay = () => {
            sync();
            audio.play();
        };
        video.onplaying = () => {
            sync();
            audio.play();
        };
        video.onseeking = () => sync();
        video.ontimeupdate = () => {
            if(!video.paused) return;
            sync();
        };
        video.onpause = () => {
            audio.pause();
            sync();
        };

        let playing_before_hide = false;

        return {node: container, onhide: () => {
            playing_before_hide = !video.paused;
            video.pause();
        }, onshow: () => {
            if(playing_before_hide) video.play();
        }};
    }
    if(url && (url.host === "www.youtube.com" || url.host === "youtube.com") && url.pathname === "/watch") {
        const link = url.searchParams.get("v");
        if(link) {
            return embedYoutubeVideo(link, opts);
        }
    }
    if(url && (url.host === "youtu.be") && url.pathname.split("/").length === 2) {
        const youtube_video_id = url.pathname.split("/")[1] ?? "no_id";
        return embedYoutubeVideo(youtube_video_id, opts);
    }
    if(link.startsWith("https://www.reddit.com/gallery/")) {
        // information about galleries is distributed with posts
        // do nothing I guess
    }
    if(link.startsWith("https://imgur.com/")) {
        const iframe = el("iframe").attr({src: link + "/embed"});
        return {node: el("div").clss("resizable-iframe").styl({width: "500px", height: "500px"}).adch(iframe)};
    }
    if(opts.suggested_embed) {
        try {
            // const parser = new DOMParser();
            // const doc = parser.parseFromString(opts.suggested_embed, "text/html");
            // const iframe = doc.childNodes[0].childNodes[1].childNodes[0];
            const template_el = el("template");
            template_el.innerHTML = opts.suggested_embed;
            const iframe_unsafe = template_el.content.childNodes[0] as HTMLIFrameElement;

            console.log(iframe_unsafe, iframe_unsafe.width, iframe_unsafe.height);

            const iframe = el("iframe").attr({src: iframe_unsafe.src, allow: iframe_unsafe.allow, allowfullsreen: ""});
            return {node: el("div").clss("resizable-iframe").styl({width: iframe_unsafe.width+"px", height: iframe_unsafe.height+"px"}).adch(iframe)};
        }catch(e) {
            console.log(e);
        }
    }
    return {node: document.createComment("Preview not supported yet")};
}

function renderImageGallery(images: GenericGalleryImages): Node {
    let container = el("div");
    type State = "overview" | {
        index: number
    };
    let state: State = "overview";
    let setState = (newState: State) => {
        state = newState;
        uhtml.render(container, update());
    }

    let update = () => {
        if(state === "overview") {
            return html`${images.map((image, i) => html`
                <button class="gallery-overview-item" onclick=${() => {setState({index: i});}}>
                    <img src=${image.thumb} width=${image.thumb_w} height=${image.thumb_h}
                        class="preview-image gallery-overview-image"
                    />
                </button>
            `)}`;
        }
        let index = state.index;
        const selimg = images[index];
        return html`
            <button onclick=${() => setState({index: index - 1})} disabled=${index <= 0 ? "" : undefined}>Prev</button>
            ${index + 1}/${images.length}
            <button onclick=${() => setState({index: index + 1})} disabled=${index >= images.length - 1 ? "" : undefined}>Next</button>
            <button onclick=${() => setState("overview")}>Gallery</button>
            ${selimg.caption ? html`<div>${selimg.caption}</div>` : ""}
            <div><a href=${selimg.url} rel="noreferrer noopener" target="_blank">
                <img src=${selimg.url} width=${selimg.w} height=${selimg.h} class="preview-image" />
            </a></div>
        `;
        // TODO display a loading indicator while the image loads
    };

    setState(state);
    return container;
}

function renderFlair(flairs: GenericFlair[]) {
    let resl = document.createDocumentFragment();
    for(const flair of flairs) {
        let flairv = el("span").clss("flair");
        resl.atxt(" ");
        for(const flairelem of flair.elems) {
            if(flairelem.type === "text") {
                flairv.atxt(flairelem.text);
            }else if(flairelem.type === "emoji") {
                el("img").attr({title: flairelem.name, src: flairelem.url}).clss("flair-emoji").adto(flairv);
            }else assertNever(flairelem);
        }
        resl.adch(flairv);
    }
    return resl;
}

function s(number: number, text: string) {
    if(!text.endsWith("s")) throw new Error("!s");
    if(number == 1) return number + text.substring(0, text.length - 1);
    return number + text;
}

// TODO replace this with a proper thing that can calculate actual "months ago" values
function timeAgo(start_ms: number) {
    const ms = Date.now() - start_ms;
    if(ms < 60 * 1000) return "just now";
    if(ms < 60 * 60 * 1000) {
        const minutes = ms / (60 * 1000) |0;
        return s(minutes, " minutes")+" ago";
    }
    if(ms < 24 * 60 * 60 * 1000) {
        const hours = ms / (60 * 60 * 1000) |0;
        return s(hours, " hours")+" ago";
    }
    if(ms < 7 * 24 * 60 * 60 * 1000) {
        const days = ms / (24 * 60 * 60 * 1000) |0;
        return s(days, " days")+" ago";
    }
    if(ms < 3 * 7 * 24 * 60 * 60 * 1000) {
        const weeks = ms / (7 * 24 * 60 * 60 * 1000) |0;
        return s(weeks, " weeks")+" ago";
    }
    return new Date(start_ms).toISOString();
}

function clientListing(client: ThreadClient, listing: GenericThread) { return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();
    // console.log(listing);

    const frame = el("div").clss("post");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    let thumbnail_loc: HTMLButtonElement;
    let preview_area: HTMLDivElement;
    let replies_area: HTMLDivElement;

    let content_title_line: HTMLDivElement;
    let content_subminfo_line: HTMLDivElement;
    let content_buttons_line: HTMLDivElement;

    if(listing.layout === "reddit-post") {
        thumbnail_loc = el("button").adto(frame).clss("post-thumbnail");
        if(!listing.thumbnail) thumbnail_loc.clss("no-thumbnail");
        const content_area = el("div").adto(frame).clss("post-titles");
        preview_area = el("div").adto(frame).clss("post-preview");
        replies_area = el("div").adto(frame).clss("post-replies");

        content_title_line = el("div").adto(content_area).clss("post-content-title");
        content_subminfo_line = el("div").adto(content_area).clss("post-content-subminfo");
        content_buttons_line = el("div").adto(content_area).clss("post-content-buttons");
    }else if(listing.layout === "reddit-comment") {
        content_title_line = el("div").adto(frame).clss("post-content-title"); // unused
        thumbnail_loc = el("button").adto(frame).clss("post-thumbnail"); // unused
        content_subminfo_line = el("div").adto(frame).clss("post-content-subminfo");
        preview_area = el("div").adto(frame).clss("post-preview"); // unused
        content_buttons_line = el("div").adto(frame).clss("post-content-buttons");
        replies_area = el("div").adto(frame).clss("post-replies");
    }else if(listing.layout === "error") {
        content_title_line = el("div").adto(frame).clss("post-content-title"); // unused
        thumbnail_loc = el("button").adto(frame).clss("post-thumbnail"); // unused
        content_subminfo_line = el("div").adto(frame).clss("post-content-subminfo");
        preview_area = el("div").adto(frame).clss("post-preview"); // unused
        content_buttons_line = el("div").adto(frame).clss("post-content-buttons");
        replies_area = el("div").adto(frame).clss("post-replies");
    }else assertNever(listing.layout);

    frame.clss("layout-"+listing.layout);

    if(listing.flair) {
        content_title_line.adch(renderFlair(listing.flair.filter(v => v.content_warning)));
        content_title_line.atxt(" ");
    }
    if(listing.title) {
        content_title_line.atxt(listing.title.text);
        // for(listing.title.flair) |flair| // uuh
    }
    if(listing.flair) {
        content_title_line.atxt(" ");
        content_title_line.adch(renderFlair(listing.flair.filter(v => !v.content_warning)));
    }
    let content_warnings = (listing.flair ?? []).filter(v => v.content_warning);

    if(listing.layout === "reddit-post") {
        const submission_time = el("span").atxt(timeAgo(listing.info.time)).attr({title: "" + new Date(listing.info.time)});
        content_subminfo_line.adch(submission_time).atxt(" by ");
        content_subminfo_line.adch(linkButton("/"+client.id+listing.info.author.link).atxt(listing.info.author.name));
        if(listing.info.author.flair) content_subminfo_line.adch(renderFlair(listing.info.author.flair));
    }else if(listing.layout === "reddit-comment") {
        content_subminfo_line.adch(linkButton("/"+client.id+listing.info.author.link).atxt(listing.info.author.name));
        if(listing.info.author.flair) content_subminfo_line.adch(renderFlair(listing.info.author.flair));
        const submission_time = el("span").atxt(timeAgo(listing.info.time)).attr({title: "" + new Date(listing.info.time)});
        content_subminfo_line.atxt(", ").adch(submission_time);
    }

    if(listing.body) {
        const content = el("div");

        if(listing.thumbnail) {
            if(listing.thumbnail.url === "none" || listing.thumbnail.url === "") {
                thumbnail_loc.classList.add("no-thumbnail");
            }else if(listing.thumbnail.url === "self") {
                thumbnail_loc.adch(el("div").clss("thumbnail-builtin", "thumbnail-self"));
            }else if(listing.thumbnail.url === "default") {
                thumbnail_loc.adch(el("div").clss("thumbnail-builtin", "thumbnail-default"));
            }else if(listing.thumbnail.url === "image") {
                thumbnail_loc.adch(el("div").clss("thumbnail-builtin", "thumbnail-image"));
            }else {
                thumbnail_loc.adch(el("img").attr({src: listing.thumbnail.url}));
                if(content_warnings.length) thumbnail_loc.clss("thumbnail-content-warning");
            }
        }

        let onhide = () => {};
        let onshow = () => {};
        let initContent = (body: GenericBody, opts: {autoplay: boolean}) => {
            if(content_warnings.length) {
                const cws = content_warnings;
                content_warnings = [];
                const cwbox = el("div").adto(content);
                cwbox.atxt("Content Warning"+(cws.length === 1 ? "" : "s")+": ");
                cwbox.adch(renderFlair(cws));
                cwbox.atxt(" ");
                el("button").adto(cwbox).atxt("Show Content").onev("click", e => {
                    cwbox.remove();
                    thumbnail_loc.classList.remove("thumbnail-content-warning");
                    initContent(body, opts);
                });
                return;
            }

            if(body.kind === "text") {
                const elv = el("div").adto(content);
                if(body.markdown_format === "reddit") {
                    el("code").atxt(body.content).adto(el("pre").adto(elv));
                }else if(body.markdown_format === "none") {
                    elv.atxt(body.content);
                }else assertNever(body.markdown_format);
            }else if(body.kind === "link") {
                // TODO fix this link button thing
                el("div").adto(content).adch(linkButton(body.url).atxt(body.url));
                const preview = renderLinkPreview(body.url, {autoplay: opts.autoplay, suggested_embed: body.embed_html});
                preview.node.adto(content);
                if(preview.onhide) onhide = preview.onhide;
                if(preview.onshow) onshow = preview.onshow;
            }else if(body.kind === "none") {
                content.remove();
            }else if(body.kind === "image_gallery") {
                renderImageGallery(body.images).adto(content);
            }else if(body.kind === "removed") {
                const removed_v = el("div").adto(content).atxt("Removed by "+body.by+".");
                if(body.fetch_path && client.fetchRemoved) {
                    const fetch_btn = el("button").adto(removed_v).atxt("View");
                    // so this is a place where it would be helpful to update the entire listing
                    // unfortunately, this is not react or uil and that can't be done easily
                    // given how stateful listings are
                    // for now, just update the body.
                    fetch_btn.onev("click", async () => {
                        let new_body: GenericBody;
                        let errored = false;
                        fetch_btn.textContent = "…";
                        fetch_btn.disabled = true;
                        try {
                            new_body = await client.fetchRemoved!(body.fetch_path);
                        }catch(e) {
                            errored = true;
                            console.log(e);
                            new_body = {kind: "text", content: "Error! "+e.toString(), markdown_format: "none"};
                        }
                        fetch_btn.textContent = errored ? "Retry" : "Loaded";
                        fetch_btn.disabled = false;
                        if(!errored) removed_v.remove();
                        initContent(new_body, {autoplay: true});
                    });
                }
            }else if(body.kind === "crosspost") {
                const child = clientListing(client, body.source).insertBefore(content, null);
                // TODO child.onShow, child.onHide
                defer(() => child.removeSelf());
            }else assertNever(body);
        };

        if(listing.display_mode.body === "collapsed") {
            const open_preview_button = el("button").adto(content_buttons_line);
            const open_preview_text = txt("Show").adto(open_preview_button);

            let initialized = false;
            let state = false;
            let prev_state = true;
            const update = () => {
                if(state && !initialized) {
                    initialized = true;
                    initContent(listing.body, {autoplay: true});
                }
                open_preview_text.nodeValue = state ? "Hide" : "Show";
                content.style.display = state ? "" : "none";
                if(state !== prev_state) {
                    prev_state = state;
                    if(state) onshow();
                    else onhide();
                }
            };
            update();
            open_preview_button.onev("click", () => {
                state =! state;
                update();
            });
            thumbnail_loc.onev("click", () => {
                state =! state;
                update();
            });
        }else{
            initContent(listing.body, {autoplay: false});
        }
        content.clss("post-body");
        content.adto(preview_area);
    }

    for(const action of listing.actions) {
        content_buttons_line.atxt(" ");
        if(action.kind === "link") linkButton("/"+client.id+action.url).atxt(action.text).adto(content_buttons_line);
        else if(action.kind === "reply") el("span").atxt("[reply]").adto(content_buttons_line);
        else assertNever(action);
    }

    content_buttons_line.atxt(" ");
    linkButton("/"+client.id+listing.link).atxt("[View]").adto(content_buttons_line);
    content_buttons_line.atxt(" ");
    el("button").onev("click", e => {
        console.log(listing);
    }).atxt("[Code]").adto(content_buttons_line);

    const children_node = el("ul").clss("replies").adto(replies_area);

    const addChildren = (children: GenericThread[], li_before_once: Node | null) => {
        for(const child_listing of children) {
            const reply_node = el("li").clss("comment");
            const child_node = clientListing(client, child_listing).insertBefore(reply_node, null);
            defer(() => child_node.removeSelf());
            children_node.insertBefore(reply_node, li_before_once);
        }
    }
    if(listing.replies) addChildren(listing.replies.loaded, null);

    return {removeSelf: () => defer.cleanup()};
} } }

function clientMain(client: ThreadClient, current_path: string) { return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();

    const frame = document.createElement("div");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    if(!client.isLoggedIn()) {
        const login_prompt: {removeSelf: () => void} = clientLogin(client, () => login_prompt.removeSelf()).insertBefore(frame, null);
        defer(() => login_prompt.removeSelf());
        // return {removeSelf: () => defer.cleanup(), hide: () => {}, show: () => {}};
    }
    const frame_uhtml_area = document.createElement("div");
    frame.appendChild(frame_uhtml_area);

    uhtml.render(frame_uhtml_area, html`Loading…`);

    (async () => {
        const home_thread = await client.getThread(current_path);
        
        uhtml.render(frame_uhtml_area, html``);
        const home_node = clientListing(client, home_thread.header).insertBefore(frame, null);
        defer(() => home_node.removeSelf());

        const addChildren = (children: GenericThread[]) => {
            for(const child_listing of children) {
                const replies_node = clientListing(client, child_listing).insertBefore(frame, null);
                defer(() => replies_node.removeSelf());
            }
        };
        if(home_thread.replies) addChildren(home_thread.replies.loaded);
        
    })().catch(e => console.log(e));

    return {removeSelf: () => defer.cleanup(), hide: () => {
        if(frame.style.display !== "none") frame.style.display = "none";
    }, show: () => {
        if(frame.style.display !== "") frame.style.display = "";
    }};
} } }

function fullscreenError(message: string) { return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();

    const frame = document.createElement("div");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    frame.appendChild(document.createTextNode(message));

    return {removeSelf: () => defer.cleanup(), hide: () => {
        if(frame.style.display !== "none") frame.style.display = "none";
    }, show: () => {
        if(frame.style.display !== "") frame.style.display = "";
    }};
} } }

function clientLoginPage(client: ThreadClient, query: URLSearchParams) { return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();

    const frame = document.createElement("div");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    uhtml.render(frame, uhtml.html`<div>…</div>`);
    (async () => {
        uhtml.render(frame, uhtml.html`<div>Logging In…</div>`);
        try {
            await client.login(query);
        }catch(e) {
            console.log(e);
            // TODO if this is the only open history item, don't target _blank
            const login_url = client.getLoginURL();
            uhtml.render(frame, uhtml.html`<div class="error">Login error! ${e.toString()}. <a href="${login_url}" rel="noreferrer noopener" target="_blank">Retry</a></div>`);
            return;
        }
        // if this page is still active, navigate({path: "/login/success", replace: true}); to get rid of the token in the url
        uhtml.render(frame, uhtml.html`<div>Logged In! You may now close this page.</div>`);
    })();

    return {removeSelf: () => defer.cleanup(), hide: () => {
        if(frame.style.display !== "none") frame.style.display = "none";
    }, show: () => {
        if(frame.style.display !== "") frame.style.display = "";
    }};
} } }


window.onpopstate = (ev: PopStateEvent) => {
    // onNavigate(ev?.state.index ?? 0);
    console.log("onpopstate. ev:",ev.state);
    if(ev.state?.session_name !== session_name) {
        console.log("Going to history item from different session");
        onNavigate(0, location);
        return;
    }
    onNavigate(ev.state?.index ?? 0, location);
};

const client_cache: {[key: string]: ThreadClient} = {};
const client_initializers: {[key: string]: () => ThreadClient} = {
    reddit: () => reddit(),
};
const getClient = (name: string) => {
    if(!client_initializers[name]) return undefined;
    if(!client_cache[name]) client_cache[name] = client_initializers[name]();
    if(client_cache[name].id !== name) throw new Error("client has incorrect id");
    return client_cache[name];
}

type NavigationEntryNode = {removeSelf: () => void, hide: () => void, show: () => void};
type NavigationEntry = {url: string, node: NavigationEntryNode};
const nav_history: NavigationEntry[] = [];

let session_name = "" + Math.random();

function navigate({path, replace}: {path: string, replace?: boolean}) {
    if(!replace) replace = false;
    if(replace) {
        console.log("Replacing history item", current_history_index, path);
        nav_history[current_history_index] = {url: "::redirecting::", node: {removeSelf: () => {}, hide: () => {}, show: () => {}}};
        history.replaceState({index: current_history_index, session_name}, "ThreadReader", path);
        onNavigate(current_history_index, location);
    }else{
        console.log("Appending history state index", current_history_index + 1, path);
        history.pushState({index: current_history_index + 1, session_name}, "ThreadReader", path);
        onNavigate(current_history_index + 1, location);
    }
}

type URLLike = {search: string, pathname: string};

let navigate_event_handlers: ((url: URLLike) => void)[] = [];

let current_history_index = 0;
function onNavigate(to_index: number, url: URLLike) {
    console.log("Navigating", to_index, url, nav_history);
    navigate_event_handlers.forEach(evh => evh(url));

    const thisurl = url.pathname + url.search;
    current_history_index = to_index;
    if(nav_history[to_index]) {
        // hide all history
        nav_history.forEach(item => item.node.hide());
        if(nav_history[to_index].url !== thisurl) {
            console.log("URLS differ. «", nav_history[to_index].url, "» «", thisurl, "»");
            
            // a b c d to_index [… remove these]
            for(let i = nav_history.length - 1; i >= to_index; i--) {
                nav_history.pop()!.node.removeSelf();
            }
        }else{
            // show the current history
            nav_history[to_index].node.show();
            return; // done
        }
    }else{
        nav_history.forEach(item => item.node.hide());
    }

    const path = url.pathname.split("/").filter(w => w);

    const path0 = path.shift();

    console.log(path);

    if(!path0) {
        navigate({path: "/reddit", replace: true});
        return;
    }

    const node: NavigationEntryNode = (() => {
        if(path0 === "login"){
            const client = getClient(path[0]);
            if(!client) {
                return fullscreenError("404 unknown client "+path[0]).insertBefore(document.body, null);
            }
            return clientLoginPage(client, new URLSearchParams(location.search)).insertBefore(document.body, null);
        }

        const client = getClient(path0);

        if(!client){
            return fullscreenError("404 unknown client "+path0).insertBefore(document.body, null);
        }
        return clientMain(client, "/"+path.join("/")+url.search).insertBefore(document.body, null);
    })();

    nav_history[to_index] = {node, url: thisurl}
}

{
    let spa_navigator_frame = document.createElement("div");
    document.body.appendChild(spa_navigator_frame);
    let spa_navigator_input = document.createElement("input");
    spa_navigator_frame.appendChild(spa_navigator_input);
    let spa_navigator_button = document.createElement("button");
    spa_navigator_button.appendChild(document.createTextNode("⏎"));
    spa_navigator_frame.appendChild(spa_navigator_button);
    let spa_navigator_refresh = document.createElement("button");
    spa_navigator_refresh.appendChild(document.createTextNode("🗘"));
    spa_navigator_frame.appendChild(spa_navigator_refresh);

    const go = () => navigate({path: spa_navigator_input.value});
    spa_navigator_button.onclick = () => go();
    spa_navigator_input.onkeydown = k => k.key === "Enter" ? go() : 0;

    spa_navigator_refresh.onclick = () => alert("TODO refresh");

    navigate_event_handlers.push(url => spa_navigator_input.value = url.pathname + url.search);
}

history.replaceState({index: 0, session_name}, "ThreadReader", location.pathname + location.search + location.hash);
onNavigate(0, location);