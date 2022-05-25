import type * as Generic from "api-types-generic";
import { readLink } from "api-types-generic";
import { createMemo, For, JSX, onCleanup } from "solid-js";
import { updateQuery } from "threadclient-client-reddit";
import { Show, SwitchKind } from "tmeta-util-solid";
import { CollapseData, FlatTreeItem, postReplies } from "../../components/flatten";
import { InternalIconRaw } from "../../components/Icon";
import { A } from "../../components/links";
import proxyURL from "../../components/proxy_url";
import { getWholePageRootContext } from "../../util/utils_solid";

function DemoTitle(): JSX.Element {
    return <>
        <div class="font-bold">Post Title</div>
        <div class="">By u/author on r/subreddit</div>
        <div class="">©12d ↑1.3k ☺97%</div>
    </>;
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
                    <div class="p-4 pointer-events-auto bg-hex-000000 bg-opacity-40">
                        {props.title}
                    </div>
                </div>
                <div class="w-14 flex flex-col drop-shadow-md">
                    <div class="flex-1" />
                    <div class="w-full pointer-events-auto bg-hex-000000 bg-opacity-40">
                        <div class="py-3 text-center">
                            <InternalIconRaw class="text-[2rem] fa-solid fa-arrow-up" label="Upvote" />
                            <div>1.3k</div>
                        </div>
                        <div class="py-3 text-center">
                            <InternalIconRaw class="text-[2rem] fa-solid fa-arrow-down" label="Downvote" />
                            <div>3%</div>
                        </div>
                        <div class="py-3 text-center">
                            <InternalIconRaw class="text-[2rem] fa-regular fa-comment" label="Comment" />
                            <div>53</div>
                        </div>
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
                    'post': post => <DemoObject title={<>
                        <Show when={post.title}>{title => <div class="font-bold">
                            {title.text}
                        </div>}</Show>
                        <FullscreenBodyInfoLine body={post.body} />
                        <div class="">By u/author on r/subreddit</div>
                        <div class="">©12d ↑1.3k ☺97%</div>
                    </>}>
                        <FullscreenBody body={post.body} />
                    </DemoObject>,
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
            class="fixed top-0 left-0 bg-hex-000000 bg-opacity-40 p-4"
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