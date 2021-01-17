import * as Reddit from "./types/api/reddit.js";
import * as Generic from "./types/generic.js";
import {ThreadClient} from "./clients/base.js";
import { darkenColor, getRandomColor, hslToRGB, RGBA, rgbToHSL, rgbToString, seededRandom } from "./darken_color.js";
import { reddit } from "./clients/reddit.js";

declare const uhtml: any;

export const raw = (string: string) => ({__raw: "" + string, toString: () => string});
export const templateGenerator = <InType>(helper: (str: InType) => string) => {
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
export const url = templateGenerator<string>(str => encodeURIComponent(str));
export const html = uhtml.html;

export const query = (items: {[key: string]: string}) => {
    let res = "";
    for(const [key, value] of Object.entries(items)) {
        if(res) res += "&";
        res += url`${key}=${value}`;
    }
    return res;
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

function linkButton(client_id: string, href: string, opts: {onclick?: (e: MouseEvent) => void} = {}) {
    // TODO get this to support links like https://….reddit.com/… and turn them into SPA links
    if(href.startsWith("/")) {
        href = "/"+client_id+href;
    }
    if(!href.startsWith("http") && !href.startsWith("/")) {
        return el("a").clss("error").attr({title: href}).clss("error").onev("click", () => alert(href));
    }
    const replacers = {
        "https://www.reddit.com": "/reddit",
        "https://old.reddit.com": "/reddit",
        "http://reddit.com": "/reddit",
        "http://www.reddit.com":
        "/reddit"
    };
    for(const [replacer, value] of Object.entries(replacers)) {
        if(href === replacer) {
            href = value;
            break;
        }
        if(href.startsWith(replacer + "/")){
            href = href.replace(replacer + "/", value + "/");
            break;
        }
    }
    const res = el("a").attr({href, target: "_blank", rel: "noreferrer noopener"});
    if(href.startsWith("/") || opts.onclick) res.onclick = event => {
        if (
            !event.defaultPrevented && // onClick prevented default
            event.button === 0 && // ignore everything but left clicks
            !isModifiedEvent(event) // ignore clicks with modifier keys
        ) {
            event.preventDefault();
            event.stopPropagation();
            if(opts.onclick) return opts.onclick(event);
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

function canPreview(link: string, opts: {autoplay: boolean, suggested_embed?: string}): undefined | (() => {node: Node, onhide?: () => void, onshow?: () => void}) {
    let url_mut: URL | undefined;
    try { 
        url_mut = new URL(link);
    }catch(e) {}
    const url = url_mut;
    const path = url?.pathname ?? link;
    if(link.startsWith("https://i.redd.it/")
        || path.endsWith(".png") || path.endsWith(".jpg")
        || path.endsWith(".jpeg")|| path.endsWith(".gif")
    ) return () => {
        let img = el("img").clss("preview-image").attr({src: link});
        // a resizable image can be made like this
        // .resizable { display: inline-block; resize: both; overflow: hidden; line-height: 0; }
        return {node: el("a").adch(img).attr({href: link, target: "_blank", rel: "noreferrer noopener"})};
    };
    if(path.endsWith(".gifv")) return () => {
        let video = el("video").attr({controls: ""}).clss("preview-image");
        el("source").attr({src: link.replace(".gifv", ".webm"), type: "video/webm"}).adto(video);
        el("source").attr({src: link.replace(".gifv", ".mp4"), type: "video/mp4"}).adto(video);
        video.loop = true;
        return {node: video, onhide: () => video.pause()};
    };
    if(link.startsWith("https://v.redd.it/")) return () => {
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
    };
    if(url && (url.host === "www.youtube.com" || url.host === "youtube.com") && url.pathname === "/watch") {
        const link = url.searchParams.get("v");
        if(link) return () => {
            return embedYoutubeVideo(link, opts);
        };
    }
    if(url && (url.host === "youtu.be") && url.pathname.split("/").length === 2) return () => {
        const youtube_video_id = url.pathname.split("/")[1] ?? "no_id";
        return embedYoutubeVideo(youtube_video_id, opts);
    };
    if(link.startsWith("https://www.reddit.com/gallery/")) {
        // information about galleries is distributed with posts
        // do nothing I guess
    }
    if(link.startsWith("https://imgur.com/")) return () => {
        const iframe = el("iframe").attr({src: link + "/embed"});
        return {node: el("div").clss("resizable-iframe").styl({width: "500px", height: "500px"}).adch(iframe)};
    };
    if(opts.suggested_embed) return () => {
        try {
            // const parser = new DOMParser();
            // const doc = parser.parseFromString(opts.suggested_embed, "text/html");
            // const iframe = doc.childNodes[0].childNodes[1].childNodes[0];
            const template_el = el("template");
            template_el.innerHTML = opts.suggested_embed!;
            const iframe_unsafe = template_el.content.childNodes[0] as HTMLIFrameElement;

            console.log(iframe_unsafe, iframe_unsafe.width, iframe_unsafe.height);

            const parent_node = el("div").clss("resizable-iframe").styl({width: iframe_unsafe.width+"px", height: iframe_unsafe.height+"px"});
            let iframe: HTMLIFrameElement | undefined;
            const initFrame = () => {
                if(!iframe) iframe = el("iframe").attr({src: iframe_unsafe.src, allow: iframe_unsafe.allow, allowfullsreen: ""}).adto(parent_node);
            };
            initFrame();
            return {
                node: parent_node,
                onhide: () => {if(iframe) {iframe.remove(); iframe = undefined;}},
                onshow: () => {initFrame();},
            };
        }catch(e) {
            console.log(e);
            return {
                node: txt("Error! "+e.toString()),
            };
        }
    }
    return undefined;
}

function renderImageGallery(images: Generic.GalleryImages): Node {
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

function renderFlair(flairs: Generic.Flair[]) {
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
// returns [time_string, time_until_update]
function timeAgoText(start_ms: number): [string, number] {
    const ms = Date.now() - start_ms;
    if(ms < 0) return ["in the future", -ms];
    if(ms < 60 * 1000) return ["just now", 60 * 1000 - ms];

    let step = 60 * 1000;
    let next_step = 60;
    if(ms < next_step * step) {
        const minutes = ms / step |0;
        return [s(minutes, " minutes")+" ago", step - (ms - minutes * step)];
    }
    step *= next_step;
    next_step = 24;
    if(ms < next_step * step) {
        const hours = ms / step |0;
        return [s(hours, " hours")+" ago", step - (ms - hours * step)];
    }
    step *= next_step;
    next_step = 7;
    if(ms < next_step * step) {
        const days = ms / step |0;
        return [s(days, " days")+" ago", step - (ms - days * step)];
    }
    step *= next_step;
    next_step = 3;
    if(ms < next_step * step) {
        const weeks = ms / step |0;
        return [s(weeks, " weeks")+" ago", step - (ms - weeks * step)];
    }
    return [new Date(start_ms).toISOString(), -1];
}

// NOTE that this leaks memory as it holds onto nodes forever and updates them even
// when they are not being displayed. This can be fixed by uil in the future.
let leak_count = 0;
function timeAgo(start_ms: number): Node {
    leak_count += 1;
    const tanode = txt("…");
    const update = () => {
        const [newtext, wait_time] = timeAgoText(start_ms);
        tanode.nodeValue = newtext;
        if(wait_time >= 0) setTimeout(() => update(), wait_time + 100);
    };
    update();
    return tanode;
}

type RedditMarkdownRenderer = {
    renderMd(text: string): string,
};
let _reddit_markdown_renderer: (() => void)[] | RedditMarkdownRenderer | undefined;
async function getRedditMarkdownRenderer(): Promise<RedditMarkdownRenderer> {
    if(!_reddit_markdown_renderer) {
        _reddit_markdown_renderer = [];
        const enc = new TextEncoder();
        const dec = new TextDecoder();
        const getMem = () => obj.instance.exports.memory as WebAssembly.Memory;
        const obj = await WebAssembly.instantiate(await fetch("/snudown.wasm").then(v => v.arrayBuffer()), {
            env: {
                __assert_fail: (assertion: number, file: number, line: number, fn: number) => {
                    console.log(assertion, file, line, fn);
                    throw new Error("assert failed");
                },
                __stack_chk_fail: () => {
                    throw new Error("stack overflow");
                },
                debugprints: (text: number, len: number) => {
                    console.log("print text:",dec.decode(new Uint8Array(getMem().buffer, text, len)));
                },
                debugprinti: (intv: number) => {
                    console.log("print int:", intv);
                },
                debugprintc: (intv: number) => {
                    console.log("print char:", String.fromCodePoint(intv));
                },
                debugpanic: (text: number, len: number) => {
                    throw new Error("Panic: "+ dec.decode(new Uint8Array(getMem().buffer, text, len)));
                }
            },
        });
        const arrayv = _reddit_markdown_renderer;
        _reddit_markdown_renderer = {renderMd(md: string) {
            const exports = obj.instance.exports as {
                memory: WebAssembly.Memory,

                // (len: usize) => [*]u8
                //   creates a u8 array of specified length
                allocString: (len: number) => number,

                // (ptr: [*]u8, len: usize)
                //   frees a u8 array of specified length
                freeText: (ptr: number, len: number) => void,

                // (strptr: [*]u8, len: usize) => [*:0]u8 (caller must free!)
                //   converts markdown to html. panics on oom. returns
                //   a null-terminated utf-8 string the caller must free.
                markdownToHTML: (strptr: number, len: number) => number,

                // (strptr: [*:0]u8) => usize
                //   gets the byte length of a null-terminated string.
                strlen: (strptr: number) => number,
            };
            try{
                const utf8 = enc.encode(md);
                const strptr = exports.allocString(utf8.byteLength);
                const inmem = new Uint8Array(getMem().buffer, strptr, utf8.byteLength);
                inmem.set(utf8);
                const res = exports.markdownToHTML(strptr, utf8.byteLength);
                const outlen = exports.strlen(res);
                const outarr = new Uint8Array(getMem().buffer, res, outlen);
                const decoded = dec.decode(outarr);
                exports.freeText(strptr, utf8.byteLength);
                exports.freeText(res, outlen);
                return decoded;
            }catch(e){
                // note that chrome sometimes crashes on wasm errors and this
                // handler might not run.
                console.log(e.toString() + "\n" + e.stack);
                return escapeHTML("Error "+e.toString()+"\n"+e.stack);
            }
        }};
        arrayv.forEach(q => q());
        return _reddit_markdown_renderer;
    }
    if(Array.isArray(_reddit_markdown_renderer)) {
        const rmdarr = _reddit_markdown_renderer;
        await new Promise<void>(r => rmdarr.push(r));
        return _reddit_markdown_renderer as any as RedditMarkdownRenderer;
    }
    return _reddit_markdown_renderer;
}

function renderText(client: ThreadClient, body: Generic.BodyText) {return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();

    const container = el("div");
    defer(() => container.remove());
    parent.insertBefore(container, before_once);
    
    if(body.markdown_format === "reddit") {
        const preel = el("pre").adto(container);
        el("code").atxt(body.content).adto(preel);
        getRedditMarkdownRenderer().then(mdr => {
            preel.remove();
            const raw_html = mdr.renderMd(body.content);
            const divel = el("div").adto(container).clss("slightlybigger");
            divel.innerHTML = raw_html;
            for(let alink of Array.from(divel.querySelectorAll("a"))) {
                const after_node = document.createComment("after");
                alink.parentNode!.replaceChild(after_node, alink);

                const href = alink.getAttribute("href")!;
                const content = Array.from(alink.childNodes);

                const renderLinkPreview = canPreview(href, {autoplay: true});

                const newbtn = linkButton(client.id, href, {onclick: renderLinkPreview ? () => togglepreview() : undefined});
                content.forEach(el => newbtn.appendChild(el));
                after_node.parentNode!.insertBefore(newbtn, after_node);

                if(!renderLinkPreview) continue;

                let showpreviewbtn = el("button").atxt("…").clss("showpreviewbtn");

                let preview_div: undefined | HTMLDivElement;

                const togglepreview = () => {
                    if(preview_div) hidepreview();
                    else showpreview();
                };
                showpreviewbtn.onev("click", () => togglepreview());
                const showpreview = () => {
                    showpreviewbtn.textContent = "⏷";
                    preview_div = el("div");
                    after_node.parentNode!.insertBefore(preview_div, after_node);
                    const lnkprvw = renderLinkPreview();
                    preview_div.adch(lnkprvw.node);

                    // not bothering with show/hide atm because that requires passing show/hide from client
                    //listing into more places
                }
                const hidepreview = () => {
                    showpreviewbtn.textContent = "⏵";
                    if(preview_div) {preview_div.remove(); preview_div = undefined;}
                };
                hidepreview();
                after_node.parentNode!.insertBefore(showpreviewbtn, after_node);
            }
            for(let spoilerspan of Array.from(divel.querySelectorAll(".md-spoiler-text")) as HTMLSpanElement[]) {
                let children = Array.from(spoilerspan.childNodes);
                let subspan = el("span").adto(spoilerspan).adch(...children).clss("md-spoiler-content");
                spoilerspan.attr({title: "Click to reveal spoiler"});
                subspan.style.opacity = "0";
                spoilerspan.onev("click", () => {
                    subspan.style.opacity = "1";
                    spoilerspan.attr({title: ""});
                });
            }
        });
    }else if(body.markdown_format === "none") {
        container.atxt(body.content);
    }else assertNever(body.markdown_format);

    return {removeSelf(){defer.cleanup();}};
}}}

function clientListing(client: ThreadClient, listing: Generic.Thread) { return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();
    // console.log(listing);

    const frame = el("div").clss("post");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    let content_voting_area: HTMLDivElement;
    let thumbnail_loc: HTMLButtonElement;
    let preview_area: HTMLDivElement;
    let replies_area: HTMLDivElement;

    let content_title_line: HTMLDivElement;
    let content_subminfo_line: HTMLDivElement;
    let content_buttons_line: HTMLDivElement;


    if(listing.layout === "reddit-post") {
        content_voting_area = el("div").adto(frame).clss("post-voting");
        thumbnail_loc = el("button").adto(frame).clss("post-thumbnail");
        const content_area = el("div").adto(frame).clss("post-titles");
        preview_area = el("div").adto(frame).clss("post-preview");
        replies_area = el("div").adto(frame).clss("post-replies");

        content_title_line = el("div").adto(content_area).clss("post-content-title");
        content_subminfo_line = el("div").adto(content_area).clss("post-content-subminfo");
        content_buttons_line = el("div").adto(content_area).clss("post-content-buttons");
    }else if(listing.layout === "reddit-comment") {
        content_voting_area = el("div").adto(frame).clss("post-voting");
        content_title_line = el("div").adto(frame).clss("post-content-title"); // unused
        thumbnail_loc = el("button").adto(frame).clss("post-thumbnail"); // unused
        content_subminfo_line = el("div").adto(frame).clss("post-content-subminfo");
        preview_area = el("div").adto(frame).clss("post-preview"); // unused
        content_buttons_line = el("div").adto(frame).clss("post-content-buttons");
        replies_area = el("div").adto(frame).clss("post-replies");
    }else if(listing.layout === "error") {
        content_voting_area = el("div").adto(frame).clss("post-voting");
        content_title_line = el("div").adto(frame).clss("post-content-title"); // unused
        thumbnail_loc = el("button").adto(frame).clss("post-thumbnail"); // unused
        content_subminfo_line = el("div").adto(frame).clss("post-content-subminfo");
        preview_area = el("div").adto(frame).clss("post-preview"); // unused
        content_buttons_line = el("div").adto(frame).clss("post-content-buttons");
        replies_area = el("div").adto(frame).clss("post-replies");
    }else assertNever(listing.layout);

    if(!listing.thumbnail) thumbnail_loc.clss("no-thumbnail");

    if(listing.layout === "reddit-comment") {
        let prev_collapsed = false;
        let collapsed = listing.default_collapsed;
        const update = () => {
            if(collapsed !== prev_collapsed) {
                prev_collapsed = collapsed;
                if(collapsed) {
                    frame.classList.add("comment-collapsed");
                }else{
                    frame.classList.remove("comment-collapsed");
                }
            }
            // collapsed_button // some aria thing idk
        };
        const collapsed_button = el("button").clss("collapse-btn").onev("click", () => {
            collapsed =! collapsed;
            update();
            const topv = collapsed_button.getBoundingClientRect().top;
            const heightv = 5;
            if(topv < heightv) {collapsed_button.scrollIntoView(); document.documentElement.scrollTop -= heightv; }
        });
        frame.insertBefore(collapsed_button, frame.childNodes[0] ?? null);
        update();
    }

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

    const getScoreMut = (pt_count: number, your_vote: 'up' | 'down' | undefined, initial_vote: 'up' | 'down' | undefined) => {
        let score_mut = pt_count;
        if(your_vote !== initial_vote) {
            if(initial_vote === "up") {
                score_mut -= 1;
                if(your_vote === "down") score_mut -= 1;
            }else if(initial_vote === "down") {
                score_mut += 1;
                if(your_vote === "up") score_mut += 1;
            }else{
                if(your_vote === "up") score_mut += 1;
                else if(your_vote === "down") score_mut -= 1;
            }
        }
        return score_mut;
    }
    type VoteState = {pt_count: number | undefined, your_vote: 'up' | 'down' | undefined, vote_loading: boolean};

    const dovote = (direction: "up" | "down" | "reset", state: VoteState, update: () => void, rpts: Generic.RedditPoints) => {
        if(rpts.vote.error != undefined) return alert(rpts.vote.error);
        state.vote_loading = true;
        state.your_vote = direction === "reset" ? undefined : direction;
        update();
        console.log("Voting on",rpts.vote[direction], direction);
        client.redditVote!(rpts.vote[direction]).then(res => {
            state.vote_loading = false;
            state.your_vote = direction === "reset" ? undefined : direction;
            update();
        }).catch(e => {
            console.log("Error!", e);
            alert("Error voting");
        });
    };

    const updateVotingClass = (state: VoteState) => {
        content_voting_area.classList.remove("unvoted", "voted-up", "voted-down", "voted-loading");
        if(state.your_vote === "up") content_voting_area.clss("voted-up");
        if(state.your_vote === "down") content_voting_area.clss("voted-down");
        if(!state.your_vote) content_voting_area.clss("unvoted");
        if(state.vote_loading) content_voting_area.clss("voted-loading");
    };

    const author_color = getRandomColor(seededRandom(listing.info.author.name));
    const author_color_dark = darkenColor("foreground", author_color);

    const scoreToString = (score: number) => {
        if(score < 10_000) return "" + score;
        if(score < 100_000) return (score / 1000).toFixed(2).match(/^-?\d+(?:\.\d{0,1})?/)?.[0] + "k";
        return (score / 1000 |0) + "k";
    };
    if(listing.layout === "reddit-post") {
        const submission_time = el("span").adch(timeAgo(listing.info.time)).attr({title: "" + new Date(listing.info.time)});
        content_subminfo_line.adch(submission_time).atxt(" by ");
        content_subminfo_line.adch(linkButton(client.id, listing.info.author.link)
            .styl({"color": rgbToString(author_color), "--dark-color": rgbToString(author_color_dark)})
            .atxt(listing.info.author.name)
        );
        if(listing.info.author.flair) content_subminfo_line.adch(renderFlair(listing.info.author.flair));
        if(listing.info.in) {
            content_subminfo_line.atxt(" in ").adch(linkButton(client.id, listing.info.in.link).atxt(listing.info.in.name));
        }
        if(listing.info.reddit_points) {
            const rpts = listing.info.reddit_points;
            const state: VoteState = {pt_count: rpts.count, your_vote: rpts.your_vote, vote_loading: false};
            const getPointsText = () => {
                if(state.pt_count == null) return ["—", "[score hidden]"];
                const score_mut = getScoreMut(state.pt_count, state.your_vote, rpts.your_vote);
                return [scoreToString(score_mut), score_mut.toLocaleString()];
            };
            const vote_up_btn = el("button").adto(content_voting_area).clss("vote-up");
            const points_span = el("span").adto(content_voting_area).clss("vote-score");
            const points_text = txt("…").adto(points_span);
            const vote_down_btn = el("button").adto(content_voting_area).clss("vote-down");

            if(listing.info.reddit_points.percent != null) {
                content_subminfo_line.atxt(", "+ listing.info.reddit_points.percent.toLocaleString(undefined, {style: "percent"}) + " upvoted");
            }

            const update = () => {
                const [text, num] = getPointsText();
                points_text.nodeValue = text;
                points_span.title = num;
                updateVotingClass(state);
            }
            update();

            vote_up_btn.onclick = () => {
                if(state.your_vote === "up") dovote("reset", state, update, rpts);
                else dovote("up", state, update, rpts);
            };
            vote_down_btn.onclick = () => {
                if(state.your_vote === "down") dovote("reset", state, update, rpts);
                else dovote("down", state, update, rpts);
            };
        }
    }else if(listing.layout === "reddit-comment") {
        content_subminfo_line.adch(linkButton(client.id, listing.info.author.link)
            .styl({"--light-color": rgbToString(author_color), "--dark-color": rgbToString(author_color_dark)})
            .clss("user-link")
            .atxt(listing.info.author.name)
        );
        if(listing.info.author.flair) content_subminfo_line.adch(renderFlair(listing.info.author.flair));
        if(listing.info.reddit_points) {
            const rpts = listing.info.reddit_points
            const state: VoteState = {pt_count: rpts.count, your_vote: rpts.your_vote, vote_loading: false};

            const getPointsText = () => {
                if(state.pt_count == null) return ["[score hidden]", "[score hidden]"];
                const score_mut = getScoreMut(state.pt_count, state.your_vote, rpts.your_vote);
                return [scoreToString(score_mut) + " point"+(score_mut === 1 ? "" : "s"), score_mut.toLocaleString()] as const;
            };
            const points_span = el("span");
            const points_text = txt("…").adto(points_span);
            content_subminfo_line.atxt(" ").adch(points_span);

            const vote_up_btn = el("button").adto(content_voting_area).clss("vote-up");
            const vote_down_btn = el("button").adto(content_voting_area).clss("vote-down");

            const update = () => {
                const [ptxt, pnum] = getPointsText();
                points_text.nodeValue = ptxt;
                points_span.title = pnum;
                updateVotingClass(state);
            };
            update();

            vote_up_btn.onclick = () => {
                if(state.your_vote === "up") dovote("reset", state, update, rpts);
                else dovote("up", state, update, rpts);
            };
            vote_down_btn.onclick = () => {
                if(state.your_vote === "down") dovote("reset", state, update, rpts);
                else dovote("down", state, update, rpts);
            };
        }
        const submission_time = el("span").adch(timeAgo(listing.info.time)).attr({title: "" + new Date(listing.info.time)});
        content_subminfo_line.atxt(" ").adch(submission_time);
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
        let initContent = (body: Generic.Body, opts: {autoplay: boolean}) => {
            if(content_warnings.length) {
                const cws = content_warnings;
                content_warnings = [];
                const cwbox = el("div").adto(content);
                cwbox.atxt("Content Warning"+(cws.length === 1 ? "" : "s")+": ");
                cwbox.adch(renderFlair(cws));
                cwbox.atxt(" ");
                el("button").attr({draggable: "true"}).adto(cwbox).atxt("Show Content").onev("click", e => {
                    cwbox.remove();
                    thumbnail_loc.classList.remove("thumbnail-content-warning");
                    initContent(body, opts);
                });
                return;
            }

            if(body.kind === "text") {
                const txt = renderText(client, body).insertBefore(content, null);
                defer(() => txt.removeSelf());
            }else if(body.kind === "link") {
                // TODO fix this link button thing
                el("div").adto(content).adch(linkButton(client.id, body.url).atxt(body.url));
                const renderLinkPreview = canPreview(body.url, {autoplay: opts.autoplay, suggested_embed: body.embed_html});
                if(renderLinkPreview) {
                    const preview = renderLinkPreview();
                    preview.node.adto(content);
                    if(preview.onhide) onhide = preview.onhide;
                    if(preview.onshow) onshow = preview.onshow;
                }
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
                        let new_body: Generic.Body;
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
                        console.log("Got new body:", new_body);
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
            }else if(body.kind === "richtext") {
                content.atxt("TODO richtext");
            }else assertNever(body);
        };

        if(listing.display_mode.body === "collapsed") {
            const open_preview_button = el("button").clss("not-this-button").adto(content_buttons_line);
            const open_preview_text = txt("…").adto(open_preview_button);

            let initialized = false;
            let state = listing.display_mode.body_default === "open";
            let prev_state: boolean | undefined = undefined;
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
        if(action.kind === "link") linkButton(client.id, action.url).atxt(action.text).adto(content_buttons_line);
        else if(action.kind === "reply") el("span").atxt("Reply").adto(content_buttons_line);
        else assertNever(action);
    }

    content_buttons_line.atxt(" ");
    el("button").attr({draggable: "true"}).onev("click", e => {
        console.log(listing);
    }).atxt("Code").adto(content_buttons_line);

    const children_node = el("ul").clss("replies").adto(replies_area);

    const allow_threading = listing.replies?.length === 1 && (listing.replies[0] as Generic.Thread).replies?.length === 1;

    const addChild = (child_listing: Generic.Node) => {
        const reply_node = el("li").adto(children_node);
        if(allow_threading) reply_node.clss("threaded");
        if(child_listing.kind === "load_more") {
            loadMoreButton(client, child_listing, addChild, () => reply_node.remove()).adto(reply_node);
            return;
        }
        let futureadd: undefined | Generic.Node;
        if(allow_threading && child_listing.replies?.length == 1) {
            futureadd = child_listing.replies[0];
            child_listing.replies = [];
        }
        reply_node.clss("comment");
        const child_node = clientListing(client, child_listing).insertBefore(reply_node, null);
        defer(() => child_node.removeSelf());

        if(futureadd) addChild(futureadd);
    }
    if(listing.replies) listing.replies.forEach(rply => addChild(rply));

    return {removeSelf: () => defer.cleanup()};
} } }

// TODO I guess support loading more in places other than the end of the list
// that means :: addChildren needs to have a second before_once argument and this needs to have a before_once
// doesn't matter atm but later.
function loadMoreButton(client: ThreadClient, load_more_node: Generic.LoadMore, addChild: (children: Generic.Node) => void, removeSelf: () => void) {
    const container = el("div");
    const makeButton = () => linkButton(client.id, load_more_node.load_more, {onclick: e => {
        const loading_txt = el("span").atxt("Loading…").adto(container);
        current_node.remove();
        current_node = loading_txt;

        client.getThread(load_more_node.load_more).then(res => {
            current_node.remove();
            if(res.replies) res.replies.forEach(rply => addChild(rply));
            removeSelf();
        }).catch(e => {
            console.log("error loading more:", e);
            try{current_node.remove();}catch(e){console.log(e);}
            current_node = el("span").atxt("Error. ").adch(makeButton().atxt("🗘 Retry")).adto(container);
        });
    }});

    let current_node: ChildNode = makeButton().atxt(load_more_node.count ? "Load "+load_more_node.count+" More…" : "Load More…").adto(container);

    el("button").attr({draggable: "true"}).onev("click", e => {
        console.log(load_more_node);
    }).atxt("Code").adto(container);
    return container;
}

function clientMain(client: ThreadClient, current_path: string) { return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();

    const outer = el("div").clss("client-wrapper");
    parent.insertBefore(outer, before_once);
    defer(() => outer.remove());
    const frame = el("div").adto(outer);
    frame.classList.add("display-loading");

    if(!client.isLoggedIn()) {
        const login_prompt: {removeSelf: () => void} = clientLogin(client, () => login_prompt.removeSelf()).insertBefore(frame, null);
        defer(() => login_prompt.removeSelf());
        // return {removeSelf: () => defer.cleanup(), hide: () => {}, show: () => {}};
    }
    const frame_uhtml_area = document.createElement("div");
    frame.appendChild(frame_uhtml_area);

    uhtml.render(frame_uhtml_area, html`Loading…`);

    (async () => {
        const listing = await client.getThread(current_path);

        frame.classList.remove("display-loading");
        frame.classList.add("display-"+listing.display_style);
        
        uhtml.render(frame_uhtml_area, html``);
        const home_node = clientListing(client, listing.header).insertBefore(frame, null);
        defer(() => home_node.removeSelf());

        const addChild = (child_listing: Generic.Node) => {
            if(child_listing.kind === "load_more") {
                const lmbtn = loadMoreButton(client, child_listing, addChild, () => lmbtn.remove());
                lmbtn.adto(frame);
                return;
            }
            const replies_node = clientListing(client, child_listing).insertBefore(frame, null);
            defer(() => replies_node.removeSelf());
        };
        if(listing.replies) listing.replies.forEach(rply => addChild(rply));
        if(listing.replies?.length === 0) txt("There is nothing here").adto(frame);
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

setInterval(() => document.querySelector('.darkreader')?.remove(), 1000)