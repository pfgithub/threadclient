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
};

type RedditPostComment = RedditPostBase & {
    body_html: string,
    replies?: RedditListing,
};

type RedditPost = {
    kind: "t3",
    data: RedditPostSubmission,
} | {
    kind: "t1",
    data: RedditPostComment,
};

type GenericPage = {
    header: GenericThread,
    replies?: {load_prev?: string, loaded: GenericThread[], load_next?: string},
};
type GenericThread = {
    title?: string,
    body: {
        kind: "text",
        content_html: string,
    } | {
        kind: "link",
        url: string,
    } | {
        kind: "image_gallery",
        images: GenericGalleryImages,
    } | {
        kind: "none",
    },
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
    
    content_warnings?: GenericContentWarning[],
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
type GenericContentWarning = {name: string};

type ThreadClient = {
    id: string,
    links: () => [string, () => string][]
    isLoggedIn: () => boolean,
    getLoginURL: () => string,
    getThread: (path: string) => Promise<GenericPage>,
    login: (query: URLSearchParams) => Promise<void>,
};

function assertNever(content: never) {
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
            alert("REFRESHED TOKEN, CHECK CONSOLE!");
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
                header: threadFromListing(listing[0].data.children[0]),
                replies: {
                    load_prev: "TODO listing[1].data.before",
                    loaded: listing[1].data.children.map(child => threadFromListing(child)),
                    load_next: "TODO listing[1].data.after",
                },
            };
        }
        return {
            header: {
                title: "Listing",
                body: {kind: "text", content_html: safehtml`Listing`},
                display_mode: {body: "collapsed", comments: "collapsed"},
                link: "TODO no link",
                layout: "error",
            },
            replies: {
                load_prev: "TODO listing.data.before",
                loaded: listing.data.children.map(child => threadFromListing(child)),
                load_next: "TODO listing.data.after",
            },
        };
    };
    const threadFromListing = (listing_raw: RedditPost): GenericThread => {
        if(listing_raw.kind === "t1") {
            // Comment
            const listing = listing_raw.data;
            const result: GenericThread = {
                body: {kind: "text", content_html: listing.body_html},
                display_mode: {body: "visible", comments: "visible"},
                raw_value: listing_raw,
                link: listing.permalink,
                layout: "reddit-comment",
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
            const result: GenericThread = {
                title: listing.title ?? "",
                body: listing.is_self
                    ? listing.selftext_html
                        ? {kind: "text", content_html: listing.selftext_html}
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
                    : {kind: "link", url: listing.url}
                ,
                display_mode: {body: "collapsed", comments: "collapsed"},
                raw_value: listing_raw,
                link: listing.permalink,
                thumbnail: listing.preview
                    ? {url: listing.preview.images[0].resolutions[0].url}
                    : {url: listing.thumbnail ?? "none"}
                ,
                layout: "reddit-post",
            };
            {
                const content_warnings: GenericContentWarning[] = [];
                if(listing.spoiler) content_warnings.push({name: "Spoiler"});
                if(listing.over_18) content_warnings.push({name: "Over 18"});
                result.content_warnings = content_warnings;
            }
            return result;
        }else{
            return {
                title: "unsupported listing kind "+(listing_raw as any).data.kind,
                body: {kind: "text", content_html: safehtml`unsupported`},
                display_mode: {body: "collapsed", comments: "collapsed"},
                raw_value: listing_raw,
                link: "TODO no link",
                layout: "error",
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
                        title: "Error",
                        body: {
                            kind: "text",
                            content_html: safehtml`Error ${e.toString()}`+ (is_networkerror
                                ? safehtml`. If using Firefox, try disabling 'Enhanced Tracker Protection' ${""
                                    } for this site. Enhanced tracker protection indiscriminately blocks all ${""
                                    } requests to social media sites, including Reddit.`
                                : safehtml`.`
                            ),
                        },
                        display_mode: {
                            body: "visible",
                            comments: "collapsed",
                        },
                        link: "TODO no link",
                        layout: "error",
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

function renderLinkPreview(link: string): {node: Node, onhide?: () => void, onshow?: () => void} {
    if(link.startsWith("https://i.redd.it/")
        || link.endsWith(".png") || link.endsWith(".jpg")
        || link.endsWith(".jpeg")|| link.endsWith(".gif")
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
    if(link.startsWith("https://youtu.be/")) {
        const youtube_video_id = link.split("/")[3] ?? "no_id";
        const yt_player = el("iframe").attr({
            width: "640", height: "360", allow: "fullscreen",
            src: "https://www.youtube.com/embed/"+youtube_video_id+"?autoplay=1&version=3&enablejsapi=1&playerapiid=ytplayer"
        });
        return {node: yt_player, onhide: () => {
            yt_player.contentWindow?.postMessage(JSON.stringify({event: "command", func: "pauseVideo", args: ""}), "*");
        }};
    }
    if(link.startsWith("https://www.reddit.com/gallery/")) {
        // information about galleries is distributed with posts
        // do nothing I guess
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

function clientListing(client: ThreadClient, listing: GenericThread) { return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();
    // console.log(listing);

    const frame = el("div").clss("post");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    const thumbnail_loc = el("button").adto(frame).clss("post-thumbnail");
    const content_area = el("div").adto(frame).clss("post-titles");
    const preview_area = el("div").adto(frame).clss("post-preview");
    const replies_area = el("div").adto(frame).clss("post-replies");

    frame.clss("layout-"+listing.layout);

    linkButton("/"+client.id+listing.link).atxt("[View]").adto(content_area);
    el("button").onev("click", e => {
        console.log(listing);
    }).atxt("[Code]").adto(content_area);

    if(listing.title) {
        el("div").adto(content_area).atxt(listing.title);
    }
    if(listing.body) {
        const content = el("div");

        if(listing.thumbnail) {
            if(listing.thumbnail.url === "none") {
                thumbnail_loc.adch(el("div").clss("thumbnail-builtin", "thumbnail-none"));
            }else if(listing.thumbnail.url === "self") {
                thumbnail_loc.adch(el("div").clss("thumbnail-builtin", "thumbnail-self"));
            }else if(listing.thumbnail.url === "default") {
                thumbnail_loc.adch(el("div").clss("thumbnail-builtin", "thumbnail-default"));
            }else if(listing.thumbnail.url === "image") {
                thumbnail_loc.adch(el("div").clss("thumbnail-builtin", "thumbnail-image"));
            }else {
                thumbnail_loc.adch(el("img").attr({src: listing.thumbnail.url}));
            }
        }

        let onhide = () => {};
        let onshow = () => {};
        let initContent = () => {
            if(listing.body.kind === "text") {
                const elv = el("div").adto(content);
                elv.innerHTML = listing.body.content_html;
            }else if(listing.body.kind === "link") {
                // TODO fix this link button thing
                el("div").adto(content).adch(linkButton(listing.body.url).atxt(listing.body.url));
                const preview = renderLinkPreview(listing.body.url);
                preview.node.adto(content);
                if(preview.onhide) onhide = preview.onhide;
                if(preview.onshow) onshow = preview.onshow;
            }else if(listing.body.kind === "none") {
                content.remove();
            }else if(listing.body.kind === "image_gallery") {
                renderImageGallery(listing.body.images).adto(content);
            }else assertNever(listing.body);
        };

        if(listing.display_mode.body === "collapsed") {
            const open_preview_button = el("button").adto(content_area);
            const open_preview_text = txt("Show").adto(open_preview_button);

            let initialized = false;
            let state = false;
            let prev_state = true;
            const update = () => {
                if(state && !initialized) {
                    initialized = true;
                    initContent();
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
            initContent();
        }
        content.clss("post-body");
        content.adto(preview_area);
    }

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