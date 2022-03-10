// [!] ok this is cool and all
//     but what if we rethink it entirely
//     just have one big Set<string path, void signal>
//     and then one big object that is the actual value

import { batch, createSignal, Signal, untrack } from "solid-js";
import { asObject2, isObject2, unreachable } from "./guards";

export type Node<T> = {
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

function getNodeSignal(root: Root, path: (string | {v: "keys"})[]): Signal<undefined> {
    const track_str = JSON.stringify(path);
    let signal = root.watched_nodes.get(track_str);
    if(!signal) {
        signal = createSignal(undefined, {equals: () => false});
        root.watched_nodes.set(track_str, signal);
    }
    return signal;
}

// wow we basically just remade our modValue thing from solid js store but
// a little bit better because it only tracks the leaf and not the entire path to get
// to it
//     (that does mean setting a node to undefined requires alerting a bunch of consumers
//      but that's okay)
export function readValue(root: Root, node: Node<unknown>): unknown {
    // track reads
    getNodeSignal(root, node._internal_path)[0]();

    let ntry = root.data;
    for(const itm of node._internal_path) {
        if(isObject2(ntry)) {
            ntry = ntry[itm];
        }else{
            ntry = undefined;
            break;
        }
    }
    return ntry;
}

export function readString<T extends string>(root: Root, node: Node<T>): T | "unsupported" | null {
    const value = readValue(root, node);
    if(typeof value === "string") {
        return value as T | "unsupported";
    }
    return null;
}

export function write<T>(root: Root, node: Node<T>, nvCb: (pv: unknown) => T): void {
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
            const v = ntry.parent[ntry.key];
            if(isObject2(v)) {
                ntry = {
                    parent: v,
                    key: path_node,
                };
            }else{
                // make it an object
                const prev_value = ntry.parent;
                const new_value = {...ntry.parent, [ntry.key]: {}};
                ntry.parent = new_value;

                // emit its signals
                const obj_path = node._internal_path.slice(0, i + 1);
                emitDiffSignals(root, obj_path, prev_value, new_value);
            }
        }

        // update the object [!] oh wait is this okay? [!] i think it is because uuh
        // [!] we might end up with stale references. if that's not acceptable, we'll have
        //     to reconcile properly.
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
    if(isObject2(old_value)) {
        if(!root.all_contents.delete(old_value)) unreachable();
    }
    if(isObject2(new_value)) {
        if(root.all_contents.has(new_value)) unreachable();
        root.all_contents.add(new_value);
    }

    const old_keys = isObject2(old_value) ? Object.keys(old_value) : [];
    const new_keys = isObject2(new_value) ? Object.keys(new_value) : [];

    const deleted_keys = new Set(old_keys);
    for(const key of new_keys) deleted_keys.delete(key);

    // emit diff signals for all new leaves
    if(isObject2(new_value)) {
        const pv = asObject2(old_value) ?? {};
        for(const key of new_keys) {
            emitDiffSignals(root, [...path, key], pv, new_value[key]);
        }
    }
    // emit keys changed
    if(deleted_keys.size > 0) {
        getNodeSignal(root, [...path, {v: "keys"}])[1](undefined);
    }
    // emit signals for removed keys
    if(true) {
        const pv = asObject2(old_value) ?? {};
        const nv = asObject2(new_value) ?? {};
        for(const key of deleted_keys) {
            emitDiffSignals(root, [...path, key], pv, nv);
        }
    }
    // emit an update signal unless both old and new are objects
    if(!(isObject2(old_value) && isObject2(new_value))) {
        getNodeSignal(root, path)[1](undefined);
    }
}