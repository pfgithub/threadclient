import type * as Generic from "api-types-generic";
import {
    Accessor, createMemo, createSignal,
    For, JSX, Setter, untrack
} from "solid-js";
import { allowedToAcceptClick, Show, SwitchKind } from "tmeta-util-solid";
import { link_styles_v } from "../page1";
import { navigate } from "../page1_routing";
import {
    classes, getSettings, getWholePageRootContextOpt, size_lt
} from "../util/utils_solid";
import { DropdownActionButton } from "./ActionButtonDropdown";
import { HorizontalActionButton } from "./ActionButtonHorizontal";
import { ShowAnimate } from "./animation";
import { Body, summarizeBody } from "./body";
import Clickable, { ClickAction } from "./Clickable";
import { CollapseButton } from "./CollapseButton";
import { VerticalIconCounter } from "./counter";
import Dropdown from "./Dropdown";
import { Flair } from "./Flair";
import { CollapseData, CollapseInfo, FlatPost, getCState, postContentCollapseInfo } from "./flatten";
import { ActionItem, getThumbnailPreview, useActions } from "./flat_posts";
import { HSplit } from "./HSplit";
import { InternalIcon, InternalIconRaw } from "./Icon";
import InfoBar from "./InfoBar";
import { LinkButton, UserLink } from "./links";
import { postGetPage } from "./PageFlatItem";
import Pfp from "./Pfp";
import proxyURL from "./proxy_url";

function PreviewThumbnailIcon(props: {body: Generic.Body}): JSX.Element {
    const genv = createMemo(() => getThumbnailPreview(props.body));
    return <>{genv() != null ? <div class={classes(
        "absolute bottom-1 right-1",
        "text-xs sm:text-base w-6 h-6 sm:w-8 sm:h-8 p-1 bg-slate-300 dark:bg-zinc-700",
        "rounded-md",
        "flex items-center justify-center",
    )}><span>
        <SwitchKind item={genv()!}>{{
            icon: (icn) => <InternalIcon
                tag={({
                    text: "fa-file-lines",
                    video: "fa-circle-play",
                    link: "fa-arrow-up-right-from-square",
                    other: "fa-asterisk",
                } as const)[icn.icon]}
                filled={icn.icon === "other" || icn.icon === "link"}
                label={({
                    text: "Text",
                    video: "Video",
                    link: "Link",
                    other: "",
                } as const)[icn.icon]}
            />,
            gallery: (gal) => <>{gal.count}</>,
        }}</SwitchKind>
    </span></div> : null}</>;
}

export type ClientPostOpts = {
    // TODO: get rid of all of this except for flat_frame and maybe client_id. delete it. gone. gotten rid of.
    client_id: string,
    frame: Generic.Post | null, // oh and this too :(
    id: Generic.Link<Generic.Post> | null,
    flat_frame: null | FlatPost,
    collapse_data?: undefined | CollapseData, // oh we need this too unfortunately
};

export type ClientPostProps = {
    content: Generic.PostContentPost,
    opts: ClientPostOpts,
    hovering?: undefined | boolean,
    whole_object_clickable?: undefined | boolean,
};
export default function ClientPost(props: ClientPostProps): JSX.Element {
    // wow this is sketchy because we're supporting posts that
    // aren't rendered from <ClientPage />

    // ok all these signals are a mess because we're trying to do clipping height animations but keep the original
    // appearence while the post switches to a collapsed state

    // it would probably be better to have two seperate post renderes, one for collapsed and one for expanded,
    // and switch between the two

    const collapseInfo = createMemo(
        () => postContentCollapseInfo(props.content, props.opts.flat_frame ?? {
            is_pivot: false,
            displayed_in: "tree",
        }),
        undefined,
        {equals: (a, b) => {
            return JSON.stringify(a) === JSON.stringify(b);
        }},
    );
    const isPivot = () => props.opts.flat_frame?.is_pivot ?? false;

    const [visible, setVisible]: [Accessor<boolean>, Setter<boolean>] = (
    props.opts.collapse_data && props.opts.id && props.opts.flat_frame) ?
    ((): [Accessor<boolean>, Setter<boolean>] => {
        const ff = props.opts.flat_frame;
        const pivot_signal = createSignal(true);
        if(ff.is_pivot) return createSignal(true);
        const ci = collapseInfo();
        if(!ci.user_controllable) return createSignal(!ci.default_collapsed);
        const cs = getCState(props.opts.collapse_data, props.opts.id);
        const setter: Setter<boolean> = (nv) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return !cs.setCollapsed((pv): boolean => {
                return !(typeof nv === "boolean" ? nv : nv(!pv));
            }) as any; // jkjckdnacjkdsnajkldkl
            // why is this setter type so messy aaaa
        };
        return [
            createMemo(() => ff.is_pivot ? pivot_signal[0]() : !cs.collapsed()),
            (arg) => ff.is_pivot ? pivot_signal[1](arg) : setter(arg),
        ];
    })() : createSignal(
        untrack(isPivot) ? true :
        !untrack(() => collapseInfo()).default_collapsed,
    );

    const [contentWarning, setContentWarning] = createSignal(
        !!(props.content.flair ?? []).find(flair => flair.content_warning),
    );
    // next: fix fix focus

    const hprc = getWholePageRootContextOpt();

    const getPage = (): Generic.Page2 | undefined => {
        if(!props.opts.flat_frame) return undefined;
        if(!hprc) return undefined;
        return postGetPage(hprc, props.opts.flat_frame.content);
    };

    const getActions = useActions(() => props.content, () => props.opts);

    return <article
        class={classes(
            // note: can even consider <sm:text-xs
            // we'll probably want a font size config in the settings
            isPivot() ? [
                "text-base p-2",
            ] : "text-sm",
        )}
    >
        <ShowAnimate
            mode={props.opts.collapse_data ? "clip" : "height"}
            if={visible()}
        fallback={<div class="flex flex-row">
            <Show if={collapseInfo().user_controllable && (
                props.content.thumbnail != null ? false : true
            ) && !size_lt.sm()}>
                <div class={"flex flex-col items-center mr-1 gap-2 sm:pr-1"}>
                    <CollapseButton
                        class="flex-1"
                        mode="reveal_only"
                        onClick={() => {
                            setVisible(t => !t);
                        }}
                        cstates={props.opts.collapse_data}
                        id={props.opts.flat_frame?.collapse?.id ?? undefined}
                    />
                </div>
            </Show>
            <div class="flex-1 w-0">
                <PostTopBar
                    content={props.content}
                    opts={props.opts}

                    visible={false}
                    setVisible={setVisible}
                    contentWarning={contentWarning()}
                    collapseInfo={collapseInfo()}
                    actions={getActions()}
                    getPage={getPage}
                    hovering={props.hovering}
                    whole_object_clickable={props.whole_object_clickable}
                />
            </div>
        </div>}><div class="flex flex-row">
            <Show if={collapseInfo().user_controllable && !size_lt.sm()}>
                <div class={"flex flex-col items-center mr-1 gap-2 sm:pr-1"}>
                    <div>
                        <Show when={props.content.actions?.vote} fallback={<>
                            <button
                                onClick={() => {
                                    setVisible(t => !t);
                                }}
                                class="text-slate-500 dark:text-zinc-600 text-xs"
                            >
                                <InternalIconRaw class="fa-solid fa-circle-chevron-up" label="Collapse" />
                            </button>
                        </>}>{vote_action => (
                            <VerticalIconCounter counter={vote_action} />
                        )}</Show>
                    </div>
                    <CollapseButton
                        class="flex-1"
                        mode="collapse_only"
                        onClick={() => {
                            setVisible(t => !t);
                        }}
                        cstates={props.opts.collapse_data}
                        id={props.opts.flat_frame?.collapse?.id ?? undefined}
                    />
                </div>
            </Show>
            <div class="flex-1 w-0">
                <PostTopBar
                    content={props.content}
                    opts={props.opts}

                    visible={true}
                    setVisible={setVisible}
                    contentWarning={contentWarning()}
                    collapseInfo={collapseInfo()}
                    actions={getActions()}
                    getPage={getPage}
                    hovering={props.hovering}
                    whole_object_clickable={props.whole_object_clickable}
                />
                <div>
                    <section class={isPivot() ? "py-4" : ""}>
                        <Show if={true}>
                            <Show if={true}><div class="mt-2"></div></Show>
                            <ShowAnimate if={!contentWarning()} fallback={
                                <>
                                    Content Warning:{" "}
                                    <Flair flairs={(props.content.flair ?? []).filter(f => f.content_warning)} />{" "}
                                    <button
                                        class={link_styles_v["pill-filled"]}
                                        onClick={() => setContentWarning(false)}
                                    >Show Anyway</button>
                                </>
                            }>
                                <Body body={props.content.body} autoplay={false} />
                            </ShowAnimate>
                        </Show>
                    </section>
                    <Show if={isPivot()}><div class="text-sm">
                        <InfoBar post={props.content} opts={props.opts} />
                    </div></Show>
                </div>
            </div>
        </div></ShowAnimate>
    </article>;
}

export function Thumbnail(props: {
    thumbnail: Generic.Thumbnail,
    body: Generic.Body,
    content_warning: boolean,
    action: ClickAction,
}): JSX.Element {
    /*
                    const thumbimg: string = {
                        self: "self", default: "default", image: "image", spoiler: "spoiler",
                        nsfw: "nsfw", account: "account", error: "error"
                    }[listing.thumbnail.thumb];
                    thumbnail_loc.adch(el("div").clss("thumbnail-builtin", "thumbnail-" + thumbimg));
    */
    return <Clickable
        action={props.action}
        class={classes(
            "w-12 h-12 sm:w-16 sm:h-16 mr-4 rounded-md bg-slate-100 dark:bg-zinc-800",
            props.content_warning && props.thumbnail.kind === "image" ? "thumbnail-content-warning" : "",
            "block",
            "relative",
        )}
    >
        <SwitchKind item={props.thumbnail}>{{
            image: img => <img
                src={proxyURL(img.url)}
                alt=""
                class={classes(
                    "w-full h-full object-cover rounded-md"
                    // object-contain is nicer but we're using object-cover for now
                )}
            />,
            default: def => <div class={"w-full h-full rounded-full bg-slate-500 dark:bg-zinc-500"}>{def.thumb}</div>,
        }}</SwitchKind>
        <PreviewThumbnailIcon body={props.body} />
    </Clickable>;
}

// [!] RENDER THIS TWICE, ONCE WITH visible=true AND ONCE WITH visible=false
// [!] USE A SHOWHIDE TOGGLE ANIMATED THING
// [!] UPDATE THAT THING TO USE inert=true ON THE THING BEING HIDDEN
//      [!] we also need to move focus to the right place immediately on toggle
export function PostTopBar(props: ClientPostProps & {
    visible: boolean,
    setVisible: Setter<boolean>,

    contentWarning: boolean,
    collapseInfo: CollapseInfo,

    actions: ActionItem[],

    hovering: undefined | boolean,
    whole_object_clickable: undefined | boolean,

    getPage: () => Generic.Page2 | undefined,
}): JSX.Element {
    const isPivot = () => props.opts.flat_frame?.is_pivot ?? false;
    const postIsClickable = () => {
        if(props.whole_object_clickable === true) return false;
        return !props.visible || (props.opts.frame?.url != null && !isPivot());
    };

    const hasThumbnail = () => {
        return !!props.content.thumbnail && !props.visible;
    };

    const settings = getSettings();

    return <HSplit.Container dir="right" vertical="center">
        <Show if={!props.visible} when={props.content.thumbnail}>{thumb_any => (
            <HSplit.Child>
                <Thumbnail content_warning={props.contentWarning} action={{
                    url: props.opts.frame?.url ?? "ENOHREF",
                    client_id: props.opts.frame?.client_id ?? "ENOCLIENTID",
                    page: props.getPage,
                    onClick: props.collapseInfo.user_controllable ? () => {
                        props.setVisible(t => !t);
                    } : undefined,
                }} body={props.content.body} thumbnail={thumb_any} />
            </HSplit.Child>
        )}</Show>
        <HSplit.Child fullwidth><div
            class={(postIsClickable() ? " hover-outline" : "")}
            // note: screenreader or keyboard users must click the 'view' button
            // or the title if there is one.
            // I considered making the "x points x hours ago" a link but it's harder
            // to do than it should be because of the {" "} and {", "} those get underlined
            onclick={e => {
                if(!postIsClickable()) return;
                if(!allowedToAcceptClick(e.target, e.currentTarget)) return;
                e.stopPropagation();

                // support ctrl click
                const target_url = "/"+props.opts.client_id+props.opts.frame?.url;
                if(e.ctrlKey || e.metaKey || e.altKey) {
                    if(props.opts.frame?.url == null) return;
                    window.open(target_url);
                }else{
                    if(props.collapseInfo.user_controllable && !props.visible) {
                        props.setVisible(() => true);
                        return;
                    }
                    if(props.opts.frame?.url == null) return;
                    navigate({
                        path: target_url,
                        page: props.getPage(),
                        // page: props.opts.frame ? {pivot: {ref: props.opts.frame}} : undefined,
                        // disabling this for now, we'll fix it in a bit
                        // we just need to know what the link to the post is in the
                        // post itself
                    });
                }
            }}
        >
            <div class={classes(
                "text-gray-500",
                "text-sm",
                props.visible || hasThumbnail()
                ? ""
                : "filter grayscale text-$collapsed-header-color italic",
            )}><div class={classes([
                "flex",
                props.content.thumbnail ? "flex-col" : [
                    "flex-row flex-wrap gap-2 items-baseline"
                ],
            ])}>
                <Show if={props.content.title != null || props.content.flair != null}>
                    <div role="heading" class={classes(
                        "text-black",
                        (isPivot() && props.visible) ? "text-3xl sm:text-2xl" : "text-base",
                    )}>
                        <Show when={props.content.title}>{title => (
                            <Show if={!isPivot()} when={props.opts.frame?.url} fallback={(
                                title.text
                            )}>{url => (
                                <Clickable
                                    action={{url, client_id: props.opts.client_id, page: props.getPage}}
                                    class="hover:underline"
                                >{title.text}</Clickable>
                            )}</Show>
                        )}</Show>
                    <Flair pre_space flairs={props.content.flair ?? []} />
                    </div>
                </Show>
                <div>
                    <Show when={props.content.author}>{author => <>
                        <Show if={
                            props.visible && settings.authorPfp() === "on"
                        } when={author.pfp} fallback={"By "}>{pfp => <>
                            <Pfp pfp={pfp} class="w-8 h-8 inline-block align-middle" />
                        </>}</Show>
                        <UserLink
                            client_id={author.client_id}
                            href={author.link}
                            color_hash={author.color_hash}
                        >
                            {author.name}
                        </UserLink>{" "}
                    </>}</Show>
                    <Show if={props.visible}>
                        <Show when={props.content.author}>{author => <>
                            <Show when={author.flair}>{flair => <>
                                <Flair flairs={flair} />{" "}
                            </>}</Show>
                        </>}</Show>
                    </Show>
                    <Show when={props.content.info?.in}>{in_sr => <>
                        {" in "}<LinkButton
                            action={{url: in_sr.link, client_id: in_sr.client_id}}
                            style="previewable"
                        >{in_sr.name}</LinkButton>{" "}
                    </>}</Show>
                </div>
                <Show if={!isPivot() || !props.visible}>
                    <div>
                        <InfoBar post={props.content} opts={props.opts} />
                    </div>
                </Show>
                <HSplit.Child fullwidth>
                    <Show if={!(props.visible || hasThumbnail())}>
                        <Show if={
                            !props.collapseInfo.default_collapsed
                        } children={<div>
                            <div class="whitespace-normal max-lines max-lines-1">
                                {"“" + (() => {
                                    const res = summarizeBody(props.content.body);
                                    if(res.length > 500) return res.substring(0, 500) + "…";
                                    return res;
                                })() + "”"}
                            </div>
                        </div>} />
                    </Show>
                </HSplit.Child>
            </div></div>
        </div></HSplit.Child>
        <Show if={props.visible || hasThumbnail()}>
            <HSplit.Child>
                <div class={props.hovering == null ? "" : (
                    props.hovering ? "" : "can-hover:opacity-0 can-hover:focus-within:opacity-100"
                )}>
                    <Dropdown>
                        <For each={props.actions}>{action => <>
                            <DropdownActionButton action={action} />
                        </>}</For>
                    </Dropdown>
                </div>
            </HSplit.Child>
        </Show>
    </HSplit.Container>;
}