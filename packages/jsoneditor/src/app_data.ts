// [!] ok this is cool and all
//     but what if we rethink it entirely
//     just have one big Set<string path, void signal>
//     and then one big object that is the actual value

import { batch, createMemo, createSignal, Signal, untrack } from "solid-js";
import { assertNever } from "tmeta-util";
import { asObject, isObject, unreachable } from "./guards";
import { Include } from "./util";

const symbol_value = Symbol("value");
const symbol_path = Symbol("path");
const symbol_root = Symbol("root");
const object_sym = Symbol("object");
const nothing = Symbol("nothing");
export type IncludeBackup<T, U> = Include<T, U> extends never ? {[nothing]: undefined} : Include<T, U>;
export type AnNodeData<T> = {
    [symbol_value]: T, // exists in ts only, for typechecking.
    [symbol_path]: string[],
    [symbol_root]: Root,
};
export type AnNode<T> = AnNodeData<T> & IncludeBackup<(T extends Primitive ? {
    [nothing]: undefined,
} : T extends {[key in string]: unknown} ? {
    [object_sym]: undefined,
} & {
    [key in keyof T]-?: AnNode<T[key]>
} : never), {
    [object_sym]: undefined,
}>;

const an_proxy_handler: ProxyHandler<AnNodeData<any>> = {
    get(target, prop, reciever) {
        if(typeof prop !== "string") {
            return Reflect.get(target, prop, reciever);
        }
        return anConstructor(target[symbol_root], [...target[symbol_path], prop]);
    },
    ownKeys(target) {
        const res = Reflect.ownKeys(target);
        if(res.find(w => typeof w !== "symbol")) unreachable();

        return [...res, ...anKeys(target)];
    },
};
function anConstructor<T>(root: Root, path: string[]): AnNode<T> {
    const data: AnNodeData<T> = {
        [symbol_value]: undefined as any,
        [symbol_path]: [...path],
        [symbol_root]: root,
    };
    return new Proxy(data, an_proxy_handler) as AnNode<T>;
}

// maybe it was better having get() return a keys() fn if it's an object
export function anKeys(node: AnNodeData<any>): string[] {
    const value = readValue(node[symbol_root], node[symbol_path]);
    getNodeSignal(node[symbol_root], [...node[symbol_path], {v: "keys"}]).view();
    return Object.keys(asObject(value) ?? {});
}
export function anGet(node: AnNodeData<any>): Primitive | {__is_object: true} {
    const value = readValue(node[symbol_root], node[symbol_path]);
    if(isObject(value)) return {__is_object: true};
    return value as Primitive;
}
export function anString<T extends string | null | undefined>(node: AnNodeData<T>): T | "unsupported" | null {
    const value = anGet(node);
    if(typeof value === "string") return value as T | "unsupported";
    return null;
}
export function anBool(node: AnNodeData<boolean | null | undefined>): boolean | null {
    const value = anGet(node);
    if(typeof value === "boolean") return value;
    return null;
}
export function anSetReconcile<T>(node: AnNodeData<T>, nv: (pv: unknown) => T): void {
    return anSetReconcileIncomplete(node, nv);
}
export function anSetReconcileIncomplete<T>(node: AnNodeData<T>, nv: (pv: unknown) => Partial<T>): void {
    setReconcile(node[symbol_root], node[symbol_path], nv);
}
// export function anObserve(node: node): the actual value of the node. all children are watched
// eg we can get a node signal [...node[symbol_path], {v: "@all"}] and update all of those whenever
// any node is changed.

export function anRoot<T>(node: AnNodeData<T>): Root {
    return node[symbol_root];
}

(() => {
    type Person = {
        name: string,
        tags: {[key: string]: string},
        options?: undefined | {
            media?: undefined | boolean,
        },
        settings: {
            media: boolean,
        },
    };
    let example!: AnNode<Person>;

    const name: string = anString(example.name) ?? "*unnamed*";
    const options = example.options;
    const media = options.media;
    const value = anBool(media);
    const value2 = anBool(example.settings.media);
});

type Primitive = string | bigint | boolean | null | undefined;

export type JSON = unknown;
export type ActionPath = string[];
export type ActionValue = {
    kind: "reorder_keys",
    path: ActionPath,
    old_keys: string[],
    new_keys: string[],
    //^ so if one person adds a key while another person reorders, the added item
    //  does not get deleted.
} | {
    kind: "set_value",
    path: ActionPath,
    new_value: JSON,
};
export type Action = {
    // id: string,
    value: ActionValue,
}

export type Root = {
    // note: see if we can use a weakmap for this
    // we'll have to use the same path array for every watched nodes access
    // eeh whatever. we'll just leak memory
    watched_nodes: Map<string, Signal<undefined>>,
    all_contents: Set<object>, // [!] debug builds only, used to automatically detect and error for references.

    actions: Action[],
    // snapshots: Map<ActionHash, JSON>, // TODO how do we do snapshots?
    snapshot: JSON,
    actions_signal: Signal<undefined>,
};
function setNodeAtPath(path: ActionPath, snapshot: JSON, upd: (prev: JSON) => JSON): JSON {
    console.log("setting node at path", path);

    const res_root: {parent: {[key: string]: unknown}, key: string} = {
        parent: {r: {...asObject(snapshot) ?? {}}},
        key: "r",
    };
    let res = res_root;
    for(const key of path) {
        console.log(res);
        const newnode = {...asObject(res.parent[res.key]) ?? {}};
        res.parent[res.key] = newnode;
        res = {
            parent: newnode,
            key,
        };
    }
    res.parent[res.key] = upd(res.parent[res.key]);
    console.log("succeed set node", res_root);
    return res_root.parent[res_root.key];
}
function applyActionToSnapshot(action: Action, snapshot: JSON): JSON {
    const av = action.value;
    if(av.kind === "set_value") {
        return setNodeAtPath(av.path, snapshot, prev => {
            return av.new_value;
        });
    }else if(av.kind === "reorder_keys") {
        return setNodeAtPath(av.path, snapshot, prev => {
            if(!isObject(prev)) return;

            // this logic can be improved to be better
            const current_keys = Object.keys(prev);
            const expected_current_keys = av.old_keys;

            const missing_current_keys = new Set(expected_current_keys);
            for(const key of current_keys) missing_current_keys.delete(key);
            const extra_current_keys = new Set(current_keys);
            for(const key of expected_current_keys) extra_current_keys.delete(key);

            return Object.fromEntries([...av.new_keys, ...extra_current_keys].map((key) => {
                return [key, prev[key]];
            }));
        });
    }else assertNever(av);
}
export function createAppData<T>(): AnNode<T> {
    const root: Root = {
        watched_nodes: new Map(),
        all_contents: new Set(),

        actions: [],
        snapshot: undefined,
        actions_signal: createSignal(undefined, {equals: () => false}),
    };
    return anConstructor(root, []);
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
function readValue(root: Root, path: string[]): unknown {
    // track reads
    getNodeSignal(root, path).view();

    let ntry = root.snapshot;
    for(const itm of path) {
        if(isObject(ntry)) {
            ntry = ntry[itm];
        }else{
            ntry = undefined;
            break;
        }
    }
    return ntry;
}
// change how setreconcile works
// 1: find actions
// 2: applyActions
// 3: emitDiffSignals

function findActions(path: string[], pv: JSON, nv: JSON): Action[] {
    if(pv === nv) return [];

    if(!isObject(pv) || !isObject(nv)) {
        return [{value: {
            kind: "set_value",
            path: path,
            new_value: nv,
        }}];
    }

    const res_actions: Action[] = [];

    const prev_keys = Object.keys(pv);
    const next_keys = Object.keys(nv);

    // change key order & delete old keys
    if(JSON.stringify(prev_keys) !== JSON.stringify(next_keys)) res_actions.push({value: {
        kind: "reorder_keys",
        path: path,
        old_keys: prev_keys,
        new_keys: next_keys,
    }});

    // create all new keys
    for(const key of next_keys) {
        res_actions.push(...findActions([...path, key], pv[key], nv[key]));
    }

    return res_actions;
}

function setReconcile<T>(root: Root, path: string[], nvCb: (pv: unknown) => T): void {
    untrack(() => batch(() => {
        const pv = readValue(root, path);
        const nv = nvCb(pv);

        const new_actions = findActions(path, pv, nv);
        root.actions = [...root.actions, ...new_actions];
        root.actions_signal[1](undefined);
    
        const ps = root.snapshot;
        let ns = root.snapshot;
        for(const action of new_actions) ns = applyActionToSnapshot(action, ns);
        root.snapshot = ns;

        // emit its signals
        emitDiffSignals(root, [], ps, ns);
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
            // unreachable();
        }
    }
    if(isObject(new_value)) {
        if(root.all_contents.has(new_value)) {
            console.warn("E_DOUBLE_INSERT", new_value);
            // unreachable();
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