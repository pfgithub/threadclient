// [!] ok this is cool and all
//     but what if we rethink it entirely
//     just have one big Set<string path, void signal>
//     and then one big object that is the actual value

import { batch, createMemo, createSignal, Signal, untrack } from "solid-js";
import { asObject, isObject, unreachable } from "./guards";

const _error = Symbol("error");
type ERROR = typeof _error;

type Primitive = string | bigint | boolean | null | undefined;

export class Node<T> implements Path<T> {
    __ts_value: T = undefined as unknown as T;

    #root: Root;
    _internal_path: string[];
    constructor(root: Root, path: string[]) {
        this.#root = root;
        this._internal_path = path;
    }

    get<
        Q extends {[key: string]: unknown} | null | undefined,
        K extends keyof Exclude<Q, null | undefined>,
    >(this: Node<Q>, key: K): Node<Exclude<Q, null | undefined>[K]> {
        return new Node(this.#root, [...this._internal_path, key as string]);
    }

    readKeys(this: Node<{[key: string]: unknown}>): string[] | null {
        const v = this.readPrimitive();
        if(v != null && typeof v === "object") {
            return v.keys() as any;
        }
        return null as any;
    }

    readPrimitive(): Primitive | {
        keys: () => string[],
    } {
        const value = readValue(this.#root, this);
        if(isObject(value)) {
            return {
                keys: () => {
                    getNodeSignal(this.#root, [...this._internal_path, {v: "keys"}]).view();
                    return untrack(() => (
                        Object.keys(asObject(readValue(this.#root, this))!)
                    ));
                },
            };
        }
        return value as Primitive;
    }

    readString<Q extends string>(this: Node<Q>): Q | "unsupported" | null {
        const value = this.readPrimitive();
        if(typeof value === "string") {
            return value as Q | "unsupported";
        }
        return null;
    }
    readBoolean(this: Node<boolean | null | undefined>): boolean | null {
        const value = this.readPrimitive();
        if(typeof value === "boolean") {
            return value;
        }
        return null;
    }

    setReconcile<T>(nvCb: (pv: unknown) => T): void {
        return setReconcile(this.#root, this, nvCb);
    }

}
type Path<T> = {
    // ok path will be string[] and maybe a {"keys": ""} object for tracking object
    // keys.    
    _internal_path: string[];

    // we can add a prototype with fns like readvalue, readstring, …
};
export type Root = {
    // note: see if we can use a weakmap for this
    // we'll have to use the same path array for every watched nodes access
    // eeh whatever. we'll just leak memory
    watched_nodes: Map<string, Signal<undefined>>,
    data: unknown, // [!] acyclic, no references, readonly. must be updated using reconcile()
    all_contents: Set<object>, // [!] debug builds only, used to automatically detect and error for references.

    // if I want I can store the actual data inside of nodes but idk
};
export function createAppData<T>(): Node<T> {
    const root: Root = {
        watched_nodes: new Map(),
        data: undefined,
        all_contents: new Set(),
    };
    return new Node(root, []);
}

function getNodeSignal(root: Root, path: (string | {v: "keys"})[]): {
    view: () => void,
    emit: () => void,
} {
    const track_str = JSON.stringify(path);
    let signal = root.watched_nodes.get(track_str);
    if(!signal) {
        signal = createSignal(undefined, {equals: () => false});
        root.watched_nodes.set(track_str, signal);
    }
    return {
        view: () => {
            signal![0]();
            console.log("observing signal", JSON.stringify(path));
        },
        emit: () => {
            signal![1](undefined);
            console.log("emitting signal", JSON.stringify(path));
        },
    };
}

// wow we basically just remade our modValue thing from solid js store but
// a little bit better because it only tracks the leaf and not the entire path to get
// to it
//     (that does mean setting a node to undefined requires alerting a bunch of consumers
//      but that's okay)
export function readValue(root: Root, node: Path<unknown>): unknown {
    // track reads
    getNodeSignal(root, node._internal_path).view();

    let ntry = root.data;
    for(const itm of node._internal_path) {
        if(isObject(ntry)) {
            ntry = ntry[itm];
        }else{
            ntry = undefined;
            break;
        }
    }
    return ntry;
}

export function setReconcile<T>(root: Root, node: Path<T>, nvCb: (pv: unknown) => T): void {
    untrack(() => batch(() => {
        const pv = readValue(root, node);
        const nv = nvCb(pv);

        let ntry: {
            parent: {[key: string]: unknown},
            key: string,
        } = {
            parent: root,
            key: "data",
        };
        for(const [i, path_node] of node._internal_path.entries()) {
            let v = ntry.parent[ntry.key];
            if(Object.hasOwnProperty.call(ntry.parent, ntry.key) && isObject(v)) {
                // we're good!
            } else {
                // turn it into an object
                v = {};
                if(!Object.hasOwnProperty.call(ntry.parent, ntry.key) && i - 1 >= 0) {
                    const parent_path = node._internal_path.slice(0, i - 1);
                    getNodeSignal(root, [...parent_path, {v: "keys"}]).emit();
                }
                ntry.parent[ntry.key] = v;

                const obj_path = node._internal_path.slice(0, i);
                console.log("had to create object at", JSON.stringify(obj_path));
                getNodeSignal(root, obj_path).emit();
            }
            ntry = {
                parent: v as {[key: string]: unknown},
                key: path_node,
            };
        }

        if(!Object.hasOwnProperty.call(ntry.parent, ntry.key)) {
            // [!] duplicated code
            const pathlen = node._internal_path.length;
            if(pathlen - 1 >= 0) {
                const parent_path = node._internal_path.slice(0, pathlen - 1);
                getNodeSignal(root, [...parent_path, {v: "keys"}]).emit();
            }
        }

        // [!] we might end up with stale references. if that's not acceptable, we'll have
        //     to reconcile properly. this should be okay though I think.
        ntry.parent[ntry.key] = nv;

        // emit its signals
        emitDiffSignals(root, node._internal_path, pv, nv);
    }));
}
function emitDiffSignals<T>(root: Root, path: string[], old_value: unknown, new_value: T): void {
    // old and new are identical. don't emit anything.
    if(old_value === new_value) return;

    // neither old or new are objects
    // // (this is not necessary as it is handled below)
    // if(!isObject2(old_value) && !isObject2(new_value)) {
    //     getNodeSignal(root, path)[1](undefined);
    //     return;
    // }

    // assert there are no cyclical references
    if(isObject(old_value)) {
        if(!root.all_contents.delete(old_value)) {
            console.warn("E_NOT_IN_DB", old_value);
            unreachable();
        }
    }
    if(isObject(new_value)) {
        if(root.all_contents.has(new_value)) {
            console.warn("E_DOUBLE_INSERT", new_value);
            unreachable();
        }
        root.all_contents.add(new_value);
    }

    const old_keys = isObject(old_value) ? Object.keys(old_value) : [];
    const new_keys = isObject(new_value) ? Object.keys(new_value) : [];

    const deleted_keys = new Set(old_keys);
    for(const key of new_keys) deleted_keys.delete(key);

    // emit diff signals for all new leaves
    if(isObject(new_value)) {
        const pv = asObject(old_value) ?? {};
        for(const key of new_keys) {
            console.log("emit4key", key, pv[key], new_value[key]);
            emitDiffSignals(root, [...path, key], pv[key], new_value[key]);
        }
    }
    // emit keys changed
    if(JSON.stringify(old_keys) !== JSON.stringify(new_keys)) {
        getNodeSignal(root, [...path, {v: "keys"}]).emit();
    }
    // emit signals for removed keys
    if(true) {
        const pv = asObject(old_value) ?? {};
        const nv = asObject(new_value) ?? {};
        for(const key of deleted_keys) {
            emitDiffSignals(root, [...path, key], pv[key], nv[key]);
        }
    }
    // emit an update signal unless both old and new are objects
    if(!(isObject(old_value) && isObject(new_value))) {
        getNodeSignal(root, path).emit();
    }
}