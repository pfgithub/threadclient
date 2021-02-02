import "./_stdlib";
import "./main.scss";

import  * as uhtml from "uhtml";

import * as Generic from "./types/generic";
import {ThreadClient} from "./clients/base";
import { getRandomColor, rgbToString, seededRandom } from "./darken_color";

const rawsym = Symbol("raw");
export const raw = (string: string): {[rawsym]: string, toString: () => string} => ({[rawsym]: "" + string, toString: () => string});
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const templateGenerator = <InType>(helper: (str: InType) => string) => {
    type ValueArrayType = (InType | {[rawsym]: string})[];
    return (strings: TemplateStringsArray, ...values: ValueArrayType) => {
        const result: ({raw: string} | {val: InType})[] = [];
        (strings as TemplateStringsArray).forEach((string, i) => {
            result.push({raw: string});
            if(i < values.length) {
                const val = values[i];
                if(typeof val === "object" && rawsym in val) {
                    result.push({raw: (val as {[rawsym]: string})[rawsym]});
                }else{
                    result.push({val: val as InType});
                }
            }
        });
        const res = result.map(el => 'raw' in el ? el.raw : helper(el.val)).join("");
        return res;
    };
};
export const encodeURL = templateGenerator<string>(str => encodeURIComponent(str));
export const htmlr = uhtml.html;

export const encodeQuery = (items: {[key: string]: string}): string => {
    let res = "";
    for(const [key, value] of Object.entries(items)) {
        if(res) res += "&";
        res += encodeURL`${key}=${value}`;
    }
    return res;
};

function assertNever(content: never): never {
    console.log("not never:", content);
    throw new Error("is not never");
}

export function escapeHTML(unsafe_html: string): string {
    return unsafe_html.replace(/[^a-zA-Z0-9. ]/giu, c => "&#"+c.codePointAt(0)+";");
    // might be a bit &#…; heavy for other languages
}

export const safehtml = templateGenerator((v: string) => escapeHTML(v));

function clientLogin(client: ThreadClient, path: string, onComplete: () => void): HideShowCleanup<HTMLDivElement> {
    const frame = el("div");
    const hsc = hideshow(frame);

    const renderLink = (href: string) => {
        uhtml.render(frame, htmlr`<a href="${href}" rel="noreferrer noopener" target="_blank">Log In</a>`);
    };
    const clurl = client.loginURL;
    if(typeof clurl === "string") {
        renderLink(clurl);
    }else{
        const btn = el("button").atxt("Log In").adto(frame).onev("click", () => {
            btn.textContent = "…";
            btn.disabled = true;
            clurl(path).then(res => {
                renderLink(res);
            }).catch(e => {
                btn.textContent = "Retry";
                frame.atxt("Error:"+e);
                console.log(e);
                btn.disabled = false;
            });
        });
    }

    let done = false;
    const onFocus = () => {
        if(!done && client.isLoggedIn(path)) {
            done = true;
            uhtml.render(frame, htmlr`Logged In!`);
            onComplete();
        }
    };
    document.addEventListener("focus", onFocus);
    hsc.on("cleanup", () => document.removeEventListener("focus", onFocus));

    return hsc;
}

function isModifiedEvent(event: MouseEvent) {
    return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

function linkButton(client_id: string, href: string, opts: {onclick?: (e: MouseEvent) => void} = {}) {
    // TODO get this to support links like https://….reddit.com/… and turn them into SPA links
    if(href.startsWith("/") && client_id) {
        href = "/"+client_id+href;
    }
    if(href.startsWith("mailto:")) {
        return el("span").attr({title: href.replace("mailto:", "")});
    }
    if(!href.startsWith("http") && !href.startsWith("/")) {
        return el("a").clss("error").attr({title: href}).clss("error").onev("click", () => alert(href));
    }
    let urlparsed: URL | undefined;
    try {
        urlparsed = new URL(href);
    }catch(e) {
        urlparsed = undefined;
    }
    if(urlparsed && (urlparsed.host === "reddit.com" || urlparsed.host.endsWith(".reddit.com"))) {
        href = "/reddit"+urlparsed.pathname;
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

function embedYoutubeVideo(youtube_video_id: string, opts: {autoplay: boolean}, search: URLSearchParams): {node: Node, onhide?: () => void, onshow?: () => void} {
    const start_code = search.get("t") ?? search.get("start") ?? undefined;
    const yt_player = el("iframe").attr({
        allow: "fullscreen",
        src: "https://www.youtube.com/embed/"
            +youtube_video_id+"?version=3&enablejsapi=1&playerapiid=ytplayer"
            +(opts.autoplay ? "&autoplay=1" : "")
            +(start_code != null ? "&start="+start_code : "")
        ,
    });
    return {node: el("div").clss("resizable-iframe").styl({width: "640px", height: "360px"}).adch(yt_player), onhide: () => {
        yt_player.contentWindow?.postMessage(JSON.stringify({event: "command", func: "pauseVideo", args: ""}), "*");
    }};
}
function previewVreddit(id: string, opts: {autoplay: boolean}): HideShowCleanup<Node> {
    const container = el("div");
    const link = "https://v.redd.it/"+id;

    const audio = el("audio").adto(container);
    el("source").attr({src: link+"/DASH_audio.mp4", type: "video/mp4"}).adto(audio);
    el("source").attr({src: link+"/audio", type: "video/mp4"}).adto(audio);

    const video = el("video").attr({controls: ""}).clss("preview-image").adto(el("div").adto(container));
    el("source").attr({src: link+"/DASH_720.mp4", type: "video/mp4"}).adto(video);
    el("source").attr({src: link+"/DASH_720", type: "video/mp4"}).adto(video);
    el("source").attr({src: link+"/DASH_480.mp4", type: "video/mp4"}).adto(video);
    el("source").attr({src: link+"/DASH_480", type: "video/mp4"}).adto(video);
    el("source").attr({src: link+"/DASH_360.mp4", type: "video/mp4"}).adto(video);
    el("source").attr({src: link+"/DASH_360", type: "video/mp4"}).adto(video);
    el("source").attr({src: link+"/DASH_240.mp4", type: "video/mp4"}).adto(video);
    el("source").attr({src: link+"/DASH_240", type: "video/mp4"}).adto(video);
    el("source").attr({src: link+"/HLSPlaylist.m3u8", type: "application/x-mpegURL"}).adto(video);

    const speaker_icons = ["🔇", "🔈", "🔊"] as const;
    const btnarea = el("div").adto(container).styl({display: "flex"});
    const mutebtn = el("button").adto(btnarea);
    const muteicn = txt(speaker_icons[2]).adto(mutebtn);
    const slider = el("input").attr({type: "range", min: "0", max: "100", value: "100"}).adto(btnarea);
    const upslider = () => slider.value = "" + (audio.volume * 100);
    let mute_backv: undefined | number;
    const upbtn = () => {
        if(mute_backv === undefined) {
            if(audio.volume < 0.2) {
                muteicn.nodeValue = speaker_icons[1];
            }else {
                muteicn.nodeValue = speaker_icons[2];
            }
        }else{
            muteicn.nodeValue = speaker_icons[0];
        }
    };
    upslider();
    slider.oninput = () => {
        audio.volume = (+slider.value) / 100;
        mute_backv = undefined;
        upbtn();
    };
    mutebtn.onclick = () => {
        if(mute_backv === undefined) {
            mute_backv = audio.volume;
            audio.volume = 0;
        }else{
            audio.volume = mute_backv;
            mute_backv = undefined;
        }
        upslider();
        upbtn();
    };

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
        void audio.play();
    };
    video.onplaying = () => {
        sync();
        void audio.play();
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

    if(opts.autoplay) void video.play();

    let playing_before_hide = false;

    const hsc = hideshow(container);
    hsc.on("hide", () => {
        playing_before_hide = !video.paused;
        video.pause();
    });
    hsc.on("show", () => {
        if(playing_before_hide) void video.play();
    });
    return hsc;
}
function canPreview(link: string, opts: {autoplay: boolean, suggested_embed?: string}): undefined | (() => HideShowCleanup<Node>) {
    let url_mut: URL | undefined;
    try { 
        url_mut = new URL(link);
    }catch(e) {
        // ignore
    }
    const url = url_mut;
    const path = url?.pathname ?? link;
    const is_mp4_link_masking_as_gif = url ? path.endsWith(".gif") && url.searchParams.get("format") === "mp4" : false;
    if(is_mp4_link_masking_as_gif) return (): HideShowCleanup<Node> => {
        const video = el("video").clss("preview-image");
        el("source").attr({src: link, type: "video/mp4"}).adto(video);
        video.loop = true;
        const hsc = hideshow(video);
        void video.play();
        hsc.on("hide", () => {video.pause()});
        hsc.on("show", () => {void video.play()});
        return hsc;
    };
    if((url?.hostname ?? "") === "i.redd.it"
        || path.endsWith(".png") || path.endsWith(".jpg")
        || path.endsWith(".jpeg")|| path.endsWith(".gif")
        || path.endsWith(".webp")|| (url?.hostname ?? "") === "pbs.twimg.com"
    ) return (): HideShowCleanup<Node> => {
        const resn = zoomableImage(link, {});
        return hideshow(resn);
    };
    if(path.endsWith(".gifv")) return (): HideShowCleanup<Node> => {
        const video = el("video").attr({controls: ""}).clss("preview-image");
        el("source").attr({src: link.replace(".gifv", ".webm"), type: "video/webm"}).adto(video);
        el("source").attr({src: link.replace(".gifv", ".mp4"), type: "video/mp4"}).adto(video);
        video.loop = true;
        const hsc = hideshow(video);
        let playing_before_hide = false;
        if(opts.autoplay) void video.play();
        hsc.on("hide", () => {playing_before_hide = !video.paused; video.pause()});
        hsc.on("show", () => {if(playing_before_hide) void video.play();});
        return hsc;
    };
    if(link.startsWith("https://v.redd.it/")) return (): HideShowCleanup<Node> => {
        return previewVreddit(link.replace("https://v.redd.it/", ""), {autoplay: opts.autoplay});
    };
    if(link.startsWith("https://reddit.com/link/")) {
        const pathsplit = path.split("/");
        pathsplit.shift();
        // /link/:postname/video/:videoid/player
        if(pathsplit[0] === "link" && pathsplit[2] === "video" && pathsplit[4] === "player") return (): HideShowCleanup<Node> => {
            return previewVreddit(pathsplit[3] ?? "", {autoplay: opts.autoplay});
        };
    }
    if(path.endsWith(".mp4") || path.endsWith(".webm")) return (): HideShowCleanup<Node> => {
        const src = el("source").attr({src: link});
        const video = el("video").attr({controls: ""}).clss("preview-image").adch(src);
        let playing_before_hide = false;
        const hsc = hideshow(video);
        hsc.on("hide", () => {playing_before_hide = !video.paused; video.pause()});
        hsc.on("show", () => {if(playing_before_hide) void video.play();});
        return hsc;
    };
    const ytvid = (youtube_video_id: string, search: URLSearchParams) => (): HideShowCleanup<Node> => {
        const container = el("div");
        const embedv = embedYoutubeVideo(youtube_video_id, opts, search);
        embedv.node.adto(container);
        const hsc = hideshow(container);
        // maybe just delete embedv and recreate it instead
        // or do like a timeout like if >10s, delete idk
        hsc.on("hide", () => embedv.onhide?.());
        hsc.on("show", () => embedv.onshow?.());
        return hsc;
    };
    if(url && (url.host === "www.youtube.com" || url.host === "youtube.com") && url.pathname === "/watch") {
        const ytvid_id = url.searchParams.get("v");
        if(ytvid_id != null) return ytvid(ytvid_id, url.searchParams);
    }
    if(url && (url.host === "youtu.be") && url.pathname.split("/").length === 2) {
        const youtube_video_id = url.pathname.split("/")[1] ?? "no_id";
        return ytvid(youtube_video_id, url.searchParams);
    }
    if(link.startsWith("https://www.reddit.com/gallery/")) {
        // information about galleries is distributed with posts
        // do nothing I guess
    }
    if(link.startsWith("https://imgur.com/")) return (): HideShowCleanup<Node> => {
        const iframe = el("iframe").attr({src: link + "/embed"});
        const resn = {node: el("div").clss("resizable-iframe").styl({width: "500px", height: "500px"}).adch(iframe)};
        const hsc = hideshow(resn.node);
        // TODO: onhide delete, onshow recreate. no need to store imgur iframes forever.
        return hsc;
    };
    if(opts.suggested_embed != null) return (): HideShowCleanup<Node> => {
        // TODO: render a body with markdown type unsafe-html that supports iframes
        try {
            // const parser = new DOMParser();
            // const doc = parser.parseFromString(opts.suggested_embed, "text/html");
            // const iframe = doc.childNodes[0].childNodes[1].childNodes[0];
            const template_el = el("template");
            template_el.innerHTML = opts.suggested_embed!;
            const iframe_unsafe = template_el.content.childNodes[0];
            if(!iframe_unsafe) throw new Error("missing iframe");
            if(!(iframe_unsafe instanceof HTMLIFrameElement)) throw new Error("iframe was not first child");

            console.log(iframe_unsafe, iframe_unsafe.width, iframe_unsafe.height);

            const parent_node = el("div").clss("resizable-iframe").styl({width: iframe_unsafe.width+"px", height: iframe_unsafe.height+"px"});
            let iframe: HTMLIFrameElement | undefined;
            const initFrame = () => {
                if(!iframe) iframe = el("iframe").attr({src: iframe_unsafe.src, allow: iframe_unsafe.allow, allowfullsreen: ""}).adto(parent_node);
            };
            initFrame();

            const hsc = hideshow(parent_node);
            hsc.on("hide", () => {if(iframe) {iframe.remove(); iframe = undefined}});
            hsc.on("show", () => initFrame());
            return hsc;
        }catch(e) {
            console.log(e);
            const frame = el("div");
            frame.adch(el("p").atxt("Error adding suggestedembed: "+e.toString()).clss("error"));
            frame.adch(el("pre").adch(el("code").atxt(opts.suggested_embed!)));
            return hideshow(frame);
        }
    };
    return undefined;
}

function renderImageGallery(client: ThreadClient, images: Generic.GalleryItem[]): HideShowCleanup<Node> {
    const container = el("div");
    const hsc = hideshow(container);
    type State = "overview" | {
        index: number,
    };
    let state: State = "overview";
    const setState = (new_state: State) => {
        state = new_state;
        update();
    };

    let prevbody: HideShowCleanup<undefined> | undefined;
    let prevnode: HTMLDivElement | undefined;

    const update = () => {
        if(prevbody) {prevbody.cleanup(); prevbody = undefined}
        if(prevnode) prevnode.innerHTML = "";
        if(state === "overview") {
            uhtml.render(container, htmlr`${images.map((image, i) => htmlr`
                <button class="gallery-overview-item" onclick=${() => {setState({index: i})}}>
                    <img src=${image.thumb} width=${image.w+"px"} height=${image.h+"px"}
                        class="preview-image gallery-overview-image"
                    />
                </button>
            `)}`);
            return;
        }
        const index = state.index;
        const selimg = images[index]!;
        const ref: {current?: HTMLDivElement} = {};
        uhtml.render(container, htmlr`
            <button onclick=${() => setState({index: index - 1})} disabled=${index <= 0 ? "" : undefined}>Prev</button>
            ${index + 1}/${images.length}
            <button onclick=${() => setState({index: index + 1})} disabled=${index >= images.length - 1 ? "" : undefined}>Next</button>
            <button onclick=${() => setState("overview")}>Gallery</button>
            <div ref=${ref}></div>
        `);
        if(!ref.current) throw new Error("!ref.current");
        prevbody = renderBody(client, selimg.body, {autoplay: true}, ref.current);
        prevnode = ref.current;
        // TODO display a loading indicator while the image loads
    };

    hsc.on("cleanup", () => {
        if(prevbody) prevbody.cleanup();
    });

    setState(state);
    return hsc;
}

function renderFlair(flairs: Generic.Flair[]) {
    const resl = document.createDocumentFragment();
    for(const flair of flairs) {
        const flairv = el("span").clss("flair");
        resl.atxt(" ");
        if(flair.color != null) flairv.styl({"--flair-color": flair.color, "--flair-color-dark": flair.color});
        if(flair.fg_color != null) flairv.clss("flair-text-"+flair.fg_color);
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
    if(number === 1) return number + text.substring(0, text.length - 1);
    return number + text;
}

// TODO replace this with a proper thing that can calculate actual "months ago" values
// returns [time_string, time_until_update]
function timeAgoText(start_ms: number): [string, number] {
    const ms = Date.now() - start_ms;
    if(ms < 0) return ["in the future "+new Date(start_ms).toISOString(), -ms];
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
function timeAgo(start_ms: number): HideShowCleanup<Node> {
    const tanode = txt("…");
    const hsc = hideshow(tanode);
    let timeout: number | undefined;
    const update = () => {
        timeout = undefined;
        const [newtext, wait_time] = timeAgoText(start_ms);
        tanode.nodeValue = newtext;
        if(wait_time >= 0) timeout = setTimeout(() => update(), wait_time + 100);
    };
    update();
    hsc.on("cleanup", () => {
        if(timeout !== undefined) clearTimeout(timeout);
    });
    return hsc;
}

type RedditMarkdownRenderer = {
    renderMd(text: string): string,
};

function dynamicLoader<T>(loader: () => Promise<T>): () => Promise<T> {
    let load_state: undefined | (() => void)[] | {loaded: T};
    return async (): Promise<T> => {       
        if(!load_state) {
            load_state = [];
            let loadedv: T;
            try{
                loadedv = await loader();
            }catch(e) {
                console.log("failed to load", e);
                alert("failed to load dynamic load object. check console.");
                throw e;
            }
            const loadedarr = load_state;
            load_state = {loaded: loadedv};
            loadedarr.forEach(q => q());
        }
        if('loaded' in load_state) {
            return load_state.loaded;
        }
        const lsv = load_state;
        await new Promise<void>(r => lsv.push(r));
        return (load_state as unknown as {loaded: T}).loaded;
    };
}

const getRedditMarkdownRenderer = dynamicLoader(async (): Promise<RedditMarkdownRenderer> => {
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
    return {renderMd(md: string) {
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
});

type HtmlSaftifier = {saftify: (html: string, class_prefix: string) => string};
const getHtmlSaftifier = dynamicLoader(async (): Promise<HtmlSaftifier> => {
    await new Promise((r, re) => {
        const script_el = el("script");
        script_el.src = "/deps/xss.min.js";
        script_el.onload = r;
        script_el.onerror = re;
        document.head.appendChild(script_el);
    });
    const xss = (window as unknown as {
        filterXSS:
            ((html: string, opts: {onTagAttr: (tag: string, name: string, value: string, isWhiteAttr: string) => string | undefined}) => string)
            & {escapeAttrValue: (val: string) => string},
    }).filterXSS;
    return {
        saftify: (html, class_prefix: string) => xss(html, {
            onTagAttr: (tag: string, name: string, value: string, is_white_attr: string) => {
                if(name === "class") return name+"=\""+xss.escapeAttrValue(value.split(" ").map(v => class_prefix + v).join(" "))+"\"";
            },
        }),
    };
});

function renderPreviewableLink(client: ThreadClient, href: string, __after_once: Node | null, parent_node: Node): HideShowCleanup<{newbtn: HTMLElement}> {
    const after_node = document.createComment("");
    parent_node.insertBefore(after_node, __after_once);

    const renderLinkPreview = canPreview(href, {autoplay: true});

    const newbtn = linkButton(client.id, href, {onclick: renderLinkPreview ? () => togglepreview() : undefined});
    parent_node.insertBefore(newbtn, after_node);

    const hsc = hideshow({newbtn});

    if(!renderLinkPreview) return hsc;

    const showpreviewbtn = el("button").atxt("…").clss("showpreviewbtn").onev("click", () => togglepreview());

    let preview_div: undefined | {hsc: HideShowCleanup<unknown>, node: ChildNode} = undefined;

    const togglepreview = () => {
        if(preview_div) hidepreview();
        else showpreview();
    };

    const hidepreview = () => {
        showpreviewbtn.textContent = "⏵";
        if(preview_div) {preview_div.hsc.cleanup(); preview_div.node.remove(); preview_div = undefined}
    };
    const showpreview = () => {
        showpreviewbtn.textContent = "⏷";
        const preview_container = el("div");
        parent_node.insertBefore(preview_container, after_node);
        const lprvw = renderLinkPreview();
        lprvw.associated_data.adto(preview_container);
        preview_div = {node: preview_container, hsc: lprvw};
    };
    hidepreview();

    hsc.on("hide", () => {if(preview_div) preview_div.hsc.setVisible(false);});
    hsc.on("show", () => {if(preview_div) preview_div.hsc.setVisible(true);});
    hsc.on("cleanup", () => {
        if(preview_div) preview_div.hsc.cleanup();
    });

    parent_node.insertBefore(showpreviewbtn, after_node);

    return hsc;
}

function renderSafeHTML(client: ThreadClient, safe_html: string, parent_node: Node, class_prefix: string): HideShowCleanup<undefined> {
    const divel = el("div").adto(parent_node).clss("slightlybigger");
    const hsc = hideshow();
    divel.innerHTML = safe_html;
    if(class_prefix) for(const node of Array.from(divel.querySelectorAll("*"))) {
        Array.from(node.classList).forEach(classname => {
            node.classList.replace(classname, class_prefix + classname);
        });
    }
    for(const alink of Array.from(divel.querySelectorAll("a"))) {
        const after_node = document.createComment("after");
        if(!alink.parentNode) throw new Error("alink without parent node. never.");
        alink.parentNode.replaceChild(after_node, alink);
        if(!after_node.parentNode) throw new Error("never.");

        const href = alink.getAttribute("href") ?? "error no href";
        const content = Array.from(alink.childNodes);

        const {newbtn} = renderPreviewableLink(client, href, after_node, after_node.parentNode).defer(hsc);

        newbtn.attr({class: alink.getAttribute("class")});
        content.forEach(el => newbtn.appendChild(el));
    }
    for(const spoilerspan of Array.from(divel.querySelectorAll(".md-spoiler-text")) as HTMLSpanElement[]) {
        const children = Array.from(spoilerspan.childNodes);
        const subspan = el("span").adto(spoilerspan).adch(...children).clss("md-spoiler-content");
        spoilerspan.attr({title: "Click to reveal spoiler"});
        subspan.style.opacity = "0";
        spoilerspan.onev("click", () => {
            subspan.style.opacity = "1";
            spoilerspan.attr({title: ""});
        });
    }
    return hsc;
}

function renderText(client: ThreadClient, body: Generic.BodyText): HideShowCleanup<Node> {
    const container = el("div");
    const hsc = hideshow(container);
    
    if(body.markdown_format === "reddit") {
        const preel = el("pre").adto(container);
        el("code").atxt(body.content).adto(preel);
        getRedditMarkdownRenderer().then(mdr => {
            preel.remove();
            const safe_html = mdr.renderMd(body.content);
            renderSafeHTML(client, safe_html, container, "").defer(hsc);
        }).catch(e => {
            preel.remove();
            console.log(e);
            renderSafeHTML(client, "Got error! Check console!", container, "").defer(hsc);
        });
    }else if(body.markdown_format === "none") {
        container.atxt(body.content);
    }else if(body.markdown_format === "mastodon") {
        const preel = el("pre").adto(container);
        el("code").atxt(body.content).adto(preel);
        getHtmlSaftifier().then(hsr => {
            preel.remove();
            const safe_html = hsr.saftify(body.content, "mastodon-");
            renderSafeHTML(client, safe_html, container, "").defer(hsc);
        }).catch(e => {
            preel.remove();
            console.log(e);
            renderSafeHTML(client, "Got error! Check console!", container, "").defer(hsc);
        });
    }else assertNever(body.markdown_format);

    return hsc;
}

function renderRichtextSpan(client: ThreadClient, rts: Generic.Richtext.Span, container: Node): HideShowCleanup<undefined> {
    const hsc = hideshow();

    switch(rts.kind) {
        case "text": {
            let mainel: Node = el("span");
            const wrap = (outer: Node) => {
                outer.adch(mainel);
                mainel = outer;
            };
            if(rts.styles.code ?? false) wrap(el("code"));
            if(rts.styles.emphasis ?? false) wrap(el("i"));
            if(rts.styles.error != null) wrap(el("span").clss("error").attr({title: rts.styles.error}));
            if(rts.styles.strikethrough ?? false) wrap(el("s"));
            if(rts.styles.strong ?? false) wrap(el("b"));
            if(rts.styles.superscript ?? false) wrap(el("sup"));

            mainel.atxt(rts.text);
            mainel.adto(container);
        } break;
        case "link": {
            const {newbtn} = renderPreviewableLink(client, rts.url, null, container).defer(hsc);
            if(rts.title != null) newbtn.title = rts.title;
            for(const child of rts.children) {
                renderRichtextSpan(client, child, newbtn).defer(hsc);
            }
        } break;
        case "br": {
            container.adch(el("br"));
        } break;
        case "spoiler": {
            const spoilerspan = el("spoiler").clss("md-spoiler-text");
            const subspan = el("span").adto(spoilerspan).clss("md-spoiler-content");
            for(const child of rts.children) {
                renderRichtextSpan(client, child, subspan).defer(hsc);
            }
            spoilerspan.attr({title: "Click to reveal spoiler"});
            subspan.style.opacity = "0";
            spoilerspan.onev("click", () => {
                subspan.style.opacity = "1";
                spoilerspan.attr({title: ""});
            });
        } break;
        default: assertNever(rts);
    }

    return hsc;
}

function renderRichtextParagraph(client: ThreadClient, rtp: Generic.Richtext.Paragraph, container: ChildNode): HideShowCleanup<undefined> {
    const hsc = hideshow();

    switch(rtp.kind) {
        case "paragraph": {
            const pel = el("p").adto(container);
            for(const child of rtp.children) {
                renderRichtextSpan(client, child, pel).defer(hsc);
            }
        } break;
        case "heading": {
            const hel = el("h"+rtp.level).adto(container);
            for(const child of rtp.children) {
                renderRichtextSpan(client, child, hel).defer(hsc);
            }
        } break;
        case "blockquote": case "list": case "list_item": {
            const bquot = el(
                rtp.kind === "blockquote"
                    ? "blockquote"
                    : rtp.kind === "list"
                    ? rtp.ordered
                        ? "ol"
                        : "ul"
                    : rtp.kind === "list_item"
                    ? "li"
                    : assertNever(rtp)
            ).adto(container).clss("richtext-render-node");
            for(const child of rtp.children) {
                renderRichtextParagraph(client, child, bquot).defer(hsc);
            }
        } break;
        case "horizontal_line": {
            el("hr").adto(container);
        } break;
        case "code_block": {
            el("pre").adch(el("code").atxt(rtp.text)).adto(container);
        } break;
        case "body": {
            renderBody(client, rtp.body, {autoplay: false}, container).defer(hsc);
        } break;
        case "table": {
            const tablel = el("table").adto(container);
            const thead = el("tr").adto(el("thead").adto(tablel));
            for(const heading of rtp.headings) {
                const headth = el("th").adto(thead).attr({align: heading.align});
                for(const child of heading.children) {
                    renderRichtextSpan(client, child, headth).defer(hsc);
                }
            }
            const tbody = el("tbody").adto(tablel);
            for(const row of rtp.children) {
                const rowr = el("tr").adto(tbody);
                row.forEach((col, i) => {
                    const align = rtp.headings[i]!.align;
                    const td = el("td").adto(rowr).attr({align});
                    for(const child of col.children) {
                        renderRichtextSpan(client, child, td).defer(hsc);
                    }
                });
            }
        } break;
        default: assertNever(rtp);
    }

    return hsc;
}

const renderBody = (client: ThreadClient, body: Generic.Body, opts: {autoplay: boolean}, content: ChildNode): HideShowCleanup<undefined> => {
    const hsc = hideshow();

    if(body.kind === "text") {
        const txta = el("div").adto(content);
        renderText(client, body).defer(hsc).adto(txta);
    }else if(body.kind === "link") {
        // TODO fix this link button thing
        el("div").adto(content).adch(linkButton(client.id, body.url).atxt(body.url));
        const renderLinkPreview = canPreview(body.url, {autoplay: opts.autoplay, suggested_embed: body.embed_html});
        if(renderLinkPreview) {
            renderLinkPreview().defer(hsc).adto(content);
        }
    }else if(body.kind === "none") {
        content.remove();
    }else if(body.kind === "gallery") {
        renderImageGallery(client, body.images).defer(hsc).adto(content);
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
                if(!client.fetchRemoved) throw new Error("client provided a removal fetch path but has no fetchRemoved");
                try {
                    new_body = await client.fetchRemoved(body.fetch_path);
                }catch(e) {
                    errored = true;
                    console.log(e);
                    new_body = {kind: "text", content: "Error! "+e.toString(), markdown_format: "none"};
                }
                console.log("Got new body:", new_body);
                fetch_btn.textContent = errored ? "Retry" : "Loaded";
                fetch_btn.disabled = false;
                if(!errored) removed_v.remove();
                renderBody(client, new_body, {autoplay: true}, content).defer(hsc);
            });
        }
        const existing_body_v = el("div").adto(content);
        renderBody(client, body.body, {autoplay: opts.autoplay}, existing_body_v).defer(hsc);
    }else if(body.kind === "crosspost") {
        const parentel = el("div").styl({"max-width": "max-content"}).adto(content);
        clientListing(client, body.source).defer(hsc).adto(parentel);
    }else if(body.kind === "richtext") {
        const txta = el("div").adto(content);
        for(const pargrph of body.content) {
            renderRichtextParagraph(client, pargrph, txta).defer(hsc);
        }
    }else if(body.kind === "poll") {
        const pollcontainer = el("ul").adto(content).clss("poll-container");
        const expires = el("div").adto(pollcontainer).atxt("Expires: ");
        timeAgo(body.close_time).defer(hsc).adto(expires);
        for(const choice of body.choices) {
            const choicebtn = el("button").adto(el("li").adto(pollcontainer).clss("poll-choice-li")).clss("poll-choice");
            choicebtn.atxt(choice.name + " ("+(choice.votes === "hidden" ? "hidden" : s(choice.votes, " Votes"))+")");
            choicebtn.onev("click", () => alert("TODO voting on polls"));
        }
        if(body.select_many) {
            const submitbtn = el("button").adto(content);
            submitbtn.onclick = () => "TODO vote on polls";
        }
    }else if(body.kind === "captioned_image") {
        zoomableImage(body.url, {w: body.w, h: body.h, alt: body.alt}).adto(el("div").adto(content));
        if(body.caption != null) el("div").adto(content).atxt("Caption: "+body.caption);
    }else if(body.kind === "video") {
        if(body.caption != null) el("div").adto(content).atxt("Caption: "+body.caption);
        if(body.url == null) {
            if(body.url_backup_image == null) {
                el("div").clss("error").atxt("missing stuff?? ?? :: "+JSON.stringify(body));

                return hsc;
            }
            zoomableImage(body.url_backup_image, {w: body.w, h: body.h, alt: body.alt}).adto(el("div").adto(content));

            return hsc;
        }
        const vid = el("video").adch(
            el("source").attr({src: body.url})).attr({width: `${body.w}px` as const, height: `${body.h}px` as const, controls: "", alt: body.alt}
        ).clss("preview-image").adto(content);
        if(body.gifv) {
            vid.loop = true;
            vid.onplaying = () => vid.controls = false;
        }
        if(opts.autoplay) {void vid.play()}
        let playing_before_hide = !vid.paused;
        hsc.on("hide", () => {playing_before_hide = !vid.paused; vid.pause()});
        hsc.on("show", () => {if(playing_before_hide) void vid.play();});
    }else if(body.kind === "vreddit_video") {
        if(body.caption != null) el("div").adto(content).atxt("Caption: "+body.caption);
        previewVreddit(body.id, {autoplay: false}).defer(hsc).adto(content);
    }else if(body.kind === "array") {
        for(const v of body.body) {
            if(!v) continue;
            const atma = el("div").adto(content);
            renderBody(client, v, {autoplay: false}, atma).defer(hsc);
        }
    }else assertNever(body);

    return hsc;
};

function getButton(e: PointerEvent) {
    // ??? what is this why is it weird
    // I have no idea what this function does
    return [1, 4, 2, 8, 16][e.button] ?? 32;
}
export function startDragWatcher(
    start_event: PointerEvent,
    cb: (e: PointerEvent) => void,
): Promise<PointerEvent> {
    return new Promise(resolve => {
        const moveListener = (e: PointerEvent) => {
            if (e.pointerId !== start_event.pointerId) {
                return;
            }
            if (
                e.pointerType === "mouse" &&
                !(e.buttons & getButton(start_event))
            ) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            cb(e);
        };
        window.addEventListener("pointermove", moveListener, { capture: true });
        const stopListener = (e: PointerEvent) => {
            if (e.pointerId !== start_event.pointerId) {
                return;
            }
            if (
                e.pointerType === "mouse" &&
                e.buttons & getButton(start_event)
            ) {
                // button will be excluded on a mouseup
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            window.removeEventListener("pointermove", moveListener, {
                capture: true,
            });
            window.removeEventListener("pointerup", stopListener, {
                capture: true,
            });
            resolve(e);
        };
        window.addEventListener("pointerup", stopListener, { capture: true });
    });
}

// TODO
// ideally:
// click to fullscreen the image and have like a neat view where
// - mobile: zoom/pan with gestures
// - desktop: zoom/pan with mouse/scroll
// and then when the image isn't fullscreened, make it possible to like make it smaller or something
function zoomableImage(url: string, opt: {w?: number, h?: number, alt?: string}): HTMLElement {
    const frame = el("a").attr({href: url, target: "_blank", rel: "noreferrer noopener"});
    const res = el("img").clss("preview-image", "image-loading")
        .attr({
            src: url,
            width: opt.w != null ? `${opt.w}px` as const : undefined,
            height: opt.h != null ? `${opt.h}px` as const : undefined,
            alt: opt.alt, title: opt.alt
        })
        .adto(frame)
    ;
    res.styl({"transform": "scale(100%)", "transform-origin": "top left"});
    res.onload = () => res.classList.remove("image-loading");
    res.onerror = () => res.classList.remove("image-loading");
    // let current_offset = 0;
    // const updateImage = (updated: number) => {
    //     const offset = current_offset + updated;
    //     const scale = (2**(offset / 300));
    //     res.styl({transform: "scale("+scale+")"});
    // };
    // const getOffset = (start_ev: PointerEvent, e: PointerEvent) => {
    //     const diff = [e.clientX - start_ev.clientX, e.clientY - start_ev.clientY] as const;
    //     return diff[0] + diff[1];
    // };
    // // ideally on mobile make this enter fullscreen. unfortunately, ios safari.
    // res.addEventListener("touchdown", e => {e.preventDefault(); e.stopPropagation()});
    // res.addEventListener("touchmove", e => {e.preventDefault(); e.stopPropagation()});
    // res.addEventListener("pointerdown", async start_event => {
    //     start_event.preventDefault();
    //     start_event.stopPropagation();
    //     // if(start_event.pointerType === "touch") {
    //     //     return;
    //     // }
    //     const end_event = await startDragWatcher(start_event, (e) => {
    //         const total = getOffset(start_event, e);
    //         updateImage(total);
    //     });
    //     console.log(end_event);
    //     const total = getOffset(start_event, end_event);
    //     current_offset = current_offset + total;
    //     updateImage(0);
    // });
    // // mouse events: resize image
    // // touch events: open fullscreen and allow zooming
    return frame;
}

function userProfileListing(client: ThreadClient, profile: Generic.Profile, frame: HTMLDivElement): HideShowCleanup<undefined> {
    const hsc = hideshow();

    {
        const bodyel = el("div").adto(frame);
        renderBody(client, profile.bio, {autoplay: false}, bodyel);
    }

    const action_container = el("div").adto(frame);
    for(const action of profile.actions) {
        action_container.atxt(" ");
        renderAction(client, action, action_container).defer(hsc);
    }
    action_container.atxt(" ");
    linkLikeButton().adto(action_container).atxt("Code").onev("click", () => {
        console.log(profile);
    });

    // TODO add all the buttons
    // specifically ::
    //   Follow, Mute, Block, Block Domain
    // so I can use "Block Domain" on "botsin.space"

    return hsc;
}

const scoreToString = (score: number) => {
    if(score < 10_000) return "" + score;
    if(score < 100_000) return (score / 1_000).toFixed(2).match(/^-?\d+(?:\.\d{0,1})?/)?.[0] + "k";
    if(score < 1_000_000) return (score / 1_000 |0) + "k";
    if(score < 100_000_000) return (score / 1_000_000).toFixed(2).match(/^-?\d+(?:\.\d{0,1})?/)?.[0] + "m";
    return (score / 1_000_000 |0) + "m";
};

function renderAction(client: ThreadClient, action: Generic.Action, content_buttons_line: Node): HideShowCleanup<undefined> {
    if(action.kind === "link") linkButton(client.id, action.url).atxt(action.text).adto(content_buttons_line);
    else if(action.kind === "reply") {
        let prev_preview: {preview: Generic.Thread, remove: () => void} | undefined = undefined;
        let reply_state: "none" | {preview?: Generic.Thread} = "none";
        const reply_btn = linkLikeButton().atxt("Reply").adto(content_buttons_line);

        const hsc = hideshow();

        let reply_container: HTMLDivElement | undefined;

        hsc.on("cleanup", () => {
            if(prev_preview) {prev_preview.remove(); prev_preview = undefined}
        });
        
        const update = () => {
            if(reply_state === "none") {
                if(reply_container) {reply_container.remove(); reply_container = undefined}
                if(prev_preview) {prev_preview.remove(); prev_preview = undefined}
                reply_btn.disabled = false;
            }else{
                if(!reply_container) {
                    reply_container = el("div").adto(content_buttons_line);
                    const textarea = el("textarea").adto(el("div").adto(reply_container));
                    const submit = el("button").adto(reply_container).atxt("Reply");
                    const preview = el("button").adto(reply_container).atxt("Preview");
                    const cancel = el("button").adto(reply_container).atxt("Cancel");
                    preview.onev("click", () => {
                        reply_state = {preview: client.previewReply(textarea.value, action.reply_info)};
                        update();
                    });
                    // this might lag too much idk
                    textarea.onev("input", () => {
                        reply_state = {preview: client.previewReply(textarea.value, action.reply_info)};
                        update();
                    });
                    cancel.onev("click", () => {
                        const deleteres = textarea.value ? confirm("delete?") : true;
                        if(deleteres) {
                            reply_state = "none";
                            update();
                        }
                    });
                    submit.onev("click", () => {
                        submit.disabled = true;
                        submit.textContent = "…";
                        console.log("SUBMITTING");
                        client.sendReply(textarea.value, action.reply_info).then(r => {
                            console.log("Got response", r);
                            reply_state = "none";
                            update();
                            if(r.kind === "load_more") {
                                console.log("got back load more item. todo display it.");
                                return;
                            }
                            clientListing(client, r).defer(hsc).adto(el("div").adto(content_buttons_line));
                        }).catch(e => {
                            const error = e as Error;
                            submit.disabled = false;
                            submit.textContent = "Reply";
                            console.log("Got error", e);
                            const displayv = el("div").adto(content_buttons_line).clss("error").styl({'white-space': "pre-wrap"});
                            displayv.atxt(error.toString()+"\n\n"+error.stack);
                        });
                    });
                }
                reply_btn.disabled = true;
                label: if(reply_state.preview) {
                    if(prev_preview) {
                        if(prev_preview.preview === reply_state.preview) {
                            break label;
                        }
                        prev_preview.remove();
                        prev_preview = undefined;
                    }
                    // hacky for now. reply buttons should need a special override
                    // rather than being bundled with the rest of stuff in renderAction
                    const containerel = el("div").adto(content_buttons_line);
                    const listing_el = clientListing(client, reply_state.preview);
                    listing_el.associated_data.adto(containerel);
                    prev_preview = {
                        preview: reply_state.preview,
                        remove: () => {
                            listing_el.cleanup();
                            containerel.remove();
                        },
                    };
                }
            }
        };

        reply_btn.onev("click", () => {
            if(reply_state === "none") reply_state = {};
            update();
        });
        update();
    }else if(action.kind === "counter") {
        renderCounterAction(client, action, content_buttons_line, {parens: true});
    }else if(action.kind === "delete") {
        const resdelwrap = el("span").adto(content_buttons_line);
        const resyeswrap = el("span").adto(content_buttons_line);
        const resgonwrap = el("span").adto(content_buttons_line);
        const reserrwrap = el("span").adto(content_buttons_line);
        const resloadwrap = el("span").adto(content_buttons_line);

        const delbtn = linkLikeButton().atxt("Delete").adto(resdelwrap);

        resyeswrap.atxt("Are you sure? ");
        const confirmbtn = linkLikeButton().clss("error").atxt("Delete").adto(resyeswrap);
        resyeswrap.atxt(" / ");
        const nvmbtn = linkLikeButton().atxt("Cancel").adto(resyeswrap);

        resloadwrap.atxt("Deleting…");

        resgonwrap.atxt("Deleted!");

        type State = "none" | "confirm" | "load" | "deleted" | {error: string};
        const setv = (nv: State) => {
            resdelwrap.style.display = nv === "none" ? "" : "none";
            resyeswrap.style.display = nv === "confirm" ? "" : "none";
            resgonwrap.style.display = nv === "deleted" ? "" : "none";
            resloadwrap.style.display = nv === "load" ? "" : "none";
            reserrwrap.style.display = typeof nv !== "string" ? "" : "none";
            if(typeof nv !== "string") {
                reserrwrap.adch(el("span").clss("error").atxt(nv.error));
            }
        };
        setv("none");

        delbtn.onev("click", () => {
            setv("confirm");
        });
        confirmbtn.onev("click", () => {
            setv("load");
            client.act(action.data).then(r => {
                setv("deleted");
            }).catch(e => {
                console.log("Got error:", e);
                setv({error: e.toString()});
            });
        });
        nvmbtn.onev("click", () => {
            setv("none");
        });
    }else assertNever(action);
    return hideshow();
}
function renderCounterAction(client: ThreadClient, action: Generic.CounterAction, content_buttons_line: Node, opts: {parens: boolean}) {
    const display_count = action.count_excl_you !== "none";

    const wrapper = el("span").clss("counter").adto(content_buttons_line);
    const button = linkLikeButton().adto(wrapper).clss("counter-increment-btn");
    const btn_span = el("span").adto(button);
    const pretxt = txt("").adto(btn_span);
    const btxt = txt("…").adto(btn_span);
    const votecount = el("span").adto(wrapper.atxt(" ")).clss("counter-count");
    const votecount_txt = txt("…").adto(votecount);
    const percent_voted_txt = action.percent == null ? txt("—% upvoted") : txt(action.percent.toLocaleString(undefined, {style: "percent"}) + " upvoted");
    let decr_button: HTMLButtonElement | undefined;

    const state = {loading: false, pt_count: action.count_excl_you === "hidden" || action.count_excl_you === "none" ? null : action.count_excl_you, your_vote: action.you};

    const getPointsText = () => {
        if(state.pt_count == null) return ["—", "[score hidden]"];
        const score_mut = state.pt_count + (state.your_vote === "increment" ? 1 : state.your_vote === "decrement" ? -1 : 0);
        return [scoreToString(score_mut), score_mut.toLocaleString()] as const;
    };

    const update = () => {
        const [pt_text, pt_raw] = getPointsText();
        btxt.nodeValue = {increment: action.incremented_label, decrement: action.decremented_label ?? "ERR", none: action.label}[state.your_vote ?? "none"];
        votecount_txt.nodeValue = opts.parens ? "(" + pt_text + ")" : pt_text;
        if(!display_count) votecount_txt.nodeValue = ""; // hmm
        votecount.title = pt_raw;
        wrapper.classList.remove("counted-increment", "counted-decrement", "counted-reset");
        wrapper.classList.add("counted-"+(state.your_vote ?? "reset"));
        wrapper.classList.toggle("counted-loading", state.loading);
        button.disabled = state.loading;
        if(decr_button) decr_button.disabled = state.loading;
    };
    update();

    const doAct = (vote: undefined | "increment" | "decrement") => {
        if('error' in action.actions) {
            return alert("Error: "+action.actions.error);
        }
        const prev_vote = state.your_vote;
        state.your_vote = vote;
        state.loading = true;
        update();
        client.act(action.actions[vote ?? "reset"] ?? "error").then(() => {
            state.your_vote = vote;
            state.loading = false;
            update();
        }).catch(e => {
            state.your_vote = prev_vote;
            state.loading = false;
            update();
            console.log(e);
            alert("Got error: "+e);
        });
    };

    if(action.decremented_label != null) {
        pretxt.nodeValue = "⯅ ";
        wrapper.atxt(" ");
        decr_button = linkLikeButton().adch(el("span").atxt("⯆")).adto(wrapper).onev("click", () => {
            if(state.your_vote === "decrement") {
                doAct(undefined);
            }else{
                doAct("decrement");
            }
        }).clss("counter-decrement-btn");
    }
    button.onev("click", e => {
        if(state.your_vote === "increment") {
            doAct(undefined);
        }else{
            doAct("increment");
        }
    });

    return {percent_voted_txt, votecount};
}

const userLink = (client_id: string, href: string, name: string) => {
    const [author_color, author_color_dark] = getRandomColor(seededRandom(name));
    return linkButton(client_id, href)
        .styl({"--light-color": rgbToString(author_color), "--dark-color": rgbToString(author_color_dark)})
        .clss("user-link")
        .atxt(name)
    ;
};

function hListing(client: ThreadClient, listing: Generic.HList, frame: HTMLDivElement): HideShowCleanup<undefined> {
    const hsc = hideshow();

    el("div").atxt("HListing").adto(frame);
    linkLikeButton().atxt("Code").adto(frame).onev("click", () => console.log(listing));

    return hsc;
}

function widgetRender(client: ThreadClient, widget: Generic.Widget, frame: HTMLDivElement): HideShowCleanup<undefined> {
    const hsc = hideshow();

    frame.clss("widget");
    txt(widget.title).adto(el("div").adto(frame).clss("widget-header"));
    
    if(widget.actions_top) {
        const actionstop = el("div").clss("widget-actions-top").adto(frame);
        for(const action of widget.actions_top) {
            renderAction(client, action, actionstop).defer(hsc);
        }
    }

    const content = widget.widget_content;
    if(content.kind === "list") {
        const list = el("ul").clss("widget-list").adto(frame);
        for(const item of content.items) {
            const ili = el("li").adto(list);
            if(item.icon != null) {
                el("div").adto(ili).clss("widget-list-icon").styl({"--background-image-url": "url("+item.icon+")"});
            }
            linkButton(client.id, item.link).atxt(item.name).adto(ili);
            if(item.action) {
                const actionv = el("span").adto(ili).atxt(" ");
                renderAction(client, item.action, actionv).defer(hsc);
            }
        }
    }else if(content.kind === "community-details") {
        el("p").atxt(content.description).adto(frame);
    }else if(content.kind === "body") {
        const container = el("div").adto(frame);
        renderBody(client, content.body, {autoplay: false}, container).defer(hsc);
    }else assertNever(content);

    if(widget.actions_bottom) {
        const actionstop = el("div").clss("widget-actions-bottom").adto(frame);
        for(const action of widget.actions_bottom) {
            renderAction(client, action, actionstop).defer(hsc);
        }
    }
    el("div").adto(frame).adch(linkLikeButton().atxt("Code").onev("click", () => console.log(widget)));

    return hsc;
}

function clientListing(client: ThreadClient, listing: Generic.ContentNode): HideShowCleanup<Node> {
    // console.log(listing);
    
    const frame = el("div").clss("post");
    const hsc = hideshow(frame);

    if(listing.kind === "user-profile") {
        userProfileListing(client, listing, frame).defer(hsc);
        return hsc;
    }
    if(listing.kind === "hlist") {
        hListing(client, listing, frame).defer(hsc);
        return hsc;
    }
    if(listing.kind === "widget") {
        widgetRender(client, listing, frame).defer(hsc);
        return hsc;
    }

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
    }else if(listing.layout === "reddit-comment" || listing.layout === "mastodon-post") {
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

    if(listing.layout === "reddit-comment" || listing.layout === "mastodon-post") {
        let prev_collapsed = false;
        let collapsed = listing.default_collapsed;
        const update = () => {
            if(collapsed !== prev_collapsed) {
                prev_collapsed = collapsed;
                hsc.setVisible(!collapsed);
                if(collapsed) {
                    frame.classList.add("comment-collapsed");
                }else{
                    frame.classList.remove("comment-collapsed");
                }
            }
            // collapsed_button // some aria thing idk
        };
        const collapsed_button = el("button").clss("collapse-btn").attr({draggable: "true"}).onev("click", () => {
            collapsed =! collapsed;
            update();
            const topv = collapsed_button.getBoundingClientRect().top;
            const heightv = 5 + navbar.getBoundingClientRect().height;
            if(topv < heightv) {collapsed_button.scrollIntoView(); document.documentElement.scrollTop -= heightv }
        });
        frame.insertBefore(collapsed_button, frame.childNodes[0] ?? null);
        update();
    }

    frame.clss("layout-"+listing.layout);
    if(listing.layout === "reddit-comment" || listing.layout === "mastodon-post") {
        frame.clss("layout-commentlike");
    }

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

    let reserved_points_area: null | Node = null;

    if(listing.layout === "reddit-post" && listing.info) {
        const submission_time = el("span").adch(timeAgo(listing.info.time).defer(hsc)).attr({title: "" + new Date(listing.info.time)});
        content_subminfo_line.adch(submission_time).atxt(" by ");
        content_subminfo_line.adch(userLink(client.id, listing.info.author.link, listing.info.author.name));
        if(listing.info.author.flair) content_subminfo_line.adch(renderFlair(listing.info.author.flair));
        if(listing.info.in) {
            content_subminfo_line.atxt(" in ").adch(linkButton(client.id, listing.info.in.link).atxt(listing.info.in.name));
        }
        if(listing.info.pinned) {
            content_subminfo_line.atxt(", Pinned");
        }
    }else if((listing.layout === "reddit-comment" || listing.layout === "mastodon-post") && listing.info) {
        content_subminfo_line.adch(userLink(client.id, listing.info.author.link, listing.info.author.name));
        if(listing.info.author.flair) content_subminfo_line.adch(renderFlair(listing.info.author.flair));
        if(listing.layout === "mastodon-post" && listing.info.author.pfp) {
            frame.clss("spacefiller-pfp");

            const pfpimg = el("div").clss("pfp").styl({
                "--url": "url("+JSON.stringify(listing.info.author.pfp.url)+")",
                "--url-hover": "url("+JSON.stringify(listing.info.author.pfp.hover)+")"
            });
            pfpimg.adto(content_voting_area);
        }
        reserved_points_area = document.createComment("").adto(content_subminfo_line);
        const submission_time = el("span").adch(timeAgo(listing.info.time).defer(hsc)).attr({title: "" + new Date(listing.info.time)});
        content_subminfo_line.atxt(" ").adch(submission_time);
        if(listing.info.pinned) {
            content_subminfo_line.atxt(", Pinned");
        }
        if(listing.info.reblogged_by) {
            content_subminfo_line.atxt(" ← Boosted by ")
                .adch(userLink(client.id, listing.info.reblogged_by.author.link, listing.info.reblogged_by.author.name))
                .atxt(" at ").adch(timeAgo(listing.info.reblogged_by.time).defer(hsc))
            ;
            if(listing.layout === "mastodon-post" && listing.info.reblogged_by.author.pfp) {
                frame.clss("spacefiller-pfp");
                const pfpimg = el("div").clss("pfp", "pfp-reblog").styl({
                    "--url": "url("+JSON.stringify(listing.info.reblogged_by.author.pfp.url)+")",
                    "--url-hover": "url("+JSON.stringify(listing.info.reblogged_by.author.pfp.hover)+")"
                });
                pfpimg.adto(content_voting_area);
            }
        }
    }

    {
        const content = el("div");

        if(listing.thumbnail) {
            if(listing.thumbnail.kind === "image") {
                thumbnail_loc.adch(el("img").attr({src: listing.thumbnail.url}));
                if(content_warnings.length) thumbnail_loc.clss("thumbnail-content-warning");
            }else if(listing.thumbnail.kind === "default") {
                const thumbimg: string = {
                    self: "self", default: "default", image: "image", spoiler: "spoiler",
                    nsfw: "nsfw", account: "account", error: "error"
                }[listing.thumbnail.thumb];
                thumbnail_loc.adch(el("div").clss("thumbnail-builtin", "thumbnail-" + thumbimg));
            }else assertNever(listing.thumbnail);
        }

        const body_hsc = hideshow();
        hsc.addChild(body_hsc);

        const initContent = (body: Generic.Body, opts: {autoplay: boolean}) => {
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
                    renderBody(client, body, {...opts}, content).defer(body_hsc);
                });
                return;
            }
            renderBody(client, body, {...opts}, content).defer(body_hsc);
        };
        
        if(listing.display_mode.body === "collapsed") {
            const open_preview_button = el("button").clss("not-this-button").adto(content_buttons_line);
            const open_preview_text = txt("…").adto(open_preview_button);

            let initialized = false;
            let state = listing.display_mode.body_default === "open";
            const autoplay = !state;
            const update = () => {
                if(state && !initialized) {
                    initialized = true;
                    initContent(listing.body, {autoplay});
                }
                open_preview_text.nodeValue = state ? "Hide" : "Show";

                content.style.display = state ? "" : "none";
                body_hsc.setVisible(state);
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
        if(action.kind === "counter" && action.special === "reddit-points") {
            frame.clss("spacefiller-redditpoints");
            const ctr = renderCounterAction(client, action, content_voting_area, {parens: false});
            if(listing.layout === "reddit-comment") {
                content_subminfo_line.insertBefore(txt(" "), reserved_points_area);
                content_subminfo_line.insertBefore(ctr.votecount, reserved_points_area);
                content_subminfo_line.insertBefore(txt(" points"), reserved_points_area);
            }else if(listing.layout === "reddit-post") {
                content_subminfo_line.atxt(", ");
                ctr.percent_voted_txt.adto(content_subminfo_line);

                content_voting_area.clss("desktop-only");
                content_buttons_line.atxt(" ");
                const cbl_render_area = el("div").clss("mobile-only").adto(content_buttons_line);
                renderAction(client, action, cbl_render_area).defer(hsc);
            }
        }else {
            content_buttons_line.atxt(" ");
            renderAction(client, action, content_buttons_line).defer(hsc);
        }
    }

    content_buttons_line.atxt(" ");
    listing.actions.length === 0 && linkButton(client.id, listing.link).atxt("View").adto(content_buttons_line);
    content_buttons_line.atxt(" ");
    linkLikeButton().onev("click", e => {
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
        if(allow_threading && child_listing.replies?.length === 1) {
            futureadd = child_listing.replies[0];
            child_listing.replies = [];
        }
        reply_node.clss("comment");
        clientListing(client, child_listing).defer(hsc).adto(reply_node);

        if(futureadd) addChild(futureadd);
    };
    if(listing.replies) listing.replies.forEach(rply => addChild(rply));

    return hsc;
}

function linkLikeButton() {
    return el("button").clss("link-like-button").attr({draggable: "true"});
}

function loadingSpinner() {
    return el("div").clss("lds-ripple").adch(el("div")).adch(el("div"));
}

// TODO I guess support loading more in places other than the end of the list
// that means :: addChildren needs to have a second before_once argument and this needs to have a before_once
// doesn't matter atm but later.
function loadMoreButton(client: ThreadClient, load_more_node: Generic.LoadMore, addChild: (children: Generic.Node) => void, removeSelf: () => void) {
    const container = el("div");
    const makeButton = () => linkButton(client.id, load_more_node.load_more, {onclick: ev => {
        const loading_txt = el("div").adto(container);
        loading_txt.adch(el("span").atxt("Loading…"));
        loading_txt.adch(loadingSpinner());
        current_node.remove();
        current_node = loading_txt;

        client.getThread(load_more_node.load_more, "loadmore").then(res => {
            current_node.remove();
            if((load_more_node.includes_parent ?? false) && res.replies && res.replies.length === 1) {
                res.replies = (res.replies[0] as Generic.Thread).replies ?? [];
            }
            if(res.replies) res.replies.forEach(rply => addChild(rply));
            if(load_more_node.next) addChild(load_more_node.next);
            removeSelf();
        }).catch(e => {
            console.log("error loading more:", e);
            if(current_node.parentNode) current_node.remove();
            current_node = el("span").atxt("Error. ").adch(makeButton().atxt("🗘 Retry")).adto(container);
        });
    }});

    let current_node: ChildNode = makeButton().atxt(load_more_node.count != null ? "Load "+load_more_node.count+" More…" : "Load More…").adto(container).clss("load-more");

    container.atxt(" ");
    linkLikeButton().onev("click", e => {
        console.log(load_more_node);
    }).atxt("Code").adto(container);
    return container;
}

function clientMain(client: ThreadClient, current_path: string): HideShowCleanup<HTMLDivElement> {
    const outer = el("div").clss("client-wrapper");
    const hsc = hideshow(outer);

    const frame = el("div").adto(outer);
    frame.classList.add("client-main-frame");

    if(!client.isLoggedIn(current_path)) {
        clientLogin(client, current_path, () => {
            // uh oh! this hsc node has a parent, so when it gets cleaned up it needs to tell its parent it no longer exists
            // otherwise there is a leak
            console.log("TODO remove clientLogin");
            // just removing the node isn't good enough because the hsc still exists
        }).defer(hsc).adto(el("div").clss("login-button-area").adto(frame));
    }
    const loader_area = el("div").adto(frame);
    loader_area.classList.add("display-loading");
    loader_area.adch(loadingSpinner());

    (async () => {
        // await new Promise(r => 0);
        const listing = await client.getThread(current_path, "pageload");

        frame.classList.add("display-"+listing.display_style);
        loader_area.remove();

        const header_area = el("div").adto(frame).clss("header-post");
        
        clientListing(client, listing.header).defer(hsc).adto(header_area);

        if(listing.sidebar) {
            // on mobile, ideally this would be a link that opens the sidebar in a new history item
            el("button").adto(frame).clss("sidebar-toggle-mobile").atxt("Toggle Sidebar").onev("click", () => {
                sidebar_area.classList.toggle("sidebar-visible-mobile");
            });
            const sidebar_area = el("div").adto(frame).clss("sidebar-area");
            for(const sidebar_elem of listing.sidebar) {
                clientListing(client, sidebar_elem).defer(hsc).adto(sidebar_area);
            }
        }
        
        const comments_area = el("div").adto(frame).clss("comments-area");

        const addChild = (child_listing: Generic.Node) => {
            if(child_listing.kind === "load_more") {
                const lmbtn = loadMoreButton(client, child_listing, addChild, () => lmbtn.remove());
                lmbtn.adto(comments_area);
                return;
            }
            clientListing(client, child_listing).defer(hsc).adto(comments_area);
        };
        if(listing.replies) listing.replies.forEach(rply => addChild(rply));
        if(listing.replies?.length === 0) txt("There is nothing here").adto(comments_area);
    })().catch(e => {
        console.log(e, e.stack);
        if(loader_area.parentNode) loader_area.remove();
        el("div").atxt("Error! "+e+", check console.").clss("error").adto(frame);
    });

    return hsc;
}

function fullscreenError(message: string): HideShowCleanup<HTMLDivElement> {
    const frame = document.createElement("div");
    const hsc = hideshow(frame);

    frame.appendChild(document.createTextNode(message));

    return hsc;
}

function clientLoginPage(client: ThreadClient, path: string[], query: URLSearchParams): HideShowCleanup<HTMLDivElement> {
    const frame = document.createElement("div");
    const hsc = hideshow(frame);

    uhtml.render(frame, uhtml.html`<div>…</div>`);
    (async () => {
        uhtml.render(frame, uhtml.html`<div>Logging In…</div>`);
        try {
            await client.login(path, query);
        }catch(e) {
            console.log(e);
            // TODO if this is the only open history item, don't target _blank
            uhtml.render(frame, uhtml.html`<div class="error">Login error! ${e.toString()}.</div>`);
            // const v: {removeSelf: () => void} = clientLogin(client, () => v.removeSelf()).insertBefore(frame, null);
            return;
        }
        // if this page is still active, navigate({path: "/login/success", replace: true}); to get rid of the token in the url
        uhtml.render(frame, uhtml.html`<div>Logged In! You may now close this page.</div>`);
    })().catch(e => {
        console.log(e);
        alert("Unexpected error "+e.toString());
    });

    return hsc;
}


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
const client_initializers: {[key: string]: () => Promise<ThreadClient>} = {
    reddit: () => import("./clients/reddit").then(client => client.client),
    mastodon: () =>  import("./clients/mastodon").then(client => client.client),
};
const getClient = async (name: string) => {
    const clientInitializer = client_initializers[name];
    if(!clientInitializer) return undefined;
    if(!client_cache[name]) client_cache[name] = await clientInitializer();
    if(client_cache[name]!.id !== name) throw new Error("client has incorrect id");
    return client_cache[name];
};
const getClientCached = (name: string): ThreadClient | undefined => {
    return client_cache[name] ?? undefined;
};

type NavigationEntryNode = {removeSelf: () => void, hide: () => void, show: () => void};
type NavigationEntry = {url: string, node: NavigationEntryNode};
const nav_history: NavigationEntry[] = [];

const session_name = "" + Math.random();

function navigate({path, replace}: {path: string, replace?: boolean}) {
    replace ??= false;
    if(replace) {
        console.log("Replacing history item", current_history_index, path);
        nav_history[current_history_index] = {url: "::redirecting::", node: {removeSelf: () => {""}, hide: () => {""}, show: () => {""}}};
        history.replaceState({index: current_history_index, session_name}, "ThreadReader", path);
        onNavigate(current_history_index, location);
    }else{
        console.log("Appending history state index", current_history_index + 1, path);
        history.pushState({index: current_history_index + 1, session_name}, "ThreadReader", path);
        onNavigate(current_history_index + 1, location);
    }
}

function homePage(): HideShowCleanup<HTMLDivElement> {
    const res = el("div");
    const hsc = hideshow(res);
    linkButton("", "/reddit").atxt("Reddit").adto(res);
    res.atxt(" · ");
    linkButton("", "/mastodon").atxt("Mastodon").adto(res);
    return hsc;
}

type URLLike = {search: string, pathname: string};

const navigate_event_handlers: ((url: URLLike) => void)[] = [];

export type HSEvent = "hide" | "show" | "cleanup";
export type HideShowCleanup<T> = {
    setVisible: (new_visible: boolean) => void,
    setParentVisible: (new_visible: boolean) => void,
    cleanup: () => void,
    readonly visible: boolean,
    on: (ev: HSEvent, cb: () => void) => void,
    emit: (ev: HSEvent) => void,
    addChild: (child: HideShowCleanup<unknown>) => void,
    readonly associated_data: T,
    defer: (parent: HideShowCleanup<unknown>) => T,
};

export function hideshow(): HideShowCleanup<undefined>;
export function hideshow<T>(a: T): HideShowCleanup<T>;
export function hideshow<T>(a_any?: T): HideShowCleanup<T> {
    const a = a_any as T;
    const events: {[key: string]: (() => void)[]} = {};

    let is_visible = true;
    let parent_is_visible = true;

    let prev_derived_visibility = true;
    const update = () => {
        const derived_visibility = is_visible && parent_is_visible;

        if(derived_visibility !== prev_derived_visibility) {
            prev_derived_visibility = derived_visibility;
            
            if(derived_visibility) emit("show");
            else emit("hide");

            children.forEach(child => child.setParentVisible(derived_visibility));
        }
    };

    let exists = true;
    const children: HideShowCleanup<unknown>[] = [];
    const emit = (text: HSEvent) => {
        const event = events[text];
        if(!event) return;
        event.forEach(ev => ev());
    };

    const res: HideShowCleanup<T> = {
        on(ev, cb) {
            events[ev] ??= [];
            events[ev]!.push(cb);
        },
        setVisible(nvisible: boolean) {
            if(!exists) return console.log("hideshow called on a deleted object");
            if(is_visible !== nvisible) {
                is_visible = nvisible;
                update();
            }
        },
        setParentVisible(pnvis: boolean) {
            if(!exists) return console.log("hideshow called on a deleted object");
            if(parent_is_visible !== pnvis) {
                parent_is_visible = pnvis;
                update();
            }
        },
        get visible() {
            return is_visible;
        },
        cleanup() {
            exists = false;
            children.forEach(child => child.cleanup());
            emit("cleanup");
        },
        emit,
        addChild(child) {
            children.push(child);
        },
        get associated_data() {
            return a;
        },
        defer(parent: HideShowCleanup<unknown>): T {
            parent.addChild(res);
            return a;
        },
    };
    return res;
}

function fetchClientThen(client_id: string, cb: (client: ThreadClient) => HideShowCleanup<HTMLDivElement>): HideShowCleanup<HTMLDivElement> {
    const cached = getClientCached(client_id);
    if(cached) {
        return cb(cached);
    }

    return fetchPromiseThen(getClient(client_id), client => {
        if(!client){ 
            return fullscreenError("404. Client "+client_id+" not found.");
        }
        return cb(client);
    });

}
// import { richtextEditor } from "./editors/reddit-richtext"; 
function fetchPromiseThen<T>(promise: Promise<T>, cb: (v: T) => HideShowCleanup<HTMLDivElement>): HideShowCleanup<HTMLDivElement> {
    const wrapper = el("div").adto(document.body);
    const hsc = hideshow(wrapper);
    const loader_container = el("div").adto(wrapper);
    el("span").atxt("Fetching client…").adto(loader_container);
    
    promise.then(resv => {
        cb(resv).defer(hsc).adto(wrapper);
        loader_container.remove();
    }).catch(e => {
        console.log("error rendering", e);
        wrapper.adch(el("span").clss("error").atxt("Got error! Check console! "+e.toString()));
    });

    return hsc;
}

function renderPath(pathraw: string, search: string): HideShowCleanup<HTMLDivElement> {
    const path = pathraw.split("/").filter(w => w);

    const path0 = path.shift();

    console.log(path);

    if(path0 == null || path0 === "pwa_start") {
        return homePage();
    }

    if(path0 === "login"){
        return fetchClientThen(path[0] ?? "ENOCLIENT", (client) => {
            return clientLoginPage(client, path, new URLSearchParams(search));
        });
    }

    if(path0 === "richtext") {
        return fetchPromiseThen(import("./editors/reddit-richtext"), editor => {
            return editor.richtextEditor({usernames: []});
        });
    }

    return fetchClientThen(path0, (client) => {
        return clientMain(client, "/"+path.join("/")+search);
    });
}

let current_history_index = 0;
function onNavigate(to_index: number, url: URLLike) {
    console.log("Navigating", to_index, url, nav_history);
    navigate_event_handlers.forEach(evh => evh(url));

    const thisurl = url.pathname + url.search;
    current_history_index = to_index;
    const history_item = nav_history[to_index];
    if(history_item) {
        // hide all history
        nav_history.forEach(item => item.node.hide());
        if(history_item.url !== thisurl) {
            console.log("URLS differ. «", history_item.url, "» «", thisurl, "»");
            
            // a b c d to_index [… remove these]
            for(let i = nav_history.length - 1; i >= to_index; i--) {
                const last = nav_history.pop();
                if(!last) throw new Error("bad logic");
                last.node.removeSelf();
            }
        }else{
            // show the current history
            history_item.node.show();
            return; // done
        }
    }else{
        nav_history.forEach(item => item.node.hide());
    }

    const hsc = hideshow();
    const node = renderPath(url.pathname, url.search).defer(hsc).adto(document.body);
    hsc.on("cleanup", () => node.remove());
    hsc.on("hide", () => node.style.display = "none");
    hsc.on("show", () => node.style.display = "");

    const naventry: NavigationEntryNode = {
        removeSelf: () => hsc.cleanup(),
        hide: () => hsc.setVisible(false),
        show: () => hsc.setVisible(true),
    };

    nav_history[to_index] = {node: naventry, url: thisurl};
}

// TODO add support for navigation without any browser navigation things
// eg within the frame of /pwa-start, display the client and have custom nav buttons
// on the top that don't use history or whatever

export const bodytop = el("div").adto(document.body);
let navbar: HTMLDivElement; {
    const frame = el("div").clss("navbar").adto(document.body);
    navbar = frame;

    el("button").adto(frame).atxt("←").onev("click", () => history.back());
    el("button").adto(frame).atxt("→").onev("click", () => history.forward());

    const nav_path = el("input").adto(frame).clss("navbar-path");

    const nav_go = el("button").atxt("⏎").adto(frame);
    const nav_reload = el("button").atxt("🗘").adto(frame);

    const go = () => navigate({path: nav_path.value});
    nav_go.onclick = () => go();
    nav_path.onkeydown = k => k.key === "Enter" ? go() : 0;

    nav_reload.onclick = () => alert("TODO refresh");

    navigate_event_handlers.push(url => nav_path.value = url.pathname + url.search);
}

history.replaceState({index: 0, session_name}, "ThreadReader", location.pathname + location.search + location.hash);
onNavigate(0, location);

let drtime = 100;
const rmdarkreader = () => {
    document.head.querySelector(".darkreader")?.remove();
    drtime *= 2;
    setTimeout(() => rmdarkreader(), drtime);
};
setTimeout(() => rmdarkreader(), 0);

const alertarea = el("div").adto(document.body).clss("alert-area");
export function showAlert(text: string): void {
    const alert = el("div").clss("alert").adto(alertarea);
    el("div").clss("alert-body").adto(alert).atxt(text);
    el("button").clss("alert-close").atxt("🗙 Close").adto(alert).onev("click", () => alert.remove());
    alert.atxt(" ");
    el("button").clss("alert-close").atxt("🗘 Refresh").adto(alert).onev("click", () => location.reload());
}

declare const fakevar: {build: "development" | "production"};
if(fakevar.build === "production" && 'serviceWorker' in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js").then(regr => {
            console.log("ServiceWorker registered", regr, regr.scope);
        }).catch(e => {
            console.log("ServiceWorker registration failed", e);
        });
    });
}