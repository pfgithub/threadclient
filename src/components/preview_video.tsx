import { createEffect, createSignal, For, Index, JSX, on, onCleanup, onMount } from "solid-js";
import { fetchPromiseThen, hideshow, link_styles_v, zoomableImage } from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { classes, getIsVisible, getSettings, Icon, ShowCond, SwitchKind } from "../util/utils_solid";
import type shaka_types from "shaka-player";
import { createStore, produce, SetStoreFunction, Store } from "solid-js/store";

function timeSecToString(time: number): string {
    const hours = time / 60 / 60 |0;
    const minutes = (time / 60 |0) % 60;
    const seconds = (time |0) % 60;
    return (hours ? hours.toString().padStart(2, "0") + ":" : "")
        + minutes.toString().padStart(hours ? 2 : 1, "0") + ":"
        + seconds.toString().padStart(2, "0")
    ;
}

function debugVideo(video_el: HTMLMediaElement) {
    if(true as false) return;
    const video_event_types: (keyof HTMLMediaElementEventMap)[] = [
        "encrypted", "waitingforkey", "fullscreenchange", "fullscreenerror",
        "abort", "animationcancel", "animationend", "animationiteration",
        "animationstart", "auxclick", "beforeinput", "blur", "cancel",
        "canplay", "canplaythrough", "change", "click", "close",
        "compositionend", "compositionstart", "compositionupdate",
        "contextmenu", "cuechange", "dblclick", "drag", "dragend",
        "dragenter", "dragexit", "dragleave", "dragover",
        "dragstart", "drop", "durationchange", "emptied", "ended",
        "error", "focus", "focusin", "focusout", "gotpointercapture",
        "input", "invalid", "keydown", "keypress", "keyup", "load",
        "loadeddata", "loadedmetadata", "loadstart", "lostpointercapture",
        "mousedown", "mouseenter", "mouseleave", "mousemove", "mouseout",
        "mouseover", "mouseup", "pause", "play", "playing", "pointercancel",
        "pointerdown", "pointerenter", "pointerleave", "pointermove",
        "pointerout", "pointerover", "pointerup", "progress", "ratechange",
        "reset", "resize", "scroll", "securitypolicyviolation", "seeked",
        "seeking", "select", "selectionchange", "selectstart", "stalled",
        "submit", "suspend", "timeupdate", "toggle", "touchcancel",
        "touchend", "touchmove", "touchstart", "transitioncancel",
        "transitionend", "transitionrun", "transitionstart", "volumechange",
        "waiting", "wheel", "copy", "cut", "paste",
    ];
    for(const video_ev of video_event_types) {
        video_el.addEventListener(video_ev, e => {
            console.log("video on"+video_ev, e);
        });
    }
}

let shaka_initialized = false;
function initShaka(shaka: typeof shaka_types): void {
    if(shaka_initialized) return;

    shaka.polyfill.installAll();

    // Check to see if the browser supports the basic APIs Shaka needs.
    if (!shaka.Player.isBrowserSupported()) {
        throw new Error("Shaka player is not supported");
    }

    shaka_initialized = true;
}

function NativeVideoElement(props: {
    state: Store<VideoState>,
    setState: SetStoreFunction<VideoState>,
    videoRef: (v: VideoRef) => void,

    video: Generic.Video,
    source: Generic.VideoSourceVideo,
    sources: VideoSourceI[],
    autoplay: boolean,
}): JSX.Element {
    let video_el!: HTMLVideoElement;

    let shaka_player: shaka_types.Player | undefined = undefined;
    const initShakaPlayer = async (): Promise<shaka_types.Player> => {
        if(shaka_player) return shaka_player;
        const {default: shaka} = await import("shaka-player");
        initShaka(shaka);
        shaka_player = new shaka.Player();
        shaka_player.addEventListener("error", e => {
            console.log("Error!", e);
            props.setState("error_overlay", "An error occured. Check console.");
        });
        return shaka_player;
    };

    onMount(() => {
        debugVideo(video_el);

        props.videoRef({
            play: () => void video_el.play(),
            pause: () => video_el.pause(),
            setPlaybackRate: target => {
                video_el.playbackRate = target;
                updateProgress();
            },
            seek: target => {
                video_el.currentTime = target;
                updateProgress();
            },
            reload: () => {
                reloadVideo(video_el.currentTime);
            },
        });

        createEffect(on([() => props.source], () => {
            reloadVideo(0);
        }, {defer: true}));

        const reloadVideo = (start_time: number) => {
            // TODO fix race condition when reloading
            // the video while a reload is already occuring
            (async () => {
                console.log("Reloading Video", start_time);
                let res_error = new Error("No sources");
                for(const source of props.sources) {
                    try {
                        if(shaka_player) await shaka_player.detach();
                        video_el.src = "";
                        video_el.onerror = () => {/**/};
                        video_el.onload = () => {/**/};
                        // shaka requires cors access to videos the browser supports eg .mp4, so
                        // it cannot be used to play mp4 videos.
                        // TODO: don't load shaka at all if it's not required.
                        if(source.url.endsWith(".m3u8") || source.url.endsWith(".mpd")) {
                            const player = await initShakaPlayer();
                            props.setState("playing", "loading");
                            await player.attach(video_el);
                            console.log("trying to load", source.url);
                            await player.load(source.url, start_time);
                        }else{
                            await new Promise<void>((r, re) => {
                                video_el.onerror = (e) => {
                                    console.log(e);
                                    res_error = new Error("error " + e);
                                    props.setState("errored_sources", s => ({...s, [source.i]: true}));
                                    re(res_error);
                                };
                                video_el.onload = () => {
                                    r();
                                };
                                video_el.src = source.url;
                                video_el.load();
                            });
                        }
                        return;
                    }catch(e) {
                        res_error = e as Error;
                        props.setState("errored_sources", s => ({...s, [source.i]: true}));
                    }
                }
                throw res_error;
            })().then(() => {
                console.log("Player loaded");
            }).catch((e: Error) => {
                console.log(e);
                props.setState("error_overlay", e.stack ?? e.toString());
                // TODO try other sources
            });
        };
        reloadVideo(0);

        onCleanup(() => {
            if(shaka_player) shaka_player.destroy().then(() => {
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
        props.setState(produce<VideoState>(s => {
            s.current_time = video_el.currentTime;
            s.buffered = bufres;
            s.max_time = video_el.duration;
            s.playing = (
                (video_el.paused || video_el.ended) ? (
                    false
                ) : (video_el.readyState < video_el.HAVE_FUTURE_DATA || video_el.currentTime === 0) ? (
                    "loading"
                ) : true
            );
            s.quality = video_el.videoWidth === 0 ? null : {
                w: video_el.videoWidth,
                h: video_el.videoHeight,
            };
            if(video_el.playbackRate !== 0) s.playback_rate = video_el.playbackRate;
        }));
        
        if(video_el.error) props.setState("error_overlay", video_el.error.message);
        else if(video_el.networkState === video_el.NETWORK_NO_SOURCE) {
            props.setState("error_overlay", "Video could not be loaded.");
        } else props.setState("error_overlay", null);
    };

    const settings = getSettings();

    return <video
        ref={video_el}
        controls={settings.custom_video_controls.value() === "browser"}
        class="max-h-inherit max-w-inherit"
        autoplay={props.autoplay}
        width={props.video.w}
        height={props.video.h}
        loop={props.video.gifv}

        poster={props.source.thumbnail}
        onplay={() => {
            updateProgress();
        }}
        onplaying={() => {
            updateProgress();
        }}
        onratechange={() => {
            updateProgress();
        }}
        onvolumechange={() => {
            updateProgress();
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
            updateProgress();
        }}
        onwaiting={() => {
            updateProgress();
        }}
        onstalled={() => {
            updateProgress();
        }}
        onloadedmetadata={() => {
            updateProgress();
        }}
        onloadeddata={() => {
            updateProgress();
        }}
        onemptied={() => {
            updateProgress();
        }}
        oncapture:error={(e) => {
            updateProgress();
        }}
    >
        <span>{
            props.video.alt ?? "Your device does not support video, and alt text was not supplied."
        }</span>
    </video>;
}

type VideoState = {
    max_time: number, // 0 | "loading"?
    current_time: number,
    quality: {w: number, h: number} | null,
    buffered: BufferNode[],
    playing: boolean | "loading",
    error_overlay: string | null,
    errored_sources: {[key: number]: boolean},
    playback_rate: number,
};
type VideoRef = {
    play(): void,
    pause(): void,
    setPlaybackRate(rate: number): void,
    seek(target: number): void,
    reload(): void,
};

type VideoSourceI = {i: number, url: string, quality?: string};
type BufferNode = {start: number, end: number};
function PreviewRealVideo(props: {
    video: Generic.Video,
    source: Generic.VideoSourceVideo,
    autoplay: boolean,
}): JSX.Element {
    const [targetQuality, setTargetQuality] = createSignal(0);

    let video_ref!: VideoRef;
    const [state, setState] = createStore<VideoState>({
        max_time: 0,
        current_time: 0,
        quality: null,
        buffered: [],
        playing: "loading",
        error_overlay: null,
        errored_sources: {},
        playback_rate: 1,
    });

    const [expandControlsRaw, setExpandControls] = createSignal(false);
    const [hoveringPercent, setHoveringPercent] = createSignal<number | null>(null);

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

    const sources = (): VideoSourceI[] => {
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
            if(state.errored_sources[i] === true) continue;
            res.set(source.quality ?? "Unknown", {index: i});
        }
        return [...res.entries()].map(([n, v]) => ({name: n, ...v}));
    };

    const isVisible = getIsVisible();
    createEffect(() => {
        if(!isVisible()) {
            video_ref.pause();
        }
    });
    const showOverlay = () => {
        return settings.custom_video_controls.value() === "custom"
        && (state.playing !== true || expandControls());
    };

    // todo support dragging left and right to seek
    return <div class="handles-clicks">
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
            <NativeVideoElement
                state={state}
                setState={setState}
                videoRef={v => video_ref = v}

                video={props.video}
                source={props.source}
                sources={sources()}
                autoplay={props.autoplay}
            />
            <div
                class={classes(
                    "absolute top-0 left-0 bottom-0 right-0 items-center justify-center flex",
                    "transform transition",
                    showOverlay() ? "scale-100 opacity-100" : "scale-0 opacity-0",
                )}
            >
                <button
                    class="block transform scale-200 hover:scale-300 transition-transform"
                    onclick={() => {
                        if(state.playing === false) {
                            video_ref.play();
                        }else{
                            video_ref.pause();
                        }
                    }}
                    style={{
                        'filter': "drop-shadow(0 0 5px rgba(0, 0, 0, 0.5))",
                    }}
                >
                    <Icon size="icon-sm" icon={
                        state.playing === false ? {
                            class: "icon-play-button",
                            label: "Play",
                        } : state.playing === true ? {
                            class: "icon-play-pause",
                            label: "Pause",
                        } : {
                            class: "icon-spinner-alt",
                            label: "Loading",
                        }
                    } />
                </button>
            </div>
            <ShowCond when={state.error_overlay}>{overlay => (
                <div
                    class={classes(
                        "absolute top-0 left-0 bottom-0 right-0 p-4 bg-rgray-900 bg-opacity-75",
                    )}
                    style={{display: settings.custom_video_controls.value() === "custom" ? "block" : "none"}}
                >
                    <p>Error! {overlay}</p>
                </div>
            )}</ShowCond>
            <div
                class={classes(
                    "absolute left-0 right-0 bottom-0",
                    "flex flex-col",
                    "bg-rgray-900 bg-opacity-25",
                    "transform transition-transform origin-top",
                    expandControls() ? "scale-y-0" : "scale-y-100",
                )}
            >
                <div
                    class="h-1 w-full relative bg-rgray-100 bg-opacity-50"
                >
                    <Index each={state.buffered}>{(item, i) => (
                        <div class="absolute h-full bg-rgray-500 bg-opacity-75" style={{
                            'width': (item().end - item().start) / state.max_time * 100 + "%",
                            'left': item().start / state.max_time * 100 + "%",
                        }}></div>
                    )}</Index>
                    <div class="absolute h-full bg-rgray-700" style={{
                        'width': (state.current_time / state.max_time * 100) + "%",
                    }}></div>
                </div>
            </div>
            <div
                class={classes(
                    "absolute left-0 right-0 bottom-0",
                    "flex flex-col",
                    "bg-rgray-900 bg-opacity-25",
                    "transform transition-transform origin-bottom",
                    expandControls() ? "scale-y-100" : "scale-y-0",
                )}
            >
                <div
                    class={classes(
                        "w-full h-2",
                        "relative",
                        "bg-rgray-100 bg-opacity-50",
                        "transform transition-transform origin-bottom",
                        hoveringPercent() != null ? "scale-y-150" : "",
                    )}
                    onmousemove={e => {
                        const size = e.currentTarget.getBoundingClientRect();
                        setHoveringPercent((e.clientX - size.left) / size.width);
                    }}
                    onmouseleave={() => {
                        setHoveringPercent(null);
                    }}
                    onmouseup={e => {
                        const size = e.currentTarget.getBoundingClientRect();
                        const progress = (e.clientX - size.left) / size.width;
                        // TODO only if the mouse down started on this element
                        video_ref.seek(progress * state.max_time);
                    }}
                >
                    <Index each={state.buffered}>{(item, i) => (
                        <div class="absolute h-full bg-rgray-500 bg-opacity-75" style={{
                            'width': (item().end - item().start) / state.max_time * 100 + "%",
                            'left': item().start / state.max_time * 100 + "%",
                        }}></div>
                    )}</Index>
                    <div class="absolute h-full bg-rgray-700" style={{
                        'width': (state.current_time / state.max_time * 100) + "%",
                    }}></div>
                    <ShowCond when={hoveringPercent()}>{hover_progress => (
                        <div class="absolute h-full bg-rgray-900 bg-opacity-50" style={{
                            'width': (hover_progress * 100) + "%",
                        }}></div>
                    )}</ShowCond>
                </div>
                <div
                    class="flex transform transition-transform origin-bottom"
                >
                    <button class="block" onclick={() => {
                        if(state.playing === false) {
                            video_ref.play();
                        }else{
                            video_ref.pause();
                        }
                    }}>
                        <Icon size="icon-sm" icon={
                            state.playing === false ? {
                                class: "icon-play-button",
                                label: "Play",
                            } : state.playing === true ? {
                                class: "icon-play-pause",
                                label: "Pause",
                            } : {
                                class: "icon-loadbar",
                                label: "Loading",
                            }
                        } />
                    </button>
                    <div class="flex-grow"></div>
                    <div>{timeSecToString(state.current_time)} / {timeSecToString(state.max_time)}</div>
                </div>
            </div>
        </div>
        <div class="flex">
            <For each={[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]}>{speed => (
                <button
                    class={link_styles_v["outlined-button"]}
                    disabled={state.playback_rate === speed}
                    on:click={() => video_ref.setPlaybackRate(speed)}
                >{speed}×</button>
            )}</For>
        </div>
        <div class="flex">
            Quality: {state.quality == null ? "Loading" : state.quality.w+"×"+state.quality.h}
            <For each={qualities()}>{(qual, i) => (
                <button
                    class={link_styles_v["outlined-button"]}
                    disabled={targetQuality() === i()}
                    on:click={() => {
                        setTargetQuality(qual.index);
                        video_ref.reload();
                    }}
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