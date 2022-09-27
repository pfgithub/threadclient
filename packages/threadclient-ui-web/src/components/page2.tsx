import * as Generic from "api-types-generic";
import { createMemo, JSX, lazy, untrack } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { getClientCached } from "../clients";
import { clientListing } from "../page1";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { DefaultErrorBoundary, getWholePageRootContextOpt } from "../util/utils_solid";
import Header from "./Header";
import OneLoader from "./OneLoader";
import ClientPost, { ClientPostOpts } from "./Post";

const Submit = lazy(() => import("./Submit"));

export function ReadLink<T>(props: {
    link: Generic.Link<T>,
    children: (value: T) => JSX.Element,
    whenError?: undefined | ((emsg: string) => JSX.Element),
    fallback: JSX.Element,
}): JSX.Element {
    const hprc = getWholePageRootContextOpt();
    const linkval = createMemo((): ({kind: "none"} | {kind: "error", msg: string} | {kind: "value", value: T}) => {
        if(hprc == null) return {kind: "none"};
        const linkres = Generic.readLink(hprc.content(), props.link);
        if(linkres == null) return {kind: "none"};
        if(linkres.error != null) return {kind: "error", msg: linkres.error};
        return {kind: "value", value: linkres.value};
    }, undefined, {equals: (a, b) => {
        // this might not be necessary if SwitchKind is implemented well but I'm not sure if it is
        // ^ it is not because it fundamentally cannot be implemented well due to how unions work
        // - unions would have to have a seperate tag and value for SwitchKind to be implemented to handle
        //   this properly
        if(a === b) return true;
        if(a == null) return a === b;
        if(b == null) return false;
        if(a.kind === "error") return b.kind === "error" && a.msg === b.msg;
        if(a.kind === "value") return b.kind === "value" && a.value === b.value;
        return false;
    }});

    return <SwitchKind item={linkval()} children={{
        'none': () => props.fallback,
        'error': emsg => <Show when={props.whenError} fallback={<div class="text-red-500">
            error: {emsg.msg}
        </div>} children={whenError => <>{untrack(() => whenError(emsg.msg))}</>} />,
        'value': value => <>{untrack(() => props.children(value.value))}</>,
    }} />;
}

export function ClientContent(props: {
    content: Generic.PostContent,
    opts: ClientPostOpts,

    hovering?: undefined | boolean,
    whole_object_clickable?: undefined | boolean,
}): JSX.Element {
    return <DefaultErrorBoundary data={[props.content, props.opts]}><SwitchKind item={props.content}>{{
        one_loader: postv => (
            <OneLoader label="Load Post" loader={postv}>{content => (
                <ClientPost
                    content={content}
                    opts={props.opts}
                    hovering={props.hovering}
                    whole_object_clickable={props.whole_object_clickable}
                />
            )}</OneLoader>
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
        client: () => <>TODO client</>,
        special: special => <ClientContent content={special.fallback} opts={props.opts} />,
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