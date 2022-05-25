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
*/

function DemoTitle(): JSX.Element {
    return <>
        <div class="font-bold">Post Title</div>
        <div class="">By u/author on r/subreddit</div>
        <div class="">©12d ↑1.3k ☺97%</div>
    </>;
}

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
}): JSX.Element {
    return <div class={
        "snap-start h-screen relative"
    }>
        {props.children}
        <div class="absolute inset-0 w-full h-full pb-12 pointer-events-none">
            <div class="flex h-full">
                <div class="flex-1 flex flex-col drop-shadow-md">
                    <div class="flex-1" />
                    <div class="p-4 pointer-events-auto bg-hex-000000 bg-opacity-50">
                        {props.title}
                    </div>
                </div>
                <div class="w-14 flex flex-col drop-shadow-md">
                    <div class="flex-1" />
                    <div class="w-full pointer-events-auto bg-hex-000000 bg-opacity-50">
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

function psurl(v: string): string {
    return "https://picsum.photos/seed/"+v;
}

function ImageBody(props: {
    url: string,
    blurhash?: string | undefined,
    color?: string | undefined,
    alt?: string | undefined,
}): JSX.Element {
    const url = () => proxyURL(props.url);
    return <div class="w-full h-full relative" style={{'background-color': props.color ?? ""}}>
        <div class="absolute inset-0 w-full h-full overflow-hidden">
            <div class="w-full h-full transform scale-150">
                <img
                    src={url()}
                    class="w-full h-full object-cover filter blur-24px "
                    alt={props.alt}
                    loading="lazy"
                />
            </div>
        </div>
        <img
            src={url()}
            class="relative block w-full h-full object-contain"
            loading="lazy"
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
    }}</SwitchKind>;
}

function FullscreenBody(props: {
    body: Generic.Body,
}): JSX.Element {
    return <SwitchKind item={props.body} fallback={itm => <div>
        TODO {itm.kind}
    </div>}>{{
        captioned_image: img => <ImageBody
            url={img.url}
            alt={img.alt}
        />,
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
    </>}>
        <Show if={!contentWarning()} fallback={<>
            <ContentWarningDisplay
                onConfirm={() => setContentWarning(false)}
                cws={(props.content.flair ?? []).filter(f => f.content_warning)}
            />
        </>}>
            <FullscreenBody body={props.content.body}  />
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
        <DemoObject title={<DemoTitle />}>
            <ImageBody url={psurl("1/255/550")} color={"#886b53"} />
        </DemoObject>
        <DemoObject title={<DemoTitle />}>
            <ImageBody url={psurl("2/270/550")} color={"#272e36"} />
        </DemoObject>
        <DemoObject title={<DemoTitle />}>
            <ImageBody url={psurl("3/550/255")} color={"#545841"} />
        </DemoObject>
        <DemoObject title={<DemoTitle />}>
            <div class="w-full h-full bg-yellow-500"></div>
        </DemoObject>
        <DemoObject title={<DemoTitle />}>
            <div class="w-full h-full bg-black"></div>
        </DemoObject>
        <DemoObject title={<DemoTitle />}>
            <div class="w-full h-full bg-white-500"></div>
        </DemoObject>
        <DemoObject title={<DemoTitle />}>
            <div class="p-4">
                Text body? We'll have to display a bunch and end it with a 'read more' button
            </div>
        </DemoObject>

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