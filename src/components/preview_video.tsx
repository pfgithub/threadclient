import { createEffect, createSignal, For, Index, JSX, on, onCleanup, onMount } from "solid-js";
import { fetchPromiseThen, hideshow, link_styles_v, zoomableImage } from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { getIsVisible, getSettings, ShowCond, SwitchKind } from "../util/utils_solid";
import shaka from "shaka-player";

function Icon(props: {
    size: string,
    icon: {
        label: string,
        class: string,
    },
}): JSX.Element {
    return <div class="block">
        <div class="w-22px h-22px flex items-center justify-center">
            <i class={props.icon.class + " " + props.size} aria-label={props.icon.label} />
        </div>
    </div>;
}

function timeSecToString(time: number): string {
    const hours = time / 60 / 60 |0;
    const minutes = (time / 60 |0) % 60;
    const seconds = (time |0) % 60;
    return (hours ? hours.toString().padStart(2, "0") + ":" : "")
        + minutes.toString().padStart(hours ? 2 : 1, "0") + ":"
        + seconds.toString().padStart(2, "0")
    ;
}

let shaka_initialized = false;
function initShaka(): void {
    if(shaka_initialized) return;

    shaka.polyfill.installAll();

    // Check to see if the browser supports the basic APIs Shaka needs.
    if (!shaka.Player.isBrowserSupported()) {
        throw new Error("Shaka player is not supported");
    }

    shaka_initialized = true;
}

type BufferNode = {start: number, end: number};
function PreviewRealVideo(props: {
    video: Generic.Video,
    source: Generic.VideoSourceVideo,
    autoplay: boolean,
}): JSX.Element {
    let video_el!: HTMLVideoElement;
    const [playbackRate, setPlaybackRate] = createSignal(1.0);
    const [quality, setQuality] = createSignal<null | {w: number, h: number}>(null);
    const [targetQuality, setTargetQuality] = createSignal(0);

    const [maxTime, setMaxTime] = createSignal(0);
    const [currentTime, setCurrentTime] = createSignal(0);
    const [buffered, setBuffered] = createSignal<BufferNode[]>([]);
    const [expandControlsRaw, setExpandControls] = createSignal(false);
    const [playing, setPlaying] = createSignal<boolean | "loading">("loading");
    const [errorOverlay, setErrorOverlay] = createSignal<string | null>(null);
    const [erroredSources, setErroredSources] = createSignal<{[key: number]: boolean}>({});

    const settings = getSettings();

    const expandControls = () => {
        if(settings.custom_video_controls.value() === "browser") return false;
        return expandControlsRaw();
    };
 
    // custom controls todo:
    // [ ] scrubbing
    // [ ] hover the scrubber for that preview bar
    // [ ] click to play/pause
    // [ ] consider putting a big play button in the
    //     center of the video when it's paused
    // [ ] audio controls
    //     (use mozHasAudio + webkitAudioDecodedBytesCount + audioTracks + ...)
    // [ ] speed controls
    // [ ] quality controls
    // [ ] transitions
    // [ ] area marked as loaded should be (video) & (audio)
    // [ ] mobile tap and drag left or right to quick scrub
    // [ ] mobile support for all the controls and stuff if you tap
    // [ ] fullscreen

    const sources = () => {
        const target_index = targetQuality();
        const full_sources = props.source.sources.map((s, i) => ({...s, i}));
        return [
            ...full_sources.filter(src => src.i >= target_index),
            ...full_sources.filter(src => src.i < target_index).reverse(),
        ];
    };
    const qualities = (): {index: number, name: string}[] => {
        const res = new Map<string, {index: number}>();
        for(const [i, source] of props.source.sources.entries()) {
            if(erroredSources()[i] === true) continue;
            res.set(source.quality ?? "Unknown", {index: i});
        }
        return [...res.entries()].map(([n, v]) => ({name: n, ...v}));
    };

    const isVisible = getIsVisible();
    createEffect(() => {
        if(!isVisible()) {
            video_el.pause();
        }
    });
    createEffect(() => {
        video_el.playbackRate = playbackRate();
    });

    onMount(() => {
        initShaka();
        const player = new shaka.Player(video_el);
        player.addEventListener("error", (e) => {
            console.log("Error!", e);
            setErrorOverlay("An error occured. Check console.");
        });

        createEffect(on([targetQuality], () => {
            setTimeout(() => {
                reloadVideo(video_el.currentTime);
            }, 0);
        }, {defer: true}));
        createEffect(on([() => props.source], () => {
            reloadVideo(0);
        }, {defer: true}));

        const reloadVideo = (start_time: number) => {
            // TODO fix race condition when reloading
            // the video while a reload is already occuring
            (async () => {
                console.log("Reloading Video", start_time);
                let res_error = new Error("No sources");
                for(const source of sources()) {
                    try {
                        setPlaying("loading");
                        await player.load(source.url, start_time);
                        break;
                    }catch(e) {
                        res_error = e as Error;
                        setErroredSources(s => ({...s, [source.i]: true}));
                    }
                }
                throw res_error;
            })().then(() => {
                console.log("Player loaded");
            }).catch((e: Error) => {
                setErrorOverlay(e.stack ?? e.toString());
                // TODO try other sources
            });
        };
        reloadVideo(0);

        onCleanup(() => {
            player.destroy().then(() => {
                console.log("player destroyed");
            }).catch(e => {
                console.log("error destroying player", e);
            });
        });
    });

    const updateProgress = () => {
        const bufres: BufferNode[] = [];
        for(let i = 0; i < video_el.buffered.length; i++) {
            bufres.push({start: video_el.buffered.start(i), end: video_el.buffered.end(i)});
        }
        setCurrentTime(video_el.currentTime);
        setBuffered(bufres);
        setMaxTime(video_el.duration);
        if(video_el.error) setErrorOverlay(video_el.error.message);
        else if(video_el.networkState === video_el.NETWORK_NO_SOURCE) setErrorOverlay("Video could not be loaded.");
        else setErrorOverlay(null);
    };
    // todo support dragging left and right to seek
    return <div>
        <div
            class="preview-image relative min-w-50px min-h-50px overflow-hidden"
            onmouseenter={() => {
                setExpandControls(true);
            }}
            onmousemove={() => {
                setExpandControls(true);
            }}
            onmouseleave={() => {
                setExpandControls(false);
            }}
        >
            <video
                ref={video_el}
                controls={settings.custom_video_controls.value() === "browser"}
                class="max-h-inherit max-w-inherit"
                autoplay={props.autoplay}
                width={props.video.w}
                height={props.video.h}
                loop={props.video.gifv}

                poster={props.source.thumbnail}
                onplay={() => {
                    setPlaying("loading");
                }}
                onplaying={() => {
                    setPlaying(video_el.paused ? false : true);
                }}
                onratechange={() => {
                    // TODO playbackRate
                }}
                onvolumechange={() => {
                    //
                }}
                onprogress={() => {
                    updateProgress();
                }}
                oncanplaythrough={() => {
                    updateProgress();
                }}
                ontimeupdate={() => {
                    updateProgress();
                }}
                onpause={() => {
                    setPlaying(false);
                }}
                onwaiting={() => {
                    setPlaying("loading");
                }}
                onstalled={() => {
                    setPlaying("loading");
                }}
                onloadedmetadata={() => {
                    setQuality({w: video_el.videoWidth, h: video_el.videoHeight});
                    setMaxTime(video_el.duration);
                }}
                onloadeddata={() => {
                    setPlaying(video_el.paused ? false : true);
                }}
                onemptied={() => {
                    setQuality(null);
                    setPlaying("loading");
                }}
                oncapture:error={(e) => {
                    setPlaying(false);
                    updateProgress();
                }}
            >
                <span>{
                    props.video.alt ?? "Your device does not support video, and alt text was not supplied."
                }</span>
            </video>
            <div
                class="absolute top-0 left-0 bottom-0 right-0 items-center justify-center"
                style={{
                    display: settings.custom_video_controls.value() === "custom"
                    && (playing() !== true || expandControls()) ? "flex" : "none",
                }}
            >
                <button
                    class="block transform scale-200 hover:scale-300 transition-transform"
                    onclick={() => {
                        if(video_el.paused) {
                            void video_el.play();
                        }else{
                            video_el.pause();
                        }
                    }}
                    style={{
                        'filter': "drop-shadow(0 0 5px rgba(0, 0, 0, 0.5))",
                    }}
                >
                    <Icon size="icon-sm" icon={
                        playing() === false ? {
                            class: "icon-play-button",
                            label: "Play",
                        } : playing() === true ? {
                            class: "icon-play-pause",
                            label: "Pause",
                        } : {
                            class: "icon-loadbar",
                            label: "Loading",
                        }
                    } />
                </button>
            </div>
            <ShowCond when={errorOverlay()}>{overlay => (
                <div
                    class="absolute top-0 left-0 bottom-0 right-0 p-4 bg-rgray-900 bg-opacity-75"
                    style={{display: settings.custom_video_controls.value() === "custom" ? "block" : "none"}}
                >
                    <p>Error! {overlay}</p>
                </div>
            )}</ShowCond>
            <div
                class={
                    "absolute left-0 right-0 bottom-0 flex flex-col bg-rgray-900 bg-opacity-25"
                    + " transform transition-transform origin-top"
                }
                classList={{
                    'scale-y-0': expandControls(),
                    'scale-y-100': !expandControls(),
                }}
            >
                <div
                    class="h-1 w-full relative bg-rgray-100 bg-opacity-50"
                >
                    <Index each={buffered()}>{(item, i) => (
                        <div class="absolute h-full bg-rgray-500 bg-opacity-75" style={{
                            'width': (item().end - item().start) / maxTime() * 100 + "%",
                            'left': item().start / maxTime() * 100 + "%",
                        }}></div>
                    )}</Index>
                    <div class="absolute h-full bg-rgray-700" style={{
                        'width': (currentTime() / maxTime() * 100) + "%",
                    }}></div>
                </div>
            </div>
            <div
                class={
                    "absolute left-0 right-0 flex flex-col bg-rgray-900 bottom-0"
                    + " bg-opacity-25 transform transition-transform origin-bottom"
                }
                classList={{
                    'scale-y-0': !expandControls(),
                    'scale-y-100': expandControls(),
                }}
            >
                <div
                    class="h-1 w-full relative bg-rgray-100 bg-opacity-50 h-2"
                >
                    <Index each={buffered()}>{(item, i) => (
                        <div class="absolute h-full bg-rgray-500 bg-opacity-75" style={{
                            'width': (item().end - item().start) / maxTime() * 100 + "%",
                            'left': item().start / maxTime() * 100 + "%",
                        }}></div>
                    )}</Index>
                    <div class="absolute h-full bg-rgray-700" style={{
                        'width': (currentTime() / maxTime() * 100) + "%",
                    }}></div>
                </div>
                <div
                    class="flex transform transition-transform origin-bottom"
                >
                    <button class="block" onclick={() => {
                        if(video_el.paused) {
                            void video_el.play();
                        }else{
                            video_el.pause();
                        }
                    }}>
                        <Icon size="icon-sm" icon={
                            playing() === false ? {
                                class: "icon-play-button",
                                label: "Play",
                            } : playing() === true ? {
                                class: "icon-play-pause",
                                label: "Pause",
                            } : {
                                class: "icon-loadbar",
                                label: "Loading",
                            }
                        } />
                    </button>
                    <div class="flex-grow"></div>
                    <div>{timeSecToString(currentTime())} / {timeSecToString(maxTime())}</div>
                </div>
            </div>
        </div>
        <div class="flex">
            <For each={[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]}>{speed => (
                <button
                    class={link_styles_v["outlined-button"]}
                    disabled={playbackRate() === speed}
                    on:click={() => setPlaybackRate(speed)}
                >{speed}×</button>
            )}</For>
        </div>
        <div class="flex">
            Quality: {quality() == null ? "Loading" : quality()!.w+"×"+quality()!.h}
            <For each={qualities()}>{(qual, i) => (
                <button
                    class={link_styles_v["outlined-button"]}
                    disabled={targetQuality() === i()}
                    on:click={() => setTargetQuality(qual.index)}
                >{qual.name}</button>
            )}</For>
        </div>
    </div>;
}

export default function PreviewVideo(props: {
    video: Generic.Video,
    autoplay: boolean,
}): JSX.Element {
    return <div>
        <ShowCond when={props.video.caption}>{caption => (
            <div>Caption: {caption}</div>
        )}</ShowCond>
        <SwitchKind item={props.video.source}>{{
            video: video => <PreviewRealVideo video={props.video} source={video} autoplay={props.autoplay} />,
            img: img => <SolidToVanillaBoundary getValue={(hsc, client) => {
                const content = el("div");
                zoomableImage(img.url, {w: props.video.w, h: props.video.h, alt: props.video.alt}).adto(content);
                return content;
            }} />,
            m3u8: m3u8 => <SolidToVanillaBoundary getValue={(hsc, client) => {
                const srcurl = m3u8.url;
                const poster = m3u8.poster;
                return fetchPromiseThen(import("./video"), vidplayer => {
                    const cframe = el("div");
                    const shsc = hideshow(cframe);
                    vidplayer.playM3U8(srcurl, poster, {autoplay: props.autoplay}).defer(shsc).adto(cframe);
                    return shsc;
                }).defer(hsc);
            }}/>,
        }}</SwitchKind>
    </div>;
}