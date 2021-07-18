import React from "react";
import { createEffect, createSignal, For, JSX } from "solid-js";
import { fetchPromiseThen, hideshow, link_styles_v, zoomableImage } from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { getIsVisible, ShowCond, SwitchKind } from "../util/utils_solid";

const speaker_icons = {
    mute: "🔇",
    low: "🔈",
    high: "🔊",
};
function PreviewRealVideo(props: {
    video: Generic.Video,
    source: Generic.VideoSourceVideo,
    autoplay: boolean,
}): JSX.Element {
    let video_el!: HTMLVideoElement;
    const [hasSeperateAudio, setHasSeperateAudio] = createSignal<HTMLAudioElement | undefined>();
    const [audioVolume, setAudioVolume] = createSignal(0);
    const [audioMuted, setAudioMuted] = createSignal(false);

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
        <video
            ref={video_el}
            controls={true}
            class="preview-image"
            autoplay={props.autoplay}
            width={props.video.w}
            height={props.video.h}

            onplay={() => {sync()}}
            onplaying={() => {
                const audio_el = hasSeperateAudio();
                if(audio_el) void audio_el.play();
            }}
            onseeking={() => sync()}
            ontimeupdate={() => {
                if(!video_el.paused) return;
                sync();
            }}
            onpause={() => {
                const audio_el = hasSeperateAudio();
                if(audio_el) audio_el.pause();
                sync();
            }}

        >
            <span>{
                props.video.alt ?? "Your device does not support video, and alt text was not supplied."
            }</span>
            <For each={props.source.sources}>{source => (
                <source src={source.url} type={source.type} />
            )}</For>
        </video>
        <ShowCond when={hasSeperateAudio()}>{audio_el => <div class="flex">
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => {
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