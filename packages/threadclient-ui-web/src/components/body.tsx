import type * as Generic from "api-types-generic";
import { createEffect, createMemo, createResource, createSignal, For, JSX, lazy, onCleanup, Suspense } from "solid-js";
import { createStore } from "solid-js/store";
import { ShowCond, SwitchKind } from "tmeta-util-solid";
import { switchKind } from "../../../tmeta-util/src/util";
import {
    fetchClient,
    getTwitchClip, gfyLike2, gfyLikeV1,
    imgurImage,
    linkPreview,
    link_styles_v,
    navigate,
    previewLink,
    redditSuggestedEmbed,
    renderOembed,
    textToBody, youtubeVideo,
    zoomableImage
} from "../app";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import {
    classes, DefaultErrorBoundary, getIsVisible,
    getSettings, ToggleColor
} from "../util/utils_solid";
import { LinkButton } from "./links";
import { ClientContent, TopLevelWrapper } from "./page2";
import { RichtextDocument, summarizeParagraphs } from "./richtext";

const PreviewVideo = lazy(() => import("./preview_video"));

export function Body(props: {body: Generic.Body, autoplay: boolean}): JSX.Element {
    return <DefaultErrorBoundary data={props.body}>
        <Suspense fallback={<div>Loading...</div>}>
            <BodyMayError body={props.body} autoplay={props.autoplay} />
        </Suspense>
    </DefaultErrorBoundary>;
}

function BodyMayError(props: {body: Generic.Body, autoplay: boolean}): JSX.Element {
    return <SwitchKind item={props.body}>{{
        text: text => {
            const [a] = createResource(text, textToBody);
            return <ShowCond when={a()}>{b => <Body body={b} autoplay={false} />}</ShowCond>;
        },
        link: link => {
            const previewBody: () => {
                body: Generic.Body,
            } | undefined = createMemo(() => {
                const body = previewLink(link.url, {
                    suggested_embed: link.embed_html,
                });
                if(!body) return undefined;
                return {body};
            });

            return <div>
                <div><LinkButton
                    client_id={link.client_id}
                    href={link.url}
                    style={"normal"}
                >{link.url}</LinkButton></div>
                <ShowCond when={previewBody()}>{preview_opts => (
                    <Body body={preview_opts.body} autoplay={props.autoplay} />
                )}</ShowCond>
            </div>;
        },
        none: () => <></>,
        gallery: gallery => <ImageGallery images={gallery.images} />,
        removed: removed => {
            const [loadState, setLoadState] = createSignal<{
                kind: "none",
            } | {kind: "loading"} | {kind: "error", body: Generic.Body}
            | {kind: "loaded", body: Generic.Body}>({kind: "none"});
            return <div>
                <div class="border p-2">
                    <div class="font-bold">{removed.removal_message.title}</div>
                    <div>{removed.removal_message.body}</div>
                    <ShowCond when={
                        //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                        (loadState().kind !== "loaded" ? true : undefined) && removed.fetch_path
                    }>{path => {
                        // body.fetch_path
                        const doClick = async () => {
                            const client = await fetchClient(removed.client_id);
                            let new_body: Generic.Body;
                            let errored = false;
                            setLoadState({kind: "loading"});
                            if(!client) {
                                throw new Error("invalid client");
                            }
                            if(!client.fetchRemoved) {
                                throw new Error("client provided a removal fetch path but has no fetchRemoved");
                            }
                            try {
                                new_body = await client.fetchRemoved(path);
                            }catch(error_) {
                                const error = error_ as Error;
                                errored = true;
                                console.log(error);
                                new_body = {
                                    kind: "text",
                                    client_id: "n/a",
                                    content: "Error! "+error.toString(),
                                    markdown_format: "none",
                                };
                            }
                            console.log("Got new body:", new_body);
                            setLoadState({kind: errored ? "error" : "loaded", body: new_body});
                        };
                        return <button
                            class={link_styles_v["outlined-button"]}
                            onclick={() => {
                                void doClick().catch(console.log);
                            }}
                            disabled={loadState().kind === "loading" || loadState().kind === "loaded"}
                        >{{none: "View", loading: "...", error: "Retry", loaded: "never"}[loadState().kind]}</button>;
                    }}</ShowCond>
                </div>
                <Body body={removed.body} autoplay={props.autoplay} />
                <SwitchKind item={loadState()}>{{
                    none: () => <></>,
                    loading: () => <div>Loading...</div>,
                    error: loaded => <div>
                        <Body body={loaded.body} autoplay={false} />
                    </div>,
                    loaded: loaded => <div>
                        <Body body={loaded.body} autoplay={false} />
                    </div>,
                }}</SwitchKind>
            </div>;
        },
        crosspost: xpost => <TopLevelWrapper restrict_w>
            <ClientContent listing={{
                kind: "legacy",
                thread: xpost.source,
                client_id: xpost.client_id,
            }} opts={{
                clickable: true,
                client_id: xpost.client_id,
                frame: null,
                replies: null,
                at_or_above_pivot: false,
                is_pivot: false,
            }} />
        </TopLevelWrapper>,
        richtext: richtext => <div>
            <RichtextDocument content={richtext.content} />
        </div>,
        poll: poll => <div>
            <div>TODO polls are currently not supported</div>
            <ul>
                <For each={poll.choices}>{choice => (
                    <li>{choice.name} ({choice.votes === "hidden" ? "hidden" : "Vote(s)"})</li>
                )}</For>
            </ul>
        </div>,
        captioned_image: image => <div>
            <SolidToVanillaBoundary getValue={() => {
                const div = el("div");
                zoomableImage(image.url, {
                    w: image.w ?? undefined,
                    h: image.h ?? undefined,
                    alt: image.alt
                }).adto(div);
                return div;
            }} />
            <ShowCond when={image.caption}>{caption => (
                <div>Caption: {caption}</div>
            )}</ShowCond>
        </div>,
        video: video => <PreviewVideo video={video} autoplay={props.autoplay} />,
        audio: audio => <audio ref={audio_el => {
            const isVisible = getIsVisible();
            createEffect(() => {
                if(!isVisible()) audio_el.pause();
            });
        }} src={audio.url} autoplay={props.autoplay} controls={true}>
            {audio.alt ?? "Audio is not supported and alt text was not provided"}
        </audio>,
        array: array => <For each={array.body}>{item => {
            if(!item) return null;
            return <Body body={item} autoplay={false} />;
        }}</For>,
        gfycatv1: gfycat => <SolidToVanillaBoundary getValue={hsc => {
            const div = el("div");
            gfyLikeV1(gfycat.host, gfycat.id, {autoplay: props.autoplay}).defer(hsc).adto(div);
            return div;
        }} />,
        gfycatv2: gfycat => <Gfycat data={gfycat} />,
        imgur: imgur => <SolidToVanillaBoundary getValue={hsc => {
            const div = el("div");
            imgurImage(imgur.imgur_kind, imgur.imgur_id).defer(hsc).adto(div);
            return div;
        }} />,
        youtube: youtube => <SolidToVanillaBoundary getValue={hsc => {
            const div = el("div");
            youtubeVideo(youtube.id, youtube.search, {autoplay: props.autoplay}).defer(hsc).adto(div);
            return div;
        }} />,
        twitch_clip: twitch => {
            const [a] = createResource(twitch.slug, getTwitchClip);
            return <ShowCond when={a()}>{b => <Body body={b} autoplay={false} />}</ShowCond>;
        },
        reddit_suggested_embed: se => <SolidToVanillaBoundary getValue={hsc => {
            const div = el("div");
            redditSuggestedEmbed(se.suggested_embed).defer(hsc).adto(div);
            return div;
        }} />,
        link_preview: link_preview => <SolidToVanillaBoundary getValue={hsc => {
            const div = el("div");
            linkPreview(link_preview.client_id, link_preview).defer(hsc).adto(div);
            return div;
        }} />,
        oembed: oembed => <SolidToVanillaBoundary getValue={hsc => {
            const div = el("div");
            renderOembed(oembed).defer(hsc).adto(div);
            return div;
        }} />,
        mastodon_instance_selector: mis => {
            const [instance, setInstance] = createSignal("");
            const acceptable = createMemo(() => {
                const value = instance();
                if(!value.trim()) return false;
                else if(value.indexOf("/") > -1) return false;
                else if(value.indexOf(".") === -1) return false;
                else return true;
            });
            const go = () => {
                if(!acceptable()) return;
                navigate({path: "/"+mis.client_id+"/"+(instance().replaceAll("/", "-"))});
            };
            return <div>
                <h1 class="text-base font-light" style={{'max-width': "6rem"}}>
                    <svg aria-label="Mastodon" class="preview-image"
                        viewBox="0 0 713.35878 175.8678" style="fill: currentColor;"
                    >
                        <use href="/images/mastodon/Logotype (Full).svg#base"
                            width="713.35878" height="175.8678"
                        />
                    </svg>
                </h1>
                <h2 class="text-2xl font-black py-1">Select your instance</h2>
                <div class="py-1">
                    <label>Instance Name: <input
                        class="border rounded-md p-1"
                        placeholder="mastodon.social"
                        value={instance()}
                        oninput={e => setInstance(e.currentTarget.value)}
                        onkeydown={e => {
                            if(e.key === "Enter") go();
                        }}
                    /></label>
                    <button onclick={() => {
                        go();
                    }} 
                        disabled={!acceptable()}
                        class={link_styles_v[acceptable() ? "pill-filled" : "pill-empty"]}
                    >Go →</button>
                </div>
                <p class="py-2">
                    Not on mastodon? Join at{" "}
                    <LinkButton
                        client_id={""}
                        style="normal"
                        href="https://joinmastodon.org"
                    >joinmastodon.org</LinkButton>
                </p>
                <p class="py-2">
                    Note that some instances may require logging in before they let you view timelines.
                </p>
            </div>;
        },
    }}</SwitchKind>;
}

export function summarizeBody(body: Generic.Body): string {
    // note: some of these would benefit from being fetched first. maybe somehow the content of the
    //       rendered body could contribute to the summary?
    // note: if a comment is default collapsed for downvotes, maybe don't show a body summary on it
    return switchKind(body, {
        text: () => "[text]",
        richtext: richtext => summarizeParagraphs(richtext.content),
        link: link => link.url,
        captioned_image: () => "[image]",
        video: () => "[video]",
        gfycatv1: () => "[gif]",
        gfycatv2: () => "[gif]",
        youtube: () => "[video]",
        imgur: () => "[images]",
        twitch_clip: () => "[video]",
        oembed: () => "[link]",
        reddit_suggested_embed: () => "[content]",
        audio: () => "[audio]",
        gallery: () => "[gallery]",
        poll: () => "[poll]",
        none: () => "",
        removed: removed => summarizeBody(removed.body),
        crosspost: () => "[crosspost]",
        array: arr => arr.body.map(item => item ? summarizeBody(item) : "").join("\n"),
        link_preview: link => link.url,
        mastodon_instance_selector: () => "[mastodon instance selector]",
    });
}

export function Gfycat(props: {data: {id: string, host: string}}): JSX.Element {
    const [state, setState] = createSignal<{
        kind: "loading",
    } | {
        kind: "loaded",
        frame: Generic.PostData,
    } | {
        kind: "error",
        message: string,
    }>({kind: "loading"});
    const [retry, setRetry] = createSignal(Symbol());

    createEffect(() => {
        retry();

        let running = true;
        onCleanup(() => running = false);

        const data = props.data;
        gfyLike2(data.host, data.id).then(r => {
            if(!running) return;
            setState({kind: "loaded", frame: r});
        }).catch(e => {
            if(!running) return;
            console.log("got error", e, (e as Error).stack);
            setState({kind: "error", message: (e as Error).toString()});
        });
    });

    return <TopLevelWrapper restrict_w>
        <SwitchKind item={state()}>{{
            loading: () => <>loading...</>,
            loaded: ({frame}) => <ClientContent listing={frame.content} opts={{
                clickable: true,
                client_id: frame.client_id,
                frame: frame,
                replies: null,
                at_or_above_pivot: false,
                is_pivot: false,
            }} />,
            error: e => <div>
                <button onClick={() => {
                    setState({kind: "loading"});
                    setRetry(Symbol());
                }}>Retry</button>
                <span class="text-red-500">{e.message}</span>
            </div>,
        }}</SwitchKind>
    </TopLevelWrapper>;
}

// TODO ↑that but for getting the thumbnail. An optional hint
// can be passed in which will be used if a thumbnail cannot be found
// also it should say what type the thumbnail is in the output to eg put
// a little play icon on videos

// then thumbnail on a post would look like
// `thumbnail: false` | `thumbnail: {hint: "…some url…"}`

function getBound(v: HTMLElement) {
    const rect = v.getBoundingClientRect();
    return {
        x: rect.left,
        y: rect.top + (window.pageYOffset ?? document.documentElement.scrollTop),
        w: rect.width,
        h: rect.height,
    };
}

export function ImageGallery(props: {images: Generic.GalleryItem[]}): JSX.Element {
    const [state, setState] = createStore<{
        kind: "overview",
    } | {
        kind: "image",
        index: number,
    }>({kind: "overview"});

    const [fullscreenState, setFullscreenState] = createSignal<{
        enabled: boolean,
        index: number,
        loading: boolean,
    }>({
        enabled: false,
        index: 0,
        loading: false,
    });

    const settings = getSettings();
    const supportsFullscreen = createMemo(() => props.images.every(img => img.body.kind === "captioned_image"));
    const usesFullscreen = () => supportsFullscreen() && settings.gallery_display.value() === "fullscreen";

    let div!: HTMLDivElement;

    const boundfn = (index: number) => {
        setState({kind: "overview", fullscreen_index: index});
        const boundi = div.querySelector(".img-"+index);
        if(!boundi) return {x: 0, y: 0, w: 0};
        const bound = getBound(boundi as HTMLImageElement);

        const target = props.images[index];
        if(target && target.aspect != null) {
            if(target.aspect > 1) {
                const ph = bound.h;
                bound.h = bound.w * (1 / target.aspect);                
                bound.y += (ph - bound.h) / 2;
            }else{
                const pw = bound.w;
                bound.w = bound.h * target.aspect;
                bound.x += (pw - bound.w) / 2;
            }
        }
        return bound;
    };

    let destroyGallery: (() => void) | undefined;
    onCleanup(() => {
        if(destroyGallery) destroyGallery();
    });
    const visible = getIsVisible();
    createEffect(() => {
        if(!visible()) {
            if(destroyGallery) destroyGallery();
        }
    });

    return <div ref={div}><SwitchKind item={state}>{{
        overview: overview => <ToggleColor>{color => (
            <For each={props.images}>{(image, i) => (
                <button 
                    class={classes(
                        "m-1 inline-block rounded-md",
                        color,
                    )}
                    onclick={() => {
                        if(usesFullscreen()) {
                            setFullscreenState({
                                enabled: true,
                                index: i(),
                                loading: true,
                            });
                            import("../components/gallery").then(gallery => {
                                setFullscreenState({
                                    enabled: true,
                                    index: i(),
                                    loading: false,
                                });
                                if(destroyGallery) destroyGallery();

                                const visible_gallery = gallery.showGallery(props.images, i(), boundfn, {
                                    onclose: () => {
                                        // closed
                                        console.log("gallery closed");
                                        setFullscreenState(f => ({
                                            ...f,
                                            enabled: false,
                                        }));
                                    },
                                    setIndex: (index) => {
                                        setFullscreenState({
                                            enabled: true,
                                            index,
                                            loading: false,
                                        });
                                    },
                                });
                                destroyGallery = () => {
                                    visible_gallery.cleanup();
                                    setState({kind: "overview", fullscreen_index: undefined});
                                };
                            }).catch(e => {
                                console.log("Error loading gallery component", e);
                                setState({kind: "image", index: i()});
                            });
                        }else{
                            setState({kind: "image", index: i()});
                        }
                    }}
                >
                    <img src={image.thumb ?? "error"}
                        class={classes(
                            "w-24 h-24 object-contain img-"+i(),
                            fullscreenState().enabled && fullscreenState().index === i() ? (
                                fullscreenState().loading ? "opacity-50" : "opacity-0"
                            ) : "",
                        )}
                    />
                </button>
            )}</For>
        )}</ToggleColor>,
        image: sel => <>
            <button
                class={link_styles_v["outlined-button"]}
                onclick={() => setState({kind: "image", index: sel.index - 1})}
                disabled={sel.index <= 0}
            >Prev</button>
            {sel.index + 1}/{props.images.length}
            <button
                class={link_styles_v["outlined-button"]}
                onclick={() => setState({kind: "image", index: sel.index + 1})}
                disabled={sel.index >= props.images.length - 1}
            >Next</button>
            <button
                class={link_styles_v["outlined-button"]}
                onclick={() => setState({kind: "overview"})}
            >Gallery</button>
            <Body body={props.images[sel.index]!.body} autoplay={true} />
        </>,
    }}</SwitchKind></div>;
}