import { hideshow, HideShowCleanup } from "../app";
import videojs from "video.js";
import "video.js/dist/video-js.min.css";
import "./videojs_fix.scss";

// for some reason shaka isn't playing the m3u8 files

export function playM3U8(
    m3u8: string,
    poster: string | undefined,
    opts: {autoplay: boolean},
): HideShowCleanup<HTMLDivElement> {
    const container_outer = el("div");
    const hsc = hideshow(container_outer);

    const container = container_outer.clss("handles-clicks");
    // const container = container_outer.attachShadow({mode: "open"}); // video-js does not work within a shadow dom
    // el("style").atxt(css).adto(container);

    const video = el("video").attr({
        'controls': "",
        'class': "video-js",
        'data-setup': "{}",
        'poster': poster,
    }).adto(el("div").adto(container));
    el("source").attr({src: m3u8, type: "application/x-mpegURL"}).adto(video);

    const player = videojs(video, {
        autoplay: opts.autoplay,
        liveui: true,
        playbackRates: [0.25, 0.5, 1, 1.5, 1.75, 2],
    }, () => {
        console.log("Player initialized");
    });
    
    hsc.on("hide", () => player.pause());
    hsc.on("cleanup", () => player.dispose());

    return hsc;
}