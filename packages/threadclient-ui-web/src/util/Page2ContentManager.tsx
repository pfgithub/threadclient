import type * as Generic from "api-types-generic";
import { batch, createSignal, Signal, untrack } from "solid-js";

export default class Page2ContentManager {
    #signals: Map<
        Generic.NullableLink<unknown>,
        Signal<null | Generic.ReadLinkResult<unknown>>
    >;

    constructor() {
        this.#signals = new Map();
    }

    setData(new_data: Generic.Page2Content) {
        // diff:
        batch(() => {
            const old_deleted = new Set<Generic.NullableLink<unknown>>();
            for(const key of this.#signals.keys()) {
                old_deleted.add(key);
            }
            const in_new = new Set<Generic.NullableLink<unknown>>();
            for(const key of Object.keys(new_data) as Generic.NullableLink<unknown>[]) {
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
            for(const key of Object.keys(new_data) as Generic.NullableLink<unknown>[]) {
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