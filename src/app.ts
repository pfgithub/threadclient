import "./_stdlib";
import "./main.scss";

import * as Reddit from "./types/api/reddit";
import * as Generic from "./types/generic";
import {ThreadClient} from "./clients/base";
import { darkenColor, getRandomColor, hslToRGB, RGBA, rgbToHSL, rgbToString, seededRandom } from "./darken_color";

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

export function escapeHTML(html: string) {
    return html.replace(/[^a-zA-Z0-9. ]/giu, c => "&#"+c.codePointAt(0)+";");
    // might be a bit &#…; heavy for other languages
}

const safehtml = templateGenerator((v: string) => escapeHTML(v));

function clientLogin(client: ThreadClient, path: string, on_complete: () => void) { return {insertBefore(parent: Node, before_once: Node | null) {
    const frame = document.createElement("div");
    parent.insertBefore(frame, before_once);

    const renderLink = (href: string) => {
        uhtml.render(frame, html`<a href="${href}" rel="noreferrer noopener" target="_blank">Log In</a>`);
    }
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
    const event_listener = () => {
        if(!done && client.isLoggedIn(path)) {
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
    if(href.startsWith("/") && client_id) {
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

function embedYoutubeVideo(youtube_video_id: string, opts: {autoplay: boolean}, search: URLSearchParams): {node: Node, onhide?: () => void, onshow?: () => void} {
    const start_code = search.get("t") ?? search.get("start") ?? undefined;
    const yt_player = el("iframe").attr({
        allow: "fullscreen",
        src: "https://www.youtube.com/embed/"+youtube_video_id+"?version=3&enablejsapi=1&playerapiid=ytplayer"+(opts.autoplay ? "&autoplay=1" : "")+(start_code ? "&start="+start_code : ""),
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
        || path.endsWith(".webp")
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

        let audio = el("audio").adto(container);
        el("source").attr({src: link+"/DASH_audio.mp4", type: "video/mp4"}).adto(audio);
        el("source").attr({src: link+"/audio", type: "video/mp4"}).adto(audio);

        let video = el("video").attr({controls: ""}).clss("preview-image").adto(el("div").adto(container));
        el("source").attr({src: link+"/DASH_720.mp4", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_720", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_480.mp4", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_480", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_360.mp4", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_360", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_240.mp4", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/DASH_240", type: "video/mp4"}).adto(video);
        el("source").attr({src: link+"/HLSPlaylist.m3u8", type: "application/x-mpegURL"}).adto(video);

        const speaker_icons = ["🔇", "🔈", "🔊"];
        let btnarea = el("div").adto(container).styl({display: "flex"});
        let mutebtn = el("button").adto(btnarea);
        const muteicn = txt(speaker_icons[2]).adto(mutebtn);
        let slider = el("input").attr({type: "range", min: "0", max: "100", value: "100"}).adto(btnarea);
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
    if(path.endsWith(".mp4") || path.endsWith(".webm")) return () => {
        let src = el("source").attr({src: link});
        let video = el("video").attr({controls: ""}).clss("preview-image").adch(src);
        return {node: video, onhide: () => video.pause()};
    }
    if(url && (url.host === "www.youtube.com" || url.host === "youtube.com") && url.pathname === "/watch") {
        const link = url.searchParams.get("v");
        if(link) return () => {
            return embedYoutubeVideo(link, opts, url.searchParams);
        };
    }
    if(url && (url.host === "youtu.be") && url.pathname.split("/").length === 2) return () => {
        const youtube_video_id = url.pathname.split("/")[1] ?? "no_id";
        return embedYoutubeVideo(youtube_video_id, opts, url.searchParams);
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

function renderImageGallery(client: ThreadClient, images: Generic.GalleryItem[]): {node: Node, cleanup: () => void} {
    let container = el("div");
    type State = "overview" | {
        index: number
    };
    let state: State = "overview";
    let setState = (newState: State) => {
        state = newState;
        update();
    }

    let prevbody: {cleanup: () => void} | undefined;
    let prevnode: HTMLDivElement | undefined;

    let update = () => {
        if(prevbody) {prevbody.cleanup(); prevbody = undefined;}
        if(prevnode) prevnode.innerHTML = "";
        if(state === "overview") {
            uhtml.render(container, html`${images.map((image, i) => html`
                <button class="gallery-overview-item" onclick=${() => {setState({index: i});}}>
                    <img src=${image.thumb} width=${image.w+"px"} height=${image.h+"px"}
                        class="preview-image gallery-overview-image"
                    />
                </button>
            `)}`);
            return;
        }
        let index = state.index;
        const selimg = images[index];
        const ref: {current?: HTMLDivElement} = {};
        uhtml.render(container, html`
            <button onclick=${() => setState({index: index - 1})} disabled=${index <= 0 ? "" : undefined}>Prev</button>
            ${index + 1}/${images.length}
            <button onclick=${() => setState({index: index + 1})} disabled=${index >= images.length - 1 ? "" : undefined}>Next</button>
            <button onclick=${() => setState("overview")}>Gallery</button>
            <div ref=${ref}></div>
        `);
        prevbody = renderBody(client, selimg.body, {autoplay: true, on: {show: () => {}, hide: () => {}}}, ref.current!);
        prevnode = ref.current;
        // TODO display a loading indicator while the image loads
    };

    setState(state);
    return {node: container, cleanup: () => {if(prevbody) prevbody.cleanup(); if(prevnode) prevnode.remove()}};
}

function renderFlair(flairs: Generic.Flair[]) {
    let resl = document.createDocumentFragment();
    for(const flair of flairs) {
        let flairv = el("span").clss("flair");
        resl.atxt(" ");
        if(flair.color) flairv.styl({"--flair-color": flair.color, "--flair-color-dark": flair.color});
        if(flair.fg_color) flairv.clss("flair-text-"+flair.fg_color);
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
function timeAgo(start_ms: number): {node: Node, cleanup: () => void, defer: (defobj: MakeDeferReturn) => Node} {
    const tanode = txt("…");
    let timeout: number | undefined;
    const update = () => {
        timeout = undefined;
        const [newtext, wait_time] = timeAgoText(start_ms);
        tanode.nodeValue = newtext;
        if(wait_time >= 0) timeout = setTimeout(() => update(), wait_time + 100);
    };
    update();
    const cleanup = () => {
        if(timeout !== undefined) clearTimeout(timeout);
    };
    return {node: tanode, cleanup, defer: (dobj) => (dobj(() => cleanup()), tanode)};
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
        return (load_state as any as {loaded: T}).loaded;
    }
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
    const xss = (window as any).filterXSS;
    return {
        saftify: (html, class_prefix: string) => xss(html, {
            onTagAttr: (tag: string, name: string, value: string, isWhiteAttr: string) => {
                if(name === "class") return name+"=\""+xss.escapeAttrValue(value.split(" ").map(v => class_prefix + v).join(" "))+"\"";
            },
        }),
    };
});

function renderPreviewableLink(client: ThreadClient, href: string, __after_once: Node | null, parent_node: Node): {newbtn: HTMLAnchorElement} {
    const after_node = document.createComment("");
    parent_node.insertBefore(after_node, __after_once);

    const renderLinkPreview = canPreview(href, {autoplay: true});

    const newbtn = linkButton(client.id, href, {onclick: renderLinkPreview ? () => togglepreview() : undefined});
    parent_node.insertBefore(newbtn, after_node);

    if(!renderLinkPreview) return {newbtn};

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
        parent_node.insertBefore(preview_div, after_node);
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
    parent_node.insertBefore(showpreviewbtn, after_node);

    return {newbtn};
}

function renderSafeHTML(client: ThreadClient, safe_html: string, parent_node: Node, class_prefix: string) {
    const divel = el("div").adto(parent_node).clss("slightlybigger");
    divel.innerHTML = safe_html;
    if(class_prefix) for(let node of Array.from(divel.querySelectorAll("*"))) {
        Array.from(node.classList).forEach(classname => {
            node.classList.replace(classname, class_prefix + classname);
        });
    }
    for(let alink of Array.from(divel.querySelectorAll("a"))) {
        const after_node = document.createComment("after");
        alink.parentNode!.replaceChild(after_node, alink);

        const href = alink.getAttribute("href")!;
        const content = Array.from(alink.childNodes);

        const {newbtn} = renderPreviewableLink(client, href, after_node, after_node.parentNode!);

        newbtn.attr({"class": alink.getAttribute("class")});
        content.forEach(el => newbtn.appendChild(el));
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
            const safe_html = mdr.renderMd(body.content);
            renderSafeHTML(client, safe_html, container, "");
        });
    }else if(body.markdown_format === "none") {
        container.atxt(body.content);
    }else if(body.markdown_format === "mastodon") {
        const preel = el("pre").adto(container);
        el("code").atxt(body.content).adto(preel);
        getHtmlSaftifier().then(hsr => {
            preel.remove();
            const safe_html = hsr.saftify(body.content, "mastodon-");
            renderSafeHTML(client, safe_html, container, "");
        });
    }else assertNever(body.markdown_format);

    return {removeSelf(){defer.cleanup();}};
}}}

function renderRichtextSpan(client: ThreadClient, rts: Generic.Richtext.Span, container: Node): {cleanup: () => void} {
    const defer = makeDefer();

    switch(rts.kind) {
        case "text": {
            let mainel: Node = el("span");
            const wrap = (outer: Node) => {
                outer.adch(mainel);
                mainel = outer;
            }
            if(rts.styles.code) wrap(el("code"));
            if(rts.styles.emphasis) wrap(el("i"));
            if(rts.styles.error) wrap(el("span").clss("error").attr({title: rts.styles.error}));
            if(rts.styles.strikethrough) wrap(el("s"));
            if(rts.styles.strong) wrap(el("b"));
            if(rts.styles.superscript) wrap(el("sup"));

            mainel.atxt(rts.text);
            mainel.adto(container);
        }; break;
        case "link": {
            const {newbtn} = renderPreviewableLink(client, rts.url, null, container);
            if(rts.title) newbtn.title = rts.title;
            for(const child of rts.children) {
                const chld = renderRichtextSpan(client, child, newbtn);
                defer(() => chld.cleanup());
            }
        }; break;
        case "br": {
            container.adch(el("br"));
        }; break;
        case "spoiler": {
            let spoilerspan = el("spoiler").clss("md-spoiler-text");
            let subspan = el("span").adto(spoilerspan).clss("md-spoiler-content");
            for(const child of rts.children) {
                const chld = renderRichtextSpan(client, child, subspan);
                defer(() => chld.cleanup());
            }
            spoilerspan.attr({title: "Click to reveal spoiler"});
            subspan.style.opacity = "0";
            spoilerspan.onev("click", () => {
                subspan.style.opacity = "1";
                spoilerspan.attr({title: ""});
            });
        }; break;
        default: assertNever(rts);
    }

    return {cleanup: () => defer.cleanup()};
}

function renderRichtextParagraph(client: ThreadClient, rtp: Generic.Richtext.Paragraph, container: Node): {cleanup: () => void} {
    const defer = makeDefer();

    switch(rtp.kind) {
        case "paragraph": {
            const pel = el("p").adto(container);
            for(const child of rtp.children) {
                const chld = renderRichtextSpan(client, child, pel);
                defer(() => chld.cleanup());
            }
        }; break;
        case "heading": {
            const hel = el("h"+rtp.level).adto(container);
            for(const child of rtp.children) {
                const chld = renderRichtextSpan(client, child, hel);
                defer(() => chld.cleanup());
            }
        }; break;
        case "blockquote": case "list": case "list_item": {
            const bquot = el(rtp.kind === "blockquote" ?
                "blockquote" : rtp.kind === "list" ?
                rtp.ordered ? "ol" : "ul" : rtp.kind
                === "list_item" ? "li" : assertNever(rtp)
            ).adto(container);
            for(const child of rtp.children) {
                const chld = renderRichtextParagraph(client, child, bquot);
                defer(() => chld.cleanup());
            }
        }; break;
        case "horizontal_line": {
            el("hr").adto(container);
        }; break;
        case "code_block": {
            el("pre").adch(el("code").atxt(rtp.text)).adto(container);
        }; break;
        case "image": {
            el("img").attr({src: rtp.url, alt: rtp.alt, title: rtp.alt, width: rtp.w + "px", height: rtp.h + "px"}).clss("preview-image").adto(container);
            if(rtp.caption) el("p").atxt("Caption: "+rtp.caption).adto(container);
        }; break;
        case "video": {
            el("video").attr({src: rtp.url, width: rtp.w + "px", height: rtp.h + "px"}).clss("preview-image").adto(container);
            if(rtp.caption) el("p").atxt("Caption: "+rtp.caption).adto(container);
        }; break;
        case "table": {
            const tablel = el("table").adto(container);
            const thead = el("tr").adto(el("thead").adto(tablel));
            for(const heading of rtp.headings) {
                const headth = el("th").adto(thead).attr({align: heading.align});
                for(const child of heading.children) {
                    const chld = renderRichtextSpan(client, child, headth);
                    defer(() => chld.cleanup());
                }
            }
            const tbody = el("tbody").adto(tablel);
            for(const row of rtp.children) {
                const rowr = el("tr").adto(tbody);
                row.forEach((col, i) => {
                    const align = rtp.headings[i].align;
                    const td = el("td").adto(rowr).attr({align});
                    for(const child of col.children) {
                        const chld = renderRichtextSpan(client, child, td);
                        defer(() => chld.cleanup());
                    }
                });
            }
        }; break;
        default: assertNever(rtp);
    }

    return {cleanup: () => defer.cleanup()};
}

let renderBody = (client: ThreadClient, body: Generic.Body, opts: {autoplay: boolean, on: {hide: () => void, show: () => void}}, content: ChildNode): {cleanup: () => void} => {
    const defer = makeDefer();

    if(body.kind === "text") {
        const txta = el("div").adto(content);
        const txt = renderText(client, body).insertBefore(txta, null);
        defer(() => txt.removeSelf());
    }else if(body.kind === "link") {
        // TODO fix this link button thing
        el("div").adto(content).adch(linkButton(client.id, body.url).atxt(body.url));
        const renderLinkPreview = canPreview(body.url, {autoplay: opts.autoplay, suggested_embed: body.embed_html});
        if(renderLinkPreview) {
            const preview = renderLinkPreview();
            preview.node.adto(content);
            if(preview.onhide) opts.on.hide = preview.onhide;
            if(preview.onshow) opts.on.show = preview.onshow;
        }
    }else if(body.kind === "none") {
        content.remove();
    }else if(body.kind === "gallery") {
        const rvres = renderImageGallery(client, body.images)
        rvres.node.adto(content);
        defer(() => rvres.cleanup());
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
                const rbres = renderBody(client, new_body, {autoplay: true, on: opts.on}, content); defer(() => rbres.cleanup());
            });
        }
    }else if(body.kind === "crosspost") {
        const parentel = el("div").styl({width: "max-content"}).adto(content);
        const child = clientListing(client, body.source).insertBefore(parentel, null);
        // TODO child.onShow, child.onHide
        defer(() => child.removeSelf());
    }else if(body.kind === "richtext") {
        const txta = el("div").adto(content);
        for(const pargrph of body.content) {
            const rendered = renderRichtextParagraph(client, pargrph, txta);
            defer(() => rendered.cleanup());
        }
    }else if(body.kind === "poll") {
        const pollcontainer = el("ul").adto(content).clss("poll-container");
        for(const choice of body.choices) {
            const choicebtn = el("button").adto(el("li").adto(pollcontainer).clss("poll-choice-li")).clss("poll-choice");
            choicebtn.atxt(choice.name + " ("+s(choice.votes, " Votes")+")");
            choicebtn.onev("click", () => alert("TODO voting on polls"));
        }
        if(body.select_many) {
            const submitbtn = el("button").adto(content);
        }
    }else if(body.kind === "captioned_image") {
        el("div").adto(content).atxt(body.caption ?? "");
        el("img").adto(el("div").adto(content)).clss("preview-image").attr({src: body.url, width: body.w + "px", height: body.h + "px", alt: body.alt, title: body.alt});
    }else if(body.kind === "video") {
        const vid = el("video").adch(el("source").attr({src: body.url})).attr({width: body.w + "px", height: body.h + "px", controls: ""}).clss("preview-image").adto(content);
        if(body.gifv) {
            vid.loop = true;
            if(opts.autoplay) vid.controls = false;
        }
        if(opts.autoplay) {vid.play();}
    }else if(body.kind === "array") {
        for(const v of body.body) {
            if(!v) continue;
            const atma = el("div").adto(content);
            const child = renderBody(client, v, {autoplay: false, on: opts.on}, atma);
            defer(() => child.cleanup());
        }
    }else assertNever(body);

    return {cleanup: () => defer.cleanup()};
};

function userProfileListing(client: ThreadClient, profile: Generic.Profile, frame: HTMLDivElement) {
    const defer = makeDefer();

    {
        const bodyel = el("div").adto(frame);
        renderBody(client, profile.bio, {autoplay: false, on: {hide: () => {}, show: () => {}}}, bodyel);
    }

    const action_container = el("div").adto(frame);
    for(const action of profile.actions) {
        action_container.atxt(" ");
        const actv = renderAction(client, action, action_container);
        defer(() => actv.cleanup());
    }
    action_container.atxt(" ");
    linkLikeButton().adto(action_container).atxt("Code").onev("click", () => {
        console.log(profile);
    })

    // TODO add all the buttons
    // specifically ::
    //   Follow, Mute, Block, Block Domain
    // so I can use "Block Domain" on "botsin.space"

    return {cleanup: () => defer.cleanup()};
}

const scoreToString = (score: number) => {
    if(score < 10_000) return "" + score;
    if(score < 100_000) return (score / 1000).toFixed(2).match(/^-?\d+(?:\.\d{0,1})?/)?.[0] + "k";
    return (score / 1000 |0) + "k";
};

function renderAction(client: ThreadClient, action: Generic.Action, content_buttons_line: Node): {cleanup: () => void} {
    const defer = makeDefer();
    if(action.kind === "link") linkButton(client.id, action.url).atxt(action.text).adto(content_buttons_line);
    else if(action.kind === "reply") {
        let prev_preview: {preview: Generic.Thread, remove: () => void} | undefined = undefined;
        let reply_state: "none" | {preview?: Generic.Thread} = "none"
        const reply_btn = linkLikeButton().atxt("Reply").adto(content_buttons_line);

        let reply_container: HTMLDivElement | undefined;

        defer(() => {
            if(prev_preview) {prev_preview.remove(); prev_preview = undefined;}
        });
        
        const update = () => {
            if(reply_state === "none") {
                if(reply_container) {reply_container.remove(); reply_container = undefined;}
                if(prev_preview) {prev_preview.remove(); prev_preview = undefined;}
                reply_btn.disabled = false;
            }else{
                if(!reply_container) {
                    reply_container = el("div").adto(content_buttons_line);
                    const textarea = el("textarea").adto(el("div").adto(reply_container));
                    const submit = el("button").adto(reply_container).atxt("Reply");
                    const preview = el("button").adto(reply_container).atxt("Preview");
                    const cancel = el("button").adto(reply_container).atxt("Cancel");
                    preview.onev("click", () => {
                        reply_state = {preview: client.previewReply(textarea.value, action.reply_info)}
                        update();
                    });
                    // this might lag too much idk
                    textarea.onev("input", () => {
                        reply_state = {preview: client.previewReply(textarea.value, action.reply_info)}
                        update();
                    });
                    cancel.onev("click", () => {
                        const deleteres = textarea.value ? confirm("delete?") : true;
                        if(deleteres) {
                            reply_state = "none";
                            update();
                        }
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
                    const listing_el = clientListing(client, reply_state.preview).insertBefore(containerel, null);
                    prev_preview = {
                        preview: reply_state.preview,
                        remove: () => {
                            listing_el.removeSelf();
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
    }else assertNever(action);
    return {cleanup: () => defer.cleanup()};
}
function renderCounterAction(client: ThreadClient, action: Generic.CounterAction, content_buttons_line: Node, opts: {parens: boolean}) {
    const wrapper = el("span").clss("counter").adto(content_buttons_line);
    const button = linkLikeButton().adto(wrapper).clss("counter-increment-btn");
    const btn_span = el("span").adto(button);
    const pretxt = txt("").adto(btn_span);
    const btxt = txt("…").adto(btn_span);
    const votecount = el("span").adto(wrapper.atxt(" ")).clss("counter-count");
    const votecount_txt = txt("…").adto(votecount);
    const percent_voted_txt = action.percent == null ? txt("—% upvoted") : txt(action.percent.toLocaleString(undefined, {style: "percent"}) + " upvoted")
    let decr_button: HTMLButtonElement | undefined;

    const state = {loading: false, pt_count: action.count_excl_you === "hidden" ? null : action.count_excl_you, your_vote: action.you};

    const getPointsText = () => {
        if(state.pt_count == null) return ["—", "[score hidden]"];
        const score_mut = state.pt_count + (state.your_vote === "increment" ? 1 : state.your_vote === "decrement" ? -1 : 0);
        return [scoreToString(score_mut), score_mut.toLocaleString()] as const;
    };

    const update = () => {
        const [pt_text, pt_raw] = getPointsText();
        btxt.nodeValue = {increment: action.incremented_label, decrement: action.decremented_label ?? "ERR", "": action.label}[state.your_vote ?? ""];
        votecount_txt.nodeValue = opts.parens ? "(" + pt_text + ")" : pt_text;
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
            alert("Got error: "+e)
        });
    }

    if(action.decremented_label) {
        pretxt.nodeValue = "⯅ ";
        wrapper.atxt(" ");
        decr_button = linkLikeButton().adch(el("span").atxt("⯆")).adto(wrapper).onev("click", () => {
            if(state.your_vote == "decrement") {
                doAct(undefined);
            }else{
                doAct("decrement");
            }
        }).clss("counter-decrement-btn");
    }
    button.onev("click", e => {
        if(state.your_vote == "increment") {
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
}

function clientListing(client: ThreadClient, listing: Generic.ContentNode) { return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();
    // console.log(listing);

    const frame = el("div").clss("post");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    if(listing.kind === "user-profile") {
        const res = userProfileListing(client, listing, frame);
        defer(() => res.cleanup());
        return {removeSelf: () => defer.cleanup()};
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

    let reserved_points_area: null | Node = null;

    if(listing.layout === "reddit-post" && listing.info) {
        const submission_time = el("span").adch(timeAgo(listing.info.time).defer(defer)).attr({title: "" + new Date(listing.info.time)});
        content_subminfo_line.adch(submission_time).atxt(" by ");
        content_subminfo_line.adch(userLink(client.id, listing.info.author.link, listing.info.author.name));
        if(listing.info.author.flair) content_subminfo_line.adch(renderFlair(listing.info.author.flair));
        if(listing.info.in) {
            content_subminfo_line.atxt(" in ").adch(linkButton(client.id, listing.info.in.link).atxt(listing.info.in.name));
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
        const submission_time = el("span").adch(timeAgo(listing.info.time).defer(defer)).attr({title: "" + new Date(listing.info.time)});
        content_subminfo_line.atxt(" ").adch(submission_time);
        if(listing.info.reblogged_by) {
            const [author_color, author_color_dark] = getRandomColor(seededRandom(listing.info.reblogged_by.author.name));
            content_subminfo_line.atxt(" ← Boosted by ")
                .adch(userLink(client.id, listing.info.reblogged_by.author.link, listing.info.reblogged_by.author.name))
                .atxt(" at ").adch(timeAgo(listing.info.reblogged_by.time).defer(defer))
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

        const on = {
            hide: () => {},
            show: () => {},
        }

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
                    const rbres = renderBody(client, body, {...opts, on}, content); defer(() => rbres.cleanup());
                });
                return;
            }
            const rbres = renderBody(client, body, {...opts, on}, content); return defer(() => rbres.cleanup());
        }
        
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
                    if(state) on.show();
                    else on.hide();
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
        if(action.kind === "counter" && action.special === "reddit-points") {
            frame.clss("spacefiller-redditpoints");
            const ctr = renderCounterAction(client, action, content_voting_area, {parens: false});
            if(listing.layout === "reddit-comment") {
                content_subminfo_line.insertBefore(txt(" "), reserved_points_area)
                content_subminfo_line.insertBefore(ctr.votecount, reserved_points_area);
                content_subminfo_line.insertBefore(txt(" points"), reserved_points_area)
            }else if(listing.layout === "reddit-post") {
                content_subminfo_line.atxt(", ");
                ctr.percent_voted_txt.adto(content_subminfo_line);

                content_voting_area.clss("desktop-only");
                content_buttons_line.atxt(" ");
                const cbl_render_area = el("div").clss("mobile-only").adto(content_buttons_line);
                const actv = renderAction(client, action, cbl_render_area);
                defer(() => actv.cleanup());
            }
        }else {
            content_buttons_line.atxt(" ");
            const actv = renderAction(client, action, content_buttons_line);
            defer(() => actv.cleanup());
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

function swtch<T, U>(value: T, ...cases: [T, () => U][]): U {
    return cases.find(cas => cas[0] === value)![1]();
}

function linkLikeButton() {
    return el("button").clss("link-like-button").attr({draggable: "true"});
}

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
            if(load_more_node.includes_parent && res.replies && res.replies.length === 1) {
                res.replies = (res.replies[0] as Generic.Thread).replies ?? [];
            }
            if(res.replies) res.replies.forEach(rply => addChild(rply));
            if(load_more_node.next) addChild(load_more_node.next);
            removeSelf();
        }).catch(e => {
            console.log("error loading more:", e);
            try{current_node.remove();}catch(e){console.log(e);}
            current_node = el("span").atxt("Error. ").adch(makeButton().atxt("🗘 Retry")).adto(container);
        });
    }});

    let current_node: ChildNode = makeButton().atxt(load_more_node.count ? "Load "+load_more_node.count+" More…" : "Load More…").adto(container).clss("load-more");

    container.atxt(" ");
    linkLikeButton().onev("click", e => {
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
    frame.classList.add("client-main-frame");
    frame.classList.add("display-loading");

    if(!client.isLoggedIn(current_path)) {
        const login_prompt: {removeSelf: () => void} = clientLogin(client, current_path, () => login_prompt.removeSelf()).insertBefore(frame, null);
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
    })().catch(e => console.log(e, e.stack));

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

function clientLoginPage(client: ThreadClient, path: string[], query: URLSearchParams) { return {insertBefore(parent: Node, before_once: Node | null) {
    const defer = makeDefer();

    const frame = document.createElement("div");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

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
const client_initializers: {[key: string]: () => Promise<ThreadClient>} = {
    reddit: () => import("./clients/reddit").then(client => client.reddit("reddit")),
    mastodon: () =>  import("./clients/mastodon").then(client => client.mastodon("mastodon")),
};
const getClient = async (name: string) => {
    if(!client_initializers[name]) return undefined;
    if(!client_cache[name]) client_cache[name] = await client_initializers[name]();
    if(client_cache[name].id !== name) throw new Error("client has incorrect id");
    return client_cache[name];
}
const getClientCached = (name: string): ThreadClient | undefined => {
    return client_cache[name] ?? undefined;
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

function homePage(res: HTMLDivElement): NavigationEntryNode {
    linkButton("", "/reddit").atxt("Reddit").adto(res);
    res.atxt(" · ");
    linkButton("", "/mastodon").atxt("Mastodon").adto(res);
    return {removeSelf: () => res.remove(), hide: () => {
        if(res.style.display !== "none") res.style.display = "none";
    }, show: () => {
        if(res.style.display !== "") res.style.display = "";
    }};
}

type URLLike = {search: string, pathname: string};

let navigate_event_handlers: ((url: URLLike) => void)[] = [];

type HideShowCleanup = {
    setVisible: (new_visible: boolean) => void,
    cleanup: () => void,
    readonly visible: boolean,
    on: (ev: "hide" | "show" | "cleanup", cb: () => void) => void,
};
function hideshow(): HideShowCleanup {
    const events: {[key: string]: (() => void)[]} = {};
    let is_visible = true;
    let exists = true;
    const emit = (text: string) => {
        if(!events[text]) return;
        events[text].forEach(ev => ev());
    }
    const res: HideShowCleanup = {
        on(ev, cb) {
            if(!events[ev]) events[ev] = [];
            events[ev].push(cb);
        },
        setVisible(nvisible: boolean) {
            if(!exists) return console.log("setVisible called on a deleted object");
            if(is_visible && !nvisible) {
                emit("hide");
            }else if(!is_visible && nvisible) {
                emit("show");
            }
            is_visible = nvisible;
        },
        get visible() {
            return is_visible;
        },
        cleanup() {
            exists = false;
            emit("cleanup");
        },
    };
    return res;
}

function fetchClientThen(client_id: string, cb: (client: ThreadClient, parent: Node, before: Node | null) => NavigationEntryNode): NavigationEntryNode {
    const cached = getClientCached(client_id);
    if(cached) {
        return cb(cached, document.body, null);
    }

    const hsc = hideshow();

    const wrapper = el("div").adto(document.body);
    const loader_container = el("div").adto(wrapper);
    el("span").atxt("Fetching client…").adto(loader_container);
    
    getClient(client_id).then(client => {
        let cbres: NavigationEntryNode;
        if(client){ 
            cbres = cb(client, wrapper, null);
        }else{
            cbres = fullscreenError("404. Client "+client_id+" not found.").insertBefore(wrapper, null);
        }
        loader_container.remove();

        hsc.on("cleanup", () => cbres.removeSelf());
        hsc.on("hide", () => cbres.hide());
        hsc.on("show", () => cbres.show()); 
    });

    let res: NavigationEntryNode = {
        removeSelf: () => {
            hsc.cleanup();
            wrapper.remove();
        },
        hide: () => {wrapper.style.display = "none"; hsc.setVisible(false)},
        show: () => {wrapper.style.display = "";     hsc.setVisible(true)},
    };
    return res;
}

function renderPath(pathraw: string, search: string): NavigationEntryNode {
    const path = pathraw.split("/").filter(w => w);

    const path0 = path.shift();

    console.log(path);

    if(!path0) {
        const res = el("div").adto(document.body);
        return homePage(res);
    }

    if(path0 === "login"){
        const client = getClient(path[0]);
        return fetchClientThen(path[0], (client, parent, before) => {
            return clientLoginPage(client, path, new URLSearchParams(search)).insertBefore(parent, before);
        });
    }

    return fetchClientThen(path0, (client, parent, before) => {
        return clientMain(client, "/"+path.join("/")+search).insertBefore(parent, before);
    })
}

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

    const node = renderPath(url.pathname, url.search);

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