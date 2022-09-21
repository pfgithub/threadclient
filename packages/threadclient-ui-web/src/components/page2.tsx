import type * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { SwitchKind } from "tmeta-util-solid";
import { getClientCached } from "../clients";
import { clientContent, clientListing } from "../page1";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { DefaultErrorBoundary } from "../util/utils_solid";
import ClientPost, { ClientPostOpts } from "./Post";
import Submit from "./Submit";

// ?!?!?!?! why are there two almost identical functions what is the difference
// ClientContentAny is used in:
// - PageFlatItem Content rendering
// - page1 Displaying reply after submit
// ClientContent is used in:
// - Reply rendering
// - Settings previews
// - Body crosspost rendering
// ?!?!?!?!??!!!!?
// resolution:
// 1. delete ClientContent:
//     - update uses to use ClientContent
//     - change 'listing={}' to 'content={}'
// 2. rename ClientContentAny to ClientContent

export function ClientContentAny(props: {
    content: Generic.PostContent,
    opts: ClientPostOpts,

    hovering?: undefined | boolean,
    whole_object_clickable?: undefined | boolean,
}): JSX.Element {
    return <SwitchKind item={props.content}>{{
        post: content => (
            <ClientPost
                content={content}
                opts={props.opts}
                hovering={props.hovering}
                whole_object_clickable={props.whole_object_clickable}
            />
        ),
        page: () => <>TODO page</>,
        submit: submit => <>
            <Submit submit={submit.submission_data} opts={props.opts} />
        </>,
        legacy: legacy => <>
            <SolidToVanillaBoundary getValue={hsc => {
                const outer = el("div").clss("-mt-10px -ml-10px");
                const frame = el("div").clss("post text-sm").adto(outer);
                const client = getClientCached(legacy.client_id)!;
                clientListing(client, legacy.thread, frame, {
                    clickable: true,
                }).defer(hsc);
                return outer;
            }} />
        </>,
        client: () => <>TODO client</>,
        special: special => <ClientPost content={special.fallback} opts={props.opts} />,
    }}</SwitchKind>;
}

// …? what's the difference between "clientcontent" and "clientcontentany"? these are basically the exact
// same code copy/pasted
// pretty sure all uses of 'ClientContentAny' should be removed and replaced with 'ClientContent'
export type ClientContentProps = {listing: Generic.PostContent, opts: ClientPostOpts};
export function ClientContent(props: ClientContentProps): JSX.Element {
    const todosupport = (thing: unknown) => <>
        TODO support. also in the parent list these should probably{" "}
        be one of those navbars with bits like ClientName {">"} PageName {">"} …{" "}
        <button onclick={() => console.log(thing)}>code</button>
    </>;
    return <div>
        <DefaultErrorBoundary data={[props.listing, props.opts]}>
            <SwitchKind item={props.listing}>{{
                page: thing => todosupport(thing),
                client: thing => todosupport(thing),
                post: post => <>
                    <ClientPost content={post} opts={props.opts} />
                </>,
                submit: submit => <>
                    <Submit submit={submit.submission_data} opts={props.opts} />
                </>,
                special: special => <>
                    <ClientPost content={special.fallback} opts={props.opts} />
                </>,
                legacy: legacy => <SolidToVanillaBoundary getValue={(hsc): HTMLElement => {
                    // clientContent(client, r, {clickable: false}).defer(hsc).adto(el("div").adto(content_buttons_line));
                    // return clientContent()
                    //                             clientContent(client, r, {clickable: false}).defer(hsc).adto(el("div").adto(content_buttons_line));
                    const client = getClientCached(legacy.client_id)!;
                    return clientContent(client, legacy.thread, {clickable: true}).defer(hsc);
                }}/>,
            }}</SwitchKind>
        </DefaultErrorBoundary>
    </div>;
}

export function TopLevelWrapper(props: {
    children: JSX.Element,
}): JSX.Element {
    return <div class={
        "m-3 p-3 shadow-md sm:rounded-xl <sm:mx-0"
        + " " + "bg-slate-100 dark:bg-zinc-800"
    }>{props.children}</div>;
}

export function CrosspostWrapper(props: {
    children: JSX.Element,
    // max-w-xl?
}): JSX.Element {
    return <div class="bg-slate-300 dark:bg-zinc-900 p-2 rounded-xl">
        <div class="rounded-md bg-slate-100 dark:bg-zinc-800 p-3">
            {props.children}
        </div>
    </div>;
}