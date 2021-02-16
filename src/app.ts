import "./_stdlib";
import "./main.scss";
import "tailwindcss/tailwind.css";

import  * as uhtml from "uhtml";

import * as Generic from "./types/generic";
import {ThreadClient} from "./clients/base";
import { getRandomColor, rgbToString, seededRandom } from "./darken_color";

import {escapeHTML} from "./util";

export const htmlr = uhtml.html;

function assertNever(content: never): never {
    console.log("not never:", content);
    throw new Error("is not never");
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
    let is_raw = false;
    if(href.startsWith("raw!")) {
        href = href.replace("raw!", "");
        is_raw = true;
    }
    if(!href.startsWith("http") && !href.startsWith("/")) {
        return el("a").clss(...linkAppearence, "error").attr({title: href}).clss("error").onev("click", () => alert(href));
    }
    let urlparsed: URL | undefined;
    try {
        urlparsed = new URL(href);
    }catch(e) {
        urlparsed = undefined;
    }
    if(urlparsed && !is_raw && (urlparsed.host === "reddit.com" || urlparsed.host.endsWith(".reddit.com"))) {
        href = "/reddit"+urlparsed.pathname;
    }
    const res = el("a").clss(...linkAppearence).attr({href, target: "_blank", rel: "noreferrer noopener"});
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
    // cross-origin request blocked, can't use this unless the browser happens to support it

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
function videoPreview(sources: {src: string, type?: string}[], opts: {autoplay: boolean, width?: number, height?: number, gifv: boolean}): HideShowCleanup<Node> {
    const video = el("video").attr({controls: "",
        width: opts.width != null ? `${opts.width}px` as const : undefined, height: opts.height != null ? `${opts.height}px` as const : undefined
    }).clss("preview-image");
    sources.forEach(source => {
        el("source").attr({src: source.src, type: source.type}).adto(video);
    });
    if(opts.gifv) {
        video.loop = true;
        video.onplaying = () => video.controls = false;
    }
    if(opts.autoplay) void video.play();
    let playing_before_hide = false;
    const hsc = hideshow(video);
    hsc.on("hide", () => {playing_before_hide = !video.paused; video.pause()});
    hsc.on("show", () => {if(playing_before_hide) void video.play();});
    return hsc;
}
function gfyLike(gfy_host: string, gfy_link: string, opts: {autoplay: boolean}): HideShowCleanup<Node> {
    const resdiv = el("div");
    const hsc = hideshow(resdiv);
    
    const loader = loadingSpinner().adto(resdiv);
    
    fetch("https://api."+gfy_host+"/v1/gfycats/"+gfy_link).then(r => r.json()).then(r => {
        loader.remove();
        type GfyContentUrl = {
            url: string,
            size: number,
            width: number,
            height: number,
        };
        if((r as {errorMessage: string}).errorMessage != null) {
            throw new Error("Got error: "+r.errorMessage);
        }
        resdiv.adch(el("div").adch(linkLikeButton().atxt("code").onev("click", () => console.log(r))));
        const error_v = r as {
            logged: boolean,
            message: string,
            reported: boolean,
        };
        if('message' in error_v) {
            el("div").clss("error").adto(resdiv).atxt("Error: "+error_v.message + " ; logged="+error_v.logged+" ; reported="+error_v.reported);
            return;
        }
        const {gfyItem: gfy_item} = r as {
            gfyItem: {
                avgColor: string,
                content_urls: {
                    // thumbnails
                    poster: GfyContentUrl,
                    mobilePoster: GfyContentUrl,
                    
                    // videos
                    mp4?: GfyContentUrl,
                    mobile?: GfyContentUrl,
                    webm?: GfyContentUrl,
                    webp?: GfyContentUrl,
                },
                createDate: number,
                description?: string,
                title?: string,
                width: number,
                height: number,
            },
        };
        if(gfy_item.title != null) resdiv.adch(el("div").atxt("Title: " + gfy_item.title));
        if(gfy_item.description != null) resdiv.adch(el("div").atxt("Description: "+gfy_item.description));

        videoPreview([
            ...gfy_item.content_urls.mobile ? [{src: gfy_item.content_urls.mobile.url}] : [],
            ...gfy_item.content_urls.webm ? [{src: gfy_item.content_urls.webm.url}] : [],
            ...gfy_item.content_urls.mp4 ? [
                {src: gfy_item.content_urls.mp4.url},
                {src: gfy_item.content_urls.mp4.url.replace(".mp4", "-mobile.mp4")}, // hack
            ] : [],
        ], {autoplay: opts.autoplay, width: gfy_item.width, height: gfy_item.height, gifv: false}).defer(hsc).adto(resdiv);
    }).catch(e => {
        console.log(e);
        if(loader.parentNode) loader.remove();
        resdiv.adch(el("div").clss("error").atxt("Error loading gfycat : " + e.toString()));
    });
    
    return hsc;
}

// what instead of actually previewing the link, this returned a body? pretty resonable idea tbh, just make sure not to allow
// infinite loops where this returns a link body
function canPreview(client: ThreadClient, link: string, opts: {autoplay: boolean, suggested_embed?: string}): undefined | (() => HideShowCleanup<Node>) {
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
        return videoPreview([{src: link, type: "video/mp4"}], {autoplay: opts.autoplay, gifv: true});
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
    if(url && url.host === "gfycat.com" && url.pathname.split("/").length === 2) return (): HideShowCleanup<Node> => {
        const gfylink = url.pathname.replace("/", "").split("-")[0]!.toLowerCase();
        return gfyLike("gfycat.com", gfylink, {autoplay: opts.autoplay});
    };
    if(url && url.host === "\x72\x65\x64gifs.com" && url.pathname.split("/").length === 3 && url.pathname.startsWith("/watch/")) return (): HideShowCleanup<Node> => {
        const gfylink = url.pathname.replace("/watch/", "").split("-")[0]!.toLowerCase();
        return gfyLike(url.host, gfylink, {autoplay: opts.autoplay});
    };
    if(path.endsWith(".mp4") || path.endsWith(".webm")) return (): HideShowCleanup<Node> => {
        return videoPreview([{src: path}], {autoplay: opts.autoplay, gifv: false});
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
    if(url && (url.host === "www.imgur.com" || url.host === "imgur.com") && url.pathname.startsWith("/gallery/")) {
        const galleryid = url.pathname.replace("/gallery/", "");
        if(!galleryid.includes("/")) return (): HideShowCleanup<Node> => {
            const resdiv = el("div");
            const hsc = hideshow(resdiv);
            const loader = loadingSpinner().adto(resdiv);

            fetch("https://api.imgur.com/3/gallery/"+galleryid).then(r => r.json()).then(r => {
                const typed = r as ({
                    success: false,
                    status: number,
                    data: {
                        error: string,
                    },
                } | {
                    success: true,
                    status: number,
                    data: {
                        title: string,
                        layout: "blog" | "unknown",
                        images_count: number,
                        images: {
                            id: string,
                            description: string,
                            link: string, // img src
                            width: number,
                            height: number,
                        }[],
                    },
                });
                console.log("imgur result", typed);
                if(typed.success) {
                    const gallery: Generic.Body = {
                        kind: "gallery",
                        images: typed.data.images.map(image => {
                            const res: Generic.GalleryItem = {
                                thumb: image.link,
                                w: image.width,
                                h: image.height,
                                body: {
                                    kind: "captioned_image",
                                    caption: image.description,
                                    url: image.link,
                                    w: image.width,
                                    h: image.height,
                                },
                            };
                            return res;
                        }),
                    };
                    renderBody(client, gallery, {autoplay: false}, el("div").adto(resdiv)).defer(hsc);
                    loader.remove();
                }else{
                    if(loader.parentNode) loader.remove();
                    resdiv.adch(el("div").clss("error").atxt("Error loading imgur: "+typed.data.error));
                }
            }).catch(e => {
                console.log(e);
                resdiv.adch(el("div").clss("error").atxt("Error loading imgur : "+e.toString()));
            });

            return hsc;
        };
    }
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
        const flairv = el("span").clss("px-2 rounded-full inline-block");
        resl.atxt(" ");
        if(flair.color != null && flair.color !== "") flairv.clss("bg-flair-light dark:bg-flair-dark").styl({"--flair-color": flair.color, "--flair-color-dark": flair.color});
        else flairv.clss("bg-gray-300 dark:bg-gray-600");
        if(flair.fg_color != null) flairv.clss("flair-text-"+flair.fg_color);
        for(const flairelem of flair.elems) {
            if(flairelem.type === "text") {
                flairv.atxt(flairelem.text);
            }else if(flairelem.type === "emoji") {
                el("img").attr({title: flairelem.name, src: flairelem.url, width: `${flairelem.w}px` as const, height: `${flairelem.h}px` as const})
                    .clss("inline-block w-4 h-4 align-middle object-contain").adto(flairv)
                ;
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
function timeAgo(start_ms: number): HideShowCleanup<HTMLSpanElement> {
    const span = el("span").attr({title: "" + new Date(start_ms)});
    const hsc = hideshow(span);
    const tanode = txt("…").adto(span);
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
    renderMd(text: string): string & {_is_safe: true},
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
            return decoded as string & {_is_safe: true};
        }catch(e){
            // note that chrome sometimes crashes on wasm errors and this
            // handler might not run.
            console.log(e.toString() + "\n" + e.stack);
            return escapeHTML("Error "+e.toString()+"\n"+e.stack) as string & {_is_safe: true};
        }
    }};
});

type HtmlSaftifier = {saftify: (html: string, class_prefix: string) => string & {_is_safe: true}};
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
        }) as string & {_is_safe: true},
    };
});

function renderPreviewableLink(client: ThreadClient, href: string, __after_once: Node | null, parent_node: Node): HideShowCleanup<{newbtn: HTMLElement}> {
    const after_node = document.createComment("");
    parent_node.insertBefore(after_node, __after_once);

    const renderLinkPreview = canPreview(client, href, {autoplay: true});

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

function renderSafeHTML(client: ThreadClient, safe_html: string & {_is_safe: true}, parent_node: Node, class_prefix: string): HideShowCleanup<undefined> {
    const divel = el("div").adto(parent_node).clss("rendered-html");
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

        newbtn.attr({class: newbtn.getAttribute("class") + " " + alink.getAttribute("class")});
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
    for(const image of Array.from(divel.querySelectorAll("img"))) {
        image.clss("preview-image");
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
            renderSafeHTML(client, "Got error! Check console!" as string & {_is_safe: true}, container, "").defer(hsc);
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
            renderSafeHTML(client, "Got error! Check console!" as string & {_is_safe: true}, container, "").defer(hsc);
        });
    }else if(body.markdown_format === "reddit_html") {
        const preel = el("pre").adto(container);
        el("code").atxt(body.content).adto(preel);
        getHtmlSaftifier().then(hsr => {
            preel.remove();
            const safe_html = hsr.saftify(body.content, "");
            renderSafeHTML(client, safe_html, container, "").defer(hsc);
        }).catch(e => {
            preel.remove();
            console.log(e);
            renderSafeHTML(client, "Got error! Check console!" as string & {_is_safe: true}, container, "").defer(hsc);
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
            const spoilerspan = el("spoiler").clss("md-spoiler-text").adto(container);
            const subspan = el("span").adto(spoilerspan).clss("md-spoiler-content");
            for(const child of rts.children) {
                renderRichtextSpan(client, child, subspan).defer(hsc);
            }
            spoilerspan.attr({title: "Click to reveal spoiler"});
            subspan.style.opacity = "0";
            let open = false;
            spoilerspan.onev("click", (e) => {
                if(open) return;
                open = true;
                e.preventDefault();
                e.stopPropagation();
                subspan.style.opacity = "1";
                spoilerspan.attr({title: ""});
            }, {capture: true});
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
            ).clss(rtp.kind === "list" ? rtp.ordered ? "list-decimal" : "list-disc" : "").adto(container).clss("richtext-render-node");
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
        const renderLinkPreview = canPreview(client, body.url, {autoplay: opts.autoplay, suggested_embed: body.embed_html});
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
                    new_body = await client.fetchRemoved(body.fetch_path!);
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
        const parentel = el("div").styl({"max-width": "max-content"}).clss("object-wrapper").adto(content);
        clientContent(client, body.source).defer(hsc).adto(parentel);
    }else if(body.kind === "richtext") {
        const txta = el("div").adto(content).clss("richtext-container");
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
        if(body.source.kind === "img") {
            zoomableImage(body.source.url, {w: body.w, h: body.h, alt: body.alt}).adto(el("div").adto(content));
            return hsc;
        }else if(body.source.kind === "video") {
            videoPreview(body.source.sources.map(src => ({src: src.url, type: src.type})), {autoplay: opts.autoplay, width: body.w, height: body.h, gifv: body.gifv})
                .defer(hsc)
                .adto(content)
            ;
        }else if(body.source.kind === "m3u8") {
            const srcurl = body.source.url;
            const poster = body.source.poster;
            fetchPromiseThen(import("./components/video"), vidplayer => {
                const cframe = el("div");
                const shsc = hideshow(cframe);
                vidplayer.playM3U8(srcurl, poster, {autoplay: opts.autoplay}).defer(shsc).adto(cframe);
                return shsc;
            }).defer(hsc).adto(content);
        }
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
                            clientContent(client, r).defer(hsc).adto(el("div").adto(content_buttons_line));
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
                    const listing_el = clientContent(client, reply_state.preview);
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
        const hsc = hideshow();
        renderCounterAction(client, action, content_buttons_line, {parens: true}).defer(hsc);
        return hsc;
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
    }else if(action.kind === "report") {
        let report_container: HTMLDivElement | undefined;
        let hsc = hideshow();

        linkLikeButton().atxt("Report").adto(content_buttons_line).onev("click", () => {
            if(!report_container) report_container = renderReportScreen(client, action.data).defer(hsc).adto(content_buttons_line);
            else {
                hsc.cleanup();
                hsc = hideshow();
                report_container.remove();
                report_container = undefined;
            }
        });

        return hsc;
    }else if(action.kind === "login") {
        const frame = el("span").adto(content_buttons_line);
        const hsc = hideshow();

        const renderLink = (href: string) => {
            uhtml.render(frame, htmlr`<a href="${href}" rel="noreferrer noopener" target="_blank">Log In</a>`);
        };
        const clurl = action.data;
        const btn = el("button").atxt("Log In").adto(frame).onev("click", () => {
            btn.textContent = "…";
            btn.disabled = true;
            client.getLoginURL(clurl).then(res => {
                renderLink(res);
            }).catch(e => {
                btn.textContent = "Retry";
                frame.atxt("Error:"+e);
                console.log(e);
                btn.disabled = false;
            });
        });

        // let done = false;
        // const onFocus = () => {
        //     if(!done && client.isLoggedIn(path)) {
        //         done = true;
        //         uhtml.render(frame, htmlr`Logged In!`);
        //         onComplete();
        //     }
        // };
        // document.addEventListener("focus", onFocus);
        // hsc.on("cleanup", () => document.removeEventListener("focus", onFocus));

        return hsc;
    }else if(action.kind === "act") {
        const frame = el("span").adto(content_buttons_line);
        const btn = linkLikeButton().atxt(action.text).adto(frame).onev("click", () => {
            btn.disabled = true;
            btn.textContent = "…";
            client.act(action.action).then(() => {
                btn.remove();
                txt("✓").adto(frame);
            }).catch(e => {
                console.log("got error: "+e);
                btn.disabled = false;
                frame.adch(el("span").clss("error").atxt(e.toString()));
            });
        });
    }else assertNever(action);
    return hideshow();
}

function renderOneReportItem(client: ThreadClient, report_item: Generic.ReportScreen, onreported: (sentr: Generic.SentReport) => void): HideShowCleanup<HTMLElement> {
    const outer_v = el("details").clss("report-item");
    const hsc = hideshow(outer_v);

    outer_v.adch(el("summary").attr({draggable: "true"}).atxt(report_item.title));

    const frame = el("div").clss("report-content").adto(outer_v);

    if(report_item.description) {
        const body_cont = el("div").adto(frame);
        renderBody(client, report_item.description, {autoplay: false}, body_cont).defer(hsc);
    }

    switch(report_item.report.kind) {
        case "submit": case "textarea": {
            const textarea = report_item.report.kind === "textarea"
                ? el("textarea").adto(el("div").adto(frame))//.attr({maxlength: "" + report_item.report.char_limit})
                : undefined
            ;
            let state: "none" | "load" | {error: string} = "none";
            const btn = el("button").adto(frame);
            const btxt = txt("…").adto(btn);
            const errorlist = el("div").adto(frame);

            const update = () => {
                if(state === "none") {
                    btxt.nodeValue = "Send Report";
                    btn.disabled = false;
                }else if(state === "load") {
                    btxt.nodeValue = "…";
                    btn.disabled = true;
                }else{
                    btxt.nodeValue = "Retry";
                    btn.disabled = false;
                    errorlist.adch(el("div").clss("error").atxt("Error: "+state.error));
                }
            };
            update();

            const report_data = report_item.report.data;

            btn.onev("click", () => {
                state = "load";
                update();
                client.sendReport!(report_data, textarea?.value).then(res => {
                    onreported(res);
                }).catch(e => {
                    console.log(e);
                    state = {error: e.toString()};
                    update();
                });
            });
        } break;
        case "link": {
            linkButton(client.id, report_item.report.url).atxt(report_item.report.text).adto(frame);
        } break;
        case "more": {
            const childsv = el("div").adto(frame);
            for(const child of report_item.report.screens) {
                renderOneReportItem(client, child, onreported).defer(hsc).adto(childsv);
            }
        } break;
        default: assertNever(report_item.report);
    }

    return hsc;
}

function renderReportScreen(client: ThreadClient, report_fetch_info: Generic.Opaque<"report">): HideShowCleanup<HTMLDivElement> {
    const frame = el("div").clss("report-screen");
    const hsc = hideshow(frame);

    if(!client.fetchReportScreen) {
        frame.atxt("Missing fetchreportscreen?");
        frame.clss("error");
        console.log(client);
        return hsc;
    }
    const loader = loadingSpinner().adto(frame);
    client.fetchReportScreen(report_fetch_info).then(res => {
        loader.remove();
        const report_item_hsc = hideshow();
        const cleanup_child = hsc.addChild(report_item_hsc);
        for(const item of res) {
            renderOneReportItem(client, item, (sentr) => {
                cleanup_child.cleanup();
                frame.innerHTML = "";
                frame.atxt("Report sent!");
                console.log("Completed report", sentr);
                const resdiv = clientListingWrapperNode().adto(frame);
                resdiv.adch(el("div").atxt(sentr.title));
                const body_cont = el("div").adto(resdiv);
                renderBody(client, sentr.body, {autoplay: false}, body_cont).defer(hsc);
                console.log(resdiv, frame, frame.childNodes);
            }).defer(report_item_hsc).adto(frame);
        }
    }).catch(e => {
        console.log("error loading report screen", e);
        frame.adch(el("div").clss("error").atxt("Error loading: "+e.toString()));
        loader.remove();
    });

    return hsc;
}

type CounterState = {
    loading: boolean,
    pt_count: number | "hidden" | "none",
    your_vote: "increment" | "decrement" | undefined,
};
type GlobalCounter = {
    state: CounterState,
    handlers: Set<() => void>,
    users: number,
    update_time: number,
};
type WatchableCounterState = {
    state: CounterState,
    emit: () => void,
    onupdate: (cb: () => void) => void,
};

const global_counter_info = new Map<string, GlobalCounter>();

function watchCounterState(counter_id_raw: string | null, updates: {count: number | "hidden" | "none", you: "increment" | "decrement" | undefined, time: number}): HideShowCleanup<WatchableCounterState> {
    const counter_id = counter_id_raw ?? `${Math.random()}`;
    const global_state: GlobalCounter = global_counter_info.get(counter_id) ?? {
        state: {
            loading: false,
            pt_count: updates.count,
            your_vote: updates.you, 
        },
        handlers: new Set(),
        users: 0,
        update_time: updates.time,
    };
    if(!global_counter_info.has(counter_id)) global_counter_info.set(counter_id, global_state);
    if(global_state.update_time < updates.time) {
        global_state.state.pt_count = updates.count;
        global_state.state.your_vote = updates.you;
    }
    const res: WatchableCounterState = {
        state: global_state.state,
        emit() {
            global_state.handlers.forEach(handler => handler());
        },
        onupdate(cb) {
            const uniqueCallback = () => {
                cb();
                // consider only firing cb when hsc is visible? and if it's hidden, batch it for when it becomes visible again?
                // probably not an issue currently
            };
            global_state.handlers.add(uniqueCallback);
            hsc.on("cleanup", () => {
                global_state.handlers.delete(uniqueCallback);
            });
        },
    };
    const hsc = hideshow(res);
    global_state.users++;
    hsc.on("cleanup", () => {
        global_state.users--;
        if(global_state.users === 0) global_counter_info.delete(counter_id);
    });
    return hsc;
}

function renderCounterAction(client: ThreadClient, action: Generic.CounterAction, content_buttons_line: Node, opts: {parens: boolean}): HideShowCleanup<{
    percent_voted_txt: Text, votecount: HTMLSpanElement,
}> {
    const display_count = action.count_excl_you !== "none";

    const wrapper = el("span").clss("counter").adto(content_buttons_line);
    const button = linkLikeButton().adto(wrapper).clss("counter-increment-btn").attr({'aria-label': "Up"});
    const btn_span = el("span").adto(button);
    const pretxt = txt("").adto(btn_span);
    const btxt = txt("…").adto(btn_span);
    const votecount = el("span").adto(wrapper.atxt(" ")).clss("counter-count");
    const votecount_txt = txt("…").adto(votecount);
    const percent_voted_txt = action.percent == null ? txt("—% upvoted") : txt(action.percent.toLocaleString(undefined, {style: "percent"}) + " upvoted");
    let decr_button: HTMLButtonElement | undefined;

    const hsc = hideshow({percent_voted_txt, votecount});
    const {state, emit, onupdate} = watchCounterState(action.unique_id, {count: action.count_excl_you, you: action.you, time: action.time}).defer(hsc);

    const getPointsText = () => {
        if(state.pt_count === "hidden" || state.pt_count === "none") return ["—", "[score hidden]"];
        const score_mut = state.pt_count + (state.your_vote === "increment" ? 1 : state.your_vote === "decrement" ? -1 : 0);
        return [scoreToString(score_mut), score_mut.toLocaleString()] as const;
    };

    onupdate(() => {
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

        button.setAttribute("aria-pressed", state.your_vote === "increment" ? "true" : "false");
        if(decr_button) decr_button.setAttribute("aria-pressed", state.your_vote === "decrement" ? "true" : "false");
    });
    emit();

    const doAct = (vote: undefined | "increment" | "decrement") => {
        if('error' in action.actions) {
            return alert("Error: "+action.actions.error);
        }
        const prev_vote = state.your_vote;
        state.your_vote = vote;
        state.loading = true;
        emit();
        const action_v = action.actions[vote ?? "reset"];
        if(action_v == null) throw new Error("downvote label available but downvote action not provided");
        client.act(action_v).then(() => {
            state.your_vote = vote;
            state.loading = false;
            emit();
        }).catch(e => {
            state.your_vote = prev_vote;
            state.loading = false;
            emit();
            console.log(e);
            alert("Got error: "+e);
        });
    };

    if(action.decremented_label != null) {
        pretxt.nodeValue = "⯅ ";
        wrapper.atxt(" ");
        decr_button = linkLikeButton().adch(el("span").atxt("⯆")).attr({'aria-label': "Down"}).adto(wrapper).onev("click", () => {
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

    return hsc;
}

const userLink = (client_id: string, href: string, name: string) => {
    const [author_color, author_color_dark] = getRandomColor(seededRandom(name));
    return linkButton(client_id, href)
        .styl({"--light-color": rgbToString(author_color), "--dark-color": rgbToString(author_color_dark)})
        .clss("user-link")
        .atxt(name)
    ;
};

function redditHeader(client: ThreadClient, listing: Generic.RedditHeader, frame: HTMLDivElement): HideShowCleanup<undefined> {
    const hsc = hideshow();

    frame.clss("subreddit-banner");

    if(listing.banner) {
        el("div").clss("sub-banner-img").attr({alt: ""}).styl({
            '--desktop-banner-url': "url("+encodeURI(listing.banner.desktop)+")",
            '--mobile-banner-url': "url("+encodeURI(listing.banner.mobile ?? listing.banner.desktop)+")",
        }).adto(frame);
    }

    const area = el("div").clss("subreddit-banner-content").adto(frame);

    if(listing.icon) {
        el("img").clss("sub-icon-img").attr({alt: "", src: listing.icon.url}).adto(area);
    }
    const title_area = el("div").clss("subreddit-title-area").adto(area);
    if(listing.name.display != null) el("h1").atxt(listing.name.display).clss("text-lg").adto(title_area);
    el("h2").atxt(listing.name.link_name).clss("text-gray-500").adto(title_area);

    if(listing.subscribe) {
        const subscrarea = el("div").clss("sub-subscribe-area").adto(area);
        renderAction(client, listing.subscribe, subscrarea).defer(hsc);
    }

    if(listing.menu) {
        const menu_area = el("div").clss("subreddit-menu").adto(frame);
        for(const item of listing.menu) {
            el("span").clss("menu-item").atxt(item.text).adto(menu_area);
            txt(" ").adto(menu_area);
        }
    }

    linkLikeButton().atxt("Code").adto(frame).onev("click", () => console.log(listing));

    return hsc;
}

function widgetRender(client: ThreadClient, widget: Generic.Widget, outest_el: HTMLDivElement): HideShowCleanup<undefined> {
    const hsc = hideshow();
    outest_el.clss("widget");

    const outer_el = el("div").adto(outest_el);

    txt(widget.title).adto(el("div").adto(outer_el).clss("widget-header font-bold text-base mb-2 text-gray-500"));

    const frame = el("div").clss("widget-content").adto(outer_el);
    
    if(widget.actions_top) {
        const actionstop = el("div").clss("widget-actions-top").adto(frame);
        for(const action of widget.actions_top) {
            renderAction(client, action, actionstop).defer(hsc);
        }
    }

    const content = widget.widget_content;
    if(content.kind === "list") {
        const list = el("ul").clss("widget-list list-disc").adto(frame);
        for(const item of content.items) {
            const ili_wrapper = el("li").adto(list);
            let ili: HTMLElement;
            if(item.click.kind === "body") {
                ili_wrapper.clss("list-none");
                const details = el("details").adto(ili_wrapper);
                ili = el("summary").attr({draggable: "true"}).adto(details);
                renderBody(client, item.click.body, {autoplay: false}, details).defer(hsc);
            }else{
                ili_wrapper.clss("ml-4");
                ili = ili_wrapper;
            }
            if(item.icon != null) {
                el("div").adto(ili).clss("widget-list-icon").styl({"--background-image-url": "url("+item.icon+")"});
            }
            let name_node: Node;
            if(item.name.kind === "text") {
                name_node = txt(item.name.text);
            }else if(item.name.kind === "flair") {
                name_node = el("span");
                renderFlair([item.name.flair]).adto(name_node);
            }else if(item.name.kind === "username") {
                name_node = txt(item.name.username);
            }else assertNever(item.name);

            if(item.click.kind === "link") {
                if(item.name.kind === "username") {
                    userLink(client.id, item.click.url, item.name.username).adto(ili);
                }else {
                    linkButton(client.id, item.click.url).adch(name_node).adto(ili);
                }
            }else{
                el("span").adch(name_node).adto(ili);
            }
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
    }else if(content.kind === "iframe") {
        const alt_frame = el("div");
        outest_el.replaceChild(alt_frame, outer_el);
        outest_el.clss("widget-iframe");
        el("iframe").adto(alt_frame).attr({height: content.height as unknown as `${number}px`, srcdoc: content.srcdoc});
    }else if(content.kind === "image") {
        const alt_frame = el("div");
        outest_el.clss("widget-image");
        outest_el.replaceChild(alt_frame, outer_el);
        linkButton(client.id, content.link_url ?? content.src)
            .adch(el("img")
                .attr({src: content.src, width: `${content.width}px` as const, height: `${content.height}px` as const})
                .clss("w-full h-auto")
            ).adto(alt_frame)
        ;
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

function clientContent(client: ThreadClient, listing: Generic.ContentNode): HideShowCleanup<Node> {
    // console.log(listing);
    
    const frame = clientListingWrapperNode();
    const hsc = hideshow(frame);

    try {
        if(listing.kind === "user-profile") {
            userProfileListing(client, listing, frame).defer(hsc);
            return hsc;
        }
        if(listing.kind === "reddit-header") {
            redditHeader(client, listing, frame).defer(hsc);
            return hsc;
        }
        if(listing.kind === "widget") {
            widgetRender(client, listing, frame).defer(hsc);
            return hsc;
        }

        clientListing(client, listing, frame).defer(hsc);
        return hsc;
    }catch(e) {
        hsc.cleanup();
        console.log("Got error", e); 
        frame.innerHTML = "";
        frame.adch(el("pre").adch(el("code").atxt(e.toString() + "\n\n" + e.stack)));
        frame.adch(linkLikeButton().atxt("Code").onev("click", () => console.log(listing)));
        return hideshow(frame);
    }
}
function clientListingWrapperNode(): HTMLDivElement {
    const frame = el("div").clss("post text-sm"); // the last in the header array should be text-base
    return frame;
}
type AddChildrenFn = (children: Generic.Node[]) => void;
function clientListing(client: ThreadClient, listing: Generic.Thread, frame: HTMLDivElement): HideShowCleanup<{addChildren: AddChildrenFn}> {
    let content_voting_area: HTMLDivElement;
    let thumbnail_loc: HTMLButtonElement;
    let preview_area: HTMLDivElement;
    let replies_area: HTMLDivElement;

    let content_title_line: HTMLDivElement;
    let content_subminfo_line: HTMLDivElement;
    let content_buttons_line: HTMLDivElement;

    const result_v: {addChildren: AddChildrenFn} = {
        addChildren: undefined as unknown as AddChildrenFn,
    };
    const hsc = hideshow(result_v);

    if(listing.layout === "reddit-post") {
        content_voting_area = el("div").adto(frame).clss("post-voting");
        thumbnail_loc = el("button").adto(frame).clss("post-thumbnail");
        const content_area = el("div").adto(frame).clss("post-titles");
        preview_area = el("div").adto(frame).clss("post-preview");
        replies_area = el("div").adto(frame).clss("post-replies");

        content_title_line = el("div").adto(content_area).clss("post-content-title text-base");
        content_subminfo_line = el("div").adto(content_area).clss("post-content-subminfo");
        content_buttons_line = el("div").adto(content_area).clss("post-content-buttons");
    }else if(listing.layout === "reddit-comment" || listing.layout === "mastodon-post") {
        content_voting_area = el("div").adto(frame).clss("post-voting");
        content_title_line = el("div").adto(frame).clss("post-content-title"); // unused
        thumbnail_loc = el("button").adto(frame).clss("post-thumbnail"); // unused
        content_subminfo_line = el("div").adto(frame).clss("post-content-subminfo text-xs");
        preview_area = el("div").adto(frame).clss("post-preview"); // unused
        content_buttons_line = el("div").adto(frame).clss("post-content-buttons text-xs");
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
        let collapsed = listing.default_collapsed;
        const update = () => {
            hsc.setVisible(!collapsed);
            if(collapsed) {
                frame.classList.add("comment-collapsed");
                collapsed_button.setAttribute("aria-label", "Uncollapse");
                collapsed_button.setAttribute("aria-pressed", "true");
            }else{
                frame.classList.remove("comment-collapsed");
                collapsed_button.setAttribute("aria-label", "Collapse");
                collapsed_button.setAttribute("aria-pressed", "false");
            }
        };
        const collapsed_button = el("button").clss("collapse-btn").attr({draggable: "true"}).adch(el("div").clss("collapse-btn-inner")).onev("click", () => {
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
        if(listing.info.time !== false) {
            content_subminfo_line.adch(timeAgo(listing.info.time).defer(hsc));
            content_subminfo_line.atxt(" ");
        }
        content_subminfo_line
            .atxt("by ")
            .adch(userLink(client.id, listing.info.author.link, listing.info.author.name))
        ;
        if(listing.info.author.flair) content_subminfo_line.adch(renderFlair(listing.info.author.flair));
        if(listing.info.in) {
            content_subminfo_line.atxt(" in ").adch(linkButton(client.id, listing.info.in.link).atxt(listing.info.in.name));
        }
        if(listing.info.edited !== false) content_subminfo_line.atxt(", Edited ").adch(timeAgo(listing.info.edited).defer(hsc));
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
        if(listing.info.time !== false) {
            const submission_time = el("span").adch(timeAgo(listing.info.time).defer(hsc));
            content_subminfo_line.atxt(" ").adch(submission_time);
        }
        if(listing.info.edited !== false) {
            content_subminfo_line.atxt(", Edited ").adch(timeAgo(listing.info.edited).defer(hsc));
        }
        if(listing.info.pinned) {
            content_subminfo_line.atxt(", Pinned");
        }
        if(listing.info.reblogged_by) {
            content_subminfo_line.atxt(" ← Boosted by ")
                .adch(userLink(client.id, listing.info.reblogged_by.author.link, listing.info.reblogged_by.author.name))
            ;
            if(listing.info.reblogged_by.time !== false) {
                content_subminfo_line.atxt(" at ").adch(timeAgo(listing.info.reblogged_by.time).defer(hsc));
            }
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
                thumbnail_loc.adch(el("img").attr({src: listing.thumbnail.url, alt: ""}));
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
        
        const isEmpty = (body: Generic.Body): boolean => {
            if(body.kind === "none") return true;
            if(body.kind === "array") {
                return body.body.every(item => item == null ? true : isEmpty(item));
            }
            return false;
        };
        if(isEmpty(listing.body)) {
            // do nothing
        }else if(listing.display_mode.body === "collapsed") {
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
            const ctr = renderCounterAction(client, action, content_voting_area, {parens: false}).defer(hsc);
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

    if(content_voting_area.childNodes.length === 0) content_voting_area.remove();

    content_buttons_line.atxt(" ");
    listing.actions.length === 0 && linkButton(client.id, listing.link).atxt("View").adto(content_buttons_line);
    content_buttons_line.atxt(" ");
    linkLikeButton().onev("click", e => {
        console.log(listing);
    }).atxt("Code").adto(content_buttons_line);

    const children_node = el("ul").clss("replies").adto(replies_area);

    const added_comments_are_threaded = listing.replies?.length === 1 && (listing.replies[0] as Generic.Thread).replies?.length === 1;

    let lastElemAddChildren: AddChildrenFn | undefined;

    const addChildren = (children: Generic.Node[]) => {
        if(added_comments_are_threaded && children.length > 1) {
            if(!lastElemAddChildren) {
                throw new Error("threaded comment has no lastElemAddChildren");
            }
            lastElemAddChildren(children);
            return;
        }
        children.forEach(child => addChild(child));
    };
    const addChild = (child_listing: Generic.Node) => {
        const reply_node = el("li").adto(children_node);
        if(added_comments_are_threaded) reply_node.clss("threaded");
        if(child_listing.kind === "load_more") {
            loadMoreButton(client, child_listing, addChildren, () => reply_node.remove()).adto(reply_node);
            return;
        }
        let futureadd: undefined | Generic.Node;
        if(added_comments_are_threaded && child_listing.replies?.length === 1) {
            futureadd = child_listing.replies[0];
            child_listing.replies = [];
        }
        reply_node.clss("comment");
        const reply_frame = clientListingWrapperNode();
        lastElemAddChildren = clientListing(client, child_listing, reply_frame).defer(hsc).addChildren;
        reply_frame.adto(reply_node);

        if(futureadd) addChild(futureadd);
    };
    if(listing.replies) {
        if(listing.display_mode.comments === "collapsed") {
            // TODO uuh
        }else{
            addChildren(listing.replies);
        }
    }

    hsc.associated_data.addChildren = addChildren;

    return hsc;
}

const linkAppearence = ["text-blue-600", "dark:text-blue-500", "underline", "border-none"];

function linkLikeButton() {
    return el("button").clss(...linkAppearence).attr({draggable: "true"});
}

function loadingSpinner() {
    return el("div").clss("lds-ripple").adch(el("div")).adch(el("div"));
}

// TODO I guess support loading more in places other than the end of the list
// that means :: addChildren needs to have a second before_once argument and this needs to have a before_once
// doesn't matter atm but later.
function loadMoreButton(client: ThreadClient, load_more_node: Generic.LoadMore, addChildren: (children: Generic.Node[]) => void, removeSelf: () => void) {
    const container = el("div");
    const makeButton = () => linkButton(client.id, load_more_node.url, {onclick: ev => {
        const loading_txt = el("div").adto(container);
        loading_txt.adch(el("span").atxt("Loading…"));
        loading_txt.adch(loadingSpinner());
        current_node.remove();
        current_node = loading_txt;

        client.loadMore(load_more_node.load_more).then(res => {
            current_node.remove();
            addChildren(res);
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
// kind of a mess uuh
// the idea is that this can look different than other load more nodes
// but uuh
function loadMoreUnmountedButton(client: ThreadClient, load_more_node_initial: Generic.LoadMoreUnmounted,
    addChildren: (children: Generic.UnmountedNode[]) => void, removeSelf: () => void
) {
    const container = el("div");
    const makeButton = (lmnode: Generic.LoadMoreUnmounted) => linkButton(client.id, lmnode.url, {onclick: ev => {
        const loading_txt = el("div").adto(container);
        loading_txt.adch(el("span").atxt("Loading…"));
        loading_txt.adch(loadingSpinner());
        if(current_node) current_node.remove();
        current_node = loading_txt;

        client.loadMoreUnmounted(lmnode.load_more_unmounted).then(res => {
            if(current_node) current_node.remove();
            addChildren(res.children);
            if(res.next) {
                mkbtn(res.next);
            }else{
                removeSelf();
            }
        }).catch(e => {
            console.log("error loading more:", e);
            if(current_node && current_node.parentNode) current_node.remove();
            current_node = el("span").atxt("Error. ").adch(makeButton(lmnode).atxt("🗘 Retry")).adto(container);
        });
    }});

    const mkbtn = (lmnode: Generic.LoadMoreUnmounted) => {
        current_node = el("div").adch(
            makeButton(lmnode).atxt(lmnode.count != null ? "Load "+lmnode.count+" More…" : "Load More…").adto(container).clss("load-more")
        ).atxt(" ").adch(linkLikeButton().onev("click", e => {
            console.log(lmnode);
        }).atxt("Code")).adto(container);
    };

    let current_node: ChildNode | undefined;
    mkbtn(load_more_node_initial);
    return container;
}

type UpdateTitle = {setTitle: (new_title: string) => void};
function updateTitle(hsc: HideShowCleanup<unknown>, client_id: string): UpdateTitle {
    let is_visible_v = hsc.visible;
    hsc.on("hide", () => is_visible_v = false);
    hsc.on("show", () => {
        is_visible_v = true;
        document.title = titleFrom(title);
    });

    const titleFrom = (t: string) => t + " | "+client_id+" | ThreadReader";

    let title = "…";
    const res = {setTitle(new_title: string) {
        title = new_title;
        if(is_visible_v) document.title = titleFrom(new_title);
    }};
    res.setTitle("…");
    return res;
}

function renderClientPage(client: ThreadClient, listing: Generic.Page, frame: HTMLDivElement, title: UpdateTitle): HideShowCleanup<undefined> {
    const hsc = hideshow();

    const listing_copy = JSON.parse(JSON.stringify(listing));
    // It might get mutated so just in case make a copy. This should be fixed
    // so the listing can't be mutated and this isn't necessary
    title.setTitle(listing.title);

    frame.classList.add("display-"+listing.display_style);

    const navbar_area = el("div").adto(frame).clss("navbar-area");
    for(const navbar_action of listing.navbar) {
        renderAction(client, navbar_action, navbar_area).defer(hsc);
        txt(" ").adto(navbar_area);
    }
    const saveofflinebtn = linkLikeButton().atxt("Save Offline").adto(navbar_area).onev("click", () => {
        // save listing in indexed db
        // (or in the future, save the raw responses from the web so they can be re-transformed if necessary)
        localStorage.setItem("saved-post", JSON.stringify(listing_copy));
        saveofflinebtn.disabled = true;
        saveofflinebtn.textContent = "✓ Saved";
        // set url to /saved/… without reloading
    }).adto(navbar_area);

    const header_area = el("div").adto(frame).clss("header-area");
    const content_area = el("div").adto(frame).clss("content-area");

    const toplevel = () => el("div").clss("top-level-wrapper", "object-wrapper");

    if(listing.sidebar) {
        // on mobile, ideally this would be a link that opens the sidebar in a new history item
        el("button").adto(frame).clss("sidebar-toggle-mobile").atxt("Toggle Sidebar").onev("click", () => {
            sidebar_area.classList.toggle("sidebar-visible-mobile");
        });
        const sidebar_area = el("div").adto(frame).clss("sidebar-area");
        for(const sidebar_elem of listing.sidebar) {
            clientContent(client, sidebar_elem).defer(hsc).adto(toplevel().adto(sidebar_area));
        }
    }

    if(listing.body.kind === "listing") {
        clientContent(client, listing.body.header).defer(hsc).adto(toplevel().adto(header_area));

        const listing_area = el("div").adto(content_area);
        const addChildren = (children: Generic.UnmountedNode[]) => {
            for(const child of children) addChild(child);   
        };
        const addChild = (child: Generic.UnmountedNode) => {
            // TODO show parent nodes and stuff
            if(child.parents.length === 0) {
                const errn = el("div").clss("error").atxt("unmounted.parents.length === 0");
                errn.adto(toplevel().adto(listing_area));
                return;
            }
            const toplevel_area = toplevel().adto(listing_area);
            const last_parent = child.parents[child.parents.length - 1]!;
            if(last_parent.kind === "load_more") throw new Error("this error will never nope");
            clientContent(client, last_parent).defer(hsc).adto(toplevel_area);
        };
        addChildren(listing.body.items);

        if(listing.body.next) {
            const lmub = loadMoreUnmountedButton(client, listing.body.next, addChildren, () => lmub.remove());
            lmub.adto(content_area);
        }
    }else if(listing.body.kind === "one") {
        // TODO: all the parent items go into the same post shadow box thing
        // then each child goes in a seperate one
        // ALSO todo: rather than having a top-level-post class,
        // instead have a "top-level-post-frame" div that wraps top level items
        for(const parent of listing.body.item.parents) {
            if(parent.kind === "load_more") {
                // uuh uuh
                el("div").clss("error").atxt("todo load more here").adto(header_area);
                continue;
            }
            clientContent(client, parent).defer(hsc).adto(toplevel().adto(header_area));
        }
        const addChildren = (children: Generic.Node[]) => {
            for(const child of children) addChild(child);
        };
        const addChild = (child: Generic.Node) => {
            if(child.kind === "load_more") {
                const lmbtn = loadMoreButton(client, child, addChildren, () => lmbtn.remove());
                lmbtn.adto(content_area).clss("top-level-load-more");
                return;
            }
            clientContent(client, child).defer(hsc).adto(toplevel().adto(content_area));
        };
        addChildren(listing.body.item.replies);
    }else assertNever(listing.body);

    return hsc;
}

const top_level_wrapper: string[] = [];
const object_wrapper = ["shadow-md m-5 p-3 dark:bg-gray-800 rounded-xl m-5 p-3"];

function clientMain(client: ThreadClient, current_path: string): HideShowCleanup<HTMLDivElement> {
    const outer = el("div").clss("client-wrapper");
    const hsc = hideshow(outer);

    const frame = el("div").adto(outer);
    frame.classList.add("client-main-frame");

    const loader_area = el("div").adto(frame);
    loader_area.classList.add("display-loading");
    loader_area.adch(loadingSpinner());

    const title = updateTitle(hsc, client.id);
    title.setTitle("Loading "+client.id+"…");

    (async () => {
        // await new Promise(r => 0);
        const listing = await client.getThread(current_path);
        loader_area.remove();
        renderClientPage(client, listing, frame, title).defer(hsc);
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
    addChild: (child: HideShowCleanup<unknown>) => {cleanup: () => void},
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
    const children = new Set<HideShowCleanup<unknown>>();
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
            children.add(child);
            return {cleanup: () => {
                child.cleanup();
                children.delete(child);
            }};
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

    if(path0 === "saved") {
        return fetchClientThen("reddit", client => {
            const outer = el("div").clss("client-wrapper");
            const hsc = hideshow(outer);

            const frame = el("div").adto(outer);
            frame.classList.add("client-main-frame");

            const title = updateTitle(hsc, client.id);
            title.setTitle("Loading "+client.id+"…");

            renderClientPage(client, JSON.parse(localStorage.getItem("saved-post") ?? "{}"), frame, title);

            return hsc;
        })
    }

    return fetchClientThen(path0, (client) => {
        return clientMain(client, "/"+path.join("/")+search);
    });
}

let current_history_index = 0;
function onNavigate(to_index: number, url: URLLike) {
    console.log("Navigating", to_index, url, nav_history);
    document.title = "ThreadReader";
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

    let prev_scroll = window.scrollY;
    let resp = 0;
    // TODO:
    // on touch release, either transition resp to 0 or to 100
    document.addEventListener("scroll", e => {
        const this_scroll = window.scrollY;
        const diff = this_scroll - prev_scroll;
        prev_scroll = this_scroll;

        const max_resp = Math.max(0, Math.min(100, this_scroll));

        resp += diff;
        if(resp > max_resp) resp = max_resp;
        if(resp < 0) resp = 0;
        let navbar_h = resp;

        if(this_scroll < 0) navbar_h = -this_scroll;

        frame.style.setProperty("--mobile-transform", "translateY("+(-navbar_h)+"px)");
    }, {passive: false});
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