import type * as Generic from "api-types-generic";
import { Accessor, createContext, createEffect, createMemo, createSignal, For, JSX, onCleanup, onMount, Signal, untrack, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { Dynamic, render } from "solid-js/web";
import { previewLink } from "threadclient-preview";
import { updateQuery } from "tmeta-util";
import { Show, SwitchKind } from "tmeta-util-solid";
import { Body } from "../../components/body";
import Clickable from "../../components/Clickable";
import { Flair } from "../../components/Flair";
import { FlatReplies, FlatReplyTsch } from "../../components/flatten2";
import { FormattableNumber } from "../../components/flat_posts";
import Icon, { InternalIconRaw } from "../../components/Icon";
import InfoBar, { formatItemString } from "../../components/InfoBar";
import { UnfilledLoader } from "../../components/OneLoader";
import { ClientPostOpts } from "../../components/Post";
import { getVideoSources, NativeVideoElement, VideoRef, VideoState } from "../../components/preview_video";
import proxyURL from "../../components/proxy_url";
import { collapse_data_context } from "../../util/contexts";
import { getWholePageRootContext } from "../../util/utils_solid";

/*
Planned gestures:

swipe vertical:
✓ scroll
double tap:
- like post
tap:
- view content (eg opens photoswipe for a photo or shows a reader view for a text post)
- play/pause video
swipe horizontal:
- swipe between photos
- seek in video
pinch:
~ zoom content

I think we should handle touches ourselves

advantages:
- we can implement all the gestures better
  - pinch zoom can eg:
    - hide the ui (we can implement this currently with that visual viewport change notification thing)
    - zoom the image
    - not zoom the visual viewport (makes it feel nicer to use)
    - not be completely broken because of a scroll-snap bug in every browser and possibly in the spec too
- scroll snap is broken on every browser and possibly in the spec too

disadvantages:
- have to implement for:
  - mouse
  - keyboard
  - touch
  - screenreader
- need the inertia or spring effects or whatever it is (no bouncing but a smooth transition)
  - we can cheat it with css transitions for now. doesn't preserve velocity but better than nothing.

we should definitely handle touch ourselves

also this should change from 'fullscreensnapview' to 'MediaViewer'. while in a fullscreensnapview, it has
the option to handle swipe up/swipe down for next/prev
*/

function SidebarButton(props: {
    icon: Generic.Icon,
    label: string,
    text: FormattableNumber,
}): JSX.Element {
    return <div class="py-3 text-center">
        <Icon class="text-[2rem]" icon={props.icon} bold={false} label={props.label} />
        <div>{formatItemString(props.text).short}</div>
    </div>;
}

function DemoObject(props: {
    children: JSX.Element,
    title: JSX.Element,
    sidebar: JSX.Element,

    showUI: boolean,
}): JSX.Element {
    return <div class={
        "h-screen relative"
    }>
        {props.children}
        <div class="absolute inset-0 w-full h-full pb-12 pointer-events-none" style={{
            display: props.showUI ? "" : "none",
        }}>
            <div class="flex h-full">
                <div class="flex-1 flex flex-col drop-shadow-md">
                    <div class="flex-1" />
                    <div class="p-4 pointer-events-auto bg-hex-000000 bg-opacity-50 max-h-50% overflow-y-scroll">
                        {props.title}
                    </div>
                </div>
                <div class="w-14 flex flex-col drop-shadow-md">
                    <div class="flex-1" />
                    <div class="w-full pointer-events-auto bg-hex-000000 bg-opacity-50 max-h-full overflow-y-scroll">
                        {props.sidebar}
                    </div>
                </div>
            </div>
        </div>
    </div>;
}

// add the svg filter (I tried using a filter url but it has to async load and so it doesn't work the
// first time you render) (a filter url is url(JSON.stringify(data:image/svg+xml,encodeURIComponent(<svg>…</svg>)#sharpBlur))
// https://codepen.io/johndjameson/full/xVjgPy/
document.body.appendChild(<div>
    <style>{`
        .hideSvgSoThatItSupportsFirefox {
            border: 0;
            clip: rect(0 0 0 0);
            height: 1px;
            margin: -1px;
            overflow: hidden;
            padding: 0;
            position: absolute;
            width: 1px;
        }
    `}</style>
    <svg class="hideSvgSoThatItSupportsFirefox">
        <filter id="sharpBlur">
            <feGaussianBlur stdDeviation="2"></feGaussianBlur>
            <feColorMatrix type="matrix" values="1 0 0 0 0, 0 1 0 0 0, 0 0 1 0 0, 0 0 0 9 0"></feColorMatrix>
            <feComposite in2="SourceGraphic" operator="in"></feComposite>
        </filter>
    </svg>
</div> as HTMLElement);

function ImageBody(props: {
    url: string,
    blurhash?: string | undefined,
    color?: string | undefined,
    alt?: string | undefined,

    toggleUI: () => void,
}): JSX.Element {
    let canvasel!: HTMLCanvasElement;

    const url = () => proxyURL(props.url);
    return <div class="w-full h-full relative" style={{'background-color': props.color ?? ""}}>
        <div class="absolute inset-0 w-full h-full overflow-hidden">
            <canvas
                ref={canvasel} width={20} height={20}
                class="w-full h-full"
            />
        </div>
        <img
            src={url()}
            class="relative block w-full h-full object-contain"
            onClick={() => props.toggleUI()}
            onLoad={e => {
                const ctx2d = canvasel.getContext("2d");
                if(!ctx2d) {
                    // ?
                    return;
                }
                // wow we can almost do the entire filter thing with an svg filter url. no canvas needed
                // https://yoksel.github.io/svg-filters/#/
                // Blur ColorMatrix Composite Offset Merge
                // the only issue is we need to scale it right and that's a dynamic value
                // = we could build a solid js thing to update the filter but that seems wrong

                ctx2d.drawImage(
                    e.currentTarget, 0, 0,
                    canvasel.width, canvasel.height,
                );
                ctx2d.globalCompositeOperation = "copy";
                // vv this filter url is working fine but it seems the js canvas doesn't like it for some reason
                ctx2d.filter = "url(#sharpBlur)";
                ctx2d.drawImage(canvasel, 0, 0);
            }}
        />
    </div>;
}

function ratelimit(limit_ms: number, cb: () => void): {now: () => void} {
    let prevt = 0;
    let prepared = false;
    return {
        now: () => {
            if(prepared) return;
            const now = Date.now();
            const oldprevt = prevt;
            prevt = now;
            if(now > oldprevt + limit_ms) {
                return cb();
            }

            prepared = true;
            setTimeout(() => {
                prepared = false;
                cb();
            }, Math.max(0, (oldprevt + limit_ms) - now));
        },
    };
}

// TODO: virtual scrolling
function FullscreenGallery(props: {
    gallery: Generic.BodyGallery,
}): JSX.Element {
    const zoomed = useContext(zoomed_provider)!;

    const [currentIndex, setCurrentIndex] = createSignal(0);

    const object_descriptions: Signal<JSX.Element[]>[] = [];

    const currentDescs = createMemo(() => {
        const i = currentIndex();
        const c_desc = object_descriptions[i] ??= createSignal([]);

        const itms = c_desc[0]();
        return itms;
    });

    useAddDescription(<>
        <div>Image {currentIndex() + 1} / {props.gallery.images.length}</div>
        <For each={currentDescs()}>{itm => <div>{itm}</div>}</For>
    </>);

    return <div class={"h-full w-full overflow-hidden "+(zoomed() ? "" : "overflow-x-scroll snap-x snap-mandatory")} ref={el => {
        const rl = ratelimit(250, () => {    
            const current_scroll = el.scrollLeft + (el.offsetWidth / 2);
            const max_scroll = el.scrollWidth;
            const num_items = props.gallery.images.length;

            const scroll_percent = current_scroll / max_scroll;
            const scroll_idx = scroll_percent * num_items;

            setCurrentIndex(Math.max(0, Math.min(num_items - 1, scroll_idx |0)));
    
            // todo: estimate it by taking:
            // - the total length
            // - divide by the number of items
            // - estimate the current index
    
            // el.scrollLeft;
    
            // const elements = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            // const elem = elements.find(el => (el as Hasoursym)[oursym] === true) as Hasoursym | undefined;
            // setZoomed(elem ?? null);
        });
    
        el.addEventListener("scroll", e => {
            if(e.target !== e.currentTarget) return;
            rl.now();
        }, {passive: true});
        onMount(() => {
            rl.now();
        });
    }}>
        <div class="w-full h-full px-8">
            <div class="flex h-full gap-4">
                <For each={props.gallery.images}>{(img, i) => (
                    <VirtualElement class="w-full snap-center shrink-0 h-full py-8">
                        <description_provider.Provider value={description => {
                            const dc = [description];
                            createEffect(() => {
                                const iv = i();
                                const objdsc = object_descriptions[iv] ??= createSignal([]);
                                const itms = untrack(() => objdsc[0]());
                                itms.push(dc);
                                onCleanup(() => {
                                    const idx = itms.indexOf(dc);
                                    if(idx === -1) return;
                                    itms.splice(idx, 1);
                                });
                            });
                        }}>
                            <FullscreenBody body={img.body} toggleUI={() => {alert("TODO rewrite toggleUI")}} />
                        </description_provider.Provider>
                    </VirtualElement>
                )}</For>
                <div class="shrink-0 w-4" />
            </div>
        </div>
    </div>;
}

function FullscreenBody(props: {
    body: Generic.Body,

    toggleUI: () => void, // get rid of this & use injection
}): JSX.Element {
    // TODO:
    // - on the body fallback render, you should:
    // - tap to activate some view
    //   - it lets you scroll
    //   - it has an exit button
    return <SwitchKind item={props.body} fallback={body => <div class="h-full">
        <div class="w-full h-full bg-zinc-900">
            <div class="bg-zinc-800 text-zinc-50 h-full p-4 max-w-2xl mx-auto text-base max-h-full overflow-y-hidden">
                <Body body={body} autoplay={false} />
            </div>
        </div>,
    </div>}>{{
        captioned_image: img => {
            useAddDescription(<>{img.caption}</>);
            return <ImageBody
                url={img.url}
                alt={img.alt}

                toggleUI={props.toggleUI}
            />;
        },
        gallery: gal => <FullscreenGallery gallery={gal} />,
        link: url => {
            useAddDescription(<Clickable class="underline" action={{
                url: url.url,
                client_id: url.client_id,
            }}>{url.url}</Clickable>);
            return <Show when={previewLink(url.url, {suggested_embed: url.embed_html})} fallback={
                <div>External Link. TODO click to open</div>
            }>{body => (
                <FullscreenBody body={body} toggleUI={props.toggleUI} />
            )}</Show>;
        },
        video: video => {
            useAddDescription(<>{video.caption}</>);
            return <div class="w-full h-full">
                <SwitchKind item={video.source}>{{
                    video: source => <FullscreenVideoPlayer video={video} source={source} />,
                    img: img => <FullscreenBody body={{
                        kind: "captioned_image",
                        url: img.url,
                        w: null,
                        h: null,
                    }} toggleUI={props.toggleUI} />,
                }}</SwitchKind>
            </div>;
        },
    }}</SwitchKind>;
}

function createAnimationFrameLoop(playing: Accessor<boolean>, cb: () => void): {update: () => void} {
    let run_loop = false;
    let active_loop: number | null = null;

    createEffect(() => {
        run_loop = playing();
        untrack(() => go());
    });

    function go() {
        if(active_loop != null) return;
        active_loop = requestAnimationFrame(() => {
            active_loop = null;
            cb();
            if(run_loop) go();
        });
    }

    onCleanup(() => {
        run_loop = false;
        if(active_loop != null) cancelAnimationFrame(active_loop);
    });
    return {update: () => go()};
}

function FullscreenVideoPlayer(props: {
    video: Generic.Video,
    source: Generic.VideoSourceVideo,
}): JSX.Element {
    // GESTURES:
    // - tap drag left/right: seek
    // - single tap: play/pause

    // tap and drag left or right:
    // - pause the video
    // - show an overlay with:
    //   - a fullscreen version of the preview track
    //   - a timestamp
    //   - a bar showing the percentage
    // - the time the drag left goes by should be either:
    //   - percent video
    //     - for long videos, this makes it hard to go short distances
    //   - number of seconds based on (px from left of screen / 100vw)
    //     - for long videos, this makes it hard to go from back to front
    //     - maybe if the bar stays visible for a sec or it's visible when paused
    //       you could drag that when you want to go long distances

    const [targetQuality, setTargetQuality] = createSignal(0);
    () => setTargetQuality;
    const sources = createMemo(() => getVideoSources(targetQuality, props.source.sources));

    let canvasel!: HTMLCanvasElement;

    let video_ref!: VideoRef; // use this to draw a canvas
    const [state, setState] = createStore<VideoState>({
        max_time: 0,
        current_time: 0,
        quality: null,
        buffered: [],
        playing: "loading",
        error_overlay: null,
        errored_sources: {},
        playback_rate: 1,
        live: null,
    });

    // TODO: consider scaling the rendered object to match the width or height of the video rather than
    // stretching (note that the canvas is square, we can't just use object-cover)

    const afl = createAnimationFrameLoop(() => state.playing === true, () => {
        const ctx2d = canvasel.getContext("2d");
        if(!ctx2d) {
            // ?
            return;
        }

        if(video_ref != null) ctx2d.drawImage(
            video_ref.video_el, 0, 0,
            canvasel.width, canvasel.height,
        );
        ctx2d.globalCompositeOperation = "copy";
        // vv this filter url is working fine but it seems the js canvas doesn't like it for some reason
        ctx2d.filter = "url(#sharpBlur)";
        ctx2d.drawImage(canvasel, 0, 0);

        if(false as true) {
            ctx2d.save();
            ctx2d.globalCompositeOperation = "source-over";
            ctx2d.fillStyle = "white";
            ctx2d.textBaseline = "top";
            ctx2d.fillText("" + Math.random(), 2, 2);
            ctx2d.restore();
        }
    });
    createEffect(() => {
        state.max_time;
        state.current_time;
        state.quality;
        state.buffered;
        state.playing;
        state.error_overlay;
        state.errored_sources;
        state.playback_rate;
        state.live;
        afl.update();
    });

    return <div class="relative w-full h-full">
        <div class="absolute top-0 left-0 bottom-0 right-0">
            <canvas
                ref={canvasel} width={100} height={100}
                class="w-full h-full"
            />
        </div>
        <div class="absolute top-0 left-0 bottom-0 right-0" ref={el => {
            new IntersectionObserver((itms => {
                itms.forEach(itm => {
                    if(itm.target === el) {
                        if(itm.isIntersecting) {
                            video_ref.play();
                        }else{
                            video_ref.pause();
                        }
                    }
                });
            }), {
                threshold: 0.5,
            }).observe(el);
        }}>
            <NativeVideoElement
                state={state}
                setState={setState}
                videoRef={v => {
                    video_ref = v;
                    
                    video_ref.video_el.addEventListener("click", e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if(state.playing === false) video_ref.play(); else video_ref.pause();
                        // ^ TODO: display the same play state indicators the other thing has
                    });
                }}

                video={props.video}
                source={props.source}
                sources={sources()}
                autoplay={false}
                show_controls={false}
            />
        </div>
    </div>;
}

function ContentWarningDisplay(props: {
    cws: Generic.Flair[],
    onConfirm: () => void,
}): JSX.Element {
    /*
        <OnTap ev={() => } />
        <OnLRDrag ev={() => } />
        we might be reimplementing drag handlers ourselves because scroll snap doesn't work all
        that well
    */
    return <button class="block w-full h-full p-4" onClick={() => props.onConfirm()}>
        <div class="text-lg">Content Warning:</div>
        <div class="text-xl"><Flair flairs={props.cws} /></div>
        <div class="text-base">Tap to view.</div>
    </button>;
}

// alternatively: <AddDescription desc={<></>}> … </AddDescription> so we can put a provider inside
function useAddDescription(description: JSX.Element) {
    useContext(description_provider)!(description);
}

function FullscreenPost(props: {
    content: Generic.PostContentPost,
    opts: ClientPostOpts,
}): JSX.Element {
    const [contentWarning, setContentWarning] = createSignal(
        !!(props.content.flair ?? []).find(flair => flair.content_warning),
    );
    const zoomed = useContext(zoomed_provider)!;
    // alternatively:
    // - [acceptedContentWarnings, setAcceptedContentWarnings]
    // - const allAccepted = () => flair.filter(content_warning).filter(not in accepted).length === 0
    // (requires stable ids for the flairs, which we can do pretty easily)
    //
    // that would mean that if a new cw is added to a post, it will reprompt

    const desc_el = document.createElement("div");

    return <DemoObject title={<>
        <Show when={props.content.title}>{title => <div class="font-bold">
            {title.text}
        </div>}</Show>
        <div>
            <Flair flairs={props.content.flair ?? []} />
        </div>
        {desc_el}
        <div class="">By u/author on r/subreddit</div>
        <div class=""><InfoBar post={props.content} opts={props.opts} /></div>
    </>} sidebar={<>
        <Show when={props.content.actions?.vote}>{voteact => <>
            <Clickable class="block w-full" action="TODO">
                <SidebarButton
                    icon={voteact.increment.icon}
                    label={voteact.increment.label}
                    text={["number", -1]}
                />
            </Clickable>
            <Clickable class="block w-full" action="TODO">
                <Show when={voteact.decrement}>{decrement => <>
                    <SidebarButton
                        icon={decrement.icon}
                        label={decrement.label}
                        text={voteact.percent == null ? ["none", 0] : ["percent", voteact.percent]}
                    />
                </>}</Show>
            </Clickable>
        </>}</Show>
        <Show when={props.opts.frame?.url}>{post_url => (
            <Clickable class="block w-full" action={{url: post_url, client_id: props.opts.client_id}}>
                <SidebarButton
                    icon="comments"
                    label="Comments"
                    text={props.content.info?.comments != null ? ["number", props.content.info?.comments] : ["none", 0]}
                />
            </Clickable>
        )}</Show>
        <Clickable class="block w-full" action="TODO">
            <SidebarButton
                icon="ellipsis"
                label="More"
                text={["none", 0]}
            />
        </Clickable>
    </>} showUI={!zoomed()}>
        <Show if={!contentWarning()} fallback={<>
            <ContentWarningDisplay
                onConfirm={() => setContentWarning(false)}
                cws={(props.content.flair ?? []).filter(f => f.content_warning)}
            />
        </>}>
            <description_provider.Provider value={(description) => {
                const descbox = desc_el;
                const mydescel = document.createElement("div");
                descbox.appendChild(mydescel);
                onCleanup(() => mydescel.remove());

                render(() => description, mydescel);
            }}>
                <FullscreenBody body={props.content.body} toggleUI={() => {
                    // setShowUI(v => !v);
                }}  />
            </description_provider.Provider>
        </Show>
    </DemoObject>;
}

const zoomed_provider = createContext<null | Accessor<boolean>>(null);
const description_provider = createContext<(description: JSX.Element) => void>();

export default function FullscreenSnapView(props: {
    pivot: Generic.Link<Generic.Post>,
}): JSX.Element {
    const sel = document.createElement("style");
    sel.textContent = `
        body {
            margin-bottom: 0 !important;
        }
    `;
    onCleanup(() => {
        sel.remove();
    });
    document.body.appendChild(sel);

    const hprc = getWholePageRootContext();

    const m = createMemo((): {
        replies: Generic.PostReplies,
        pivot: Generic.Post,
    } => {
        const res = hprc.content.view(props.pivot);
        if(res == null || res.error != null) throw new Error("rve");
        const v = res.value;
        if(v.kind !== "post") throw new Error("rve2");
        if(v.replies == null) throw new Error("rve3");
        // if(v.replies.display !== "repivot_list") throw new Error("rve4");
        const rpls = v.replies;

        return {
            replies: rpls,
            pivot: v,
        };
    });

    const replies = FlatReplyTsch.useChildren(() => (
        <collapse_data_context.Provider value={{map: new Map()}}>
            <FlatReplies replies={m().replies} />
        </collapse_data_context.Provider>
    ));

    const [zoomed, setZoomed] = createSignal<boolean>(false);

    const rszel = (ev: Event) => {
        if((visualViewport?.scale ?? 1) > 1.0001) {
            setZoomed(true);
        }else{
            setZoomed(false);
        }
    };
    visualViewport?.addEventListener("resize", rszel);
    onCleanup(() => visualViewport?.removeEventListener("resize", rszel));

    return <zoomed_provider.Provider value={zoomed}><div class={
        "bg-hex-000 h-screen overflow-hidden snap-mandatory text-zinc-100 space-y-8 "
        +(zoomed() ? "" : "snap-y overflow-y-scroll")
    } style={{
        'touch-action': "auto",
    }}>
        <For each={replies()}>{item => {
            return <VirtualElement class="snap-center w-full h-full">
                <SwitchKind item={item}>{{
                    'error': (emsg) => <div class="w-full h-full">
                        E;ERROR;{emsg.msg}
                    </div>,
                    'flat_loader': fl => <div class="w-full h-full">
                        <UnfilledLoader label="Load More" loader={fl} />
                    </div>,
                    'flat_post': flat_post => <SwitchKind item={flat_post.post.content} fallback={obj => <>
                        E;TODO;{obj.kind}
                    </>}>{{
                        'post': post => <FullscreenPost content={post} opts={{
                            client_id: flat_post.post.client_id,
                            frame: flat_post.post,
                            flat_frame: null,
                            id: flat_post.link,
                        }} />,
                    }}</SwitchKind>,
                }}</SwitchKind>
            </VirtualElement>;
        }}</For>
    </div><Clickable
        class="fixed top-0 left-0 bg-hex-000000 bg-opacity-50 p-4"
        action={{
            url: updateQuery(m().pivot.url ?? "ENO", {'--tc-view': undefined}),
            client_id: m().pivot.client_id,
            mode: "replace",
            page: (): Generic.Page2 => ({content: hprc.content.untrackToContent(), pivot: props.pivot}),
        }}
    >
        <InternalIconRaw
            class="fa-solid fa-down-left-and-up-right-to-center text-base"
            label={"Exit Fullscreen"}
        />
    </Clickable></zoomed_provider.Provider>;
}

function VirtualElement(props: {children: JSX.Element, class: string}): JSX.Element {
    const [showContent, setShowContent] = createSignal(false);

    let visible_now = false;
    let req: number | undefined;

    let parent_el!: HTMLDivElement;
    let detector_el!: HTMLDivElement;

    onMount(() => {
        const ise = new IntersectionObserver((e) => {
            e.forEach(entry => {
                if(entry.target === parent_el) {
                    if(entry.isIntersecting) {
                        visible_now = true;
                        if(req != null) cancelIdleCallback(req);
                        setTimeout(() => {
                            setShowContent(visible_now);
                        }, 300); // so it doesn't do it if you scroll over a bunch
                    }
                    return;
                }else if(entry.target !== detector_el) return;
                // ios safari:
                if(!('requestIdleCallback' in window)) {
                    (window as unknown as {
                        requestIdleCallback: (cb: () => void) => void,
                    })["requestIdleCallback"] = cb => cb();
                }
                if(!('cancelIdleCallback' in window)) {
                    (window as unknown as {
                        cancelIdleCallback: () => void,
                    })["cancelIdleCallback"] = () => void 0;
                }

                console.log("INTERSECTIONOBSERVER CB", e);

                if(entry.isIntersecting) {
                    visible_now = true;
                    if(req != null) cancelIdleCallback(req);
                    req = requestIdleCallback(() => {
                        req = undefined;
                        setShowContent(visible_now);
                    });
                    // ^ ideally we should just skip the idle callback the moment the first pixel is
                    // visible but that's complicated because intersectionobserver doesn't allow negative
                    // margins and you have to use rootMargin instead
                }else{
                    visible_now = false;
                    if(req != null) cancelIdleCallback(req);
                    req = requestIdleCallback(() => {
                        req = undefined;
                        setShowContent(visible_now);
                    });
                }
            });
        }, {
            root: document.documentElement,
            threshold: 0,
        });
        ise.observe(parent_el);
        ise.observe(detector_el);
    });

    return <div class={"snap-center w-full h-full relative " + props.class} data-visible={"" + showContent()} ref={el => {
        parent_el = el;
    }}>
        <Dynamic component="intersection-observer" class="absolute top-0 left-0 bottom-0 right-0 transform scale-150 pointer-events-none" ref={detector_el} />
        <Show if={showContent()} fallback="… loading">
            {props.children}
        </Show>
    </div>;
}