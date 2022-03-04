import type * as Generic from "api-types-generic";
import {
    Accessor, createSignal,
    For, JSX, Setter
} from "solid-js";
import { allowedToAcceptClick, Show, SwitchKind } from "tmeta-util-solid";
import { link_styles_v, navigate } from "../app";
import {
    classes, getSettings, getWholePageRootContextOpt, HideshowProvider, size_lt, ToggleColor
} from "../util/utils_solid";
import { DropdownActionButton } from "./ActionButtonDropdown";
import { HorizontalActionButton } from "./ActionButtonHorizontal";
import { animateHeight, ShowAnimate } from "./animation";
import { Body, summarizeBody } from "./body";
import { CollapseButton } from "./CollapseButton";
import { CounterCount, VerticalIconCounter } from "./counter";
import Dropdown from "./Dropdown";
import { Flair } from "./Flair";
import { CollapseData, getCState } from "./flatten";
import { useActions } from "./flat_posts";
import { HSplit } from "./HSplit";
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
    const [transitionTarget, setTransitionTarget]: [Accessor<boolean>, Setter<boolean>] = (
    props.opts.collapse_data && props.opts.id) ?
    ((): [Accessor<boolean>, Setter<boolean>] => {
        if(props.opts.is_pivot) return createSignal(true);
        const cs = getCState(props.opts.collapse_data, props.opts.id);
        const setter: Setter<boolean> = (nv) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return !cs.setCollapsed((pv): boolean => {
                return !(typeof nv === "boolean" ? nv : nv(!pv));
            }) as any; // jkjckdnacjkdsnajkldkl
            // why is this setter type so messy aaaa
        };
        return [() => !cs.collapsed(), setter];
    })() : createSignal(
        props.opts.is_pivot ? true :
        (props.content.collapsible !== false ? (
            props.opts.is_pivot ? false :
            props.content.collapsible.default_collapsed
        ) : false) ? false :
        true,
    );
    const [selfVisible, setSelfVisible] = createSignal(transitionTarget());

    const [contentWarning, setContentWarning] = createSignal(
        !!(props.content.flair ?? []).find(flair => flair.content_warning),
    );
    const hasTitleOrThumbnail = () => {
        return !!props.content.thumbnail || !!props.content.title;
    };
    const hasThumbnail = () => {
        return !!props.content.thumbnail && !selfVisible();
    };

    const settings = getSettings();

    const [animState, setAnimState] = createSignal<{visible: boolean, animating: boolean}>({
        visible: selfVisible(),
        animating: false,
    });

    const postIsClickable = () => {
        return props.opts.frame?.url != null && !props.opts.is_pivot;
    };

    const hprc = getWholePageRootContextOpt();

    const getActions = useActions(() => props.content, () => props.opts);

    return <article
        ref={node => animateHeight(node, settings, transitionTarget, (state, rising, animating) => {
            setAnimState({visible: rising || state, animating});
            setSelfVisible(state || rising);
        })}
        class={classes(
            // note: can even consider <sm:text-xs
            // we'll probably want a font size config in the settings
            props.opts.is_pivot ? [
                "text-base m-2",
            ] : "text-sm",
            // "pt-10px",
            props.content.collapsible !== false ? "" : "pl-15px",
            "flex flex-row",
        )}
        style={{
            "--left-v": "8px",
        }}
    >
        <Show if={props.content.collapsible !== false && (
            props.content.thumbnail != null ? selfVisible() ? true : false : true
        ) && !size_lt.sm()}>
            <div class={"flex flex-col items-center mr-1 gap-2 sm:pr-1"}>
                <Show when={props.content.actions?.vote}>{vote_action => (
                    <div class={selfVisible() || hasThumbnail() ? "" : " hidden"}>
                        <VerticalIconCounter counter={vote_action} />
                    </div>
                )}</Show>
                <CollapseButton
                    class="flex-1"
                    collapsed_raw={!transitionTarget()}
                    collapsed_anim={!selfVisible()}
                    onClick={() => {
                        setTransitionTarget(t => !t);
                    }}
                    real={true}
                    cstates={props.opts.collapse_data}
                    id={props.opts.id}
                />
            </div>
        </Show>
        <div class="flex-1">
            <HSplit.Container dir="right" vertical="center">
                <Show if={!selfVisible()} when={props.content.thumbnail}>{thumb_any => (
                    <ToggleColor>{color => (
                        <HSplit.Child>
                            <button class={classes(
                                "w-12 h-12 sm:w-16 sm:h-16 mr-4 rounded-md "+color,
                                contentWarning() && thumb_any.kind === "image" ? "thumbnail-content-warning" : "",
                                "block",
                            )} onClick={() => setTransitionTarget(t => !t)}>
                                <SwitchKind item={thumb_any}>{{
                                    image: img => <img
                                        // TODO based on the img content, display eg a play button or something
                                        src={img.url}
                                        alt=""
                                        class={classes(
                                            "w-full h-full object-contain rounded-md"
                                        )}
                                    />,
                                    default: def => <>TODO {def.kind}</>,
                                }}</SwitchKind>
                            </button>
                        </HSplit.Child>
                    )}</ToggleColor>
                )}</Show>
                <HSplit.Child fullwidth><div
                    class={"flex-1" + (postIsClickable() ? " hover-outline" : "")}
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
                            window.open(target_url);
                        }else{
                            if(!transitionTarget()) {
                                setTransitionTarget(true);
                                return;
                            }
                            navigate({
                                path: target_url,
                                page: props.opts.id && hprc ? {
                                    pivot: props.opts.id,
                                    content: hprc.content(),
                                } : undefined,
                                // page: props.opts.frame ? {pivot: {ref: props.opts.frame}} : undefined,
                                // disabling this for now, we'll fix it in a bit
                                // we just need to know what the link to the post is in the
                                // post itself
                            });
                        }
                    }}
                >
                    <div class={classes(
                        (props.opts.is_pivot && selfVisible()) ? "text-3xl" : "text-base",
                    )}>
                        <Show when={props.content.title}>{title => (
                            <span role="heading">
                                <Show when={props.opts.frame?.url} fallback={(
                                    title.text
                                )}>{url => (
                                    <A
                                        client_id={props.opts.client_id}
                                        href={url}
                                        class="hover:underline"
                                    >{title.text}</A>
                                )}</Show>
                            </span>
                        )}</Show>
                        <Flair flairs={props.content.flair ?? []} />
                    </div>
                    <div class={classes(
                        "text-gray-500",
                        "text-sm",
                        selfVisible() || hasThumbnail()
                        ? ""
                        : "filter grayscale text-$collapsed-header-color italic",
                    )}><HSplit.Container dir="right" vertical="center">
                        <HSplit.Child><div class={classes(
                            "mr-2",
                            hasThumbnail() ? "block" : "inline-block"
                        )}>
                            <Show when={props.content.author}>{author => <>
                                <Show if={
                                    selfVisible() && settings.author_pfp.value() === "on"
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
                            <Show if={selfVisible() || hasTitleOrThumbnail()}>
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
                        </div><Show if={!props.opts.is_pivot || !selfVisible()}>
                            <div class="mr-2 inline-block">
                                <InfoBar post={props.content} />
                            </div>
                        </Show></HSplit.Child>
                        <HSplit.Child fullwidth><div class="mr-2">
                            <Show if={!(selfVisible() || hasTitleOrThumbnail())}>
                                <Show if={true
                                    && props.content.collapsible !== false
                                    && props.content.collapsible.default_collapsed === true
                                } fallback={<>
                                    <div class="whitespace-normal max-lines max-lines-1">
                                        {"“" + (() => {
                                            const res = summarizeBody(props.content.body);
                                            if(res.length > 500) return res.substring(0, 500) + "…";
                                            return res;
                                        })() + "”"}
                                    </div>
                                </>}>
                                    <Show when={props.content.actions?.vote} fallback={
                                        "[Collapsed by default]"
                                    }>{vote_action => <>
                                        <CounterCount counter={vote_action} />{" "}
                                    </>}</Show>
                                </Show>
                            </Show>
                        </div></HSplit.Child>
                    </HSplit.Container></div>
                </div></HSplit.Child>
                <Show if={!props.opts.is_pivot && (selfVisible() || hasThumbnail())}>
                    <HSplit.Child vertical="top">
                        <div class="pl-2" />
                        <Dropdown label={"…"}>
                            <For each={getActions()}>{action => <>
                                <DropdownActionButton action={action} />
                            </>}</For>
                        </Dropdown>
                    </HSplit.Child>
                </Show>
            </HSplit.Container>
            <div style={{display: selfVisible() ? "block" : "none"}}><HideshowProvider
                visible={() => animState().visible || animState().animating}
            >
                <section class={props.opts.is_pivot ? "py-4" : ""}>
                    <Show if={animState().visible || animState().animating}>
                        <Show if={selfVisible() && hasThumbnail()}><div class="mt-2"></div></Show>
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