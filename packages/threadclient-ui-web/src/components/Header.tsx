import * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { renderMenu } from "../page1";
import ActionButtonCTA from "./ActionButtonCTA";
import { Body } from "./body";
import { SolidToVanillaBoundary } from "./LinkHelper";
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
        <div class={(props.header.theme.banner != null ? "h-56" : "pt-4 -mb-4") + " -mx-4 -mt-4 relative"}>
            <Show if={props.header.theme.banner != null}>
                <div class="absolute w-full h-full">
                    <Banner banner={props.header.theme.banner} />
                </div>
                <div class="absolute w-full h-full bg-gradient-to-b from-transparent via-transparent pointer-events-none" style={{
                    '--tw-gradient-to': "rgb(0 0 0 / 0.75)",
                }}></div>
            </Show>
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
            <Show when={props.header.menu}>{menu => <SolidToVanillaBoundary getValue={(hsc) => {
                const obj_frame = document.createElement("div");
                renderMenu(menu).defer(hsc).adto(el("div").clss("my-3").adto(obj_frame));
                return obj_frame;
            }} />}</Show>
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