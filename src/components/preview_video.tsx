import { createEffect, createSignal, For, Index, JSX, on } from "solid-js";
import { fetchPromiseThen, hideshow, link_styles_v, zoomableImage } from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { getIsVisible, getSettings, ShowCond, SwitchKind } from "../util/utils_solid";

const speaker_icons = {
    mute: "🔇",
    low: "🔈",
    high: "🔊",
};
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

type BufferNode = {start: number, end: number};
function PreviewRealVideo(props: {
    video: Generic.Video,
    source: Generic.VideoSourceVideo,
    autoplay: boolean,
}): JSX.Element {
    let video_el!: HTMLVideoElement;
    const [hasSeperateAudio, setHasSeperateAudio] = createSignal<HTMLAudioElement | undefined>();
    const [audioVolume, setAudioVolume] = createSignal(0);
    const [audioMuted, setAudioMuted] = createSignal(false);
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

    createEffect(on([() => props.source], () => {
        setTargetQuality(0);
        setErroredSources({});
        previous_time = video_el.currentTime;
        video_el.load();
    }));

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

    let previous_time: number | null = null;
    createEffect(() => {
        targetQuality();
        setTimeout(() => {
            previous_time = video_el.currentTime;
            video_el.load();
        }, 0);
    });

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
            res.set(source.quality, {index: i});
        }
        return [...res.entries()].map(([n, v]) => ({name: n, ...v}));
    };

    const sync = () => {
        const audio_el = hasSeperateAudio();
        if(audio_el) {
            audio_el.currentTime = video_el.currentTime;
            audio_el.playbackRate = video_el.playbackRate;
        }
    };

    const isVisible = getIsVisible();
    createEffect(() => {
        if(!isVisible()) {
            video_el.pause();
            sync();
        }
    });
    createEffect(() => {
        video_el.playbackRate = playbackRate();
        sync();
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
        <ShowCond when={props.source.seperate_audio_track}>{audio_track => (
            <audio
                onloadedmetadata={(e) => {
                    setAudioVolume(e.currentTarget.volume);
                    setHasSeperateAudio(e.currentTarget);
                }}
                ref={audio_el => createEffect(() => {
                    if(!hasSeperateAudio()) {
                        return;
                    }
                    audio_el.muted = audioMuted();
                    audio_el.volume = audioVolume();
                })}
            >
                <For each={audio_track}>{track => (
                    <source src={track.url} type={track.type} />
                )}</For>
            </audio>
        )}</ShowCond>
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
                    sync();
                    setPlaying("loading");
                }}
                onplaying={() => {
                    setPlaying(video_el.paused ? false : true);
                    const audio_el = hasSeperateAudio();
                    if(audio_el) void audio_el.play();
                }}
                onratechange={() => {
                    // TODO update playbackRate
                    sync();
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
                onseeking={() => sync()}
                ontimeupdate={() => {
                    updateProgress();
                    const audio_el = hasSeperateAudio();
                    if(audio_el) {
                        if(!audio_el.paused) return;
                        sync();
                    }
                }}
                onpause={() => {
                    setPlaying(false);
                    const audio_el = hasSeperateAudio();
                    if(audio_el) audio_el.pause();
                    sync();
                }}
                onwaiting={() => {
                    setPlaying("loading");
                    const audio_el = hasSeperateAudio();
                    if(audio_el) audio_el.pause();
                    sync();
                }}
                onstalled={() => {
                    setPlaying("loading");
                    const audio_el = hasSeperateAudio();
                    if(audio_el) audio_el.pause();
                    sync();
                }}
                onloadedmetadata={() => {
                    if(previous_time != null) video_el.currentTime = previous_time;
                    setQuality({w: video_el.videoWidth, h: video_el.videoHeight});
                    setMaxTime(video_el.duration);
                    // todo remove quality options based on currentsrc vs what the expected value is from qualitites()
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
                <Index each={sources()}>{source => (
                    <source
                        src={source().url}
                        type={source().type}
                        onerror={(e) => {
                            console.log("Source failed load", e);
                            setErroredSources(es => ({...es, [source().i]: true}));
                        }}
                    />
                )}</Index>
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
        <ShowCond when={hasSeperateAudio()}>{audio_el => <div class="flex">
            <button
                class={link_styles_v["outlined-button"]}
                onclick={() => {
                    setAudioMuted(!audioMuted());
                }}
            >
                {(() => {
                    if(audioMuted()) {
                        return speaker_icons.mute;
                    }else if(audioVolume() < 0.2) {
                        return speaker_icons.low;
                    }else return speaker_icons.high;
                })()}
            </button>
            <input
                ref={slider => createEffect(() => {
                    if(audioMuted()) slider.value = "0";
                    else slider.value = "" + (audioVolume() * 100);
                })}
                type="range" min="0" max="100" value="100"
                oninput={e => {
                    setAudioVolume(+e.currentTarget.value / 100);
                    setAudioMuted(false);
                }}
            />
        </div>}</ShowCond>
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

export function PreviewVideo(props: {
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