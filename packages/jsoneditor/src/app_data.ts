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

export type JSONV = {[key: string]: JSONV} | JSONV[] | string | number | boolean | undefined | null;

// maybe it was better having get() return a keys() fn if it's an object
export function anJson(node: AnNodeData<any>): JSONV {
    const value = anGet(node);
    if(typeof value === "object") {
        const res: {[key: string]: JSONV} = {};
        for(const key of anKeys(node)) {
            res[key] = anJson((node as unknown as AnNode<{[key: string]: any}>)[key]!);
        }
        return res;
    }else return value;
}
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
//   ↑ does it? maybe if it has a method addActions() sure but right now not at all
export class UndoGroup {
    action_ids: TemporaryActionID[];
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
export function reducePath(a: ActionPath | null, b: ActionPath): ActionPath {
    if(a == null) return b;
    const res: ActionPath = [];
    for(let i = 0; i < Math.min(a.length, b.length); i++) {
        if(a[i] !== b[i]) break;
        res.push(a[i]!);
    }
    return res;
}
function notNull<T>(a: T | null | undefined): a is T {
    return a != null;
}
export function anUndo(root: AnRoot, group: UndoGroup): {redo: UndoGroup} {
    let ids = group.action_ids.splice(0);
    // ^ updates the undo group in case more actions are inserted with it

    // ↓ store this in root probably instead of regenerating it on every undo
    const actions_by_temp_id = new Map<string, Action>();
    for(const action of root.permanent_actions) actions_by_temp_id.set(action.temporary_id, action);
    for(const action of root.temporary_actions) actions_by_temp_id.set(action.temporary_id, action);

    // actions array
    const actions = ids.map(id => actions_by_temp_id.get(id)).filter(notNull);
    // ^ TODO error if any of them are null, we'll manage the actions carefully to
    //   never delete any and if we do, update the undo groups

    if(actions.length === 0) {
        // nothing to undo
        return {redo: anCreateUndoGroup()};
    }

    // remove deleted actions (due to merges for server uploads, etc)
    ids = actions.map(action => action.temporary_id);

    const affects_tree = actions.map(act => act.affects_tree).reduce(reducePath);

    // find the earliest server action a client must have downloaded in order to fully
    // understand this undo. if the undo undoes any server actions, this is the first of those,
    // otherwise it is the latest server action the client has downloaded.
    //
    // this has the side effect of meaning undos that are not connected to a server
    // require a full rebuild every time. we can improve this in the future by including
    // checking if the client has all the actions specified in the undo because
    // if it does, there is no need
    //
    // this requires making it so if actions are ever compressed we need to remove them
    // from undo groups before they get committed. TODO
    let earliest_referenced_server_action = last(root.permanent_actions)?.permanent_id ?? null;
    for(const action of actions) {
        if(action.id_type === "permanent") {
            earliest_referenced_server_action = action.permanent_id;
            break;
            // equivalent to:
            // if(action.permanent_id < earliest_referenced_server_action) {
            //     earliest_referenced_server_action = action.permanent_id;
            // }
        }
    }
 
    const redo = anCreateUndoGroup();
    const undo_action: TemporaryAction = {
        id_type: "temporary",
        temporary_id: uuid() as TemporaryActionID,
        last_updated: uuid() as TemporaryActionParentUpdated,

        value: {
            kind: "undo",
            ids: ids,
            earliest_referenced_server_action,
        },
        affects_tree: affects_tree,
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
    path: ActionPath,
} | {
    kind: "set_value",
    new_value: Primitive,
    path: ActionPath,
} | {
    kind: "undo",
    ids: TemporaryActionID[],
    earliest_referenced_server_action: PermanentActionID | null, // null = requires full history
    // ^ if the client has ids[0] downloaded, that action's SnapshotID can be used
    //   instead of this value.
};
export type ActionBase = {
    // the action in the server will store the temporary id too so we know what to delete
    temporary_id: TemporaryActionID,
    // oh also the temporary id includes the timestamp so maybe that's useful for
    // reconciliation

    value: ActionValue,
    affects_tree: ActionPath,
};
export type TemporaryAction = {
    // temporary actions will only ever be added to the end of the actions array
    // temporary actions are always after permanent actions in the actions array
    id_type: "temporary",

    last_updated: TemporaryActionParentUpdated,
} & ActionBase;
export type PermanentAction = {
    // a permanent id is a number. no permanent ids will ever be created before this
    // number.
    id_type: "permanent",
    
    permanent_id: PermanentActionID,
} & ActionBase;
export type Action = TemporaryAction | PermanentAction;

export type PermanentActionID = number & {__is_permanent_action_id: true};
export type TemporaryActionID = UUID & {__is_temporary_action_id: true};
export type TemporaryActionParentUpdated = UUID & {__is_temporary_action_pu: true};

export type AnRoot = {
    // note: see if we can use a weakmap for this
    // we'll have to use the same path array for every watched nodes access
    // eeh whatever. we'll just leak memory
    watched_nodes: Map<string, Signal<undefined>>,
    all_contents: Set<object>, // [!] debug builds only, used to automatically detect and error for references.

    // SORTED BY permanent_id. ONLY ADD TO THE END.
    permanent_actions: PermanentAction[],
    // SORTED BY temporary_id. Only:
    // - append to the end
    // - remove items (all actions after must have their last_updated updated)
    temporary_actions: TemporaryAction[],

    snapshot: JSON,
    snapshots: Map<SnapshotID, JSON>,

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
export function collapseActions<T extends ActionBase>(actions: T[]): T[] {
    const set_paths = new Set<string>();
    let never_collapse = 0;
    return [...actions].reverse().filter(action => {
        const sp = JSON.stringify([action.value.kind, switchKind(action.value, {
            reorder_keys: rk => never_collapse++,
            set_value: sv => sv.path,
            undo: ndo => never_collapse++,
        })]);
        if(set_paths.has(sp)) return false;
        set_paths.add(sp);
        return true;
    }).reverse();
}
export function applyActionToSnapshot(action: ActionBase, snapshot: JSON): JSON {
    const av = action.value;
    if(av.kind === "set_value") {
        return setNodeAtPath(av.path, snapshot, prev => {
            return av.new_value;
        });
    }else if(av.kind === "reorder_keys") {
        return setNodeAtPath(av.path, snapshot, prev_in => {
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
    }else if(av.kind === "undo") {
        throw new Error("Internal error; Undos should not be sent to applyAction()");
    }else assertNever(av);
}
export function createAppData<T>(): AnNode<T> {
    const root: AnRoot = {
        watched_nodes: new Map(),
        all_contents: new Set(),

        permanent_actions: [],
        temporary_actions: [],
        snapshot: null,
        snapshots: new Map(),
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

    const snapshot = root.snapshot;

    let ntry = snapshot;
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

function createParents(path: string[], root: AnRoot): TemporaryAction[] {
    const res: TemporaryAction[] = [];
    for(const [index, key] of path.entries()) {
        const segment = path.slice(0, index);
        const value = anKeys({
            [symbol_value]: null,
            [symbol_path]: segment,
            [symbol_root]: root,
        });
        if(!value.includes(key)) {
            res.push({
                id_type: "temporary",

                temporary_id: uuid() as TemporaryActionID,
                last_updated: uuid() as TemporaryActionParentUpdated,
                value: {
                    kind: "reorder_keys",
                    old_keys: value,
                    new_keys: [...value, key],
                    path: segment,
                },
                affects_tree: segment,
            });
        }
    }
    return res;
}
function findActions(path: string[], pv: JSON, nv: JSON): TemporaryAction[] {
    if(pv === nv) return [];

    // this could be !isObject(pv) || !isObject(nv) but that creates an issue when
    // two people make an object at the same time - the object is overwritten. instead
    // for this case, we'll use setKeys and only ever use set_value for primitives.
    if(!isObject(nv)) {
        return [{
            id_type: "temporary",
            temporary_id: uuid() as TemporaryActionID,
            last_updated: uuid() as TemporaryActionParentUpdated,
            value: {
                kind: "set_value",
                new_value: nv as Primitive,
                path,
            }, affects_tree: path,
        }];
    }

    const res_actions: TemporaryAction[] = [];

    const prev_keys = Object.keys(asObject(pv) ?? {});
    const next_keys = Object.keys(nv);

    // change key order & delete old keys
    if(
        JSON.stringify(prev_keys) !== JSON.stringify(next_keys) || !isObject(pv)
    ) res_actions.push({
        id_type: "temporary",
        temporary_id: uuid() as TemporaryActionID,
        last_updated: uuid() as TemporaryActionParentUpdated,
        value: {
            kind: "reorder_keys",
            old_keys: prev_keys,
            new_keys: next_keys,
            path,
        },
        affects_tree: path,
    });

    // create all new keys
    for(const key of next_keys) {
        res_actions.push(...findActions([...path, key], (asObject(pv) ?? {})[key], nv[key]));
    }

    return res_actions;
}

function last<T>(a: T[]): T | undefined {
    return a[a.length - 1];
}

function asciiCompare(a: string, b: string) {
    return a === b ? 0 : a < b ? -1 : 1;
}

export function idLt(a: ActionID | null, b: ActionID): boolean {
    // really messy. simple formula though
    // i'm sure there's a better way to structure this control flow
    // - number < string < null
    //   - number: a, b => a < b
    //   - string: a, b => a < b
    //   - null: no compare function needed
    if(a == null) return false;
    if(typeof a === "number") {
        if(typeof b === "number") {
            return a < b;
        }else{
            return true;
        }
    }else if(typeof b === "number") {
        return false;
    }
    return a < b;
}
export type ActionID = TemporaryActionID | PermanentActionID;
export type SnapshotID = TemporaryActionParentUpdated | PermanentActionID;
export function idMin(a: ActionID | null, b: ActionID): ActionID {
    return idLt(a, b) ? a! : b;
}
export function getActionSnapshotID(a: Action): SnapshotID {
    return a.id_type === "permanent" ? a.permanent_id : a.last_updated;
}
export function getActionActualID(a: Action): PermanentActionID | TemporaryActionID {
    return a.id_type === "permanent" ? a.permanent_id : a.temporary_id;
}

// generates a snapshot from the given action set. uses any available existing snapshots
// when possible over rebuilding from scratch.
export function generateSnapshot(snapshots: Map<SnapshotID, JSON>, actions_in: Action[]): JSON {
    // ok for now i'm going to regenerate from scratch but eventually we'll upgrade
    // this to make use of the snapshots we have

    const actions = [...actions_in].sort((a, b) => asciiCompare(a.temporary_id, b.temporary_id));
    // ^ these actions are now sorted by time rather than server append date.
    //   for some extension actions such as text editor actions, we will need to
    //   understand the state of the world at the time the action was inserted.
    //   this will be complicated and i'll figure it out later.

    // ok time for some copy/paste

    let earliest_needed_action: ActionID | null = null;
    const upde = (id: ActionID) => {
        earliest_needed_action = idMin(earliest_needed_action, id);
    };
    const snapshotAvailableFor = (a: Action): boolean => {
        return snapshots.has(getActionSnapshotID(a));
    };
    const getSnapshotFor = (action: Action): JSON => {
        const shid = getActionSnapshotID(action);
        if(snapshots.has(shid)) {
            return snapshots.get(shid)!;
        }
        console.error("did not find a snapshot for", action, snapshots);
        unreachable();
    };

    const ignored_actions = new Set<TemporaryActionID>();

    let i = actions.length - 1;
    for(; i >= 0; i--) {
        const action = actions[i];
        if(!action) unreachable();
        const action_id = getActionActualID(action);

        if(ignored_actions.has(action.temporary_id)) continue;
        if(action.value.kind === "undo") {
            for(const id of action.value.ids) {
                ignored_actions.add(id);
            }
            upde(action.value.earliest_referenced_server_action ?? -1 as ActionID);
        }

        if((
            earliest_needed_action == null || idLt(action_id, earliest_needed_action)
        ) && snapshotAvailableFor(action)) {
            console.log("snapshot available!", action_id, i, "!");
            break;
        }
    }
    if(i === -1) {
        console.log("no snapshot available, rebuilding from scratch…");
    }

    let ns: JSON = i === -1 ? null : getSnapshotFor(actions[i]!);
    for(i = i + 1; i < actions.length; i++) {
        const action = actions[i];
        if(!action) unreachable();

        if(ignored_actions.has(action.temporary_id)) continue;

        if(action.value.kind === "undo") continue;
        ns = applyActionToSnapshot(action, ns);
    }

    return ns;
}

// updates these snapshots:
// - latest server
// - latest client
// TODO: automatically clean up old snapshots rather than having memory usage grow n²
export function generateUpToDateSnapshot(root: AnRoot): JSON {
    let changes_made = false;

    // check if the server snapshot is up to date
    const latest_server_action = last(root.permanent_actions);
    const server_action_id = latest_server_action?.permanent_id;
    if(server_action_id != null && !root.snapshots.has(server_action_id)) {
        // server snapshot is not up-to-date
        root.snapshots.set(server_action_id, generateSnapshot(root.snapshots, root.permanent_actions));
        changes_made = true;
    }

    // check if the client snapshot is up to date
    const latest_client_action = last(root.temporary_actions);
    const client_act_sn_id = latest_client_action?.last_updated;
    if(client_act_sn_id != null && !root.snapshots.has(client_act_sn_id)) {
        // client snapshot is not up-to-date
        root.snapshots.set(
            client_act_sn_id,
            generateSnapshot(root.snapshots, [...root.permanent_actions, ...root.temporary_actions]),
        );
        changes_made = true;
    }

    // delete old snapshots // TODO improve old snapshot logic
    // - eg we should send some snapshots to the server or something
    if(changes_made) {
        const save_server_snapshot = server_action_id != null ? root.snapshots.get(server_action_id) : null;
        const save_client_snapshot = client_act_sn_id != null ? root.snapshots.get(client_act_sn_id) : null;
        root.snapshots = new Map<SnapshotID, JSON>([
            ...(server_action_id != null ? [[server_action_id, save_server_snapshot]] as const : []),
            ...(client_act_sn_id != null ? [[client_act_sn_id, save_client_snapshot]] as const : []),
        ]);
    }

    // return the latest snapshot
    return root.snapshots.get(
        last(root.temporary_actions)?.last_updated ??
        last(root.permanent_actions)?.permanent_id ??
        undefined as unknown as SnapshotID
    ) ?? null;
}

// an interesting thing: if we haven't loaded all the actions and have some from a
// snapshot, we should not insert any new actions until after fetching an older snapshot
// that covers any needed undos. the server thing should manage that for us, we don't
// have to worry about it here

export function addActions(root: AnRoot, {temporary, permanent}: {
    temporary: TemporaryAction[],
    permanent: PermanentAction[],
}): void {
    if(temporary.length === 0 && permanent.length === 0) return;
    root.temporary_actions.push(...temporary);

    // [!] when inserting permanent actions, we can only ever add to the end of the array
    // [!] when inserting permanent actions, remove any temporary actions
    // ok this is a mess
    //

    // ok
    // - when inserting permanent actions:
    //   - [1]: 
    //     - the action array must always be a slice of the true server acttion array
    //     - this means that when adding new actions, if our current action array is:
    //         [id 5] [id 6] [id 8]
    //       and addActions is called with
    //         [id 7]
    //       this should never happen. if it does, we have to save stuff and reload the
    //       page or something. it shouldn't ever happen.
    //     - it is okay though to do:
    //         [id 5] [id 6] [id 8]
    //         addActions([id 3] [id 4] [id 5] [id 6])
    //           ([!] this isn't supported yet, we'll have to do some work to make sure
    //           when we don't have the full action array available from the first one
    //           we need to error if we can't find a snapshot and we need to be very
    //           careful when the server connection is calling addActions to make sure
    //           if it is going to add an action that references stuff in the past, it
    //           needs to fetch all the past data required and snapshots and stuff before
    //           calling addActions) (we don't have to deal with this yet but we will
    //           have to in the future)
    //         addActions([id 6] [id 8] [id 9] [id 10])
    //   - [2]:
    //     - remove any associated temporary actions
    //     - update the updated_times of any temporary actions past the removed ones

    const existing_ids = new Set<PermanentActionID>();
    for(const action of root.permanent_actions) existing_ids.add(action.permanent_id);

    const remove_ids = new Set<TemporaryActionID>();
    for(const action of permanent) remove_ids.add(action.temporary_id);

    for(const action of permanent) {
        if(existing_ids.has(action.permanent_id)) continue; // should probably assert it's the same

        if((last(root.permanent_actions)?.permanent_id ?? -1) > action.permanent_id) {
            unreachable(); // an action we didn't have already was attempted to be
            // inserted in the past OR the permanent array to addActions() was unsorted.
        }
        root.permanent_actions.push(action);
    }

    let needs_update = false;
    root.temporary_actions = root.temporary_actions.flatMap((action): TemporaryAction[] => {
        if(remove_ids.has(action.temporary_id)) {
            needs_update = true;
            return [];
        }
        if(needs_update) {
            return [{...action, last_updated: uuid() as TemporaryActionParentUpdated}];
        }
        return [action];
    });

    // TODO assert the arrays are both sorted

    untrack(() => {
        const ps = root.snapshot;
        const ns = generateUpToDateSnapshot(root);
        root.snapshot = ns;
        const diff_signals = findDiffSignals([], ps, ns);
        batch(() => {
            emitDiffSignals(root, diff_signals);
            root.actions_signal[1](undefined);
        });
    });
}

function addUserActions(root: AnRoot, undo_group: UndoGroup, new_actions: TemporaryAction[]): void {
    undo_group.action_ids.push(...new_actions.map(act => act.temporary_id));
    addActions(root, {temporary: new_actions, permanent: []});
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