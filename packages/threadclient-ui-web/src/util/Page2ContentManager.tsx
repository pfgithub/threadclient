import type * as Generic from "api-types-generic";
import { batch, createSignal, Signal, untrack } from "solid-js";
import { ThreadClient } from "threadclient-client-base";

export type LoadState = {kind: "none"} | {kind: "progress"} | LoadStateError | {kind: "success"};
export type LoadStateError = {kind: "error", msg: string};

export class Page2SecretsManager {
    #tokens: Map<string, Generic.Tokens>;

    constructor() {
        this.#tokens = new Map();
    }

    updateTokens(client: string, from: Generic.Tokens, to?: Generic.UpdateTokens): void {
        if (!to) return;
        // from will be used to match the active account when we support multiaccount
        // ie if the active account changed between when we sent the request and when we got the response
        const store = this.getTokens(client);
        if (to.app != null) store.app = to.app;
        if (to.active_account != null) store.active_account = to.active_account; 
        if (to.active_account_name != null) store.active_account_name = to.active_account_name;
    }
    getTokens(client: string): Generic.Tokens {
        if (!this.#tokens.has(client)) {
            this.#tokens.set(client, {});
        }
        return this.#tokens.get(client)!;
    }

    static instance(): Page2SecretsManager {
        return page2SecretsManagerInstance;
    }
}
const page2SecretsManagerInstance = new Page2SecretsManager();

type SortState = {kind: "none"} | {kind: "load"} | {kind: "error", message: string};

export default class Page2ContentManager {
    // TODO: once view is removed, we can switch this to Signal<unknown>
    #signals: Map<Generic.Link<unknown>, Signal<Generic.ReadLinkResult<unknown> | null>>;
    #load_states: Map<Generic.Link<Generic.Opaque<"loader">>, Signal<LoadState>>;
    #sort_states: Map<Generic.Link<Generic.SortGroup>, Signal<SortState>>;
    #backing: ThreadClient; // TODO: multiple backing for multiclient (we might need ids to have a client on them?)
    pivot: Generic.Link<Generic.Post>;

    constructor(client: ThreadClient, pivot: Generic.Link<Generic.Post>) {
        this.#signals = new Map();
        this.#load_states = new Map();
        this.#sort_states = new Map();
        this.#backing = client;
        this.pivot = pivot;
    }

    sort(group: Generic.Link<Generic.SortGroup>, option: Generic.Opaque<"sort_option">): void {
        const [state, setState] = this.#getSortSignal(group);
        const cstate = untrack(() => state());
        if (cstate.kind === "load") return; // already loading
        setState({kind: "load"});
        (async () => {
            const gv = untrack(() => this.view2(group).group);
            const tokens = Page2SecretsManager.instance().getTokens(this.#backing.id);
            const resp = await this.#backing.sort(gv, option, tokens);
            Page2SecretsManager.instance().updateTokens(this.#backing.id, tokens, resp.tokens);
            console.log("load response", resp);
            batch(() => {
                this.invalidate(resp.dirty);
                setState({kind: "none"});
            });
        })().catch(e => {
            console.error(e);
            setState({kind: "error", message: (e as Error).toString()});
        });
    }
    viewSortStatus(sorter: Generic.Link<Generic.SortGroup>): SortState {
        const [state, setState] = this.#getSortSignal(sorter);
        return state();
    }
    #getSortSignal(group: Generic.Link<Generic.SortGroup>): Signal<SortState> {
        if (!this.#sort_states.has(group)) {
            this.#sort_states.set(group, createSignal<SortState>({kind: "none"}));
        }
        return this.#sort_states.get(group)!;
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
            const tokens = Page2SecretsManager.instance().getTokens(this.#backing.id);
            const resp = await this.#backing.loaderLoad(request, tokens);
            Page2SecretsManager.instance().updateTokens(this.#backing.id, tokens, resp.tokens);
            console.log("load response", resp);
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