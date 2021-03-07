import "./_stdlib";
import "./main.scss";
import "tailwindcss/tailwind.css";
import "./typography.pcss";

import * as uhtml from "uhtml";

import * as Generic from "./types/generic";
import {ThreadClient} from "./clients/base";
import { getRandomColor, rgbToString, seededRandom } from "./darken_color";

import {escapeHTML} from "./util";
import { OEmbed, oembed } from "./clients/oembed";

export const htmlr = uhtml.html;

function assertNever(content: never): never {
    console.log("not never:", content);
    throw new Error("is not never");
}

function isModifiedEvent(event: MouseEvent) {
    return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

function linkButton(client_id: string, href: string, style: LinkStyle, opts: {onclick?: (e: MouseEvent) => void} = {}) {
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
        return el("a").clss(...linkAppearence(style), "error").attr({title: href}).clss("error").onev("click", (e) => {e.stopPropagation(); alert(href)});
    }
    let urlparsed: URL | undefined;
    try {
        urlparsed = new URL(href);
    }catch(e) {
        urlparsed = undefined;
    }
    if(urlparsed && !is_raw && (urlparsed.host === "reddit.com" || urlparsed.host.endsWith(".reddit.com"))) {
        href = "/reddit"+urlparsed.pathname+urlparsed.search+urlparsed.hash;
    }
    const res = el("a").clss(...linkAppearence(style)).attr({href, target: "_blank", rel: "noreferrer noopener"});
    if(href.startsWith("/") || opts.onclick) res.onclick = event => {
        event.stopPropagation();
        if (
            !event.defaultPrevented && // onClick prevented default
            event.button === 0 && // ignore everything but left clicks
            !isModifiedEvent(event) // ignore clicks with modifier keys
        ) {
            event.preventDefault();
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
            +(start_code != null ? "&start="+start_code.replace("s", "") : "")
        ,
    });
    return {node: el("div").clss("resizable-iframe").styl({width: "640px", height: "360px"}).adch(yt_player), onhide: () => {
        yt_player.contentWindow?.postMessage(JSON.stringify({event: "command", func: "pauseVideo", args: ""}), "*");
    }};
}

const menuButtonStyle = (active: boolean): string => {
    return [
        "inline-block mx-1 px-1 text-base border-b-2 transition-colors",
        active ? "border-gray-900" : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900"
    ].join(" ");
};

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
    const mutebtn = elButton("outlined-button").adto(btnarea);
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
function videoPreview(sources: {src: string, type?: string}[], opts: {autoplay: boolean, width?: number, height?: number, gifv: boolean, audio?: boolean, alt?: string}): HideShowCleanup<Node> {
    const video = el(opts.audio ?? false ? "audio" : "video").attr({controls: "",
        width: opts.width != null ? `${opts.width}px` as const : undefined, height: opts.height != null ? `${opts.height}px` as const : undefined,
        alt: opts.alt,
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
        console.log("gfylike response:", r);
        loader.remove();
        type GfyContentUrl = {
            url: string,
            size: number,
            width: number,
            height: number,
        };
        resdiv.adch(el("div").adch(elButton("code-button").atxt("code").onev("click", (e) => {e.stopPropagation(); console.log(r)})));
        const error_v = r as {
            logged?: boolean,
            message: string,
            errorMessage: {code: string, description: string} | string,
            reported?: boolean,
        };
        if('message' in error_v || 'errorMessage' in error_v) {
            el("div").clss("error").adto(resdiv).atxt("Error: "
                +(error_v.message ?? (typeof error_v.errorMessage === "string" ? error_v.errorMessage : error_v.errorMessage.description))
                + ('logged' in error_v ? " ; logged="+error_v.logged : "")+('reported' in error_v ? " ; reported="+error_v.reported : "")
            );
            return;
        }
        const {gfyItem: gfy_item} = r as {
            gfyItem: {
                avgColor: string,
                content_urls: {
                    // thumbnails
                    poster: GfyContentUrl,
                    mobilePoster: GfyContentUrl,

                    // gifs
                    max1mbGif?: GfyContentUrl,
                    max2mbGif?: GfyContentUrl,
                    max5mbGif?: GfyContentUrl,
                    
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

                mobileUrl?: string,
                webmUrl?: string,
                webpUrl?: string,
                mp4Url?: string,
            },
        };
        if(gfy_item.title != null) resdiv.adch(el("div").atxt("Title: " + gfy_item.title));
        if(gfy_item.description != null) resdiv.adch(el("div").atxt("Description: "+gfy_item.description));

        const sources = [
            ...gfy_item.mp4Url != null ? [{src: gfy_item.mp4Url, type: "video/mp4"}] : [],
            ...gfy_item.webmUrl != null ? [{src: gfy_item.webmUrl, type: "video/webm"}] : [],
            ...gfy_item.content_urls.webm ? [{src: gfy_item.content_urls.webm.url}] : [],
            ...gfy_item.content_urls.mp4 ? [
                {src: gfy_item.content_urls.mp4.url},
                {src: gfy_item.content_urls.mp4.url.replace(".mp4", "-mobile.mp4")}, // hack
            ] : [],
            ...gfy_item.content_urls.mobile ? [{src: gfy_item.content_urls.mobile.url}] : [],
            ...gfy_item.mobileUrl != null ? [{src: gfy_item.mobileUrl}] : [],
        ];
        if(sources.length > 0) {
            videoPreview(sources, {autoplay: opts.autoplay, width: gfy_item.width, height: gfy_item.height, gifv: false}).defer(hsc).adto(resdiv);
        }else{
            const urls = gfy_item.content_urls;
            const url = urls.max5mbGif ?? urls.max2mbGif ?? urls.max1mbGif; // ?? webp url

            if(url) {
                el("img").attr({src: url.url, width: `${url.width}px` as const, height: `${url.height}px` as const}).clss("preview-image").adto(resdiv);
            }else {
                console.log(gfy_item);
                el("div").clss("error").atxt("Error bad image uh oh").adto(resdiv);
            }
        }
    }).catch(e => {
        console.log(e);
        if(loader.parentNode) loader.remove();
        resdiv.adch(el("div").clss("error").atxt("Error loading gfycat : " + e.toString()));
    });
    
    return hsc;
}


function previewLink(client: ThreadClient, link: string, opts: {suggested_embed?: string}): undefined | Generic.Body {
    let url_mut: URL | undefined;
    try { 
        url_mut = new URL(link);
    }catch(e) {
        // ignore
    }
    const url = url_mut;
    const path = url?.pathname ?? link;
    const is_mp4_link_masking_as_gif = url ? path.endsWith(".gif") && url.searchParams.get("format") === "mp4" : false;
    if(is_mp4_link_masking_as_gif) return {kind: "video", gifv: true, source: {kind: "video", sources: [{url: link, type: "video/mp4"}]}};
    if((url?.hostname ?? "") === "i.redd.it"
        || path.endsWith(".png") || path.endsWith(".jpg")
        || path.endsWith(".jpeg")|| path.endsWith(".gif")
        || path.endsWith(".webp")|| (url?.hostname ?? "") === "pbs.twimg.com"
    ) return {kind: "unknown_size_image", url: link};
    if(path.endsWith(".gifv")) {
        return {kind: "video", gifv: true, source: {kind: "video", sources: [
            {url: link.replace(".gifv", ".webm"), type: "video/webm"},
            {url: link.replace(".gifv", ".mp4"), type: "video/mp4"},
        ]}};
    }
    if(link.startsWith("https://v.redd.it/")) return {
        kind: "vreddit_video",
        id: link.replace("https://v.redd.it/", ""),
        gifv: false,
    };
    if(url && (url.host === "reddit.com" || url.host.endsWith(".reddit.com") && url.pathname.startsWith("/link"))) {
        const pathsplit = path.split("/");
        pathsplit.shift();
        // /link/:postname/video/:videoid/player
        if(pathsplit[0] === "link" && pathsplit[2] === "video" && pathsplit[4] === "player") return {
            kind: "vreddit_video",
            id: pathsplit[3] ?? "",
            gifv: false,
        };
    }
    if(url && (url.host === "gfycat.com" || url.host.endsWith(".gfycat.com")) && url.pathname.split("/").length === 2) return {
        kind: "gfycat",
        id: url.pathname.replace("/", "").split("-")[0]!.toLowerCase(),
        host: "gfycat.com",
    };
    if(url && (url.host === "\x72\x65\x64gifs.com" || url.host.endsWith(".\x72\x65\x64gifs.com")) && url.pathname.split("/").length === 3 && url.pathname.startsWith("/watch/")) {
        const gfylink = url.pathname.replace("/watch/", "").split("-")[0]!.toLowerCase();
        return {
            kind: "gfycat",
            id: gfylink,
            host: "\x72\x65\x64gifs.com",
        };
    }
    if(path.endsWith(".mp4") || path.endsWith(".webm")) {
        return {kind: "video", gifv: false, source: {kind: "video", sources: [
            {url: link},
        ]}};
    }
    if(path.endsWith(".mp3")) {
        return {kind: "audio", url: link};
    }
    if(url && (url.host === "www.youtube.com" || url.host === "youtube.com") && url.pathname === "/watch") {
        const ytvid_id = url.searchParams.get("v");
        if(ytvid_id != null) return {kind: "youtube", id: ytvid_id, search: url.searchParams.toString()};
    }
    if(url && (url.host === "youtu.be") && url.pathname.split("/").length === 2) {
        const youtube_video_id = url.pathname.split("/")[1] ?? "no_id";
        return {kind: "youtube", id: youtube_video_id, search: url.searchParams.toString()};
    }
    if(url && (url.host === "vocaroo.com" || url.host === "www.vocaroo.com")) {
        const splitv = url.pathname.split("/").filter(q => q);
        if(splitv.length === 1 && splitv[0] != null && splitv[0] !== "") {
            return {kind: "audio", url: "https://media.vocaroo.com/mp3/"+splitv[0]};
        }        
    }
    if(url && (url.host === "giphy.com" || url.host === "www.giphy.com")) {
        const splitv = url.pathname.split("/").filter(q => q);
        if(splitv.length === 3 && splitv[0] === "gifs" && splitv[2] === "fullscreen") {
            const giphy_id_bits = splitv[1]!.split("-");
            const giphy_id = giphy_id_bits[giphy_id_bits.length - 1];
            return {kind: "video", source: {
                kind: "video",
                sources: [
                    {url: "https://media4.giphy.com/media/"+giphy_id+"/giphy.mp4", type: "video/mp4"},
                ],
            }, gifv: true};
        }        
    }
    if(url && (url.host === "www.imgur.com" || url.host === "imgur.com")) {
        const splitv = url.pathname.split("/").filter(q => q);
        const galleryid = splitv[1]!;
        const isv = splitv[0] === "gallery" ? "gallery" : splitv[0] === "a" ? "album" : undefined;
        if(isv !== undefined && splitv.length === 2) {
            return {
                kind: "imgur",
                imgur_id: galleryid,
                imgur_kind: isv,
            };
        }
    }
    if(url && url.host === "clips.twitch.tv" && url.pathname.split("/").filter(q => q).length === 1) {
        const clipid = url.pathname.split("/").filter(q => q)[0];
        if(clipid != null) return {
            kind: "twitch_clip",
            slug: clipid,
        };
    }
    if(url && (url.host === "soundcloud.com" || url.host.endsWith(".soundcloud.com"))) return {
        kind: "oembed",
        url: "https://soundcloud.com/oembed?format=json&url="+encodeURIComponent(link),
    };
    if(url && (url.host === "tiktok.com" || url.host.endsWith(".tiktok.com"))) return {
        kind: "oembed",
        url: "https://www.tiktok.com/oembed?url="+encodeURIComponent(link),
    };
    if(opts.suggested_embed != null) return {
        kind: "reddit_suggested_embed",
        suggested_embed: opts.suggested_embed,
    };
    return undefined;
}

// what instead of actually previewing the link, this returned a body? pretty resonable idea tbh, just make sure not to allow
// infinite loops where this returns a link body
function canPreview(client: ThreadClient, link: string, opts: {autoplay: boolean, suggested_embed?: string}): undefined | (() => HideShowCleanup<Node>) {
    const preview_body = previewLink(client, link, {suggested_embed: opts.suggested_embed});
    if(preview_body) return (): HideShowCleanup<Node> => {
        // render body
        // TODO prevent infinite loops
        const node = el("div");
        const hsc = hideshow(node);
        renderBody(client, preview_body, {autoplay: opts.autoplay}, node).defer(hsc);
        return hsc;
    };
    return undefined;
}

function getBound(v: HTMLElement) {
    const rect = v.getBoundingClientRect();
    return {x: rect.left, y: rect.top + (window.pageYOffset ?? document.documentElement.scrollTop), w: rect.width};
}

function renderImageGallery(client: ThreadClient, images: Generic.GalleryItem[]): HideShowCleanup<Node> {
    if(images.every(img => img.body.kind === "captioned_image")) {
        return fetchPromiseThen(import("./components/gallery"), gallery => {
            const div = el("div");
            const hsco = hideshow(div);
            let showing: undefined | (() => void);
            const boundfn = (index: number) => {
                const boundi = buttons[index]!;
                buttons.forEach(button => button.style.opacity = "1");
                boundi.style.opacity = "0";
                return getBound(boundi);
            };
            const buttons = images.map((img, i) => {
                const imgv = el("img").attr({
                    src: img.thumb,
                    width: img.w != null ? `${img.w}px` as const : undefined,
                    height: img.h != null ? `${img.h}px` as const : undefined,
                }).clss("w-auto h-auto max-w-full max-h-full");
                el("button").clss("m-1 w-24 h-24 flex items-center justify-center inline-block").adto(el("div").clss("inline-block").adto(div)).adch(
                    imgv,
                ).onev("click", (e) => {
                    e.stopPropagation();
                    if(showing) showing();
                    const hsc = hideshow();
                    showing = () => hsc.cleanup();
                    gallery.showGallery(images, i, boundfn, () => {
                        buttons.forEach(button => button.style.opacity = "1");
                    }).defer(hsc);
                });
                return imgv;
            });
            hsco.on("cleanup", () => {if(showing) showing();});
            return hsco;
        });
    }
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
                <button class="m-1 inline-block" onclick=${() => {setState({index: i})}}>
                    <img src=${image.thumb} width=${image.w+"px"} height=${image.h+"px"}
                        class="w-24 h-24 object-contain"
                    />
                </button>
            `)}`);
            return;
        }
        const index = state.index;
        const selimg = images[index]!;
        const ref: {current?: HTMLDivElement} = {};
        uhtml.render(container, htmlr`
            <button class="${link_styles_v["outlined-button"]}" onclick=${() => setState({index: index - 1})} disabled=${index <= 0 ? "" : undefined}>Prev</button>
            ${index + 1}/${images.length}
            <button class="${link_styles_v["outlined-button"]}" onclick=${() => setState({index: index + 1})} disabled=${index >= images.length - 1 ? "" : undefined}>Next</button>
            <button class="${link_styles_v["outlined-button"]}" onclick=${() => setState("overview")}>Gallery</button>
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
        const flairv = el("span").clss("rounded-full", (flair.system != null ? "" : "px-2"));
        resl.atxt(" ");
        if(flair.system != null) {
            flairv.clss(flair.system);
        }else{
            if(flair.color != null && flair.color !== "") flairv.clss("bg-flair-light dark:bg-flair-dark").styl({"--flair-color": flair.color, "--flair-color-dark": flair.color});
            else flairv.clss("bg-gray-300 dark:bg-gray-600");
            if(flair.fg_color != null) flairv.clss("flair-text-"+flair.fg_color);
        }
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
function timeAgoText(start_ms: number, now: number): [string, number] {
    const ms = now - start_ms;
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
    next_step = 30;
    if(ms < next_step * step) {
        const days = ms / step |0;
        return [s(days, " days")+" ago", step - (ms - days * step)];
    }
    return [new Date(start_ms).toISOString(), -1];
}

function timeAgo(start_ms: number): HideShowCleanup<HTMLSpanElement> {
    const span = el("span").attr({title: "" + new Date(start_ms)});
    const hsc = hideshow(span);
    const tanode = txt("…").adto(span);
    let timeout: number | undefined;
    const update = () => {
        timeout = undefined;
        const [newtext, wait_time] = timeAgoText(start_ms, Date.now());
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

    const newbtn = linkButton(client.id, href, renderLinkPreview ? "previewable" : "normal", {onclick: renderLinkPreview ? () => togglepreview() : undefined});
    parent_node.insertBefore(newbtn, after_node);

    const hsc = hideshow({newbtn});

    if(!renderLinkPreview) return hsc;

    const showpreviewbtn = elButton("none").clss("text-blue-500").atxt("…").onev("click", (e) => {e.stopPropagation(); togglepreview()});

    let preview_div: undefined | {hsc: HideShowCleanup<unknown>, node: ChildNode} = undefined;

    const togglepreview = () => {
        if(preview_div) hidepreview();
        else showpreview();
    };

    const hidepreview = () => {
        showpreviewbtn.textContent = "▸";
        if(preview_div) {preview_div.hsc.cleanup(); preview_div.node.remove(); preview_div = undefined}
    };
    const showpreview = () => {
        showpreviewbtn.textContent = "▾";
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
    const divel = el("div").adto(parent_node).clss("prose");
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
        el("span").adto(spoilerspan).adch(...children).clss("md-spoiler-content");
        spoilerspan.attr({title: "Click to reveal spoiler"});
        spoilerspan.clss("md-spoiler-unrevealed");
        spoilerspan.addEventListener("click", (e) => {
            if(!spoilerspan.classList.contains("md-spoiler-unrevealed")) return;
            e.preventDefault();
            e.stopPropagation();
            spoilerspan.classList.remove("md-spoiler-unrevealed");
            spoilerspan.attr({title: ""});
        }, {capture: true});
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
            let reslink: HTMLElement;
            if(rts.is_user_link != null) {
                reslink = userLink(client.id, rts.url, rts.is_user_link).adto(container);
            }else if((rts.style ?? "link") === "link"){
                const {newbtn} = renderPreviewableLink(client, rts.url, null, container).defer(hsc);
                reslink = newbtn;
            }else{
                const mappings: {[key in Generic.Richtext.LinkStyle]: LinkStyle} = {'link': "normal", 'pill-empty': "pill-empty"};
                reslink = linkButton(client.id, rts.url, mappings[rts.style ?? "link"]).adto(container);
            }
            if(rts.title != null) reslink.title = rts.title;
            for(const child of rts.children) {
                renderRichtextSpan(client, child, reslink).defer(hsc);
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
            spoilerspan.clss("md-spoiler-unrevealed");
            spoilerspan.addEventListener("click", (e) => {
                if(!spoilerspan.classList.contains("md-spoiler-unrevealed")) return;
                e.preventDefault();
                e.stopPropagation();
                spoilerspan.classList.remove("md-spoiler-unrevealed");
                spoilerspan.attr({title: ""});
            }, {capture: true});
        } break;
        case "error": {
            elButton("error").atxt(rts.text).onev("click", e => {
                e.preventDefault();
                e.stopPropagation();
                console.log(rts.value);
            }).adto(container);
        } break;
        case "emoji": {
            el("img").attr({src: rts.url, title: rts.hover}).clss("w-4 h-4 object-contain inline-block").adto(container);
        } break;
        case "flair": {
            renderFlair([rts.flair]).adto(container);
        } break;
        case "time-ago": {
            timeAgo(rts.start).defer(hsc).adto(container);
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
            // TODO
            // 1: render this in a shadow dom with normal styles
            // 2: padding
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
    try {
        return renderBodyMayError(client, body, opts, content);
    }catch(e) {
        console.log(e);
        el("div").clss("error").adto(content).atxt("Got error: "+e.toString());
        el("code").adto(el("pre").adto(content)).atxt(e.stack);
        return hideshow();
    }
};
const renderBodyMayError = (client: ThreadClient, body: Generic.Body, opts: {autoplay: boolean}, content: ChildNode): HideShowCleanup<undefined> => {
    const hsc = hideshow();

    if(body.kind === "text") {
        const txta = el("div").adto(content);
        renderText(client, body).defer(hsc).adto(txta);
    }else if(body.kind === "link") {
        // TODO fix this link button thing
        el("div").adto(content).adch(linkButton(client.id, body.url, "normal").atxt(body.url));
        const renderLinkPreview = canPreview(client, body.url, {autoplay: opts.autoplay, suggested_embed: body.embed_html});
        if(renderLinkPreview) {
            renderLinkPreview().defer(hsc).adto(content);
        }
    }else if(body.kind === "none") {
        // content.remove();
    }else if(body.kind === "gallery") {
        renderImageGallery(client, body.images).defer(hsc).adto(content);
    }else if(body.kind === "removed") {
        const removed_v = el("div").adto(content).atxt("Removed by "+body.by+".");
        if(body.fetch_path && client.fetchRemoved) {
            const fetch_btn = elButton("outlined-button").adto(removed_v).atxt("View");
            // so this is a place where it would be helpful to update the entire listing
            // unfortunately, this is not react or uil and that can't be done easily
            // given how stateful listings are
            // for now, just update the body.
            fetch_btn.onev("click", async (e) => {
                e.stopPropagation();
                let new_body: Generic.Body;
                let errored = false;
                fetch_btn.textContent = "…";
                fetch_btn.disabled = true;
                if(!client.fetchRemoved) throw new Error("client provided a removal fetch path but has no fetchRemoved");
                try {
                    new_body = await client.fetchRemoved(body.fetch_path!);
                }catch(error) {
                    errored = true;
                    console.log(error);
                    new_body = {kind: "text", content: "Error! "+error.toString(), markdown_format: "none"};
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
        const parentel = el("div").clss("bg-body rounded-xl max-w-xl").adto(content);
        clientContent(client, body.source, {clickable: true}).defer(hsc).clss("crosspost-post").adto(parentel);
    }else if(body.kind === "richtext") {
        const txta = el("div").adto(content).clss("prose whitespace-pre-wrap");
        for(const pargrph of body.content) {
            renderRichtextParagraph(client, pargrph, txta).defer(hsc);
        }
    }else if(body.kind === "poll") {
        const pollcontainer = el("ul").adto(content).clss("poll-container");
        const expires = el("div").adto(pollcontainer).atxt("Expires: ");
        timeAgo(body.close_time).defer(hsc).adto(expires);
        for(const choice of body.choices) {
            const choicebtn = elButton("outlined-button").adto(el("li").adto(pollcontainer).clss("poll-choice-li")).clss("poll-choice");
            choicebtn.atxt(choice.name + " ("+(choice.votes === "hidden" ? "hidden" : s(choice.votes, " Votes"))+")");
            choicebtn.onev("click", (e) => {e.stopPropagation(); alert("TODO voting on polls")});
        }
        if(body.select_many) {
            const submitbtn = elButton("pill-empty").atxt("Vote").adto(content);
            submitbtn.onclick = () => alert("TODO vote on polls");
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
            videoPreview(body.source.sources.map(src => ({src: src.url, type: src.type})), {autoplay: opts.autoplay, width: body.w, height: body.h, gifv: body.gifv, alt: body.alt})
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
    }else if(body.kind === "audio") {
        if(body.caption != null) el("div").adto(content).atxt("Caption: "+body.caption);
        videoPreview([{src: body.url}], {autoplay: opts.autoplay, gifv: false, audio: true, alt: body.alt}).defer(hsc).adto(content);
    }else if(body.kind === "vreddit_video") {
        if(body.caption != null) el("div").adto(content).atxt("Caption: "+body.caption);
        previewVreddit(body.id, {autoplay: false}).defer(hsc).adto(content);
    }else if(body.kind === "array") {
        for(const v of body.body) {
            if(!v) continue;
            const atma = el("div").adto(content);
            renderBody(client, v, {autoplay: false}, atma).defer(hsc);
        }
    }else if(body.kind === "unknown_size_image") {
        zoomableImage(body.url, {}).adto(el("div").adto(content));
    }else if(body.kind === "gfycat") {
        gfyLike(body.host, body.id, {autoplay: opts.autoplay}).defer(hsc).adto(content);
    }else if(body.kind === "imgur") {
        imgurImage(client, body.imgur_kind, body.imgur_id).defer(hsc).adto(content);
    }else if(body.kind === "youtube") {
        youtubeVideo(body.id, body.search, {autoplay: opts.autoplay}).defer(hsc).adto(content);
    }else if(body.kind === "twitch_clip") {
        twitchClip(body.slug, {autoplay: opts.autoplay}).defer(hsc).adto(content);
    }else if(body.kind === "reddit_suggested_embed") {
        redditSuggestedEmbed(body.suggested_embed).defer(hsc).adto(content);
    }else if(body.kind === "link_preview") {
        // maybe outline with body background and no shadow?
        let button_box: HTMLElement;
        if(body.click_enabled) {
            button_box = el("div").clss("bg-body rounded-lg block").adto(content);
        }else{
            button_box = linkButton(client.id, body.url, "none", {onclick: body.click_enabled ? () => {
                button_box.remove();
                renderBody(client, body.click, {autoplay: true}, content).defer(hsc);
            } : undefined}).clss("bg-body rounded-lg hover:shadow-md hover:bg-gray-100 block").adto(content);
        }
        const link_preview_box = el("article").clss("flex", body.click_enabled ? "flex-col" : "flex-row").adto(button_box);
        const thumb_box = el("div").clss(
            body.click_enabled ? "w-full h-auto min-h-10 relative" : "w-24 h-full flex items-center justify-center bg-gray-100",
            "rounded-lg overflow-hidden",
        )
            .adto(el("div").adto(link_preview_box))
        ;
        if(body.thumb != null) {
            thumb_box.adch(el("img").clss(body.click_enabled ? "w-full h-full" : "").attr({src: body.thumb}));
        }else{
            thumb_box.adch(el("div").atxt("🔗"));
        }
        if(body.click_enabled) {
            const choicearea = el("div").adto(thumb_box);
            choicearea.clss("flex items-center justify-center absolute top-0 left-0 bottom-0 right-0");
            const choicebox = el("div").clss("rounded-lg bg-gray-200 p-2 flex shadow-md gap-3").adto(choicearea);
            el("button").clss("hover:underline").adto(choicebox).atxt("Play").onev("click", e => {
                e.stopPropagation();
                thumb_box.innerHTML = "";
                renderBody(client, body.click, {autoplay: true}, thumb_box).defer(hsc);
            });
            choicebox.atxt(" ");
            linkButton(client.id, body.url, "none").clss("hover:underline").atxt("Open").adto(choicebox);
        }
        const meta_box = el("div").clss("flex flex-col p-3 text-sm").adto(link_preview_box);
        meta_box.adch(el("h1").clss("max-1-line font-black").atxt(body.title));
        meta_box.adch(el("p").clss("max-2-lines").atxt(body.description));
        meta_box.adch(el("div").clss("max-1-line font-light").atxt(body.url));
    }else if(body.kind === "oembed") {
        fetchPromiseThen(fetch(body.url, {headers: {'Accept': "application/json"}}).then(r => r.json()), resp => {
            console.log("oembed resp", resp);
            const outerel = el("div");
            const ihsc = hideshow(outerel);
            renderBody(client, oembed(resp as OEmbed), {autoplay: false}, outerel).defer(hsc);
            return ihsc;
        }).defer(hsc).adto(content);
    }else if(body.kind === "mastodon_instance_selector") {
        const heading = el("h1").clss("text-base font-light").styl({'max-width': "6rem"}).adto(content);
        heading.innerHTML = `
            <svg alt="Mastodon" class="preview-image" viewbox="0 0 713.35878 175.8678" style="fill: currentColor;">
                <use href="/images/mastodon/Logotype (Full).svg#base" width="713.35878" height="175.8678" />
            </svg>
        `;
        el("h2").atxt("Select your instance").clss("text-2xl font-black py-1").adto(content);

        const selxarea = el("div").adto(content).clss("py-1");
        const label = el("label").atxt("Instance Name: ").adto(selxarea);
        selxarea.atxt(" ");
        const go = () => {
            navigate({path: "/"+client.id+"/"+(inputel.value.replaceAll("/", "-"))});
        };
        const inputel = el("input").clss("border rounded-md p-1").attr({placeholder: "instance.site"}).adto(label).onev("keypress", e => {
            if(e.key === "Enter") go();
        }).onev("input", () => {
            updatebtn();
        });
        const updatebtn = () => {
            const value = inputel.value;
            if(!value.trim()) btnel.disabled = true;
            else if(value.indexOf("/") > -1) btnel.disabled = true;
            else btnel.disabled = false;
            btnel.attr({class: link_styles_v[btnel.disabled ? "pill-empty" : "pill-filled"]});
        };
        const btnel = el("button").atxt("Go →").adto(selxarea).onev("click", e => {e.stopPropagation(); go()});
        updatebtn();

        el("p").atxt("Not on mastodon? Join at ").clss("py-2")
            .adch(linkButton(client.id, "https://joinmastodon.org", "normal").atxt("joinmastodon.org")).adto(content)
        ;
        el("p").atxt("Note that some instances may require logging in before they let you view timelines.").clss("py-2").adto(content);
    }else assertNever(body);

    return hsc;
};

function redditSuggestedEmbed(suggested_embed: string): HideShowCleanup<Node> {
    // TODO?: render a body with markdown type unsafe-html that supports iframes
    try {
        // const parser = new DOMParser();
        // const doc = parser.parseFromString(opts.suggested_embed, "text/html");
        // const iframe = doc.childNodes[0].childNodes[1].childNodes[0];
        const template_el = el("template");
        template_el.innerHTML = suggested_embed;
        const iframe_unsafe = template_el.content.childNodes[0];
        if(!iframe_unsafe) throw new Error("missing iframe");
        const iframe_attrs = iframe_unsafe instanceof HTMLIFrameElement
            ? {src: iframe_unsafe.src, allow: iframe_unsafe.allow, allowfullsreen: ""}
            : {srcdoc: suggested_embed}
        ;

        const parent_node = el("div").clss("resizable-iframe");
        let iframe: HTMLIFrameElement | undefined;
        const initFrame = () => {
            if(!iframe) iframe = el("iframe").attr(iframe_attrs).adto(parent_node);
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
        frame.adch(el("pre").adch(el("code").atxt(suggested_embed)));
        return hideshow(frame);
    }
}

function twitchClip(clipid: string, opts: {autoplay: boolean}): HideShowCleanup<Node> {
    const frame = el("div");
    const hsc = hideshow(frame);

    const loading = loadingSpinner().adto(frame);

    function gqlRequest(operation: string, hash: string, variables: unknown) {
        return {
            extensions: {persistedQuery: {sha256Hash: hash, version: 1}},
            operationName: operation,
            variables,
        };
    }

    fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: {
            'Content-Type': "application/json",
            'Accept': "application/json",
            'Client-Id': "kimne78kx3ncx6brgo4mv6wki5h1ko",
        },
        body: JSON.stringify([
            gqlRequest("VideoAccessToken_Clip",
                "36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11",
                {slug: clipid}
            ),
            gqlRequest("ClipsChatCard",
                "94c1c7d97d860722a5b7ef3c3b3de3783b37fc32d69bcccc8ea0cda372cf1f01",
                {slug: clipid}
            ),
            gqlRequest("ClipsBroadcasterInfo", // 9
                "ce258d9536360736605b42db697b3636e750fdb14ff0a7da8c7225bdc2c07e8a",
                {slug: clipid}
            ),
            gqlRequest("ClipsTitle", // 12
                "f6cca7f2fdfbfc2cecea0c88452500dae569191e58a265f97711f8f2a838f5b4",
                {slug: clipid}
            ),
            gqlRequest("ClipsCurator", // 13
                "769e99d9ac3f68e53c63dd902807cc9fbea63dace36c81643d776bcb120902e2",
                {slug: clipid}
            ),
            gqlRequest("ClipsFullVideoButton", // 14
                "d519a5a70419d97a3523be18fe6be81eeb93429e0a41c3baa9441fc3b1dffebf",
                {slug: clipid}
            ),
        ]),
    }).then(r => r.json()).then(res_untyped => {
        loading.remove();
        console.log(res_untyped);
        const [video, chat_card, broadcaster_info, title, curator, full_video_btn] = res_untyped as [
            // wow lots of redundant data
            video: {data: {clip: null | {
                id: string,
                playbackAccessToken: {
                    signature: string,
                    value: string, // JSON {authorization: {forbidden: false, reason: ""}, clip_url: "", device_id: null, expires: number, user_id: "", version: 2}
                },
                videoQualities: {
                    frameRate: number,
                    quality: "360" | "480" | "720" | "unsupported",
                    sourceURL: string,
                }[],
            }}},
            chat_card: {data: {clip: {
                id: string,
                videoOffsetSeconds: number,
                createdAt: string,
                curator: {id: string, login: string},
                video: {id: string, login: string},
            }}},
            broadcaster_info: {data: {clip: {
                id: string,
                game: {name: string, displayName: string},
                broadcaster: {
                    id: string,
                    profileImageURL: string,
                    displayName: string,
                    login: string,
                    stream: null,
                },
            }}},
            title: {data: {clip: {
                id: string,
                title: string,
            }}},
            curator: {data: {clip: {
                id: string,
                curator: {id: string, displayName: string, login: string},
            }}},
            full_video_btn: {data: {clip: {
                id: string,
                videoOffsetSeconds: number,
                durationSeconds: number,
                title: string,
                broadcaster: {id: string, login: string},
                video: {id: string, broadcastType: "ARCHIVE" | "unsupported"},
                game: {id: string, displayName: string},
            }}},
        ];
        if(!video.data.clip) {
            el("div").clss("text-xl font-bold text-red-500").adto(frame).atxt("404 clip not found. It might be deleted or otherwise no longer available.");
            return;
        }
        el("h1").clss("text-xl font-bold text-gray-500").adto(frame).atxt(title.data.clip.title);
        videoPreview(video.data.clip.videoQualities.map(quality => {
            return {src: quality.sourceURL};
        }), {autoplay: opts.autoplay, gifv: false}).defer(hsc).adto(frame);

        () => [chat_card, broadcaster_info, curator, full_video_btn]; 

        // TODO ClipsChatReplay 05bb2716e4760d4c5fc03111a5afe9b0ab69fc875e9b65ea8a63bbc34d5af21d
        // variables:
        // - slug,
        // - videoOffsetSeconds,
        // → something that gives a cursor
        // then
        // ClipsChatReplay 05bb2716e4760d4c5fc03111a5afe9b0ab69fc875e9b65ea8a63bbc34d5af21d
        // variables:
        // - slug,
        // - cursor,
        // → the chat messages
    }).catch(e => {
        console.log(e);
        try {loading.remove()}catch(er){()=>er}
        el("div").clss("error").adto(frame).atxt(e.toString());
    });

    return hsc;
}

function youtubeVideo(youtube_video_id: string, search_str: string, opts: {autoplay: boolean}) {
    const search = new URLSearchParams(search_str);
    const container = el("div");
    const embedv = embedYoutubeVideo(youtube_video_id, {autoplay: opts.autoplay}, search);
    embedv.node.adto(container);
    const hsc = hideshow(container);
    // maybe just delete embedv and recreate it instead
    // or do like a timeout like if >10s, delete idk
    hsc.on("hide", () => embedv.onhide?.());
    hsc.on("show", () => embedv.onshow?.());
    return hsc;
}

function imgurImage(client: ThreadClient, isv: "gallery" | "album", galleryid: string): HideShowCleanup<Node> {
    const resdiv = el("div");
    const hsc = hideshow(resdiv);
    const loader = loadingSpinner().adto(resdiv);

    fetch("https://api.imgur.com/3/"+isv+"/"+galleryid, {
        headers: {
            'Authorization': "Client-ID 6ccf617dc7a8830",
            'Accept': "application/json",
        },
    }).then(r => r.json()).then(r => {
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
                title: string | null,
                description: string | null,
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
                images: ('images' in typed.data ? typed.data.images : [typed.data]).map(image => {
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
            resdiv.adch(el("div").clss("error").atxt("Error loading imgur: "+typed.data.error));
        }
    }).catch(e => {
        console.log(e);
        if(loader.parentNode) loader.remove();
        resdiv.adch(el("div").clss("error").atxt("Error loading imgur : "+e.toString()));
    });

    return hsc;
}

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

function zoomableFrame(img: HTMLImageElement): HTMLElement {
    const frame = el("button").adch(img);

    frame.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        frame.disabled = true;
        import("./components/gallery").then(component => {
            const hsc = hideshow(); // it deletes itself so who cares :: the answer is if you try to go back after opening this it doesn't work
            frame.style.opacity = "0";
            component.showGallery([{
                thumb: img.src,
                w: img.naturalWidth,
                h: img.naturalHeight,
                body: {kind: "captioned_image",
                    w: img.naturalWidth,
                    h: img.naturalHeight,
                    url: img.src,
                },
            }], 0, () => {
                return getBound(img);
            }, () => {
                frame.disabled = false;
                frame.style.opacity = "1";
            }).defer(hsc);
        }).catch(err => {
            console.log(err);
            frame.disabled = false;
            alert(err.toString());
        });
    };

    return frame;
}

function elImg(url: string, opt: {w?: number, h?: number, alt?: string}): HTMLImageElement {
    const res = el("img").clss("image-loading")
        .attr({
            src: url,
            width: opt.w != null ? `${opt.w}px` as const : undefined,
            height: opt.h != null ? `${opt.h}px` as const : undefined,
            alt: opt.alt, title: opt.alt
        })
    ;
    res.onload = () => res.classList.remove("image-loading");
    res.onerror = () => res.classList.remove("image-loading");
    return res;
}

function zoomableImage(url: string, opt: {w?: number, h?: number, alt?: string}): HTMLElement {
    return zoomableFrame(elImg(url, opt).clss("preview-image"));
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
    elButton("code-button").adto(action_container).atxt("Code").onev("click", (e) => {
        e.stopPropagation();
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
    if(action.kind === "link") linkButton(client.id, action.url, "action-button").atxt(action.text).adto(content_buttons_line);
    else if(action.kind === "reply") {
        let prev_preview: {preview: Generic.Thread, remove: () => void} | undefined = undefined;
        let reply_state: "none" | {preview?: Generic.Thread} = "none";
        const reply_btn = elButton("action-button").atxt("Reply").adto(content_buttons_line);

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
                    const textarea = el("textarea").clss("border my-3 w-full resize-y").adto(el("div").adto(reply_container));
                    // maybe make this empty if the text input is empty?
                    const btnline = el("div").clss("flex space-x-1").adto(reply_container);
                    const submit = elButton("pill-filled").adto(btnline).atxt("Reply");
                    const preview = elButton("pill-empty").adto(btnline).atxt("Preview");
                    const cancel = elButton("pill-empty").adto(btnline).atxt("Cancel");
                    preview.onev("click", (e) => {
                        e.stopPropagation();
                        reply_state = {preview: client.previewReply(textarea.value, action.reply_info)};
                        update();
                    });
                    // this might lag too much idk
                    textarea.onev("input", () => {
                        reply_state = {preview: client.previewReply(textarea.value, action.reply_info)};
                        update();
                    });
                    cancel.onev("click", (e) => {
                        e.stopPropagation();
                        const deleteres = textarea.value ? confirm("delete?") : true;
                        if(deleteres) {
                            reply_state = "none";
                            update();
                        }
                    });
                    submit.onev("click", (e) => {
                        e.stopPropagation();
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
                            clientContent(client, r, {clickable: false}).defer(hsc).adto(el("div").adto(content_buttons_line));
                        }).catch(err => {
                            const error = err as Error;
                            submit.disabled = false;
                            submit.textContent = "Reply";
                            console.log("Got error", err);
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
                    const listing_el = clientContent(client, reply_state.preview, {clickable: false});
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

        reply_btn.onev("click", (e) => {
            e.stopPropagation();
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

        const delbtn = elButton("action-button").atxt("Delete").adto(resdelwrap);

        resyeswrap.atxt("Are you sure? ");
        const confirmbtn = elButton("unsafe-action-button").atxt("Delete").adto(resyeswrap);
        resyeswrap.atxt(" / ");
        const nvmbtn = elButton("safe-action-button").atxt("Cancel").adto(resyeswrap);

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

        delbtn.onev("click", (e) => {
            e.stopPropagation();
            setv("confirm");
        });
        confirmbtn.onev("click", (e) => {
            e.stopPropagation();
            setv("load");
            client.act(action.data).then(r => {
                setv("deleted");
            }).catch(err => {
                console.log("Got error:", err);
                setv({error: err.toString()});
            });
        });
        nvmbtn.onev("click", (e) => {
            e.stopPropagation();
            setv("none");
        });
    }else if(action.kind === "report") {
        let report_container: HTMLDivElement | undefined;
        let hsc = hideshow();

        elButton("action-button").atxt("Report").adto(content_buttons_line).onev("click", (e) => {
            e.stopPropagation();
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

        const clurl = action.data;
        const btn = elButton("action-button").atxt("Log In").adto(frame).onev("click", (e) => {
            e.stopPropagation();
            btn.textContent = "…";
            btn.disabled = true;
            client.getLoginURL!(clurl).then(res => {
                frame.innerHTML = "";
                linkButton(client.id, res, "pill-filled").atxt("Log In").adto(frame);
            }).catch(err => {
                btn.textContent = "Retry";
                frame.atxt("Error:"+err);
                console.log(err);
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
        const btn = elButton("action-button").atxt(action.text).adto(frame).onev("click", (e) => {
            e.stopPropagation();
            btn.disabled = true;
            btn.textContent = "…";
            client.act(action.action).then(() => {
                btn.remove();
                txt("✓").adto(frame);
            }).catch(err => {
                console.log("got error: "+err);
                btn.disabled = false;
                frame.adch(el("span").clss("error").atxt(err.toString()));
            });
        });
    }else if(action.kind === "flair") {
        // TODO
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
            const btn = elButton("pill-filled").adto(frame);
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

            btn.onev("click", (e) => {
                e.stopPropagation();
                state = "load";
                update();
                client.sendReport!(report_data, textarea?.value).then(res => {
                    onreported(res);
                }).catch(err => {
                    console.log(err);
                    state = {error: err.toString()};
                    update();
                });
            });
        } break;
        case "link": {
            linkButton(client.id, report_item.report.url, "normal").atxt(report_item.report.text).adto(frame);
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
    const frame = el("div").clss("report-screen text-sm");
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
    const button = elButton("action-button").adto(wrapper).clss("counter-increment-btn").attr({'aria-label': "Up"});
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

        button.setAttribute("class", "counter-increment-btn " + link_styles_v[state.your_vote === "increment" ? (action.incremented_style ?? "action-button") : (action.style ?? "action-button")]);
        if(decr_button) decr_button.setAttribute("class", "counter-decrement-btn " + link_styles_v[state.your_vote === "decrement" ? (action.decremented_style ?? "action-button") : (action.style ?? "action-button")]);

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
        decr_button = elButton("action-button").adch(el("span").atxt("⯆")).attr({'aria-label': "Down"}).adto(wrapper).onev("click", (e) => {
            e.stopPropagation();
            if(state.your_vote === "decrement") {
                doAct(undefined);
            }else{
                doAct("decrement");
            }
        }).clss("counter-decrement-btn");
    }
    button.onev("click", e => {
        e.stopPropagation();
        if(state.your_vote === "increment") {
            doAct(undefined);
        }else{
            doAct("increment");
        }
    });

    return hsc;
}

const userLink = (client_id: string, href: string, name: string) => {
    const [author_color, author_color_dark] = getRandomColor(seededRandom(name.toLowerCase()));
    return linkButton(client_id, href, "userlink")
        .styl({"--light-color": rgbToString(author_color), "--dark-color": rgbToString(author_color_dark)})
    ;
};

export type Watchable<T> = {
    value: T,
    watch: (update: () => void) => HideShowCleanup<undefined>,
};
export function watchable<T>(initial: T): Watchable<T> {
    let c_val = initial;
    const watchers: (() => void)[] = [];
    return {
        get value() {
            return c_val;
        },
        set value(nv: T) {
            c_val = nv;
            watchers.forEach(w => w());
        },
        watch(update: () => void): HideShowCleanup<undefined> {
            const hsc = hideshow();
            const wcb = () => {update()};
            watchers.push(wcb);
            hsc.on("cleanup", () => watchers.splice(watchers.indexOf(wcb), 1));
            return hsc;
        },
    };
}

// state x = 25;
// const y = x / 5;
// →
// const x = watchable(25);
// const y = watchWith([x], () => x / 5).defer(hsc);
export function watchWith<T>(dependencies: Watchable<unknown>[], value: () => T): HideShowCleanup<Watchable<T>> {
    const nwable = watchable(value());
    const hsc = hideshow(nwable);

    for(const dependnc of dependencies) {
        dependnc.watch(() => nwable.value = value()).defer(hsc);
    }

    return hsc;
}
export function watchNode<Node>(dependencies: Watchable<unknown>[], node: Node, update: (node: Node) => void): HideShowCleanup<Node> {
    const hsc = hideshow(node);

    for(const dependnc of dependencies) {
        dependnc.watch(() => update(node)).defer(hsc);
    }
    update(node);

    return hsc;
}

function renderMenu(client: ThreadClient, menu: Generic.Menu): HideShowCleanup<HTMLElement> {
    const menu_area = el("div");
    const hsc = hideshow(menu_area);
    const menu_this_line = el("div").adto(menu_area);
    const renderSubmenu = (items: Generic.MenuItem[]): HTMLElement => {
        const smdiv = el("div");
        for(const item of items) {
            if(item.action.kind === "link") {
                linkButton(client.id, item.action.url, "none").clss("text-gray-600 dark:text-gray-400 hover:text-gray-900").adto(smdiv).atxt(item.text);
            }else if(item.action.kind === "menu") {
                elButton("none").adto(smdiv).atxt(item.text + " " + "▸").onev("click", e => {
                    e.stopPropagation();
                    e.preventDefault();
                    alert("TODO submenus");
                }).adto(smdiv);
            }else if(item.action.kind === "show-line-two") {
                elButton("none").adto(smdiv).atxt(item.text).onev("click", e => {
                    e.stopPropagation();
                    e.preventDefault();
                    alert("TODO submenu show-line-two");
                }).adto(smdiv);
            }else assertNever(item.action);
        }
        return smdiv;
    };

    let menu_l2: HideShowCleanup<HTMLElement> | undefined;

    hsc.on("cleanup", () => {
        if(menu_l2) {menu_l2.cleanup(); menu_l2 = undefined}
    });


    const selected_item = watchable(menu.find(it => it.selected));

    selected_item.watch(() => {
        if(menu_l2) {
            menu_l2.cleanup();
            menu_l2.associated_data.remove();
            menu_l2 = undefined;
        }
    });
    for(const item of menu) {
        // const classv = [
        //     "inline-block mx-1 px-1 text-base border-b-2 transition-colors",
        //     item.selected ? "border-gray-900" : "border-transparent text-gray-500 dark:text-gray-600 hover:text-gray-900"
        // ];
        if(item.action.kind === "menu") {
            const arrowv = txt("…");
            let open = false;
            let submenu_v: HTMLElement | undefined;
            const subitems = item.action.children;

            hsc.on("hide", () => {console.log("open menu was asked to be hidden"); open = false; update()});
            
            const update = () => {
                arrowv.nodeValue = open ? "▴" : "▾";
                btnel.attr({'aria-expanded': open ? "true" : "false"});
                if(open) {
                    if(!submenu_v) {
                        submenu_v = renderSubmenu(subitems).clss(
                            "absolute z-10 flex flex-col shadow bg-gray-100 p-3 rounded w-max max-w-7xl"
                        ).adto(document.body);
                        const bbox = itcontainer.getBoundingClientRect();
                        submenu_v.styl({left: bbox.left+"px", top: (bbox.bottom + (window.pageYOffset ?? document.documentElement.scrollTop))+"px"});
                    }
                }else{
                    if(submenu_v) {submenu_v.remove(); submenu_v = undefined}
                }
            };
            const itcontainer = el("span").adto(menu_this_line);
            const documentEventListener = (e: MouseEvent) => {
                if(open) {
                    console.log("Got event: ", e.target);
                    let parentv: HTMLElement | null = e.target as HTMLElement | null;
                    while(parentv) {
                        if(parentv === itcontainer) return;
                        if(submenu_v && parentv === submenu_v) return;
                        parentv = parentv.parentElement;
                    }
                    open = false;
                    update();
                }
            };
            document.addEventListener("click", documentEventListener, {capture: true});
            hsc.on("cleanup", () => document.removeEventListener("click", documentEventListener, {capture: true}));
            const btnel = elButton("none").attr({'aria-haspopup': "true"}).atxt(item.text).atxt(" ").adch(arrowv).adto(itcontainer).onev("click", e => {
                e.preventDefault();
                e.stopPropagation();
                
                open =! open;
                update();
            });

            watchNode([selected_item], 0, () => {
                btnel.setAttribute("class", menuButtonStyle(item === selected_item.value));
            }).defer(hsc);

            update();
        }else if(item.action.kind === "link") {
            const lbtn = linkButton(client.id, item.action.url, "none").atxt(item.text).adto(menu_this_line);

            watchNode([selected_item], 0, () => {
                lbtn.setAttribute("class", menuButtonStyle(item === selected_item.value));
            }).defer(hsc);
        }else if(item.action.kind === "show-line-two") {
            const action = item.action;
            const l2btn = elButton("none").atxt(item.text).adto(menu_this_line);
            watchNode([selected_item], 0, () => {
                l2btn.setAttribute("class", menuButtonStyle(item === selected_item.value));

                if(item === selected_item.value) {
                    if(menu_l2) throw new Error("already existing menu_l2");
                    menu_l2 = renderMenu(client, action.children);
                    menu_l2.defer(hsc);
                    menu_l2.associated_data.clss("mt-2").adto(menu_area);
                }
            }).defer(hsc);
            l2btn.onev("click", e => {
                e.stopPropagation();
                selected_item.value = item;
            });
        }else assertNever(item.action);
        txt(" ").adto(menu_this_line);
    }
    return hsc;
}

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
        el("img").clss("sub-icon-img drop-shadow").attr({alt: "", src: listing.icon.url}).adto(area);
    }
    const title_area = el("div").clss("subreddit-title-area").adto(area);
    if(listing.name.display != null) el("h1").atxt(listing.name.display).clss("text-lg").adto(title_area);
    el("h2").atxt(listing.name.link_name).clss("text-gray-500").adto(title_area);

    const rest = el("div").clss("sub-subscribe-area").adto(area);

    if(listing.subscribe) {
        const subscr = el("div").adto(rest);
        renderAction(client, listing.subscribe, subscr).defer(hsc);
    }

    if(listing.body) {
        const bodyarea = el("div").adto(rest);
        renderBody(client, listing.body, {autoplay: false}, bodyarea).defer(hsc);
    }

    // TODO extract this out so menus can be used for eg listing sort options
    if(listing.menu) {
        renderMenu(client, listing.menu).defer(hsc).adto(el("div").clss("my-3").adto(frame));
    }

    elButton("action-button").atxt("Code").adto(frame).onev("click", (e) => {e.stopPropagation(); console.log(listing)});

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
            }else if(item.name.kind === "image") {
                name_node = el("img").clss("w-fill h-auto").attr({src: item.name.src, alt: item.name.alt, width: `${item.name.w}px` as const, height: `${item.name.h}px` as const});
            }else assertNever(item.name);

            if(item.click.kind === "link") {
                if(item.name.kind === "username") {
                    userLink(client.id, item.click.url, item.name.username).atxt(item.name.username).adto(ili);
                }else {
                    linkButton(client.id, item.click.url, "normal").adch(name_node).adto(ili);
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
        outest_el.clss("widget-fullscreen-content");
        const iframe = el("iframe").adto(alt_frame).styl({width: "312px"}).attr({width: "312px", height: content.height as unknown as `${number}px`, srcdoc: content.srcdoc});
        iframe.onload = () => {
            if(!iframe.contentWindow) return console.log("no content window");
            iframe.style.height = (iframe.contentWindow.document.body.scrollHeight + 20) + "px";
        };
    }else if(content.kind === "image") {
        const alt_frame = el("div");
        outest_el.clss("widget-fullscreen-content");
        outest_el.replaceChild(alt_frame, outer_el);
        const imgel = elImg(content.src, {w: content.width, h: content.height}).clss("w-full h-auto");
        if(content.link_url != null) linkButton(client.id, content.link_url, "none")
            .adch(imgel).adto(alt_frame);
        else zoomableFrame(imgel).adto(alt_frame);
    }else assertNever(content);

    if(widget.actions_bottom) {
        const actionstop = el("div").clss("widget-actions-bottom").adto(frame);
        for(const action of widget.actions_bottom) {
            renderAction(client, action, actionstop).defer(hsc);
        }
    }
    el("div").adto(frame).adch(elButton("code-button").atxt("Code").onev("click", (e) => {e.stopPropagation(); console.log(widget)}));

    return hsc;
} 

type ClientContentOpts = {
    clickable: boolean,
};
function clientContent(client: ThreadClient, listing: Generic.ContentNode, opts: ClientContentOpts): HideShowCleanup<Node> {
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

        clientListing(client, listing, frame, opts).defer(hsc);
        return hsc;
    }catch(e) {
        hsc.cleanup();
        console.log("Got error", e); 
        frame.innerHTML = "";
        frame.adch(el("pre").adch(el("code").atxt(e.toString() + "\n\n" + e.stack)));
        frame.adch(elButton("code-button").atxt("Code").onev("click", (err) => {err.stopPropagation(); console.log(listing)}));
        return hideshow(frame);
    }
}
function clientListingWrapperNode(): HTMLDivElement {
    const frame = el("div").clss("post text-sm"); // the last in the header array should be text-base
    return frame;
}
type AddChildrenFn = (children: Generic.Node[]) => void;
function clientListing(client: ThreadClient, listing: Generic.Thread, frame: HTMLElement, opts: ClientContentOpts): HideShowCleanup<{addChildren: AddChildrenFn}> {
    let content_voting_area: HTMLDivElement;
    let thumbnail_loc: HTMLButtonElement;
    let preview_area: HTMLDivElement;
    let replies_area: HTMLDivElement;

    let content_title_line: HTMLDivElement;
    let content_subminfo_line: HTMLDivElement;
    let content_buttons_line: HTMLDivElement;

    if(opts.clickable && listing.link.startsWith("/")) {
        // frame = linkButton(client.id, listing.link, "none").clss("hover:bg-gray-200").adto(frame);
        frame.clss("hover-outline").attr({tabindex: "0"}).onev("click", (e) => {
            e.stopPropagation();
            console.log("target:", e.target);
            let target_parent = e.target as Node | null;
            while(target_parent && target_parent !== frame) {
                if(target_parent instanceof HTMLElement && (false
                    || target_parent.nodeName === "A"
                    || target_parent.nodeName === "BUTTON"
                    || target_parent.nodeName === "VIDEO"
                    || target_parent.nodeName === "AUDIO"
                    || target_parent.nodeName === "INPUT"
                    || target_parent.nodeName === "TEXTAREA"
                    || target_parent.nodeName === "IFRAME"
                    || target_parent.classList.contains("resizable-iframe")
                )) return;
                target_parent = target_parent.parentNode;
            }
            navigate({path: "/"+client.id+listing.link});
        });
    }

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
        const collapsed_button = el("button").clss("collapse-btn").attr({draggable: "true"}).adch(el("div").clss("collapse-btn-inner")).onev("click", (e) => {
            e.stopPropagation();
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
        content_title_line.adch(linkButton(client.id, listing.link, "none").clss("hover:underline").atxt(listing.title.text));
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
            .adch(userLink(client.id, listing.info.author.link, listing.info.author.color_hash).atxt(listing.info.author.name))
        ;
        if(listing.info.author.flair) content_subminfo_line.adch(renderFlair(listing.info.author.flair));
        if(listing.info.in) {
            content_subminfo_line.atxt(" in ").adch(linkButton(client.id, listing.info.in.link, "normal").atxt(listing.info.in.name));
        }
        if(listing.info.edited !== false) content_subminfo_line.atxt(", Edited ").adch(timeAgo(listing.info.edited).defer(hsc));
        if(listing.info.pinned) {
            content_subminfo_line.atxt(", ").adch(el("span").clss("text-green-600 dark:text-green-500").atxt("Pinned"));
        }
    }else if((listing.layout === "reddit-comment" || listing.layout === "mastodon-post") && listing.info) {
        content_subminfo_line.adch(userLink(client.id, listing.info.author.link, listing.info.author.color_hash).atxt(listing.info.author.name));
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
            content_subminfo_line.atxt(", ").adch(el("span").clss("text-green-600 dark:text-green-500").atxt("Pinned"));
        }
        if(listing.info.reblogged_by) {
            content_subminfo_line.atxt(" ← Boosted by ")
                .adch(userLink(client.id, listing.info.reblogged_by.author.link, listing.info.reblogged_by.author.color_hash).atxt(listing.info.reblogged_by.author.name))
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

        const initContent = (body: Generic.Body, bodyopts: {autoplay: boolean}): HideShowCleanup<HTMLElement> => {
            const body_container = el("div").clss("post-body");

            const body_hsc = hideshow(body_container);

            if(content_warnings.length) {
                const cws = content_warnings;
                content_warnings = [];
                const cwbox = el("div").adto(body_container);
                cwbox.atxt("Content Warning"+(cws.length === 1 ? "" : "s")+": ");
                cwbox.adch(renderFlair(cws));
                cwbox.atxt(" ");
                elButton("pill-filled").adto(cwbox).atxt("Show Content").onev("click", e => {
                    e.stopPropagation();
                    cwbox.remove();
                    thumbnail_loc.classList.remove("thumbnail-content-warning");
                    renderBody(client, body, {...bodyopts}, body_container).defer(body_hsc);
                });
                return body_hsc;
            }
            renderBody(client, body, {...bodyopts}, body_container).defer(body_hsc);
            return body_hsc;
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
            preview_area.remove();
        }else if(listing.display_mode.body === "collapsed") {
            const open_preview_button = elButton("outlined-button").adto(content_buttons_line);
            const open_preview_text = txt("…").adto(open_preview_button);

            let body_v: undefined | HideShowCleanup<HTMLElement>;
            hsc.on("cleanup", () => {if(body_v) body_v.cleanup();});
            hsc.on("hide", () => {if(body_v) body_v.setVisible(false);});
            hsc.on("show", () => {if(body_v) body_v.setVisible(true);});

            let state = listing.display_mode.body_default === "open";
            const autoplay = !state;
            const update = () => {
                if(state && !body_v) {
                    body_v = initContent(listing.body, {autoplay});
                    body_v.associated_data.adto(preview_area);
                }else if(!state && body_v) {
                    body_v.cleanup();
                    body_v.associated_data.remove();
                    body_v = undefined;
                }
                open_preview_text.nodeValue = state ? "Hide" : "Show";

            };
            update();
            open_preview_button.onev("click", (e) => {
                e.stopPropagation();
                state =! state;
                update();
            });
            thumbnail_loc.onev("click", (e) => {
                e.stopPropagation();
                state =! state;
                update();
            });
        }else{
            initContent(listing.body, {autoplay: false}).defer(hsc).adto(preview_area);
        }
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
    listing.actions.length === 0 && linkButton(client.id, listing.link, "action-button").atxt("View").adto(content_buttons_line);
    content_buttons_line.atxt(" ");
    elButton("code-button").onev("click", e => {
        e.stopPropagation();
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
        if(added_comments_are_threaded) reply_node.clss("relative threaded");
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
        lastElemAddChildren = clientListing(client, child_listing, reply_frame, {clickable: opts.clickable}).defer(hsc).addChildren;
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

type LinkStyle = keyof typeof link_styles_v;

const link_styles_v = {
    'none': "",
    'normal': "text-blue-600 dark:text-blue-500 underline",
    'previewable': "text-blue-600 dark:text-blue-500 hover:underline",
    'action-button': "p-1 rounded hover:bg-gray-200",
    'save-button-saved': "text-green-600 dark:text-green-500 hover:underline",
    'safe-action-button': "text-blue-600 dark:text-blue-500 hover:underline",
    'unsafe-action-button': "text-red-600 dark:text-red-500 hover:underline",
    'code-button': "text-gray-600 dark:text-gray-500 hover:underline",
    'load-more': "text-blue-600 dark:text-blue-500 hover:underline text-base",
    'userlink': "text-userlink-color-light dark:text-userlink-color-dark hover:underline",
    'pill-empty': "text-sm border-2 border-black text-black hover:text-white hover:bg-black p-1 px-3 rounded-full transition-colors",
    'pill-transparent': "text-sm border-2 border-transparent text-black hover:text-white hover:bg-black p-1 px-3 rounded-full transition-colors",
    'pill-filled': "text-sm border-2 border-black bg-black text-white hover:text-black hover:bg-transparent p-1 px-3 rounded-full transition-colors",
    'outlined-button': "border border-gray-600 dark:border-gray-500 px-2",
    'error': "text-red-600 dark:text-red-500 hover:underline",
};

const linkAppearence = (display_style: LinkStyle) => [link_styles_v[display_style]];

function elButton(display_style: LinkStyle) {
    return el("button").clss(...linkAppearence(display_style)).attr({draggable: "true"});
}

function loadingSpinner() {
    return el("div").clss("lds-ripple").adch(el("div")).adch(el("div"));
}

// TODO I guess support loading more in places other than the end of the list
// that means :: addChildren needs to have a second before_once argument and this needs to have a before_once
// doesn't matter atm but later.
function loadMoreButton(client: ThreadClient, load_more_node: Generic.LoadMore, addChildren: (children: Generic.Node[]) => void, removeSelf: () => void) {
    const container = el("div");
    const makeButton = () => linkButton(client.id, load_more_node.url, "load-more", {onclick: ev => {
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
    elButton("code-button").onev("click", e => {
        e.stopPropagation();
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
    const makeButton = (lmnode: Generic.LoadMoreUnmounted) => linkButton(client.id, lmnode.url, "load-more", {onclick: ev => {
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
        ).atxt(" ").adch(elButton("code-button").onev("click", e => {
            e.stopPropagation();
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

const makeTopLevelWrapper = () => el("div").clss("top-level-wrapper", "object-wrapper", "bg-postcolor-100");

function renderClientPage(client: ThreadClient, listing: Generic.Page, frame: HTMLDivElement, title: UpdateTitle): HideShowCleanup<undefined> {
    const hsc = hideshow();

    // It might get mutated so just in case make a copy. This should be fixed
    // so the listing can't be mutated and this isn't necessary
    title.setTitle(listing.title);

    frame.classList.add("display-"+listing.display_style);

    const navbar_area = el("div").adto(frame).clss("navbar-area");
    for(const navbar_action of listing.navbar) {
        renderAction(client, navbar_action, navbar_area).defer(hsc);
        txt(" ").adto(navbar_area);
    }
    // TODO save the raw page responses. listings are not meant to be copied, they can have symbols
    // and might in the future have functions and stuff
    //
    // How to make this change:
    // make client.getThread return an Opaque<ThreadData> that you pass back to client to get the listing 
    //
    // const saveofflinebtn = elButton("action-button").atxt("Save Offline").adto(navbar_area).onev("click", () => {
    //     // save listing in indexed db
    //     // (or in the future, save the raw responses from the web so they can be re-transformed if necessary)
    //     localStorage.setItem("saved-post", JSON.stringify(listing_copy));
    //     saveofflinebtn.disabled = true;
    //     saveofflinebtn.textContent = "✓ Saved";
    //     // set url to /saved/… without reloading
    // }).adto(navbar_area);

    const header_area = el("div").adto(frame).clss("header-area");
    const content_area = el("div").adto(frame).clss("content-area");

    if(listing.sidebar) {
        // on mobile, ideally this would be a link that opens the sidebar in a new history item
        elButton("pill-filled").adto(frame).clss("sidebar-toggle-mobile", "my-1").atxt("Toggle Sidebar").onev("click", e => {
            e.stopPropagation();
            sidebar_area.classList.toggle("sidebar-visible-mobile");
        });
        const sidebar_area = el("div").adto(frame).clss("sidebar-area");
        for(const sidebar_elem of listing.sidebar) {
            clientContent(client, sidebar_elem, {clickable: false}).defer(hsc).adto(makeTopLevelWrapper().adto(sidebar_area));
        }
    }

    if(listing.body.kind === "listing") {
        clientContent(client, listing.body.header, {clickable: false}).defer(hsc).adto(makeTopLevelWrapper().adto(header_area));

        if(listing.body.menu) {
            renderMenu(client, listing.body.menu).defer(hsc).adto(makeTopLevelWrapper().adto(content_area));
        }

        const listing_area = el("div").adto(content_area);
        const addChildren = (children: Generic.UnmountedNode[]) => {
            for(const child of children) addChild(child);   
        };
        const addChild = (child: Generic.UnmountedNode) => {
            // TODO show parent nodes and stuff
            if(child.parents.length === 0) {
                const errn = el("div").clss("error").atxt("unmounted.parents.length === 0");
                errn.adto(makeTopLevelWrapper().adto(listing_area));
                return;
            }
            const toplevel_area = makeTopLevelWrapper().adto(listing_area);
            for(const parent of child.parents) {
                if(parent.kind === "load_more") {
                    const lmdiv = el("div").adto(toplevel_area);
                    linkButton(client.id, parent.url, "load-more").atxt("Load More").adto(lmdiv);
                    lmdiv.adch(txt(" ")).adch(el("span").clss("error text-sm").atxt("TODO load more here"));
                }else{
                    clientContent(client, parent, {clickable: true}).defer(hsc).adto(toplevel_area);
                }
            }
            if(child.replies.length > 0) {
                let replies: HideShowCleanup<HTMLElement> | undefined;
                const srplybtn = elButton("previewable").adto(toplevel_area).atxt("Replies ▸").onev("click", e => {
                    e.stopPropagation();
                    if(replies) {
                        replies.cleanup();
                        replies.associated_data.remove();
                        replies = undefined;
                        srplybtn.textContent = "Replies ▸";
                    }else{
                        srplybtn.textContent = "Replies ▾";
                        const rdiv = el("div").adto(toplevel_area);
                        const rhsc = hideshow(rdiv);
                        replies = rhsc;
                        const addChildrenReplies = (children: Generic.Node[]) => {
                            for(const child_replies of children) addChildReplies(child_replies);
                        };
                        const addChildReplies = (child_replies: Generic.Node) => {
                            if(child_replies.kind === "load_more") {
                                const lmbtn = loadMoreButton(client, child_replies, addChildrenReplies, () => lmbtn.remove());
                                lmbtn.adto(rdiv);
                                return;
                            }
                            clientContent(client, child_replies, {clickable: false}).defer(rhsc).adto(rdiv);
                        };
                        addChildrenReplies(child.replies);
                    }
                });
            }
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
        const parent_area = makeTopLevelWrapper().adto(header_area);
        for(const parent of listing.body.item.parents) {
            if(parent.kind === "load_more") {
                // uuh uuh
                const lmdiv = parent_area;
                linkButton(client.id, parent.url, "load-more").atxt("Load More").adto(lmdiv);
                lmdiv.adch(txt(" ")).adch(el("span").clss("error text-sm").atxt("TODO load more here"));
                continue;
            }
            const is_last = parent === listing.body.item.parents[listing.body.item.parents.length - 1];
            clientContent(client, parent, {clickable: !is_last}).defer(hsc).adto(parent_area);
        }
        if(listing.body.item.menu) {
            renderMenu(client, listing.body.item.menu).defer(hsc).adto(makeTopLevelWrapper().adto(content_area));
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
            clientContent(client, child, {clickable: false}).defer(hsc).adto(makeTopLevelWrapper().adto(content_area));
        };
        addChildren(listing.body.item.replies);
        if(listing.body.item.replies.length === 0) {
            el("div").atxt("*There are no replies*").adto(content_area);
        }
    }else assertNever(listing.body);

    return hsc;
}

// const top_level_wrapper: string[] = [];
// const object_wrapper = ["shadow-md m-5 p-3 dark:bg-gray-800 rounded-xl m-5 p-3"];

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
            await client.login!(path, query);
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
    test: () =>  import("./clients/test").then(client => client.client),
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

// a custom redirect can be made for "/" for SEO reasons that has html in it already
function homePage(): HideShowCleanup<HTMLDivElement> {
    const res = el("div");
    const hsc = hideshow(res);

    res.innerHTML = `<div class="flex justify-center flex-row">
        <div class="w-full max-w-prose">
            <div class="bg-white p-5 sm:m-5 sm:p-10 shadow sm:rounded-xl">
                <h1 class="text-3xl sm:text-5xl font-black">ThreadReader</h1>
                <h2 class="text-base font-light text-gray-800 dark:text-gray-500">A client for Reddit and Mastodon</h2>
                <div class="mt-10"></div>
                <p>Try for <span id="reddit"></span></p>
                <p>Try for <span id="mastodon"></span></p>
                <div class="mt-10"></div>
                <p class="text-gray-800 dark:text-gray-500"><span id="settings"></span> · <span id="github"></span> · <span id="license"></span> · <span id="privacy"></span></p>
                <div class="mt-2"></div>
            </div>
        </div>
    </div>`;
    res.querySelector("#reddit")!.appendChild(linkButton("", "/reddit", "normal").atxt("Reddit").adto(res));
    res.querySelector("#mastodon")!.appendChild(linkButton("", "/mastodon", "normal").atxt("Mastodon").adto(res));
    res.querySelector("#settings")!.appendChild(linkButton("", "/settings", "action-button").atxt("Settings").adto(res));
    res.querySelector("#github")!.appendChild(linkButton("", "https://github.com/pfgithub/threadclient", "action-button").atxt("Github").adto(res));
    res.querySelector("#license")!.appendChild(linkButton("", "https://github.com/pfgithub/threadclient/blob/main/LICENSE", "action-button").atxt("License").adto(res));
    res.querySelector("#privacy")!.appendChild(linkButton("", "https://github.com/pfgithub/threadclient/blob/main/privacy.md", "action-button").atxt("Privacy").adto(res));

    return hsc;
}

type SchemeInfo = [scheme: "light" | "dark" | "system", system: boolean];
declare function getColorScheme(): SchemeInfo;
declare function onColorSchemeChange(cb: (...info: SchemeInfo) => void): () => void;
declare function setColorScheme(ncs: "light" | "dark" | "system"): void;

function settingsPage(): HideShowCleanup<HTMLDivElement> {
    const res = el("div");
    const hsc = hideshow(res);

    const colorschemearea = el("div").clss("p-4").adto(res);
    colorschemearea.adch(el("h1").atxt("Color Scheme").clss("text-2xl font-black"));
    const lightbtn = el("button").atxt("Light Mode").adto(colorschemearea).onev("click", e => {
        e.stopPropagation();
        setColorScheme("light");
    });
    const darkbtn = el("button").atxt("Dark Mode").adto(colorschemearea).onev("click", e => {
        e.stopPropagation();
        setColorScheme("dark");
    });
    const systembtn = el("button").atxt("System Default ").adto(colorschemearea).onev("click", e => {
        e.stopPropagation();
        setColorScheme("system");
    });
    const systemtext = txt("(…)");
    systembtn.adch(systemtext);

    const onupdate = ([scheme, system]: SchemeInfo) => {
        systemtext.nodeValue = system ? "(Dark)" : "(Light)";

        lightbtn.setAttribute("class", menuButtonStyle(scheme === "light"));
        darkbtn.setAttribute("class", menuButtonStyle(scheme === "dark"));
        systembtn.setAttribute("class", menuButtonStyle(scheme === "system"));
    };
    onupdate(getColorScheme());
    const removeOnchange = onColorSchemeChange((cschm, csys) => {
        onupdate([cschm, csys]);
    });
    hsc.on("cleanup", () => removeOnchange());

    const demoitm = el("div").adto(colorschemearea);
    el("div").clss("w-max max-w-full").adto(demoitm).adch(
        makeTopLevelWrapper().adch(
            el("div").clss("prose").adch(
                el("h1").atxt("Theme"),
                el("p").atxt("theme"),
            ),
        ),
    );

    return hsc;
}

function pwaStartPage(): HideShowCleanup<HTMLDivElement> {
    const res = el("div");
    const hsc = hideshow(res);

    linkButton("", "/reddit", "normal").atxt("Reddit").adto(res);
    res.atxt(" · ");
    linkButton("", "/mastodon", "normal").atxt("Mastodon").adto(res);
    res.atxt(" · ");
    linkButton("", "/settings", "normal").atxt("Settings").adto(res);
    res.atxt(" · ");
    linkButton("", "/", "normal").atxt("Home").adto(res);

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

    if(path0 == null) {
        return homePage();
    }
    if(path0 === "pwa_start") {
        return pwaStartPage();
    }
    if(path0 === "settings") {
        return settingsPage();
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
        });
    }

    return fetchClientThen(path0, (client) => {
        return clientMain(client, "/"+path.join("/")+search);
    });
}

// TODO:
// below item:
//    const scroll_top = …
//    style= position:fixed;top:0;left:0;bottom:0;right:0;overflow-y:hidden;
//    scrollTop = scroll_top;
// above item:
//    background-color: rgba(0, 0, 0, 0.5)
// on render:
//    if below is fullscreen-view && above is comments-view
//    - keep
//    else
//    - gone below item

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
    const frame = el("div").clss("navbar", "bg-postcolor-100").adto(document.body);
    navbar = frame;

    const navbar_button = ["px-2"];

    el("button").adto(frame).atxt("←").clss(...navbar_button).onev("click", e => {e.stopPropagation(); history.back()});
    el("button").adto(frame).atxt("→").clss(...navbar_button).onev("click", e => {e.stopPropagation(); history.forward()});

    const nav_path = el("input").adto(frame).clss("bg-transparent text-center border border-gray-600 dark:border-gray-500");

    const nav_go = el("button").clss(...navbar_button).atxt("⏎").adto(frame);
    const nav_reload = el("button").clss(...navbar_button).atxt("🗘").adto(frame);

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
    elButton("pill-empty").atxt("🗙 Close").adto(alert).onev("click", (e) => {e.stopPropagation(); alert.remove()});
    alert.atxt(" ");
    elButton("pill-empty").atxt("🗘 Refresh").adto(alert).onev("click", (e) => {e.stopPropagation(); location.reload()});
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