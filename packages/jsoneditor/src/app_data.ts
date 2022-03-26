// [!] ok this is cool and all
//     but what if we rethink it entirely
//     just have one big Set<string path, void signal>
//     and then one big object that is the actual value

import { batch, createSignal, Signal, untrack } from "solid-js";
import { assertNever, switchKind, UUID } from "tmeta-util";
import { asObject, isObject, unreachable } from "./guards";
import { Include } from "./util";
import { uuid } from "./uuid";

const symbol_value = Symbol("value");
const symbol_path = Symbol("path");
const symbol_root = Symbol("root");
const object_sym = Symbol("object");
const nothing = Symbol("nothing");
export type IncludeBackup<T, U> = Include<T, U> extends never ? {[nothing]: undefined} : Include<T, U>;
export type AnNodeData<T> = {
    [symbol_value]: T, // exists in ts only, for typechecking.
    [symbol_path]: string[],
    [symbol_root]: AnRoot,
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
            return Reflect.get(target, prop, reciever) as unknown;
        }
        return anConstructor(anRoot(target), [...target[symbol_path], prop]);
    },
    ownKeys(target) {
        const res = Reflect.ownKeys(target);
        if(res.some(w => typeof w !== "symbol")) unreachable();

        return [...res, ...anKeys(target)];
    },
};
function anConstructor<T>(root: AnRoot, path: string[]): AnNode<T> {
    const data: AnNodeData<T> = {
        [symbol_value]: undefined as unknown as T,
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
export function anNumber(node: AnNodeData<number | null | undefined>): number | null {
    const value = anGet(node);
    if(typeof value === "number") return value;
    return null;
}
export function anSetReconcile<U, T extends AnNodeData<U>>(
    node: T,
    nv: (pv: unknown) => T[typeof symbol_value],
    opts?: SetReconcileOpts,
): void {
    return anSetReconcileIncomplete(node, nv, opts);
}
export function anSetReconcileIncomplete<T>(
    node: AnNodeData<T>,
    nv: (pv: unknown) => Partial<T> | null,
    opts?: SetReconcileOpts,
): void {
    if(!opts) {
        opts = {undo_group: anCreateUndoGroup()};
        anCommitUndoGroup(anRoot(node), opts.undo_group);
    }
    setReconcile(anRoot(node), opts.undo_group, node[symbol_path], nv);
}
// export function anObserve(node: node): the actual value of the node. all children are watched
// eg we can get a node signal [...node[symbol_path], {v: "@all"}] and update all of those whenever
// any node is changed.

// ↓ this could just be an object but a class makes it more clear that it's mutable
export class UndoGroup {
    action_ids: UUID[];
    constructor() {
        this.action_ids = [];
    }
}
export function anCreateUndoGroup(): UndoGroup {
    return new UndoGroup();
}
export function anCommitUndoGroup(root: AnRoot, group: UndoGroup) {
    const new_undos = [...root.undos];
    new_undos.splice(root.undo_index, Infinity, group);
    root.undos = new_undos;
    root.undo_index = root.undos.length;
    root.undos_signal[1](undefined);
}
export function anUndo(root: AnRoot, group: UndoGroup): {redo: UndoGroup} {
    const ids = group.action_ids.splice(0);
    // ^ updates the undo group in case more actions are inserted with it

    const redo = anCreateUndoGroup();
    const undo_action: FloatingAction = {
        id: uuid(),
        from: "client",
        value: {
            kind: "undo",
            ids: ids,
        },
        affects: [[]], // TODO loop over the ids and get the actions they affect
        // also probably filter ids to only the ones that exist because an undo group
        // might contain more actions than are actually in the document because of
        // action merging every 200ms
    };

    addUserActions(root, redo, [undo_action]);

    return {redo};
}

type SetReconcileOpts = {undo_group: UndoGroup};

export function anRoot<T>(node: AnNodeData<T>): AnRoot {
    return node[symbol_root];
}
export function anPath<T>(node: AnNodeData<T>): string[] {
    return node[symbol_path];
}

type Primitive = string | number | boolean | null | undefined; // TODO get rid of undefined

export type JSON = unknown; // TODO = Primitive | {[key: string]: unknown}
export type ActionPath = string[];
export type ActionValue = {
    kind: "reorder_keys",
    old_keys: string[],
    new_keys: string[],
    //^ so if one person adds a key while another person reorders, the added item
    //  does not get deleted.
} | {
    kind: "set_value",
    new_value: Primitive,
} | {
    kind: "undo",
    ids: UUID[],
};
export type FloatingAction = {
    id: UUID,
    from: "client" | "server",
    value: ActionValue,
    affects: ActionPath[], // specifies the subtrees this action modifies
};
export type InsertedAction = FloatingAction & {
    parent_updated: number, // hash(parent.id, parent.parent_hash) (currently implemented as
    // a random number any time the action needs updating. and this is probably fine.)
};
export type Action = InsertedAction;

export type AnRoot = {
    // note: see if we can use a weakmap for this
    // we'll have to use the same path array for every watched nodes access
    // eeh whatever. we'll just leak memory
    watched_nodes: Map<string, Signal<undefined>>,
    all_contents: Set<object>, // [!] debug builds only, used to automatically detect and error for references.

    actions: Action[],
    // snapshots: Map<ActionHash, JSON>, // TODO how do we do snapshots?
    snapshot: JSON,
    snapshot_updated: number,
    actions_signal: Signal<undefined>,

    undos: UndoGroup[], // each undo specifies an array of action ids that need to be undone
    undo_index: number,
    undos_signal: Signal<undefined>,

    performance: Signal<{
        times: [string, number][],
    } | null>,
};
function setNodeAtPath(path: ActionPath, snapshot: JSON, upd: (prev: JSON) => JSON): JSON {
    const res_root: {parent: {[key: string]: unknown}, key: string} = {
        parent: {r: {...asObject(snapshot) ?? {}}},
        key: "r",
    };
    let res = res_root;
    for(const key of path) {
        if(!Object.hasOwnProperty.call(res.parent, res.key)) {
            return snapshot;
        }
        const oldnode = res.parent[res.key];
        if(!isObject(oldnode)) {
            return snapshot;
        }
        const newnode = {...oldnode};
        res.parent[res.key] = newnode;
        res = {
            parent: newnode,
            key,
        };
    }
    if(!Object.hasOwnProperty.call(res.parent, res.key)) {
        return snapshot;
    }
    res.parent[res.key] = upd(res.parent[res.key]);
    return res_root.parent[res_root.key];
}
// ok this is actually kind of complicated
export function collapseActions<T extends FloatingAction>(actions: T[]): T[] {
    const set_paths = new Set<string>();
    let never_collapse = 0;
    return [...actions].reverse().filter(action => {
        const sp = JSON.stringify([action.value.kind, switchKind(action.value, {
            reorder_keys: rk => never_collapse++,
            set_value: sv => action.affects,
            undo: ndo => never_collapse++,
        })]);
        if(set_paths.has(sp)) return false;
        set_paths.add(sp);
        return true;
    }).reverse();
}
export function applyActionToSnapshot(action: FloatingAction, snapshot: JSON): JSON {
    const av = action.value;
    if(av.kind === "set_value") {
        let res = snapshot;
        for(const path of action.affects) res = setNodeAtPath(path, res, prev => {
            return av.new_value;
        });
        return res;
    }else if(av.kind === "reorder_keys") {
        let res = snapshot;
        for(const path of action.affects) res = setNodeAtPath(path, res, prev_in => {
            const prev = asObject(prev_in) ?? {};

            // this logic can be improved to be better
            const current_keys = Object.keys(prev);
            const expected_current_keys = av.old_keys;

            const missing_current_keys = new Set(expected_current_keys);
            for(const key of current_keys) missing_current_keys.delete(key);
            const extra_current_keys = new Set(current_keys);
            for(const key of expected_current_keys) extra_current_keys.delete(key);

            return Object.fromEntries([...extra_current_keys, ...av.new_keys].map((key) => {
                return [key, prev[key]];
            }));
        });
        return res;
    }else if(av.kind === "undo") {
        throw new Error("Internal error; Undos should not be sent to applyAction()");
    }else assertNever(av);
}
export function createAppData<T>(): AnNode<T> {
    const root: AnRoot = {
        watched_nodes: new Map(),
        all_contents: new Set(),

        actions: [],
        snapshot: undefined,
        snapshot_updated: -3,
        actions_signal: createSignal(undefined, {equals: () => false}),
        
        undos: [],
        undo_index: 0,
        undos_signal: createSignal(undefined, {equals: () => false}),

        performance: createSignal(null),
    };
    return anConstructor(root, []);
}

export type SignalPath = (string | {v: "keys"})[];
function getNodeSignal(root: AnRoot, path: SignalPath): {
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
            // console.log("observing signal", JSON.stringify(path));
        },
        emit: () => {
            signal![1](undefined);
            // console.log("emitting signal", JSON.stringify(path));
        },
    };
}

// wow we basically just remade our modValue thing from solid js store but
// a little bit better because it only tracks the leaf and not the entire path to get
// to it
//     (that does mean setting a node to undefined requires alerting a bunch of consumers
//      but that's okay)
function readValue(root: AnRoot, path: string[]): unknown {
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

function createParents(path: string[], root: AnRoot): FloatingAction[] {
    const res: FloatingAction[] = [];
    for(const [index, key] of path.entries()) {
        const segment = path.slice(0, index);
        const value = anKeys({
            [symbol_value]: null,
            [symbol_path]: segment,
            [symbol_root]: root,
        });
        if(!value.includes(key)) {
            res.push({
                id: uuid(),
                from: "client",
                value: {
                    kind: "reorder_keys",
                    old_keys: value,
                    new_keys: [...value, key],
                },
                affects: [segment],
            });
        }
    }
    return res;
}
function findActions(path: string[], pv: JSON, nv: JSON): FloatingAction[] {
    if(pv === nv) return [];

    // this could be !isObject(pv) || !isObject(nv) but that creates an issue when
    // two people make an object at the same time - the object is overwritten. instead
    // for this case, we'll use setKeys and only ever use set_value for primitives.
    if(!isObject(nv)) {
        return [{id: uuid(), from: "client", value: {
            kind: "set_value",
            new_value: nv as Primitive,
        }, affects: [path]}];
    }

    const res_actions: FloatingAction[] = [];

    const prev_keys = Object.keys(asObject(pv) ?? {});
    const next_keys = Object.keys(nv);

    // change key order & delete old keys
    if(
        JSON.stringify(prev_keys) !== JSON.stringify(next_keys) || !isObject(pv)
    ) res_actions.push({id: uuid(), from: "client", value: {
        kind: "reorder_keys",
        old_keys: prev_keys,
        new_keys: next_keys,
    }, affects: [path]});

    // create all new keys
    for(const key of next_keys) {
        res_actions.push(...findActions([...path, key], (asObject(pv) ?? {})[key], nv[key]));
    }

    return res_actions;
}

let global_parent_updated_index = 0;
export function modifyActions(root: AnRoot, {insert, remove}: {insert: FloatingAction[], remove: UUID[]}): void {
    if(insert.length === 0 && remove.length === 0) return;

    const times: [string, number][] = [
        ["start", Date.now()],
    ];

    const new_action_ids = new Map<UUID, "client" | "server">(insert.map(action => [
        action.id,
        action.from,
    ]));
    const delete_action_ids = new Set<UUID>(remove);
    const new_actions: (FloatingAction | InsertedAction)[] = [
        ...root.actions.filter(action => {
            if(delete_action_ids.has(action.id)) return false; // action to be deleted
            const in_ids = new_action_ids.get(action.id);
            if(in_ids) {
                if(in_ids === "client") throw new Error("double insert of action");
                if(action.from === "server") {
                    // TODO: no need to overwrite any duplicate server actions
                    // we recieve
                }
                return false; // this action will be overwritten
            }
            return true;
        })
    , ...insert].sort((a, b) => {
        if(a.id < b.id) return -1;
        if(a.id > b.id) return 1;
        return 0;
    });

    times.push(["append and sort actions ("+new_actions.length+")", Date.now()]);

    let prevact: InsertedAction | null = null;
    root.actions = new_actions.map((action, i, a): InsertedAction => {
        // huh this would be nice if the map function had an arg that returned
        // the previous value returned out the map function
        if((prevact?.parent_updated ?? -1) > ('parent_updated' in action ? action.parent_updated : -2)) {
            return prevact = {
                ...action,
                parent_updated: ++global_parent_updated_index,
            };
        }
        if(!('parent_updated' in action)) {
            console.error("ENOTINSERTED", prevact?.parent_updated, action);
            unreachable();
        }
        return prevact = action;
    });

    times.push(["Update parent_inserted ("+new_actions.length+")", Date.now()]);

    root.actions_signal[1](undefined);
    times.push(["Update Actions DOM", Date.now()]);

    batch(() => {
        // TODO: make use of the snapshot when we can
        // - first: find the snapshot to use (else undefined)
        //   - loop in reverse. find the first action where:
        //     - id is less than all ignored actions
        //     - has a snapshot
        // - now: loop forwards from that index
        //   - apply actions ignoring all ignored actions

        // a note: if the server is going to send you an undo action, it will also
        // send you all the context you need to understand it. it won't send you
        // an undo action to ids you don't have.

        // ok
        // TODO:
        // clean up this code and make it keep seperate snapshots for the client and
        // server position
        // (server position is just a guess as the server may report about new events)
        // (that happened in the past)

        let earliest_needed_action: UUID | null = null;
        const upde = (a: UUID) => {
            if(earliest_needed_action == null) {
                earliest_needed_action = a;
                return;
            }
            earliest_needed_action = a < earliest_needed_action ? a : earliest_needed_action;
        };
        const snapshotAvailableFor = (num: number): boolean => {
            return root.snapshot_updated === num;
        };
        const getSnapshotFor = (action: Action): JSON => {
            if(root.snapshot_updated === action.parent_updated) {
                return root.snapshot;
            }
            console.log("did not find a snapshot for", action, root.snapshot_updated);
            unreachable();
        };

        const ignored_actions = new Set<UUID>();

        let i = root.actions.length - 1;
        for(; i >= 0; i--) {
            const action = root.actions[i];
            if(!action) {
                console.error("[?] no action at index", i, root.actions, action);
                unreachable();
            }

            if(ignored_actions.has(action.id)) continue;
            if(action.value.kind === "undo") {
                for(const id of action.value.ids) {
                    ignored_actions.add(id);
                    upde(id);
                }
            }
            if((
                earliest_needed_action == null || action.id < earliest_needed_action
            ) && snapshotAvailableFor(action.parent_updated)) {
                console.log("snapshot available for", action.parent_updated, i, "!");
                break;
            }
        }
        if(i === -1) {
            console.log("no snapshot available, rebuilding from scratch…");
        }

        const iter_distance = root.actions.length - i;

        const ps = root.snapshot;
        let ns = i === -1 ? undefined : getSnapshotFor(root.actions[i]!);
        for(i = i + 1; i < root.actions.length; i++) {
            const action = root.actions[i];
            if(!action) unreachable();
    
            if(ignored_actions.has(action.id)) continue;

            if(action.value.kind === "undo") continue; // handled above
            ns = applyActionToSnapshot(action, ns);
        }
        root.snapshot = ns;
        root.snapshot_updated = root.actions[root.actions.length - 1]?.parent_updated ?? -3;

        times.push(["Update snapshot ("+iter_distance+")", Date.now()]);

        emitDiffSignals(root, findDiffSignals([], ps, ns));

        times.push(["Emit diff signals", Date.now()]);
    });
    times.push(["Update DOM", Date.now()]);

    root.performance[1]({
        times,
    });
}

function addUserActions(root: AnRoot, undo_group: UndoGroup, new_actions: FloatingAction[]): void {
    undo_group.action_ids.push(...new_actions.map(act => act.id));
    modifyActions(root, {insert: new_actions, remove: []});
}

function setReconcile<T>(root: AnRoot, undo_group: UndoGroup, path: string[], nvCb: (pv: unknown) => T): void {
    untrack(() => {
        const pv = readValue(root, path);
        const nv = nvCb(pv);

        const new_actions = [...createParents(path, root), ...findActions(path, pv, nv)];
        addUserActions(root, undo_group, new_actions);
    });
}
export function findDiffSignals<T>(path: string[], old_value: unknown, new_value: T): SignalPath[] {
    // old and new are identical. don't emit anything.
    if(old_value === new_value) return [];

    const res_signals: SignalPath[] = [];

    const old_keys = isObject(old_value) ? Object.keys(old_value) : [];
    const new_keys = isObject(new_value) ? Object.keys(new_value) : [];

    const deleted_keys = new Set(old_keys);
    for(const key of new_keys) deleted_keys.delete(key);

    // emit diff signals for all new leaves
    if(isObject(new_value)) {
        const pv = asObject(old_value) ?? {};
        for(const key of new_keys) {
            res_signals.push(...findDiffSignals([...path, key], pv[key], new_value[key]));
        }
    }
    // emit keys changed
    if(JSON.stringify(old_keys) !== JSON.stringify(new_keys)) {
        res_signals.push([...path, {v: "keys"}]);
    }
    // emit signals for removed keys
    if(true as boolean) {
        const pv = asObject(old_value) ?? {};
        const nv = asObject(new_value) ?? {};
        for(const key of deleted_keys) {
            res_signals.push(...findDiffSignals([...path, key], pv[key], nv[key]));
        }
    }
    // emit an update signal unless both old and new are objects
    if(!(isObject(old_value) && isObject(new_value))) {
        res_signals.push(path);
    }

    return res_signals;
}
function emitDiffSignals(root: AnRoot, signals: SignalPath[]): void {
    for(const path of signals) {
        getNodeSignal(root, path).emit();
    }
}

if(import.meta.hot) {
    import.meta.hot.accept((new_module) => {
        alert("cannot reload editor_data.tsx, please refresh page.");
    });
}