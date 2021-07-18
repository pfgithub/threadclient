import { createEffect, createMemo, createSignal, ErrorBoundary, For, JSX, Match, onCleanup, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import {
    clientContent, elButton, link_styles_v, navbar, renderBody, timeAgoText,
    unsafeLinkToSafeLink, LinkStyle, navigate, isModifiedEvent, previewLink, renderAction
} from "../app";
import type * as Generic from "../types/generic";
import { getClient, getIsVisible, HideshowProvider, kindIs, ShowBool, ShowCond, SwitchKind } from "../util/utils_solid";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { getRandomColor, rgbToString, seededRandom } from "../darken_color";
import React from "react";
export * from "../util/interop_solid";

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
        <ShowCond when={props.source.seperate_audio_track}>{audio_track =>
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
                <For each={audio_track}>{track =>
                    <source src={track.url} type={track.type} />
                }</For>
            </audio>
        }</ShowCond>
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
                if(audio_el) audio_el.play();
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
            <For each={props.source.sources}>{source =>
                <source src={source.url} type={source.type} />
            }</For>
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
    return <SwitchKind item={props.video.source}>{{
        video: video => <PreviewRealVideo video={props.video} source={video} autoplay={props.autoplay} />,
        img: img => <>TODO</>,
        m3u8: m3u8 => <>TODO</>,
    }}</SwitchKind>;
}