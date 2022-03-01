import { batch, createSignal, Signal, untrack } from "solid-js";
import { isObject } from "./guards";
import { UUID } from "./uuid";



// TODO:
// change how nodes work
// rather than get(node)
// we'll say node()
//
// we'll keep setReconcile(node, value) though.

// oh actually I think the right thing to do would be to stop using builtin types
// entirely. wrap({a: b, c: d}) should actually make ac ustom object

// like we can define our own .get(key) eg

// I think we should keep arrays and objects the same though, for now at least




// TODO rewrite this with:
// - rather than get(object)
//   change to object()
// - rather than unified arrays and objects
//   change to arrays being a custom type
//   arrays have key order while objects do not
//   arrays do not allow undefined access while objects do

const internal_keys = Symbol("internal_keys");
const internal_value = Symbol("internal_value");
const internal_is_wrapped = Symbol("internal_is_wrapped");

export type StateObjectUser = {
    [key: UUID]: State,
};
export type StateObject = {
    // :( https://github.com/microsoft/TypeScript/issues/47594
    // [!] defined for all uuid keys
    [key: UUID]: State,
    [internal_keys]: Signal<UUID[]>,
};
export type StateValue = StateObject | string | boolean | bigint | null | undefined;

// export type NodeValue = {
//     [internal_keys]: Signal<UUID[]>,
//     [key: UUID]: Node,
//     // [!] an undefined value cannot be observed
// } | string | boolean | bigint | null;

export type State = {
    // instead of this, we could make state a function
    // like

    // root()["some-prop"]()
    // instead of
    // get(get(root)["some-prop"])
    // that could be neat maybe
    // we still have that keys issue

    // also consider wrapping with the proxy in the getter
    // it's identical but better maybe?
    // nah it's probably worse for perf and not meaningfully better for code

    // root().some_prop.setOverwrite("new_value")
    // vs set(get(root).some_prop, "new_value")

    [internal_value]: Signal<StateValue>,

    toJSON: (this: State) => unknown, // TODO put this in a prototype rather than wasting
    // space in every node
};

const handler: ProxyHandler<StateObject> = {
    ownKeys(target) {
        const res = target[internal_keys]![0]();
        console.log("Getting own keys", res);
        return res;
    },
    get(target, key) {
        if(typeof key === "symbol") {
            if(key === internal_is_wrapped) return true;
            if(key === internal_keys) return target[internal_keys];
            console.log("TRYING TO ACCESS WITH SYMBOL", key);
            throw new Error("unsupported symbol access");
        }

        const res: State = target[key as UUID] ??= createFake(target, key as UUID);
        return res;
    },
};

function fakeUpdate(target: StateObject, key: UUID, signal: Signal<StateValue>) {
    if('__SIGNAL_IS_FAKEUPDATE' in signal) {
        console.warn("attempting to wrap a value as fakeupdate that is already wrapped");
        return;
    }
    const orig = signal[1];
    signal[1] = (...a) => {
        console.log("FAKE VALUE INSERTING REAL VALUE", ...a);
        target[internal_keys]![1](v => {
            if(v.includes(key)) {
                console.warn("attempting to double-add key?", v, target, key, signal);
                return v;
            }
            return [...v, key];
        });
        signal[1] = orig;
        delete (signal as any)['__SIGNAL_IS_FAKEUPDATE'];
        return orig(...a);
    };
}

function createFake(target: StateObject, key: UUID): State {
    const res = wrap(undefined);
    fakeUpdate(target, key, res[internal_value]);
    return res;
}

export function object(value: StateObjectUser): StateObject {
    // does not have to be recursive because values already have to be wrapped
    // like you can't call wrap({a: "b"}) you have to wrap({a: wrap("b")})
    return new Proxy({
        ...value,
        [internal_keys]: createSignal(Object.keys(value) as UUID[], {equals: (prev, next) => {
            return JSON.stringify(prev) === JSON.stringify(next);
        }}),
    }, handler);
}

export function wrap(value: StateValue): State {
    return {
        [internal_value]: createSignal(value),
        toJSON: function() {
            const res = get(this);
            if(!isObject(res)) return res;
            const keys = Object.keys(res);
            return Object.fromEntries(keys.map(key => [key, res[key as UUID]] as const))
        },
    };
}

export function get(node: State): StateValue {
    return node[internal_value][0]();
}

// TODO: optionally specify if it should be one level deep or recursive (default)
export function setReconcile(node: State, value: (pv: StateValue) => StateValue): void {
    untrack(() => {
        batch(() => {
            setReconcileInternal(node, value);
        });
    });
}
function setReconcileInternal(node: State, value: (pv: StateValue) => StateValue): void {
    const pv = get(node);
    const nv = value(pv);

    if(nv === undefined) {
        return setOverwrite(node, () => nv);
    }
    if(pv === nv) return;
    if(!isObject(pv) || !isObject(nv)) {
        console.log("UPDATED LEAF", pv, nv);
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
        console.log("REMOVED LEAF", key);
        fakeUpdate(pv, key, pv[key][internal_value]);
    }
}
export function setOverwrite(node: State, value: (pv: StateValue) => StateValue): void {
    node[internal_value][1](pv => value(pv));
}

if(import.meta.hot) {
    // TODO move const nodecontext into its own file and only do this there
    import.meta.hot.accept((new_module) => {
        alert("cannot reload app_data.tsx, please refresh page.");
    });
}