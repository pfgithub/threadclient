import { createEffect, createMemo, createResource, createSignal, For, JSX, lazy, Suspense } from "solid-js";
import {
    getTwitchClip, gfyLike,
    imgurImage,
    linkPreview,
    link_styles_v,
    navigate,
    previewLink,
    redditSuggestedEmbed,
    renderImageGallery,
    renderOembed,
    textToBody, youtubeVideo,
    zoomableImage
} from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { getClient, getIsVisible, ShowCond, SwitchKind } from "../util/utils_solid";
import { ClientContent, DefaultErrorBoundary } from "./author_pfp";
import { LinkButton } from "./links";
import { RichtextParagraphs } from "./richtext";
export * from "../util/interop_solid";

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
            const client = getClient();

            const previewBody: () => {
                body: Generic.Body,
            } | undefined = createMemo(() => {
                const body = previewLink(client(), link.url, {
                    suggested_embed: link.embed_html,
                });
                if(!body) return undefined;
                return {body};
            });

            return <div>
                <div><LinkButton href={link.url} style={"normal"}>{link.url}</LinkButton></div>
                <ShowCond when={previewBody()}>{preview_opts => (
                    <Body body={preview_opts.body} autoplay={props.autoplay} />
                )}</ShowCond>
            </div>;
        },
        none: () => <></>,
        gallery: gallery => <SolidToVanillaBoundary getValue={(hsc, client) => {
            const div = el("div");
            renderImageGallery(client(), gallery.images).defer(hsc).adto(div);
            return div;
        }} />,
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
                        const client = getClient();
                        // body.fetch_path
                        const doClick = async () => {
                            let new_body: Generic.Body;
                            let errored = false;
                            setLoadState({kind: "loading"});
                            if(!client().fetchRemoved) {
                                throw new Error("client provided a removal fetch path but has no fetchRemoved");
                            }
                            try {
                                new_body = await client().fetchRemoved!(path);
                            }catch(error_) {
                                const error = error_ as Error;
                                errored = true;
                                console.log(error);
                                new_body = {
                                    kind: "text",
                                    content: "Error! "+error.toString(),
                                    markdown_format: "none",
                                };
                            }
                            console.log("Got new body:", new_body);
                            setLoadState({kind: errored ? "error" : "loaded", body: new_body});
                        };
                        return <button
                            class={link_styles_v["outlined-button"]}
                            on:click={() => {
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
        crosspost: xpost => <div class="bg-body rounded-xl max-w-xl">
            <ClientContent listing={{
                kind: "legacy",
                thread: xpost.source,
            }} opts={{
                clickable: true,
                replies: null,
                at_or_above_pivot: false,
                is_pivot: false,
                top_level: false,
            }} />
        </div>,
        richtext: richtext => <div>
            <RichtextParagraphs content={richtext.content} />
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
        gfycat: gfycat => <SolidToVanillaBoundary getValue={(hsc, client) => {
            const div = el("div");
            gfyLike(client(), gfycat.host, gfycat.id, {autoplay: props.autoplay}).defer(hsc).adto(div);
            return div;
        }} />,
        imgur: imgur => <SolidToVanillaBoundary getValue={(hsc, client) => {
            const div = el("div");
            imgurImage(client(), imgur.imgur_kind, imgur.imgur_id).defer(hsc).adto(div);
            return div;
        }} />,
        youtube: youtube => <SolidToVanillaBoundary getValue={(hsc, client) => {
            const div = el("div");
            youtubeVideo(youtube.id, youtube.search, {autoplay: props.autoplay}).defer(hsc).adto(div);
            return div;
        }} />,
        twitch_clip: twitch => {
            const [a] = createResource(twitch.slug, getTwitchClip);
            return <ShowCond when={a()}>{b => <Body body={b} autoplay={false} />}</ShowCond>;
        },
        reddit_suggested_embed: se => <SolidToVanillaBoundary getValue={(hsc, client) => {
            const div = el("div");
            redditSuggestedEmbed(se.suggested_embed).defer(hsc).adto(div);
            return div;
        }} />,
        link_preview: link_preview => <SolidToVanillaBoundary getValue={(hsc, client) => {
            const div = el("div");
            linkPreview(client(), link_preview).defer(hsc).adto(div);
            return div;
        }} />,
        oembed: oembed => <SolidToVanillaBoundary getValue={(hsc, client) => {
            const div = el("div");
            renderOembed(client(), oembed).defer(hsc).adto(div);
            return div;
        }} />,
        mastodon_instance_selector: () => {
            const client = getClient();
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
                navigate({path: "/"+client().id+"/"+(instance().replaceAll("/", "-"))});
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
                    <button on:click={() => {
                        go();
                    }} 
                        disabled={!acceptable()}
                        class={link_styles_v[acceptable() ? "pill-filled" : "pill-empty"]}
                    >Go →</button>
                </div>
                <p class="py-2">
                    Not on mastodon? Join at{" "}
                    <LinkButton style="normal" href="https://joinmastodon.org">joinmastodon.org</LinkButton>
                </p>
                <p class="py-2">
                    Note that some instances may require logging in before they let you view timelines.
                </p>
            </div>;
        },
    }}</SwitchKind>;
}

export function ImageGallery(props: {images: Generic.GalleryItem[]}): JSX.Element {
    const [state, setState] = createSignal<{kind: "overview"} | {kind: "image", index: number}>({kind: "overview"});

    return <SwitchKind item={state()}>{{
        overview: overview => <>
            <For each={props.images}>{(image, i) => (
                <button 
                    class="m-1 inline-block bg-body rounded-md"
                    on:click={() => setState({kind: "image", index: i()})}
                >
                    <img src={image.thumb ?? "error"} width={image.w+"px"} height={image.h+"px"}
                        class="w-24 h-24 object-contain"
                    />
                </button>
            )}</For>
        </>,
        image: sel => <>
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => setState({kind: "image", index: sel.index - 1})}
                disabled={sel.index <= 0}
            >Prev</button>
            {sel.index + 1}/{props.images.length}
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => setState({kind: "image", index: sel.index + 1})}
                disabled={sel.index >= props.images.length - 1}
            >Next</button>
            <button
                class={link_styles_v["outlined-button"]}
                on:click={() => setState({kind: "overview"})}
            >Gallery</button>
            <Body body={props.images[sel.index]!.body} autoplay={true} />
        </>,
    }}</SwitchKind>;
}