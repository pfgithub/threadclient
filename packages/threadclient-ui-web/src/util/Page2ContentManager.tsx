import type * as Generic from "api-types-generic";
import { batch, createSignal, Signal, untrack } from "solid-js";
import { DeprecatedClient } from "threadclient-client-base";
import { fetchClient } from "../clients";

export class Page4ContentManager {
    // TODO: once view is removed, we can switch this to Signal<unknown>
    #signals: Map<Generic.Link<unknown>, Signal<Generic.ReadLinkResult<unknown> | null>>;
    #load_states: Map<Generic.Link<Generic.Opaque<"loader">>, Signal<LoadState>>;
    #backing: DeprecatedClient; // TODO: multiple backing for multiclient (we might need ids to have a client on them?)

    constructor(client: DeprecatedClient) {
        this.#signals = new Map();
        this.#load_states = new Map();
        this.#backing = client;
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
}

export type LoadState = {kind: "none"} | {kind: "progress"} | LoadStateError | {kind: "success"};
export type LoadStateError = {kind: "error", msg: string};

export default class Page2ContentManager {
    #signals: Map<
        Generic.NullableLink<unknown>,
        Signal<null | Generic.ReadLinkResult<unknown>>
    >;
    #load_states: Map<Generic.Link<Generic.Opaque<"loader">>, Signal<LoadState>>;

    constructor() {
        this.#signals = new Map();
        this.#load_states = new Map();
    }

    load(loader: Generic.BaseLoader): void {
        const [state, setState] = this.#getLoadSignal(loader.request);
        const cstate = untrack(() => state());
        if (cstate.kind === "progress") {
            return; // already loading
        }
        setState({kind: "progress"});
        (async () => {
            const request = untrack(() => this.view(loader.request));
            if (request == null || request.error != null) {
                throw new Error(`load failure: ${request?.error ?? "e-request-null"} / for key: ${loader.request.toString()}`);
            }
            const client = await fetchClient(loader.client_id);
            const resp = await client!.loader!(request.value);
            batch(() => {
                this.addData(resp.content);
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

    setData(new_data: Generic.Page2Content) {
        // diff:
        batch(() => {
            const old_deleted = new Set<Generic.NullableLink<unknown>>();
            for(const key of this.#signals.keys()) {
                old_deleted.add(key);
            }
            const in_new = new Set<Generic.NullableLink<unknown>>();
            for(const key of Reflect.ownKeys(new_data) as Generic.NullableLink<unknown>[]) {
                in_new.add(key);
                old_deleted.delete(key);
            }

            // 1. delete all old_not_new
            for(const key of old_deleted) {
                this.getSignal(key)[1](null);
            }
            // 2. update all new
            for(const key of in_new) {
                this.getSignal(key)[1](() => toLinkres(new_data[key]));
            }
        });
    }
    addData(new_data: Generic.Page2Content) {
        // diff:
        batch(() => {
            const in_new = new Set<Generic.NullableLink<unknown>>();
            for(const key of Reflect.ownKeys(new_data) as Generic.NullableLink<unknown>[]) {
                in_new.add(key);
            }

            // update all new
            for(const key of in_new) {
                this.getSignal(key)[1](() => toLinkres(new_data[key]));
            }
        });
    }

    view<T>(link: Generic.NullableLink<T>): null | Generic.ReadLinkResult<T> {
        const signal = this.getSignal(link);
        return signal[0]() as Generic.ReadLinkResult<T>;
    }
    getSignal(link: Generic.NullableLink<unknown>): Signal<null | Generic.ReadLinkResult<unknown>> {
        const existsver = this.#signals.get(link);
        if(existsver != null) return existsver;
        const newver = createSignal<null | Generic.ReadLinkResult<unknown>>(null);
        this.#signals.set(link, newver);
        return newver;
    }

    /**
     * @deprecated Don't use this. There is no replacement, you shouldn't need it.
     */
    untrackToContent(): Generic.Page2Content {
        return untrack((): Generic.Page2Content => {
            const res: Generic.Page2Content = {};
            for(const [key, item] of this.#signals) {
                const value = item[0]();
                if(value == null) {
                    //
                } else if(value.error != null) {
                    res[key] = {error: value.error};
                }else{
                    res[key] = {data: value.value};
                }
            }
            return res;
        });
    }
}
function toLinkres(v: Generic.Page2Content[Generic.NullableLink<unknown>]): null | Generic.ReadLinkResult<unknown> {
    if(v == null) return null;
    if('error' in v) return {error: v.error, value: null};
    return {error: null, value: v.data};
}