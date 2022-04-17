import type * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { SwitchKind } from "tmeta-util-solid";
import { clientContent, clientListing, getClientCached } from "../app";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { DefaultErrorBoundary, ToggleColor } from "../util/utils_solid";
import ClientPost, { ClientPostOpts } from "./Post";

export function ClientContentAny(props: {content: Generic.PostContent, opts: ClientPostOpts}): JSX.Element {
    return <SwitchKind item={props.content}>{{
        post: content => (
            <ClientPost content={content} opts={props.opts} />
        ),
        page: () => <>TODO page</>,
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
        special: () => <>TODO special</>,
    }}</SwitchKind>;
}

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
                post: (post) => <>
                    <ClientPost content={post} opts={props.opts} />
                </>,
                legacy: legacy => <SolidToVanillaBoundary getValue={(hsc): HTMLElement => {
                    // clientContent(client, r, {clickable: false}).defer(hsc).adto(el("div").adto(content_buttons_line));
                    // return clientContent()
                    //                             clientContent(client, r, {clickable: false}).defer(hsc).adto(el("div").adto(content_buttons_line));
                    const client = getClientCached(legacy.client_id)!;
                    return clientContent(client, legacy.thread, {clickable: props.opts.clickable}).defer(hsc);
                }}/>,
                special: thing => todosupport(thing),
            }}</SwitchKind>
        </DefaultErrorBoundary>
    </div>;
}

export function TopLevelWrapper(props: {
    children: JSX.Element,
    restrict_w?: undefined | boolean,
}): JSX.Element {
    return <ToggleColor>{(color, i) => <div class={
        (i === 0 ? "m-3 p-3 shadow-md sm:rounded-xl <sm:mx-0" : "p-10px mt-10px rounded-xl")
        + " " + color
        + " " + (props.restrict_w ?? false ? "max-w-xl" : "")
    }>{props.children}</div>}</ToggleColor>;
}