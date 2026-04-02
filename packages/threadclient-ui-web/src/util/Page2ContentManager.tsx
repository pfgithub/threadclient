import type * as Generic from "api-types-generic";
import { batch, createSignal, Signal, untrack } from "solid-js";
import { ThreadClient } from "threadclient-client-base";

export type LoadState = {kind: "none"} | {kind: "progress"} | LoadStateError | {kind: "success"};
export type LoadStateError = {kind: "error", msg: string};

export default class Page2ContentManager {
    // TODO: once view is removed, we can switch this to Signal<unknown>
    #signals: Map<Generic.Link<unknown>, Signal<Generic.ReadLinkResult<unknown> | null>>;
    #load_states: Map<Generic.Link<Generic.Opaque<"loader">>, Signal<LoadState>>;
    #backing: ThreadClient; // TODO: multiple backing for multiclient (we might need ids to have a client on them?)
    pivot: Generic.Link<Generic.Post>;

    constructor(client: ThreadClient, pivot: Generic.Link<Generic.Post>) {
        this.#signals = new Map();
        this.#load_states = new Map();
        this.#backing = client;
        this.pivot = pivot;
    }

    load(loader: Generic.BaseLoader): void {
        const [state, setState] = this.#getLoadSignal(loader.request);
        const cstate = untrack(() => state());
        if (cstate.kind === "progress") {
            return; // already loading
        }
        setState({kind: "progress"});
        (async () => {
            const request = untrack(() => this.view2(loader.request));
            const resp = await this.#backing.loaderLoad(request);
            batch(() => {
                this.invalidate(resp.dirty);
                setState({kind: "success"});
            });
        })().catch(e => {
            console.error(e);
            setState({kind: "error", msg: (e as Error).toString()});
        });
    }
    viewLoadStatus(loader: Generic.BaseLoader): LoadState {
        const [state, setState] = this.#getLoadSignal(loader.request);
        return state();
    }
    #getLoadSignal(request: Generic.Link<Generic.Opaque<"loader">>): Signal<LoadState> {
        if (!this.#load_states.has(request)) {
            this.#load_states.set(request, createSignal<LoadState>({kind: "none"}));
        }
        return this.#load_states.get(request)!;
    }

    invalidate(dirty: Generic.Link<unknown>[]): void {
        // refetch all dirty link contents
        batch(() => {
            for (const link of dirty) {
                if (this.#signals.has(link)) {
                    const [, setValue] = this.#signals.get(link)!;
                    setValue(this.#backing.resolveLinkOld(link));
                }
            }
        });
    }
    /** @deprecated: use view2 */
    view<T>(link: Generic.Link<T>): Generic.ReadLinkResult<T> | null {
        const [value] = this.#getSignal(link);
        return value();
    }
    view2<T>(link: Generic.Link<T>): T {
        const [value] = this.#getSignal(link);
        const res = value();
        if (!res || res.error != null) throw new Error(res?.error ?? "none");
        return res.value;
    }
    #getSignal<T>(link: Generic.Link<T>): Signal<Generic.ReadLinkResult<T> | null> {
        const existsver = this.#signals.get(link);
        if(existsver != null) return existsver as Signal<Generic.ReadLinkResult<T> | null>;
        const newver = createSignal<Generic.ReadLinkResult<T> | null>(this.#backing.resolveLinkOld(link));
        this.#signals.set(link, newver as Signal<Generic.ReadLinkResult<unknown> | null>);
        return newver;
    }

    /** for navigation */
    dupe(pivot: Generic.Link<Generic.Post>): Page2ContentManager {
        const {client, dirty} = this.#backing.dupe();
        const res = new Page2ContentManager(client, pivot);
        res.invalidate(dirty);
        return res;
    }
}
function toLinkres(v: Generic.Page2Content[Generic.NullableLink<unknown>]): null | Generic.ReadLinkResult<unknown> {
    if(v == null) return null;
    if('error' in v) return {error: v.error, value: null};
    return {error: null, value: v.data};
}