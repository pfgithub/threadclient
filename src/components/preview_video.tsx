import { createEffect, createSignal, For, Index, JSX, on, onCleanup, onMount } from "solid-js";
import { link_styles_v, zoomableImage } from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { classes, getIsVisible, getSettings, Icon, ShowCond, SwitchKind } from "../util/utils_solid";
import type shaka_types from "shaka-player";
import { createStore, produce, SetStoreFunction, Store } from "solid-js/store";
import { Portal } from "solid-js/web";

// Note, on firefox some rpan vods fail to play. Example:
// https://shaka-player-demo.appspot.com/demo/#audiolang=en-US;textlang=en-US;uilang=en-US;asset=
//   https://watch.redd.it/hls/4fbb0f02-356f-414e-90e9-f5f7cf2b6902/index.m3u8;panel=CUSTOM%20CONTENT;build=debug_compiled

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
async function initShaka(shaka: typeof shaka_types): Promise<void> {
    if(!(window.muxjs as undefined | {_?: undefined})) window.muxjs = (await import("mux.js")).default;

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
    custom_controls: boolean,
}): JSX.Element {
    let video_el!: HTMLVideoElement;

    let shaka_player: shaka_types.Player | undefined = undefined;
    const initShakaPlayer = async (): Promise<shaka_types.Player> => {
        if(shaka_player) return shaka_player;
        const {default: shaka} = await import("shaka-player");
        await initShaka(shaka);
        shaka_player = new shaka.Player();
        console.log(shaka_player.getConfiguration());
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
                if(shaka_player && shaka_player.isLive()) {
                    video_el.currentTime = target + shaka_player.seekRange().start;
                }else{
                    video_el.currentTime = target;
                }
                updateProgress();
            },
            reload: () => {
                reloadVideo(video_el.currentTime);
            },
            goToLive() {
                if(shaka_player && shaka_player.isLive()) {
                    shaka_player.goToLive(); // just sets currentTime to the end of the seekable range
                }
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
                        video_el.onloadedmetadata = () => {/**/};
                        // shaka requires cors access to videos the browser supports eg .mp4, so
                        // it cannot be used to play mp4 videos.
                        // TODO: don't load shaka at all if it's not required.
                        if(source.url.endsWith(".m3u8") || source.url.endsWith(".mpd")) {
                            const player = await initShakaPlayer();
                            props.setState("playing", "loading");
                            await player.attach(video_el);
                            console.log("trying to load", source.url);
                            await player.load(source.url, start_time);
                            if(player.isLive()) {
                                player.goToLive();
                            }
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
                                video_el.onloadedmetadata = () => {
                                    video_el.currentTime = start_time;
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
            console.log(shaka_player?.seekRange());
            if(shaka_player && shaka_player.isLive()) {
                const seek_range = shaka_player.seekRange();
                s.current_time = video_el.currentTime - seek_range.start;
                s.max_time = seek_range.end - seek_range.start;
                s.live = {
                    start: shaka_player.getPresentationStartTimeAsDate()!.getTime(),
                    current: shaka_player.getPlayheadTimeAsDate()!.getTime(),
                };
                s.buffered = bufres.map(i => ({
                    start: i.start - seek_range.start,
                    end: i.end - seek_range.start,
                }));
            }else{
                s.current_time = video_el.currentTime;
                s.max_time = video_el.duration;
                s.live = null;
                s.buffered = bufres;
            }
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

    return <video
        ref={video_el}
        controls={!props.custom_controls}
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
        ondurationchange={() => {
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

// function YoutubeVideoElement(props: {
//     state: Store<VideoState>,
//     setState: SetStoreFunction<VideoState>,
//     videoRef: (v: VideoRef) => void,

//     video: Generic.Video,
//     source: Generic.VideoSourceVideo,
//     sources: VideoSourceI[],
//     autoplay: boolean,
//     custom_controls: boolean,
// }): JSX.Element {
//     // https://stackoverflow.com/a/62183919
//     // there's a hack you can do with yt videos in frames
//     // TODO:
//     // - &controls=0
//     // - &disablekb=1
//     // - &enablejsapi=1
//     // - &playsinline=1 :: for ios
//     // - &loop={props.source.gifv}
//     // relevant docs:
//     // - https://developers.google.com/youtube/player_parameters
//     // - https://developers.google.com/youtube/iframe_api_reference
//     // TODO: after the video has finished playing, hide it to
//     //       prevent showing related videos
//     //       (onstatechange will tell you if the video is ended
//     //        or a new video is queued and you can cancel it somehow)
//     // notes:
//     // - setting video quality manually is not supported
//     onMount(() => {
//         // props.videoRef({

//         // });
//     });
//     // ok this is a fun idea and I might do it
//     // but also I'd probably rather view yt videos directly on the site
//     // than in a custom player here.
//     return <div></div>
// }

type VideoState = {
    max_time: number, // 0 | "loading"?
    current_time: number,
    quality: {w: number, h: number} | null,
    buffered: BufferNode[],
    playing: boolean | "loading",
    error_overlay: string | null,
    errored_sources: {[key: number]: boolean},
    playback_rate: number,
    live: {
        start: number,
        current: number,
    } | null,
};
type VideoRef = {
    play(): void,
    pause(): void,
    setPlaybackRate(rate: number): void,
    seek(target: number): void,
    reload(): void,
    goToLive(): void,
};

type SeekState = {
    seeking: boolean, // when clicking and dragging, this is true. just hovering, it's false
    percent: number, // 0..1
    preview: [x: number, y: number],
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
        live: null,
    });

    const [expandControlsRaw, setExpandControls] = createSignal(false);
    const [seek, setSeek] = createSignal<SeekState | null>(null);

    const settings = getSettings();

    const customControls = () => {
        return settings.custom_video_controls.value() === "custom" || !!state.live;
    };

    const expandControls = () => {
        if(!customControls()) return false;
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
        return customControls()
        && (state.playing !== true || expandControls());
    };

    // todo support dragging left and right to seek
    return <div class="handles-clicks">
        <Portal mount={document.body}>
            <div
                class="absolute pointer-events-none transition-opacity"
                ontransitionend={(e) => {
                    if(!seek()) {
                        e.currentTarget.style.visibility = "hidden";
                    }
                }}
                ref={container => {
                    createEffect(() => {
                        const hp = seek();
                        if(hp) {
                            container.style.top = hp.preview[1] + "px";
                            container.style.left = hp.preview[0] + "px";
                            container.style.visibility = "visible";
                        }
                        container.style.opacity = hp ? "1" : "0";
                    });
                }}
            >
                <ShowCond when={props.source.preview}>{preview_sources => (
                    <video
                        ref={video_el => {
                            createEffect(() => {
                                const hp = seek();
                                const v_len = video_el.duration;
                                if(hp && v_len) {
                                    video_el.currentTime = hp.percent * v_len;
                                }
                            });
                        }}
                    >
                        <For each={preview_sources}>{preview_source => (
                            <source src={preview_source.url} />
                        )}</For>
                    </video>
                )}</ShowCond>
                <div ref={div => {
                    createEffect(() => {
                        const hp = seek();
                        if(hp) {
                            div.textContent = timeSecToString(hp.percent * state.max_time);
                        }
                    });
                }} />
            </div>
        </Portal>
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
                custom_controls={customControls()}
            />
            <ShowCond when={state.error_overlay}>{overlay => (
                <div
                    class={classes(
                        "absolute top-0 left-0 bottom-0 right-0 p-4 bg-rgray-900 bg-opacity-75",
                    )}
                    style={{display: customControls() ? "block" : "none"}}
                >
                    <p>Error! {overlay}</p>
                </div>
            )}</ShowCond>
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
                        seek() != null ? "scale-y-150" : "",
                    )}
                    onmousemove={e => {
                        const size = e.currentTarget.getBoundingClientRect();
                        setSeek({
                            seeking: false,
                            percent: (e.clientX - size.left) / size.width,
                            preview: [e.pageX + document.body.scrollLeft, e.pageY + document.body.scrollTop],
                        });
                    }}
                    onmouseleave={() => {
                        setSeek(null);
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
                    <ShowCond when={seek()}>{seek_state => (
                        <div class="absolute h-full bg-rgray-900 bg-opacity-50" style={{
                            'width': (seek_state.percent * 100) + "%",
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
                    <div class={classes(
                        state.live ? "hover:cursor-pointer" : "",
                    )} onclick={() => {
                        if(state.live) {
                            video_ref.goToLive();
                        }
                    }}>{
                        state.live ? (
                            // Consider "LIVE" when less than 1 second behind the live-edge.
                            // https://shaka-player-demo.appspot.com/docs/api/ui_presentation_time.js.html
                            // (using 2 because 1 occasionally ticked to not showing as live anymore)
                            state.current_time + 2 > state.max_time ? (
                                timeSecToString((Date.now() - state.live.current) / 1000)+" delay"
                            ) : (
                                timeSecToString((state.live.current - state.live.start) / 1000) + " / " +
                                "Live"
                            )
                        ) : (
                            timeSecToString(state.current_time) + " / " + timeSecToString(state.max_time)
                        )
                    }</div>
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
        }}</SwitchKind>
    </div>;
}