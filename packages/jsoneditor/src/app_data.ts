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


export type LinkType<T extends ScNode> = {uuid: UUID, __fake_type?: undefined | {value: T}};


// scnode needs to be able to specify the goal
// like the actual value can be anything but we hope it's <T>
// so then you can use asObject(v) and it returns T | null
export type ScNode = ScObject<{[key: string]: ScNode}> | ScString | ScBoolean | ScBigint | ScNull | ScUndefined;

export type ScObjectUser<T extends {[key: string]: ScNode} = {[key: string]: ScNode}> = {
    [k in keyof T]: State<T[k]>
};
export type ScObjectReal = {
    [internal_keys]: Signal<string[]>,
};
export type ScObject<T extends {[key: string]: ScNode} = {[key: string]: ScNode}> = ScObjectUser<T> & ScObjectReal;
export type ScLink<T extends LinkType<ScNode>> = UUID;
export type ScString = string;
export type ScBoolean = boolean;
export type ScBigint = bigint;
export type ScNull = null;
export type ScUndefined = undefined;

export type StateValue = ScNode;
export type AnyValue = ScNode;

const enever = Symbol("E_NEVER");
export type ERROR = (typeof enever) & {__IS_ERROR: true};

type StateFn<T extends ScNode> = (() => StateValue);
type StateProps<T extends ScNode> = {
    [internal_value]: Signal<StateValue>,
};
type StatePrototype<T extends ScNode> = {
    toJSON: (this: State<T>) => unknown,

    // vv this type isn't right - someobject.getKey("a") shouldn't be allowed
    //    because someobject only knows its goal not what the actual type is so the
    //    first getkey may error because someobject is not an object
    getKey<Key extends string>(this: State<T>, key: Key): T extends never ? ERROR : T extends {[k in Key]: infer W} ? W : ERROR,
};
export type State<T extends ScNode> = StateFn<T> & StateProps<T> & StatePrototype<T>;

const handler: ProxyHandler<ScObject> = {
    ownKeys(target) {
        const res = target[internal_keys]![0]();
        return res;
    },
    get(target, key) {
        if(typeof key === "symbol") {
            if(key === internal_is_wrapped) return true;

            // vv wait why is internal_keys even a real field on the object
            // shouldn't it only exist within the proxy? idk
            if(key === internal_keys) return target[internal_keys];
            throw new Error("unsupported symbol access");
        }

        const res: State<ScNode> = target[key as UUID] ??= createFake(target, key as UUID);
        return res;
    },
};

function fakeUpdate(target: ScObject, key: string, signal: Signal<StateValue>) {
    if('__SIGNAL_IS_FAKEUPDATE' in signal) {
        console.warn("attempting to wrap a value as fakeupdate that is already wrapped");
        return;
    }
    const orig = signal[1];
    signal[1] = (...a) => {
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

function createFake<R extends ScObject>(target: R, key: string): State<undefined> {
    const res = wrap(undefined);
    fakeUpdate(target, key, res[internal_value]);
    return res;
}

export function object<T extends ScObjectUser>(value: T): T & ScObjectReal {
    // does not have to be recursive because values already have to be wrapped
    // like you can't call wrap({a: "b"}) you have to wrap({a: wrap("b")})
    return new Proxy({
        ...value,
        [internal_keys]: createSignal(Object.keys(value) as UUID[], {equals: (prev, next) => {
            return JSON.stringify(prev) === JSON.stringify(next);
        }}),
    }, handler) as (T & ScObjectReal);
}

const state_prototype: StatePrototype<ScNode> = {
    toJSON: function(this: State<ScNode>) {
        const res = get(this);
        if(!isObject(res)) return res;
        const keys = Object.keys(res);
        return Object.fromEntries(keys.map(key => [key, res[key as UUID]] as const))
    },
    getKey: function<Key extends string>(this: State<ScObject>, key: Key) {
        const val = get(this);
        if(!isObject(val)) throw new Error("cannot get key on ¬object");
        return val[key]! as any;
    },
};
export function wrap<T extends ScNode>(value: T): State<T> {
    const fn: StateFn<T> = (() => {
        return get(res);
    });
    const props: StateProps<T> = {
        [internal_value]: createSignal(value as ScNode),
    };
    const res = Object.assign(fn as State<T>, props);
    Object.setPrototypeOf(res, state_prototype);
    return res;
}

export function get<T extends ScNode>(node: State<T>): AnyValue {
    return node[internal_value][0]();
}

// TODO: optionally specify if it should be one level deep or recursive (default)
export function setReconcile<T extends ScNode>(node: State<T>, value: (pv: AnyValue) => T): void {
    untrack(() => {
        batch(() => {
            setReconcileInternal(node, value);
        });
    });
}
function setReconcileInternal<T extends ScNode>(node: State<T>, value: (pv: AnyValue) => T): void {
    const pv = get(node);
    const nv = value(pv);

    if(nv === undefined) {
        return setOverwrite(node, () => nv);
    }
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
}
export function setOverwrite<T extends ScNode>(node: State<T>, value: (pv: AnyValue) => T): void {
    node[internal_value][1](pv => value(pv));
}

if(import.meta.hot) {
    // TODO move const nodecontext into its own file and only do this there
    import.meta.hot.accept((new_module) => {
        alert("cannot reload app_data.tsx, please refresh page.");
    });
}