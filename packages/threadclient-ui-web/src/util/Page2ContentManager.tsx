import type * as Generic from "api-types-generic";
import { batch, createSignal, Signal, untrack } from "solid-js";
import { fetchClient } from "../clients";

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

export default class Page2ContentManager {
    #signals: Map<
        Generic.NullableLink<unknown>,
        Signal<null | Generic.ReadLinkResult<unknown>>
    >;
    #load_states: Map<Generic.Link<Generic.Opaque<"loader">>, Signal<LoadState>>;
    #secrets: Page2SecretsManager;

    constructor(secrets: Page2SecretsManager) {
        this.#signals = new Map();
        this.#load_states = new Map();
        this.#secrets = secrets;
    }

    load(loader: Generic.BaseLoader): void {
        const [state, setState] = this.#getLoadSignal(loader.request);
        const cstate = untrack(() => state());
        if (cstate.kind === "progress" || cstate.kind === "success") {
            return; // already loading
        }
        setState({kind: "progress"});
        (async () => {
            const request = untrack(() => this.view(loader.request));
            if (request == null || request.error != null) {
                throw new Error(`load failure: ${request?.error ?? "e-request-null"} / for key: ${loader.request.toString()}`);
            }
            const client = await fetchClient(loader.client_id);
            const tokens = this.#secrets.getTokens(loader.client_id);
            const resp = await client!.loader!(request.value, tokens);
            this.#secrets.updateTokens(loader.client_id, tokens, resp.tokens);
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