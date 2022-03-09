import { batch, createSignal, Signal, untrack } from "solid-js";
import { asObject2, unreachable } from "./guards";

type UkObject = {[key: string]: UkAnyData};
type UkString = string;
type UkBigInt = bigint;
type UkUndefined = undefined;
type UkNull = null;

type UkAnyData = UkObject | UkString | UkBigInt | UkUndefined | UkNull;

type Person = {
    name: string,
    description: string,
};
type SampleStructure = {
    people: {[key: string]: Person},
};

const __ERROR = Symbol("Error");
type ERROR<Obj, Msg extends string> = (typeof __ERROR) & {msg: Msg, obj: Obj};

type L1Unknown<T> =
    | {[key: string]: Holder<T extends {[sub in typeof key]: infer U} ? U : ERROR<T, "not in schema type">>}
    | string
    | bigint
    | undefined
    | null
;

type L1Wrapped<T> = {[k in keyof T]: T[k] | Holder<T[k]>};
// type L1Wrapped<T> = (
//     T extends {[key: string]: unknown} ? (
//         {[k in keyof T]: T[k] | Holder<T[k]>}
//     ) : T extends undefined | null | string | bigint ? (
//         T
//     ) : ERROR<T, "Invalid type, must br record | undefined | null | string | bigint">
// );

const holder_sym = Symbol("holder");

type Holder<T> = {
    [holder_sym]: true,

    // get will, upon setting, convert the value to an object if it is not already
    get<Key extends (T extends {[key: string]: unknown} ? keyof T : never)>(key: Key): Holder<T[Key]>;

    exists(): Holder<Exclude<T, null | undefined>> | null,
    
    // null will be returned if the actual value is not a string. "unknown" is included in the type to account for
    // any string that is not explicitly listed. you 
    string(): T extends string ? T | "unknown" | null : ERROR<T, "schema does not list this entry as a string">;
    // null will be returnde if the actual value is not a bigint
    bigint(): T extends bigint ? bigint | null : ERROR<T, "schema does not list this entry as a bigint">;

    set(nv: (pv: L1Unknown<T>) => L1Wrapped<T>): void,
};

// note also eventually we'll want full history and synchronization across multiple clients
// that shouldn't be too hard to do, we just have to set up batching for undo and emit events
// to a server, but just keep it in mind.
type HolderParent = {
    holder: HolderSolid<any>,
    our_key: string,
};
type HolderValue = string | bigint | undefined | null | {
    keys: Signal<Set<string>>,
};
class HolderSolid<T> implements Holder<T> {
    [holder_sym] = true as const;

    // parents must be notified on set in case
    // the parent either is not an object or does not have the field that was requested
    #parent: HolderParent | null;
    
    #value: Signal<HolderValue>;
    #existing_or_observed_props: Map<string, HolderSolid<any>>;

    constructor(parent: HolderParent | null) {
        this.#parent = parent;

        this.#value = createSignal(undefined);
        this.#existing_or_observed_props = new Map();
    }

    // [!] .get() *does not track value*. pretty neat don't you think?
    get: Holder<T>["get"] = (key) => {
        if(typeof key !== "string") throw new Error("Holders only allow string keys");

        let res = this.#existing_or_observed_props.get(key);
        if(!res) {
            const nv: HolderSolid<any> = new HolderSolid<any>({
                holder: this,
                our_key: key,
            });
            this.#existing_or_observed_props.set(key, nv);
            res = nv;
        }
        const ress: Holder<any> = res;
        return ress;
    }
    exists() {
        const value = this.#value[0]();
        if(value == null) return null;
        return this as unknown as Holder<Exclude<T, undefined | null>>;
    }
    string() {
        const value = this.#value[0]();
        if(typeof value === "string") return value as any;
        return null as any;
    }
    bigint() {
        const value = this.#value[0]();
        if(typeof value === "bigint") return value as any;
        return null as any;
    }

    set: Holder<T>["set"] = (nv) => {
        untrack(() => batch(() => {
            this.#setInternal(nv as any);
        }));
    }

    // only necessary to call if a node is being changed from `undefined`
    #notifyAboutChildUpdate(child_key: string): void {
        const prev_value = this.#value[0]();
        if(prev_value != null && typeof prev_value === "object") {
            // update our object with the new keys
            prev_value.keys[1](keys => {
                if(!keys.has(child_key)) {
                    return new Set([...keys, child_key]);
                }
                return keys;
            });
        }else{
            // notify our parent of our update
            if(this.#parent) this.#parent.holder.#notifyAboutChildUpdate(this.#parent.our_key, this);
            // turn ourself into an object
            this.#value[1](prev => {
                if(prev != null && typeof prev_value === "object") unreachable();
                return {
                    keys: createSignal(new Set([child_key])),
                };
            });
        }
    }
    /*
    ok here's the logic it should be 34loc

    // 1: notify the parent of the update

    const pv = get(node);
    const nv = value(pv);


    if(pv === nv) return;
    if(!isObject(pv) || !isObject(nv)) {
        return setOverwrite(node, () => nv);
    }

    const old_keys = Object.keys(pv) as UUID[];
    const new_keys = Object.keys(nv) as UUID[];

    const to_remove = new Set(old_keys);
    for(const new_key of new_keys) to_remove.delete(new_key);

    // update all new keys
    for(const key of new_keys) {
        setReconcileInternal(pv[key]!, () => {
            return nv[key]![internal_value][0]();
        });
    }

    // update keys array
    pv[internal_keys]![1](new_keys);

    // remove all old keys
    // - (aka redefine them as fake keys aka leak memory)
    // - (TODO fix by seperating arrays from objects)
    // - (arrays have a keys prop but are not defined for unknown uuids)
    // - (objects cannot return their keys and have no order (for json stringification, return sorted order))
    for(const key of to_remove) {
        fakeUpdate(pv, key, pv[key][internal_value]);
    }
    */
    #setInternal(cb: (pv: L1Unknown<{[key: string]: unknown}>) => L1Wrapped<unknown>): void {
        // [1]: notify our parent of the update
        if(this.#parent) this.#parent.holder.#notifyAboutChildUpdate(this.#parent.our_key);

        // reconcile content
        // (note: update parents of any holders if they need updating)

        const nv = cb(l1unwrap(this.#value[0]()));

        if(typeof nv !== "object") {
            // [!] if this is an object, we need to delete all the keys
            this.#value[1](pv => {
                if(pv != null && typeof pv === "object") {
                    for(const key of pv.keys[0]()) {
                        this.
                    }
                }
                return nv;
            });
        }

        const old_keys = asObject2(this.#value[0]())?.keys[0]() ?? [];
        const new_keys = Object.keys(nv);

        const to_remove = new Set(old_keys);
        for(const new_key of new_keys) to_remove.delete(new_key);

        // update all new keys
        for(const [key, value] of Object.entries(nv)) {
            const v = this.get(key as any);
            if(!(v instanceof HolderSolid)) unreachable();
            v.#setInternal(() => value as any);
        }
        // update keys array
        // set all old keys to undefined but do not add them to keys.
        //     [?] consider making undefined identical to `key does not exist`?
    
        const pv = this.#value[0](); // don't call this above that for loop^ setInternal changes it
        if(pv == null || typeof pv !== "object") unreachable();

        pv.keys[1]((prev_keys) => {
            const new_keys = new Set(Object.keys(nv));
            if(JSON.stringify([...prev_keys]) !== JSON.stringify([...new_keys])) {
                return new_keys;
            }
            return prev_keys;
        });
    }
}
function l1unwrap(v: HolderValue): L1Unknown<{[key: string]: unknown}> {
    if(v != null && typeof v === "object") return Object.fromEntries([...v.keys[0]()].map(key => {
        const prop_val = v.existing_or_observed_props.get(key);
        if(prop_val == null) unreachable();
        return [key, prop_val] as [string, Holder<unknown>];
    }));
    return v;
}

// let structure!: Holder<SampleStructure>;

// structure.get("people").get("test").get("description").string();
// structure.string();
// structure.get("people").set(pv => {
//     return {
//         ...(pv != null && typeof pv === "object" ? pv : {}),
//         new_entry: {
//             name: "nope",
//             description: "hmm",
//         },
//     };
// });

function isHolder(v: unknown): v is Holder<any> {
    return v != null && typeof v === "object" && holder_sym in v;
}

// function createEmptyHolder<Target extends UkAnyData>(parent: HolderParent | null): Holder<Target> {
//     return new HolderSolid<Target>(parent);
// }
// function wrapValue<T extends UkAnyData>(value: T, parent: HolderParent | null): Holder<T> {
//     if(isHolder(value)) {
//         value.#parent
//     }

//     const v = createEmptyHolder<T>(parent);
//     v.set(() => value);
//     return v;
// }