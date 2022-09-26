import * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import ActionButtonCTA from "./ActionButtonCTA";
import { Body } from "./body";
import Pfp from "./Pfp";
import { ClientPostOpts } from "./Post";
import proxyURL from "./proxy_url";

// note: hmr breaks as soon as your component has to call that getCounterState thing

/*

- banner
- icon, title. grid overlap banner.
- 

*/

export default function Header(props: {
    header: Generic.FilledIdentityCard,
    opts: ClientPostOpts,
}): JSX.Element {
    // we have to un-indent
    // do we just do negative margin?
    // - that might overlap other objects
    //   - negative margin but only if it's the flat top/bottom?
    return <div class="flex flex-col gap-4 p-2">
        <div class="h-56 -mx-4 -mt-4 relative">
            <div class="absolute w-full h-full">
                <Banner banner={props.header.theme.banner} />
            </div>
            <div class="absolute w-full h-full bg-gradient-to-b from-transparent via-transparent" style={{
                '--tw-gradient-to': "rgb(0 0 0 / 0.75)",
            }}></div>
            <div class="h-full relative flex flex-row flex-wrap gap-4 px-4 pb-4 items-end">
                <Show when={props.header.pfp}>{pfp => (
                    <Pfp class="w-20 h-20" pfp={pfp} />
                )}</Show>
                <div class="text-slate-50 dark:text-zinc-50">
                    <div class="font-bold">{props.header.names.display ?? ""}</div>
                    <div class="text-slate-300 dark:text-zinc-300">{props.header.names.raw}</div>
                </div>
            </div>
        </div>
        <div class="flex flex-col gap-2">
            <div class="flex flex-col gap-2">
                <Show when={props.header.actions.main_counter}>{main_counter => (
                    <ActionButtonCTA action={main_counter} />
                )}</Show>
                <Body body={props.header.description ?? {kind: "none"}} autoplay={false} />
            </div>
            <div class="flex flex-row flex-wrap gap-2">
                <a class="inline-block px-1 text-base border-b-2 transition-colors border-zinc-100">Posts</a>
                <a class="inline-block px-1 text-base border-b-2 transition-colors border-transparent text-zinc-400">Wiki</a>
                <a class="inline-block px-1 text-base border-b-2 transition-colors border-transparent text-zinc-400">Best of AskReddit</a>
                <a class="inline-block px-1 text-base border-b-2 transition-colors border-transparent text-zinc-400" aria-expanded="false">Related Subreddits ▾</a>
                <a class="inline-block px-1 text-base border-b-2 transition-colors border-transparent text-zinc-400">Gilded</a>
                <a class="inline-block px-1 text-base border-b-2 transition-colors border-transparent text-zinc-400" aria-expanded="false">Secret ▾</a>
            </div>
        </div>
    </div>;
}

export function Banner(props: {banner: Generic.Banner}): JSX.Element {
    return <SwitchKind item={props.banner ?? {kind: "none" as const}} children={{
        image: (bimg) => <>
            <img class="w-full h-full object-cover" src={proxyURL(bimg.desktop)} alt="" />
        </>,
        color: (bcolor) => <>
            <div style={{"background-color": bcolor.color}} class="w-full h-full" />
        </>,
        none: () => <>
        </>,
    }} />;
}

export function FullscreenViewer(props: {img_src: string, children: JSX.Element}): JSX.Element {
    return <div>{props.children}</div>;
}