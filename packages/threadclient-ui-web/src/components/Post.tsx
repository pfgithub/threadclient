import type * as Generic from "api-types-generic";
import {
    Accessor, createMemo, createSignal,
    For, JSX, Setter
} from "solid-js";
import { allowedToAcceptClick, Show, SwitchKind } from "tmeta-util-solid";
import { link_styles_v, navigate } from "../app";
import {
    classes, getSettings, getWholePageRootContextOpt, HideshowProvider, size_lt, ToggleColor
} from "../util/utils_solid";
import { DropdownActionButton } from "./ActionButtonDropdown";
import { HorizontalActionButton } from "./ActionButtonHorizontal";
import { ShowAnimate } from "./animation";
import { Body, summarizeBody } from "./body";
import { CollapseButton } from "./CollapseButton";
import { VerticalIconCounter } from "./counter";
import Dropdown from "./Dropdown";
import { Flair } from "./Flair";
import { CollapseData, CollapseInfo, getCState, postContentCollapseInfo } from "./flatten";
import { ActionItem, getThumbnailPreview, useActions } from "./flat_posts";
import { HSplit } from "./HSplit";
import { InternalIcon, InternalIconRaw } from "./Icon";
import InfoBar from "./InfoBar";
import { A, LinkButton, UserLink } from "./links";

const decorative_alt = "";

function AuthorPfp(props: {src_url: string}): JSX.Element {
    return <img
        src={props.src_url}
        alt={decorative_alt}
        class="w-8 h-8 object-center inline-block rounded-full"
    />;
}

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
    clickable: boolean,
    frame: Generic.PostData | null,
    replies: Generic.ListingData | null,
    client_id: string,
    at_or_above_pivot: boolean,
    is_pivot: boolean,
    collapse_data?: undefined | CollapseData,
    id?: undefined | Generic.Link<Generic.Post>,
};

export type ClientPostProps = {content: Generic.PostContentPost, opts: ClientPostOpts};
export default function ClientPost(props: ClientPostProps): JSX.Element {
    // wow this is sketchy because we're supporting posts that
    // aren't rendered from <ClientPage />

    // ok all these signals are a mess because we're trying to do clipping height animations but keep the original
    // appearence while the post switches to a collapsed state

    // it would probably be better to have two seperate post renderes, one for collapsed and one for expanded,
    // and switch between the two

    const [visible, setVisible]: [Accessor<boolean>, Setter<boolean>] = (
    props.opts.collapse_data && props.opts.id) ?
    ((): [Accessor<boolean>, Setter<boolean>] => {
        const pivot_signal = createSignal(true);
        if(props.opts.is_pivot) return createSignal(true);
        const cs = getCState(props.opts.collapse_data, props.opts.id);
        const setter: Setter<boolean> = (nv) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return !cs.setCollapsed((pv): boolean => {
                return !(typeof nv === "boolean" ? nv : nv(!pv));
            }) as any; // jkjckdnacjkdsnajkldkl
            // why is this setter type so messy aaaa
        };
        return [
            createMemo(() => props.opts.is_pivot ? pivot_signal[0]() : !cs.collapsed()),
            (arg) => props.opts.is_pivot ? pivot_signal[1](arg) : setter(arg),
        ];
    })() : createSignal(
        props.opts.is_pivot ? true :
        !postContentCollapseInfo(props.content, props.opts).default_collapsed,
    );
    const collapseInfo = createMemo(
        () => postContentCollapseInfo(props.content, props.opts),
        undefined,
        {equals: (a, b) => {
            return JSON.stringify(a) === JSON.stringify(b);
        }},
    );

    const [contentWarning, setContentWarning] = createSignal(
        !!(props.content.flair ?? []).find(flair => flair.content_warning),
    );
    const hasTitleOrThumbnail = () => {
        return !!props.content.thumbnail || !!props.content.title;
    };
    const hasThumbnail = () => {
        return !!props.content.thumbnail && !visible();
    };

    const hprc = getWholePageRootContextOpt();

    const getPage = (): Generic.Page2 | undefined => {
        if(!props.opts.id) return undefined;
        if(!hprc) return undefined;
        if(props.opts.frame?.disallow_pivot ?? false) return undefined;
        return {
            pivot: props.opts.id,
            content: hprc.content(),
        };
    };

    const getActions = useActions(() => props.content, () => props.opts);

    return <article
        class={classes(
            // note: can even consider <sm:text-xs
            // we'll probably want a font size config in the settings
            props.opts.is_pivot ? [
                "text-base m-2",
            ] : "text-sm",
            "flex flex-row",
        )}
    >
        <Show if={collapseInfo().user_controllable && (
            props.content.thumbnail != null ? visible() ? true : false : true
        ) && !size_lt.sm()}>
            <div class={"flex flex-col items-center mr-1 gap-2 sm:pr-1"}>
                <div class={visible() || hasThumbnail() ? "" : " hidden"}>
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
                    collapsed_raw={!visible()}
                    collapsed_anim={!visible()}
                    onClick={() => {
                        setVisible(t => !t);
                    }}
                    real={true}
                    cstates={props.opts.collapse_data}
                    id={props.opts.id}
                />
            </div>
        </Show>
        <div class="flex-1">
            <PostTopBar
                content={props.content}
                opts={props.opts}

                visible={visible()}
                setVisible={setVisible}
                contentWarning={contentWarning()}
                collapseInfo={collapseInfo()}
                hasThumbnail={hasThumbnail()}
                hasTitleOrThumbnail={hasTitleOrThumbnail()}
                actions={getActions()}
                getPage={getPage}
            />
            <div style={{display: visible() ? "block" : "none"}}><HideshowProvider
                visible={() => visible()}
            >
                <section class={props.opts.is_pivot ? "py-4" : ""}>
                    <Show if={visible()}>
                        <Show if={visible()}><div class="mt-2"></div></Show>
                        <ShowAnimate when={!contentWarning()} fallback={
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
                <Show if={props.opts.is_pivot}><div class="text-sm">
                    <InfoBar post={props.content} />
                    <div class="mt-2" />
                    <div class="flex flex-wrap gap-2">
                        <For each={getActions()}>{action => <>
                            <HorizontalActionButton action={action} />
                        </>}</For>
                    </div>
                </div></Show>
            </HideshowProvider></div>
        </div>
    </article>;
}

// [!] RENDER THIS TWICE, ONCE WITH visible=true AND ONCE WITH visible=false
// [!] USE A SHOWHIDE TOGGLE ANIMATED THING
// [!] UPDATE THAT THING TO USE inert=true ON THE THING BEING HIDDEN
//      [!] we also need to move focus to the right place immediately on toggle
function PostTopBar(props: ClientPostProps & {
    visible: boolean,
    setVisible: Setter<boolean>,

    contentWarning: boolean,
    collapseInfo: CollapseInfo,

    hasThumbnail: boolean,
    hasTitleOrThumbnail: boolean,

    actions: ActionItem[],

    getPage: () => Generic.Page2 | undefined,
}): JSX.Element {
    const postIsClickable = () => {
        return !props.visible || (props.opts.frame?.url != null && !props.opts.is_pivot);
    };

    const settings = getSettings();

    return <HSplit.Container dir="right" vertical="center">
        <Show if={!props.visible} when={props.content.thumbnail}>{thumb_any => (
            <ToggleColor>{color => (
                <HSplit.Child>
                    <A
                        href={props.opts.frame?.url ?? "ENOHREF"}
                        client_id={props.opts.frame?.client_id ?? "ENOCLIENTID"}
                        class={classes(
                            "w-12 h-12 sm:w-16 sm:h-16 mr-4 rounded-md "+color,
                            props.contentWarning && thumb_any.kind === "image" ? "thumbnail-content-warning" : "",
                            "block",
                            "relative",
                        )}
                        onClick={props.collapseInfo.user_controllable ? () => {
                            props.setVisible(t => !t);
                        } : undefined}
                        page={props.getPage}
                    >
                        <SwitchKind item={thumb_any}>{{
                            image: img => <img
                                // TODO based on the img content, display eg a play button or something
                                src={img.url}
                                alt=""
                                class={classes(
                                    "w-full h-full object-cover rounded-md"
                                    // object-contain is nicer but we're using object-cover for now
                                )}
                            />,
                            default: def => <>TODO {def.kind}</>,
                        }}</SwitchKind>
                        <PreviewThumbnailIcon body={props.content.body} />
                    </A>
                </HSplit.Child>
            )}</ToggleColor>
        )}</Show>
        <HSplit.Child fullwidth><div
            class={(postIsClickable() ? " hover-outline" : "")}
            // note: screenreader or keyboard users must click the 'view' button
            // or the title if there is one.
            // I considered making the "x points x hours ago" a link but it's harder
            // to do than it should be because of the {" "} and {", "} those get underlined
            onclick={e => {
                if(!postIsClickable()) return;
                if(!allowedToAcceptClick(e.target as Node, e.currentTarget)) return;
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
                props.visible || props.hasThumbnail
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
                        (props.opts.is_pivot && props.visible) ? "text-3xl sm:text-2xl" : "text-base",
                    )}>
                        <Show when={props.content.title}>{title => (
                            <Show if={!props.opts.is_pivot} when={props.opts.frame?.url} fallback={(
                                title.text
                            )}>{url => (
                                <A
                                    client_id={props.opts.client_id}
                                    href={url}
                                    class="hover:underline"
                                    page={props.getPage}
                                >{title.text}</A>
                            )}</Show>
                        )}</Show>
                    <Flair flairs={props.content.flair ?? []} />
                    </div>
                </Show>
                <div>
                    <Show when={props.content.author}>{author => <>
                        <Show if={
                            props.visible && settings.authorPfp() === "on"
                        } when={author.pfp} fallback={"By "}>{pfp => <>
                            <AuthorPfp src_url={pfp.url} />{" "}
                        </>}</Show>
                        <UserLink
                            client_id={author.client_id}
                            href={author.link}
                            color_hash={author.color_hash}
                        >
                            {author.name}
                        </UserLink>{" "}
                    </>}</Show>
                    <Show if={props.visible || props.hasTitleOrThumbnail}>
                        <Show when={props.content.author}>{author => <>
                            <Show when={author.flair}>{flair => <>
                                <Flair flairs={flair} />{" "}
                            </>}</Show>
                        </>}</Show>
                        <Show when={props.content.info?.in}>{in_sr => <>
                            {" in "}<LinkButton
                                href={in_sr.link}
                                style="previewable"
                                client_id={in_sr.client_id}
                            >{in_sr.name}</LinkButton>{" "}
                        </>}</Show>
                    </Show>
                </div>
                <Show if={!props.opts.is_pivot || !props.visible}>
                    <div>
                        <InfoBar post={props.content} />
                    </div>
                </Show>
                <HSplit.Child fullwidth>
                    <Show if={!(props.visible || props.hasThumbnail)}>
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
        <Show if={props.visible || props.hasThumbnail}>
            <HSplit.Child>
                <div class="pl-2" />
                <Dropdown>
                    <For each={props.actions}>{action => <>
                        <DropdownActionButton action={action} />
                    </>}</For>
                </Dropdown>
            </HSplit.Child>
        </Show>
    </HSplit.Container>;
}