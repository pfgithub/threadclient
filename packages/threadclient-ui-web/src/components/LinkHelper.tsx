import type * as Generic from "api-types-generic";
import { createMemo, createSignal, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { previewLink, unsafeLinkToSafeLink } from "../app";
import {
    classes, getSettings, ToggleColor
} from "../util/utils_solid";
import { animateHeight } from "./animation";
import { Body } from "./body";
import Clickable from "./Clickable";
import Hactive from "./Hactive";
import { InternalIconRaw } from "./Icon";
import proxyURL from "./proxy_url";
export * from "../util/interop_solid";

type Link = {
    title: string,
    url: string,
    client_id: string,

    summary?: string | undefined,
    thumbnail?: string | undefined,
};


// previewLink should give a thumbnail back somehow
// eg for youtube videos, it's an image `https://img.youtube.com/vi/${id}/default.jpg`

export default function LinkHelper(props: {link: Link}): JSX.Element {
    const settings = getSettings();
    const linkPreview: () => {
        visible: () => boolean,
        toggleVisible: () => void,
        body: Generic.Body,
    } | undefined = createMemo(() => {
        const body = previewLink(props.link.url, {});
        if(!body) return undefined;
        const [visible, setVisible] = createSignal(false);
        return {visible, toggleVisible: () => setVisible(v => !v), body};
    });
    const human = createMemo((): {link: string, external: boolean} => {
        const res = unsafeLinkToSafeLink(props.link.client_id, props.link.url);
        if(res.kind === "link") {
            return {link: res.url, external: res.external};
        }else return {link: "error", external: true};
    });

    const [previewOpen, setPreviewOpen] = createSignal<{open: boolean, temporary: boolean}>(
        {open: false, temporary: false},
    );
    // TODO: get rid of this, use showAnimate instead.
    // right, the reason we couldn't is because we had to split the thing in half
    // - just start it split in half already?
    return <Show if={human().link !== "error"}><Hactive
        clickable={true}
    >{(__, divRef, divAddClass) => <div ref={divRef} class={divAddClass()}>
        <ToggleColor>{color => <Clickable
            action={{
                url: props.link.url,
                client_id: props.link.client_id,
                onClick: linkPreview() ? () => {
                    linkPreview()!.toggleVisible();
                } : undefined,
            }}
            class={classes(
                "p-2 px-4",
                "flex flex-row flex-wrap items-center",
                color, "rounded-xl",
                "hover:bg-slate-200 hover:dark:bg-zinc-700 hover:shadow transition",
                previewOpen().open ? "rounded-b-none" : "",
            )}
        >
            <Show when={props.link.thumbnail}>{thumb => <ToggleColor>{objcolr => <>
                <div class={"w-12 h-12 sm:w-16 sm:h-16 mr-4 rounded-md " + objcolr + " block"}>
                    <img src={proxyURL(thumb)} class="w-full h-full object-cover rounded-md" alt="" />
                </div>
            </>}</ToggleColor>}</Show>
            <div class="flex-1">
                <div class={"max-lines max-lines-1 select-none " + (props.link.summary != null ? "font-bold" : "")}>
                    <Show when={linkPreview()}>{v => <>{v.visible() ? "▾ " : "▸ "}</>}</Show>
                    {props.link.title}
                </div>
                <Show if={!previewOpen().open || previewOpen().temporary} when={props.link.summary}>{summary => <>
                    <div style={{display: previewOpen().open ? "none" : "block"}}>
                        <div class="max-lines max-lines-2">{summary}</div>
                    </div>
                </>}</Show>
                <Show if={!previewOpen().open || previewOpen().temporary}>
                    <div style={{display: previewOpen().open ? "none" : "block"}}>
                        <LinkLocationSection url={human().link} external={human().external} />
                    </div>
                </Show>
            </div>
        </Clickable>}</ToggleColor>
        <Show when={linkPreview()}>{preview => <><div ref={v => animateHeight(
            // TODO: we should use showanimate & we shouldn't show until all suspenses inside have loaded
            // or the content is guarenteed to be known height or x ms have passed
            v, settings, preview.visible, (state, rising, temporary) => {
                setPreviewOpen({open: state || rising, temporary});
            },
        )}>
            <Show if={previewOpen().open || previewOpen().temporary}>
                <div style={{display: previewOpen().open ? "block" : "none"}}>
                    <Body body={preview.body} autoplay={true} />
                </div>
            </Show>
        </div><Show if={previewOpen().open || previewOpen().temporary}>
            <div style={{display: previewOpen().open ? "block" : "none"}}>
                <ToggleColor>{color => <Clickable
                    action={{
                        client_id: props.link.client_id,
                        url: props.link.url,
                    }}
                    class={classes(
                        "p-2 px-4",
                        "block",
                        color, "rounded-xl rounded-t-none",
                        "hactive:dark:bg-zinc-700 dark:hactive:shadow transition",
                    )}
                >
                    <LinkLocationSection url={human().link} external={human().external} />
                </Clickable>}</ToggleColor>
            </div>
        </Show></>}</Show>
    </div>}</Hactive></Show>;
}

function LinkLocationSection(props: {url: string, external: boolean}): JSX.Element {
    return <div class="max-lines max-lines-1 break-all font-light text-slate-800 dark:text-zinc-500 select-none">
        <Show if={props.external}>
            <ExternalIcon />{" "}
        </Show>
        {props.url}
    </div>;
}

function ExternalIcon(): JSX.Element {
    return <div class="inline-block">
        <InternalIconRaw class="fa-solid fa-arrow-up-right-from-square" label="External" />
    </div>;
}