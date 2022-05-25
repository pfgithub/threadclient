import type * as Generic from "api-types-generic";
import { readLink } from "api-types-generic";
import { createMemo, createSignal, For, JSX, onCleanup } from "solid-js";
import { updateQuery } from "threadclient-client-reddit";
import { Show, SwitchKind } from "tmeta-util-solid";
import { Flair } from "../../components/Flair";
import { CollapseData, FlatTreeItem, postReplies } from "../../components/flatten";
import Icon, { InternalIconRaw } from "../../components/Icon";
import InfoBar from "../../components/InfoBar";
import { A } from "../../components/links";
import proxyURL from "../../components/proxy_url";
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
*/

function SidebarButton(props: {
    icon: Generic.Icon,
    label: string,
    text: string,
    onClick: () => void,
}): JSX.Element {
    return <button class="block w-full" onClick={() => props.onClick()}>
        <div class="py-3 text-center">
            <Icon class="text-[2rem]" icon={props.icon} bold={false} label={props.label} />
            <div>{props.text}</div>
        </div>
    </button>;
}

function DemoObject(props: {
    children: JSX.Element,
    title: JSX.Element,

    showUI: boolean,
}): JSX.Element {
    return <div class={
        "snap-start h-screen relative"
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
                        <SidebarButton
                            icon="up_arrow"
                            label="Upvote"
                            text="1.3k"
                            onClick={() => alert("TODO")}
                        />
                        <SidebarButton
                            icon="down_arrow"
                            label="Downvote"
                            text="98%"
                            onClick={() => alert("TODO")}
                        />
                        <SidebarButton
                            icon="comments"
                            label="Comments"
                            text="53"
                            onClick={() => alert("TODO")}
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>;
}

let osla: (() => void)[] | undefined = [];
function onSVGLoaded(cb: () => void): void {
    if(osla == null) return cb();
    osla.push(cb);
    return;
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
    <svg  class="hideSvgSoThatItSupportsFirefox" onLoad={() => {
        const v = osla ?? [];
        osla = undefined;
        v.forEach(c => c());
    }}>
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
            loading="lazy"
            onClick={() => props.toggleUI()}
            onLoad={(e) => onSVGLoaded(() => {
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
            })}
        />
    </div>;
}

function FullscreenBodyInfoLine(props: {
    body: Generic.Body,
}): JSX.Element {
    return <SwitchKind item={props.body} fallback={itm => <div>
        TODO {itm.kind}
    </div>}>{{
        captioned_image: img => <Show when={img.caption}>{caption => <>
            <div>{caption}</div>
        </>}</Show>,
        gallery: gal => <div>{gal.images.length} images</div>,
    }}</SwitchKind>;
}

function FullscreenBody(props: {
    body: Generic.Body,

    toggleUI: () => void,
}): JSX.Element {
    return <SwitchKind item={props.body} fallback={itm => <div>
        TODO {itm.kind}
    </div>}>{{
        captioned_image: img => <ImageBody
            url={img.url}
            alt={img.alt}

            toggleUI={props.toggleUI}
        />,
        gallery: gal => <div class="h-full w-full overflow-x-scroll snap-x">
            <div class="w-full h-full px-8">
                <div class="flex h-full gap-4">
                    <For each={gal.images}>{img => (
                        <div class="w-full snap-center shrink-0 h-full py-8">
                            <div class="relative h-full">
                                <FullscreenBody body={img.body} toggleUI={props.toggleUI} />
                                <div class="absolute left-0 top-0 w-full bg-hex-000 bg-opacity-50 max-h-50% overflow-y-scroll p-2">
                                    <FullscreenBodyInfoLine body={img.body} />
                                </div>
                            </div>
                        </div>
                    )}</For>
                    <div class="shrink-0 w-4" />
                </div>
            </div>
        </div>,
    }}</SwitchKind>;
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

function FullscreenPost(props: {
    content: Generic.PostContentPost,
}): JSX.Element {
    const [contentWarning, setContentWarning] = createSignal(
        !!(props.content.flair ?? []).find(flair => flair.content_warning),
    );
    // alternatively:
    // - [acceptedContentWarnings, setAcceptedContentWarnings]
    // - const allAccepted = () => flair.filter(content_warning).filter(not in accepted).length === 0
    // (requires stable ids for the flairs, which we can do pretty easily)
    //
    // that would mean that if a new cw is added to a post, it will reprompt

    const [showUI, setShowUI] = createSignal(true);

    return <DemoObject title={<>
        <Show when={props.content.title}>{title => <div class="font-bold">
            {title.text}
        </div>}</Show>
        <div>
            <Flair flairs={props.content.flair ?? []} />
        </div>
        <FullscreenBodyInfoLine body={props.content.body} />
        <div class="">By u/author on r/subreddit</div>
        <div class=""><InfoBar post={props.content} /></div>
    </>} showUI={showUI()}>
        <Show if={!contentWarning()} fallback={<>
            <ContentWarningDisplay
                onConfirm={() => setContentWarning(false)}
                cws={(props.content.flair ?? []).filter(f => f.content_warning)}
            />
        </>}>
            <FullscreenBody body={props.content.body} toggleUI={() => {
                setShowUI(v => !v);
            }}  />
        </Show>
    </DemoObject>;
}

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
    const list = createMemo((): {
        items: FlatTreeItem[],
        pivot: Generic.ActualPost,
    } => {
        const res = readLink(hprc.content(), props.pivot);
        if(res == null || res.error != null) throw new Error("rve");
        const v = res.value;
        if(v.kind !== "post") throw new Error("rve2");
        if(v.replies == null) throw new Error("rve3");
        // if(v.replies.display !== "repivot_list") throw new Error("rve4");
        const rpls = v.replies;
        const rps = postReplies(rpls, {
            collapse_data: undefined as unknown as CollapseData,
            content: hprc.content(),
        });
        return {
            items: rps,
            pivot: v,
        };
    });

    return <div class="bg-hex-000 h-screen overflow-y-scroll snap-y snap-mandatory text-zinc-100">
        <For each={list().items}>{item => <>
            <SwitchKind item={item}>{{
                'error': (emsg) => <div class="snap-start w-full h-full">
                    E;ERROR;{emsg.msg}
                </div>,
                'flat_loader': fl => <div class="snap-start w-full h-full">
                    TODO loader
                </div>,
                'flat_post': flat_post => <SwitchKind item={flat_post.post.content} fallback={obj => <>
                    E;TODO;{obj.kind}
                </>}>{{
                    'post': post => <FullscreenPost content={post} />,
                }}</SwitchKind>,
            }}</SwitchKind>
        </>}</For>

        <A
            class="fixed top-0 left-0 bg-hex-000000 bg-opacity-50 p-4"
            mode="replace"
            client_id={list().pivot.client_id}
            page={(): Generic.Page2 => ({content: hprc.content(), pivot: props.pivot})}
            href={updateQuery(list().pivot.url ?? "ENO", {'--tc-fullscreen': undefined})}
        >
            <InternalIconRaw
                class="fa-solid fa-down-left-and-up-right-to-center text-base"
                label={"Exit Fullscreen"}
            />
        </A>
    </div>;
}