import { createEffect, createMemo, createSignal, ErrorBoundary, For, JSX, Match, onCleanup, Switch } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import {
    clientContent, elButton, link_styles_v, navbar, renderBody, timeAgoText,
    unsafeLinkToSafeLink, LinkStyle, navigate, isModifiedEvent, previewLink, renderAction, zoomableImage, fetchPromiseThen, hideshow
} from "../app";
import type * as Generic from "../types/generic";
import { getClient, getIsVisible, HideshowProvider, kindIs, ShowBool, ShowCond, SwitchKind } from "../util/utils_solid";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { getRandomColor, rgbToString, seededRandom } from "../darken_color";
import React from "react";
import { LinkButton } from "./author_pfp_solid";

export function Homepage(props: {_?: undefined}): JSX.Element {
    return <div class="flex justify-center flex-row">
        <div class="w-full max-w-prose">
            <div class="bg-white p-5 sm:m-5 sm:p-10 shadow sm:rounded-xl">
                <h1 class="text-3xl sm:text-5xl font-black">ThreadReader</h1>
                <h2 class="text-base font-light text-gray-800 dark:text-gray-500">A client for Reddit and Mastodon</h2>
                <div class="mt-10"></div>
                <p>Try for <LinkButton href="/reddit" style="normal">Reddit</LinkButton></p>
                <p>Try for <LinkButton href="/mastodon" style="normal">Mastodon</LinkButton></p>
                <div class="mt-10"></div>
                <p class="text-gray-800 dark:text-gray-500">
                    <LinkButton href="/settings" style="action-button">Settings</LinkButton> ·{" "}
                    <LinkButton href="https://github.com/pfgithub/threadclient" style="action-button">Github</LinkButton> ·{" "}
                    <LinkButton href="https://github.com/pfgithub/threadclient/blob/main/privacy.md" style="action-button">Privacy</LinkButton>
                </p>
                <div class="mt-2"></div>
            </div>
        </div>
    </div>;
}