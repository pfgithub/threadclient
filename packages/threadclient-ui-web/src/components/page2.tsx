import * as Generic from "api-types-generic";
import { JSX, lazy } from "solid-js";
import { SwitchKind } from "tmeta-util-solid";
import { getClientCached } from "../clients";
import { clientListing, renderNavbar } from "../page1";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { DefaultErrorBoundary, getWholePageRootContextOpt } from "../util/utils_solid";
import Header from "./Header";
import OneLoader from "./OneLoader";
import ClientPost, { ClientPostOpts } from "./Post";

const Submit = lazy(() => import("./Submit"));

export function ClientContent(props: {
    content: Generic.PostContent,
    opts: ClientPostOpts,

    hovering?: undefined | boolean,
    whole_object_clickable?: undefined | boolean,
}): JSX.Element {
    const hprc = getWholePageRootContextOpt();
    return <DefaultErrorBoundary data={[props.content, props.opts]}><SwitchKind item={props.content} fallback={v => (
        <div>TODO content kind {v.kind}</div>
    )}>{{
        post: content => (
            <ClientPost
                content={content}
                opts={props.opts}
                hovering={props.hovering}
                whole_object_clickable={props.whole_object_clickable}
            />
        ),
        nonpivoted_identity_card: npic => (
            <div>
                TODO nonpivoted identity card: {npic.card.name_raw}
            </div>
        ),
        page: page => {
            // note: if the flat item indicates that this is below the pivot && not the main sidebar id card:
            // - render a smaller version. just a profile pic and a title.
            // - likely we should the smaller version just using the limited version of the id card
            // - and support putting a pfp on limited id cards
            //   - we'll need that for replacing InfoAuthor with identity cards too (excl. flair)
            return <OneLoader label="Load Header" loader={page.wrap_page.header.filled}>{filled => (
                <Header header={filled} opts={props.opts} />
            )}</OneLoader>;
        },
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
        client: client_v => <>
            <SolidToVanillaBoundary getValue={hsc => {
                const client = getClientCached(client_v.navbar.client_id)!;
                return renderNavbar(client, client_v.navbar, hprc).defer(hsc);
            }} />
        </>,
        special: special => <ClientContent content={special.fallback} opts={props.opts} />,
        error: emsg => <div>error {emsg.message}</div>,
    }}</SwitchKind></DefaultErrorBoundary>;
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