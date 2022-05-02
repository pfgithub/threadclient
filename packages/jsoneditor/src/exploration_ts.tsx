/* eslint-disable */

import { batch, createMemo, createSignal, For, JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { InputHandler } from "./Exploration";
import { unreachable } from "./guards";

const idStr = <T,>() => <W extends string>(w: W): W & {__is: T} => {
    return w as W & {__is: T};
};

type JObject = {
    kind: "-N0gk9Mfm2iXGUkeWUMS",

    fields: JField[],
    multiline: boolean,
    mode: "array" | "object",
};
type JField = {
    kind: "-N0gkJ4N6etM-Md1KiyT",
    key?: JString | JSlot | undefined,
    value: JValue,
    // enables copy/pasting between objects and arrays eg
    // if you paste from an array to an object, it will put a bunch of fields with a slot for the key
    // if you paste into an array, it will error at all the keys

    // ok there's no reason to do this, we can just have seperate objectfield/arrayfield and handle
    // that on paste
};
type JString = {
    kind: "-N0gkxU5wAjciRZnERvO",
    text: Uint8Array,
};
type JNumber = {
    kind: "-N0gkzBWv3Cx0Ryyouky",
    num: number,
};
type JBoolean = {
    kind: "-N0gl-Obi0cyd58QHO85",
    value: true | false,
};
type JNull = {
    kind: "-N0l0aP4SXjljg-GoC-S",
};
type JSlot = {
    // a slot doesn't really need a kind, it shouldn't be a real node
    kind: "-N0gpdqw6BjkuWrRqqTG",
    value?: JValue | undefined,
};

type SysText = {
    kind: "@systext",
    text: string,
};

type JValue = JObject | JString | JNumber | JBoolean | JNull | JSlot;

const colors: {white: string, dark: string, light: string}[] = [
    {white: "text-red-100", dark: "text-red-400", light: "text-red-200"},
    {white: "text-orange-100", dark: "text-orange-400", light: "text-orange-200"},
    {white: "text-yellow-100", dark: "text-yellow-400", light: "text-yellow-200"},
    {white: "text-green-100", dark: "text-green-400", light: "text-green-200"},
    {white: "text-blue-100", dark: "text-blue-400", light: "text-blue-200"},
    {white: "text-purple-100", dark: "text-purple-400", light: "text-purple-200"},
];
const colrfor = (depth: number)  =>  colors[(depth + colors.length - 1) % colors.length]!;


function JField(props: {
    vc: VisualCursor | null,
    field: JField,
    depth: number,
}): JSX.Element {
    // cursor positions:
    // []"key"[: ]"value"[]
    // note that these indices do not change if the key is not set. instead, the function should handle that.

    return <span>
        <span class="text-gray-500">{false ? "(" : null}</span>
        {props.field.key != null ? <>
            <TempCrs vc={props.vc} idx={0} covers={""} view="vertical" />
            <span class={colrfor(props.depth).dark}>
                <JSONValueRender vc={subvc(props.vc, 0)} val={props.field.key} depth={props.depth} />
            </span>
        </> : <></>}
        <TempCrs
            vc={props.vc} idx={1}
            covers={props.field.key != null ? ": " : ""}
            view={props.field.key != null ? "covers" : "vertical"}
        />
        <span class={colrfor(props.depth).light}>
            <JSONValueRender vc={subvc(props.vc, 1)} val={props.field.value} depth={props.depth} />
        </span>
        <TempCrs vc={props.vc} idx={2} covers={""} view="vertical" />
        <span class="text-gray-500">{false ? ")" : null}</span>
    </span>;
}

function TempCrs(props: {
    vc: VisualCursor | null,
    idx: number,
    covers: JSX.Element,
    view: "horizontal" | "vertical" | "covers",
}) {
    const match = createMemo(() => {
        return props.vc?.path.length === 0 ? (
            props.vc.value.focus === props.idx ? "focus" as const :
            props.vc.value.anchor === props.idx ? "anchor" as const :
            null
        ) : null;
    });
    return <>{props.view === "horizontal" ? <>
        {props.covers}
        <span class="block relative">{match() != null ? (
            <div class={[
                "absolute top-0 left-0 w-full h-[2px] transform translate-y-[-50%]",
                "rounded",
                match() === "focus" ? "bg-blue-400" : "bg-gray-400",
            ].join(" ")}></div>
        ) : null}</span>
    </> : props.view === "vertical" ? <>
        {props.covers}
        <div class="inline relative">
            <Show if={match() != null}>
                <div class={`
                    absolute inline-block w-[2px] text-transparent select-none transform translate-x-[-50%]
                    rounded-md ${match() === "focus" ? "bg-blue-400" : "bg-gray-400"}
                `}>.</div>
            </Show>
        </div>
    </> : (
        <span class={({
            'focus': "bg-blue-400 text-blue-900 rounded",
            'anchor': "bg-gray-400 text-gray-900 rounded",
            'none': "",
        } as const)[match() ?? "none"]}>{props.covers}</span>
    )}</>;
}

function subvc(vc: VisualCursor | null, i: number): VisualCursor | null {
    if(vc == null) return null;
    if(vc.path[0] !== i) return null;
    return {
        path: vc.path.slice(1),
        value: vc.value,
    };
}

function JObjectContent(props: {
    vc: VisualCursor | null,
    obj: JObject,
    depth: number,
}): JSX.Element {
    // v 
    return <span class={props.obj.multiline ? "block pl-2 w-full border-l border-gray-700" : ""}>
        <TempCrs vc={props.vc} idx={0} covers={
            props.obj.fields.length === 0 ? "…" : ""
        } view={props.obj.multiline ? "horizontal" : "vertical"} />
        <>{props.obj.multiline ? "" : " "}</>
        <For each={props.obj.fields}>{(field, i) => {
            const last = createMemo(() => i() === props.obj.fields.length - 1);
            return <span class={props.obj.multiline ? "block" : ""}>
                <JField
                    vc={subvc(props.vc, i())}
                    field={field}
                    depth={props.depth + 1}
                />
                {props.obj.multiline || !last() ? "," : ""}
                {props.obj.multiline || !last() ? "" : " "}
                <TempCrs vc={props.vc} idx={i() + 1} covers={null} view={props.obj.multiline ? "horizontal" : "vertical"} />
                {props.obj.multiline || last() ? "" : " "}
            </span>
}}</For>
    </span>;
}

function JSONValueRender(props: {
    vc: VisualCursor | null,
    val: JValue,
    depth: number,
}): JSX.Element {
    return <SwitchKind item={props.val}>{{
        '-N0gk9Mfm2iXGUkeWUMS': jobj => <span class={colrfor(props.depth).white}>
            <span>{jobj.mode === "object" ? "{" : "["}</span>
                <JObjectContent vc={props.vc} obj={jobj} depth={props.depth} />
            <span>{jobj.mode === "object" ? "}" : "]"}</span>
        </span>,
        // we could even do jnum.toLocaleString() or Intl.NumberFormat
        // also note: consider making numbers, booleans, and null a different color
        // https://github.com/th00ber/atom-json-color
        '-N0gkzBWv3Cx0Ryyouky': jnum  => <>{JSON.stringify(jnum.num)}</>,
        '-N0gl-Obi0cyd58QHO85': jbool => <>{jbool.value.toString()}</>,
        '-N0l0aP4SXjljg-GoC-S': () => <>{"null"}</>,
        '-N0gkxU5wAjciRZnERvO':  jstr => {
            const halfwayPoint = createMemo(() => props.vc === null ? 0
            : props.vc.path.length === 0 ? props.vc.value.focus : unreachable());
            return <>
                <span class={colrfor(props.depth).dark}>"</span>
                <span class={
                    jstr.text.includes("\n".codePointAt(0)!) ? "block pl-2 "+colrfor(props.depth + 1).light : ""
                }>
                    <TempCrs vc={props.vc} idx={0} covers={""} view={"vertical"} />
                    {new TextDecoder().decode(jstr.text.subarray(0, halfwayPoint()))}
                    <TempCrs vc={props.vc} idx={halfwayPoint()} covers={""} view={"vertical"} />
                    {new TextDecoder().decode(jstr.text.subarray(halfwayPoint()))}
                </span>
                <span class={colrfor(props.depth).dark}>"</span>
            </>;
        },
        ["-N0gpdqw6BjkuWrRqqTG"]: () => <>
            <span class="bg-gray-600 px-1 rounded-md">
                <TempCrs vc={props.vc} idx={0} covers={" "} view={"covers"} />
            </span>
        </>,
    }}</SwitchKind>;
}

function TextNodeRaw(props: {children: JSX.Element, [key: string]: unknown}): JSX.Element {
    //@todo
    // also we can use display="contents" here, it's supported in browsers now
    return <>{props.children}</>;
}

type ObjHandlers<T> = {
    move(itm: T, vc: VisualCursor, stop: StopOpts): null | CursorMoveRes,
    side(itm: T, side: -1 | 1): null | CursorMoveRes,
    child(itm: T, idx: number): Obj,
    asText(itm: T): string,

    // we could have this return {remainder: Obj, value: T}
    // that way we can bubble events up
    // eg if you try to insert an image in a text node, it can say it doesn't accept it and then the parent has to
    // deal with it. not sure if we want to do this but we could.
    insert(obj: T, insert: Obj, at: {path: NodePath, index: number}): T,
    cut(obj: T, range: {start: number, end: number}): {node: T, removed: Obj[]},
};

const handlers_map = new Map<string, Partial<ObjHandlers<Obj>>>();
function register<T extends Obj>(kind: T["kind"], handlers: Partial<ObjHandlers<T>>): void {
    handlers_map.set(kind, handlers); // wow that's not typesafe, ts is lying. it's nice that it pretends
    // it's okay for me though.
}

let dbprefix = 0;
function debugprint<T>(msg: unknown[], cb: () => T): T {
    let res;
    const pfx = "[dbg] " + "|  ".repeat(dbprefix);
    // console.log(pfx, msg);
    dbprefix++;
    try {
        res = cb();
        return res;
    }catch(e) {
        res = e;
        throw e;
    }finally{
        dbprefix--;
        // console.log(pfx + "→ ", [res]);
    }
}

function anyhandler<Method extends keyof ObjHandlers<Obj>>(
    method: Method,
    args: Parameters<ObjHandlers<Obj>[Method]>,
    defaultval: () => ReturnType<ObjHandlers<Obj>[Method]>,
): ReturnType<ObjHandlers<Obj>[Method]> {
    const itm = args[0];
    return debugprint([method, itm, ...args], (): ReturnType<ObjHandlers<Obj>[Method]> => {
        const ih = handlers_map.get(itm.kind);
        const ihm = ih?.[method];
        if(ihm == null) {
            console.warn("missing "+method+" handler for "+itm.kind);
            return defaultval();
        }
        // @ts-expect-error
        return ihm(...args);
    });
}

// isn't this literally what interfaces are for?
// like you would have the objects themselves have a prototype with all these methods on them already?
// and then you don't have to do this manual dispatch?
// yeah, it is.
const any: ObjHandlers<Obj> = {
    move(...a) {return anyhandler("move", a, () => null)},
    side(...a) {return anyhandler("side", a, () => null)},
    child(...a) {return anyhandler("child", a, () => unreachable())},
    asText(...a) {return anyhandler("asText", a, () => "[EUNSUPPORTED STRINGIFY "+a[0].kind+"]")},
    insert(...a) {return anyhandler("insert", a, () => unreachable())},
    cut(...a) {return anyhandler("cut", a, () => unreachable())},
};

type StopOpts = {
    dir: -1 | 1,
    selecting: boolean, // ← can't we just check if focus equals anchor? no need for this
};
// function jStringMove(str: JString, vc: VisualCursor, stop: StopOpts): null | CursorMoveRes {
//     if(vc.path.length !== 0) unreachable();
//     const svcdup = {...svc};
//     svcdup.focus += stop.dir;
//     if(svcdup.focus < 0) return null;
//     if(svcdup.focus < str.text.length) return null;
//     return {path: [], index: svcdup.focus};
// }

function defaultSubMove(obj: Obj, vc: VisualCursor, stop: StopOpts): {
    kind: "update",
    vc: VisualCursor,
} | {
    kind: "return",
    res: CursorMoveRes,
} {
    if(vc.path.length !== 0) {
        const idx = vc.path[0]!;
        const res = any.move(any.child(obj, idx), {
            path: vc.path.slice(1),
            value: vc.value,
        }, stop);
        if(res != null) {
            return {kind: "return", res: {
                path: [idx, ...res.path],
                index: res.index,
            }};
        }
        const nq = stop.dir < 0 ? idx : idx + 1; // idx + + (stop.dir > 0)
        return {kind: "return", res: {
            path: [],
            index: nq,
        }};
    }
    return {kind: "update", vc};
}

register<JString>("-N0gkxU5wAjciRZnERvO", {
    move(field, vc, stop) {
        const idx = vc.value.focus;
        const res = idx + stop.dir; // TODO Intl.Segmenter
        if(res < 0) return null;
        if(res > field.text.length) return null;
        return {
            path: [],
            index: res,
        };
    },
    side(field, dir) {
        return {path: [], index: dir === -1 ? 0 : field.text.length};
    },
    child(field, idx) {
        throw new Error("no children in text");
    },
    asText(str) {
        return JSON.stringify(new TextDecoder().decode(str.text));
    },
    insert(str, item, at) {
        if(at.path.length !== 0) unreachable();

        // hmm. if we copy fields and paste them in a text, it won't keep the commas.
        // we'll have to solve that. later.
        // ^ maybe: rather than cut() returning an array of objects, have it return a single holder object
        // then, that object can say "the items in here should be multiline fields seperated by commas"
        // but it can be interpreted differently based on where it's being pasted. I think that's good. do that.
        const insert_text = new TextEncoder().encode(any.asText(item));

        const new_val = new Uint8Array(str.text.length + insert_text.length);
        new_val.set(str.text.subarray(0, at.index), 0);
        new_val.set(insert_text, at.index);
        new_val.set(str.text.subarray(at.index), at.index + insert_text.length);
        // manual string concatenation in javascript. fun.

        return {
            kind: "-N0gkxU5wAjciRZnERvO",
            text: new_val,
        };
    },
});

register<JNumber>("-N0gkzBWv3Cx0Ryyouky", {
    move(field, vc, stop) {
        // we're actually going to pop out a little number editor so we're treating all numbers as if
        // they have two positions
        const idx = vc.value.focus;
        const res = idx + stop.dir; // TODO Intl.Segmenter
        if(res < 0) return null;
        if(res > 1) return null;
        return {
            path: [],
            index: res,
        };
    },
    side(field, dir) {
        return {path: [], index: dir === -1 ? 0 : 1};
    },
    child(field, idx) {
        throw new Error("no children in number");
    },
    asText(num) {
        return JSON.stringify(num.num);
    },
});

// deleting a slot:
// - select left and delete range
// - this is default behaviour, the slot doesn't have to define it
// - the field will then detect if a slot is deleted, it wlil put the key in the value or something
//   - not sure about how this will be implemented yet but the interaction is simple
//        → "key": [|]
//     ⌫ → "key"
//    just the question is how to implement that
//    and what does deleting right do inside there?
//    and do we really need to have all these cursor positions? []"key"[: |]{[]}[]
//    seems like we should just have []"key"[: ]{[]}
register<JSlot>("-N0gpdqw6BjkuWrRqqTG", {
    move(field, vc, stop) {
        return null;
    },
    side(field, dir) {
        return {path: [], index: 0};
    },
    child(field, idx) {
        throw new Error("no children in slot");
    },
    asText(num) {
        return "<slot />";
    },
    insert(obj, item, at) {
        alert("E-SLOT-INSERT-ATTEMPT");
        unreachable();
    },
});

function slotInsert(item: Obj, at: {path: NodePath, index: number}): JValue {
    // ok I think we're handling this wrong
    // ! when you press a key in a slot, we need to show a suggestions list
    // your typing will filter that suggestions list and also offer up dynamic suggestions
    // we can have a few hotkeys that will insert a node directly instead of opening up the suggestions
    // list: `"`, `{`, `[`

    // that seems like a much better method than what we're trying to do here

    if(is<SysText>(item, "@systext")) {
        const text = item.text;
        // if someone eg pastes `"test"` this won't work
        // or if they use an ime and input that

        // TODO: more robust handling here^^^

        // maybe we could loop over each byte and call slotInsert?
        // that requires that we make sure typing the exact conetnt should always
        // create the same thing. eg typing "{"a": "b"}" should create that structure
        // exactly.
        // but the problem is it doesn't - typing \" doesn't break you out of a string, you
        // have to move your cursor to get out of a string

        if(text === "\"") {
            const res: JString = {
                kind: "-N0gkxU5wAjciRZnERvO",
                text: new Uint8Array([]),
            };
            return res;
        }
        if(text === "{" || text === "[") {
            const res: JObject = {
                kind: "-N0gk9Mfm2iXGUkeWUMS",
                fields: [],
                multiline: false,
                mode: text === "[" ? "array" : "object",
            };
            return res;
        }
        // when your cursor is inside a slot, we should show that listbox
        // something we could do is if you type something in the listbox that isn't
        // true, false, or null, we can detect if it's a string/number and offer up suggestions

        // makes typing json nicer - you don't need the quotes when typing the string key, you just
        // have to accept the suggestion

        // TODO: make a headlessui listbox or whatever it is that lets you search for a thing and
        // press enter to insert it
        alert("TODO support that character");
        unreachable();
    }
    alert("TODO support paste into slot");
    unreachable();
}

// booleans don't actually need any selection points. you delete and retype.
// deleting turns the node into a slot and then the slot shows one of those fancy headless ui comboboxes
// to pick the value
register<JBoolean>("-N0gl-Obi0cyd58QHO85", {
    move() {return null},
    side() {return null},
    child() {unreachable()},
    asText(bool) {
        return JSON.stringify(bool.value);
    },
});

register<JField>("-N0gkJ4N6etM-Md1KiyT", {
    move(field, vc, stop) {
        const dsmres = defaultSubMove(field, vc, stop);
        if(dsmres.kind === "return") return dsmres.res;
        vc = dsmres.vc;

        const idx = vc.value.focus;

        // || if the actual selection start point is in here
        if(!stop.selecting) do {
            const nidx = idx + (stop.dir < 0 ? -1 : 0);
            const item = nidx === 0 ? field.key : nidx === 1 ? field.value : null;
            if(item == null) break;
            const val = any.side(item, -stop.dir as -1 | 1);
            if(val == null) break;
            return {
                path: [nidx, ...val.path],
                index: val.index,
            };
        } while(false);
    
        const res = idx + stop.dir;
        // my favourite js operator, the <+! operator
        if(res <+! field.key || res > 2) return null;
        return {
            path: [],
            index: res,
        }
    },
    side(field, dir) {
        if(dir === 1) return {path: [], index: 2};
        return {path: [], index: field.key != null ? 0 : 1};
    },
    child(field, idx) {
        if(idx === 1) return field.value;
        if(idx === 0) return field.key!;
        unreachable();
    },
    asText(field) {
        return (field.key != null ? any.asText(field.key) + ": " : "") + any.asText(field.value);
    },

    insert(obj, item, at) {
        if(at.path.length === 0) {
            if(!is<SysText>(item, "@systext")) {
                alert("not supported paste arbitrary in field");
                return obj;
            }
            if(item.text !== ":") {
                alert("not supported type anything other than ':'");
                return obj;
            }

            // 0 - only exists if there is a key
            // 1 - 
            // 2

            if(at.index === 0) {
                alert("not supported here");
                return obj;
            }
            if(at.index === 1) {
                if(obj.key != null) {
                    alert("not supported here");
                    return obj;
                }
                return {
                    ...obj,
                    key: {kind: "-N0gpdqw6BjkuWrRqqTG"},
                };
            }
            if(at.index === 2) {
                if(obj.key != null) {
                    alert("not supported here");
                    return obj;
                }
                if(obj.value.kind !== "-N0gkxU5wAjciRZnERvO" && obj.value.kind !== "-N0gpdqw6BjkuWrRqqTG") {
                    alert("not supported non-string key");
                    return obj;
                }
                return {
                    ...obj,
                    key: obj.value,
                    value: {kind: "-N0gpdqw6BjkuWrRqqTG"},
                };
            }
            unreachable();
        }
        const at0 = at.path[0]!;
        const atr = at.path.slice(1);
        const upd = {...obj};
        const chv = any.child(obj, at0);
        const chp = {path: atr, index: at.index};
        const nch = any.insert(chv, item, chp);
        if(at0 === 0) upd.key = nch as typeof upd.key;
        else if(at0 === 1) upd.value = nch as typeof upd.value;
        else unreachable();
        return upd;
    },
});

register<SysText>("@systext", {
    asText(srt) {
        return srt.text;
    },
});

register<JObject>("-N0gk9Mfm2iXGUkeWUMS", {
    move(obj, vc, stop) {
        // cursor positions:
        // inline:
        //   {field, field, field}
        //   {|field, |field, |field|}
        // multiline:
        //   {field,field,field,}
        //   {|field,|field,|field,|}
        
        // display:
        // - multiline will use horizontal cursors
        // - inline have saces before, after, and between where vertical cursors will go

        const dsmres = defaultSubMove(obj, vc, stop);
        if(dsmres.kind === "return") return dsmres.res;
        vc = dsmres.vc;
    
        const idx = vc.value.focus;
        const stops = obj.fields.length;
    
        // || if the actual selection start point is in here
        if(!stop.selecting) do {
            const nidx = idx + (stop.dir < 0 ? -1 : 0);
            const field = obj.fields[nidx];
            if(field == null) break;
            const val = any.side(field, -stop.dir as -1 | 1);
            if(val == null) break;
            return {
                path: [nidx, ...val.path],
                index: val.index,
            };
        } while(false);
    
        const res = idx + stop.dir;
        if(res < 0 || res > stops) return null;
        return {
            path: [],
            index: res,
        }
    },
    side(obj, dir) {
        if(dir == -1) return {path: [], index: 0};
        return {path: [], index: obj.fields.length};
    },
    child(obj, idx) {
        return obj.fields[idx]!;
    },

    insert(obj, item, at) {
        if(at.path.length === 0) {
            // systext.is(item)?
            if(is<SysText>(item, "@systext")) {
                if(item.text === "\n") {
                    return {...obj, multiline: true};
                }
            }
            // create a slot
            // type in the slot
            const newchild: JField = {
                kind: "-N0gkJ4N6etM-Md1KiyT",
                value: slotInsert(item, {path: [], index: 0}),
            };
            
            const updfields = [...obj.fields];
            updfields.splice(at.index, 0, newchild);
            return {
                ...obj,
                fields: updfields,
            };
        }
        const at0 = at.path[0]!;
        const atr = at.path.slice(1);
        const updfields = [...obj.fields];
        updfields.splice(at0, 1, any.insert(any.child(obj, at0), item, {path: atr, index: at.index}) as typeof obj.fields[number]);
        return {
            ...obj,
            fields: updfields,
        };
    },
    asText(itm) {
        return (itm.mode === "object" ? "{" : "[")
            + itm.fields.map(field => any.asText(field)).join(",") + (itm.mode === "object" ? "}" : "]"
        );
    },
});

function is<T extends Obj>(item: Obj, kind: T["kind"]): item is T {
    return item.kind === kind;
}

type userstr = string | JString;
type usernum = number | JNumber;
type userbool = boolean | JBoolean;
type useractualobj = {[key: string]: userval | JSlot};
type userobj = useractualarr | useractualobj | JObject;
type useractualarr = (userval | JSlot)[];
type useronefield = [value: userval | JSlot];
type userfield = [key: userstr | JSlot, value: userval | JSlot] | useronefield;

type userval = userstr | usernum | userbool | userobj;

type sources = userval | JSlot;

type targetsof<T extends sources> = T extends {
    kind: string,
} ? T : T extends string ? JString : T extends number ? JNumber : T extends boolean ? (
    JBoolean
) : T extends useractualobj ? JObject : T extends useractualarr ? JObject : never;

type test = targetsof<userstr | JSlot>;

const a = {
    auto<T extends sources>(val: T): targetsof<T> {
        if(typeof val === "string") {
            const res: JString = {kind: "-N0gkxU5wAjciRZnERvO", text: new TextEncoder().encode(val)};
            return res as targetsof<T>;
        };
        if(typeof val === "number") {
            const res: JNumber = {kind: "-N0gkzBWv3Cx0Ryyouky", num: val};
            return res as targetsof<T>;
        };
        if(typeof val === "boolean") {
            const res: JBoolean = {kind: "-N0gl-Obi0cyd58QHO85", value: val};
            return res as targetsof<T>;
        };
        if(typeof val === "object") {
            if('kind' in val && [
                "-N0gk9Mfm2iXGUkeWUMS", "-N0gkxU5wAjciRZnERvO",
                "-N0gkzBWv3Cx0Ryyouky", "-N0gl-Obi0cyd58QHO85", "-N0gpdqw6BjkuWrRqqTG",
                "-N0l0aP4SXjljg-GoC-S" as unknown,
            ].includes(val.kind as unknown)) {
                return val as targetsof<T>;
            }
        }
        throw new Error("TODO typeof:"+(typeof val));
    },
    jfield(field: userfield): JField {
        const guarda = (a: userfield): a is useronefield => a.length === 1;
        if(guarda(field)) {
            return {
                kind: "-N0gkJ4N6etM-Md1KiyT",
                value: a.auto(field[0]),
            };
        }else{
            return {
                kind: "-N0gkJ4N6etM-Md1KiyT",
                key: a.auto(field[0]),
                value: a.auto(field[1]),
            };
        }
    },
    obj(v: "inline" | "multiline", ...obj: userfield[]): JObject {
        return {
            kind: "-N0gk9Mfm2iXGUkeWUMS",
            multiline: v === "multiline", 
            fields: obj.map(o => a.jfield(o)),
            mode: "object",
        };
    },
    arr(v: "inline" | "multiline", ...obj: userfield[]): JObject {
        return {
            kind: "-N0gk9Mfm2iXGUkeWUMS",
            multiline: v === "multiline", 
            fields: obj.map(o => a.jfield(o)),
            mode: "array",
        };
    },

    // v this is misleading. a slot should be handled by its parent node because of how cusor
    //    movement works around it
    slot(): JSlot {
        return {kind: "-N0gpdqw6BjkuWrRqqTG"};
    },
};

type NodePath = number[];

type SubVC = {
    focus: number,
    anchor: number,
    anchor_sub: null | VisualCursor
};
type VisualCursor = {
    path: NodePath,
    value: SubVC,
};
type CursorMoveRes = {
    path: NodePath,
    index: number,
};

export default function ExplorationEditor2(): JSX.Element {
    const [visualCursor, setVisualCursor] = createSignal<VisualCursor>({
        path: [],
        value: {
            focus: 0,
            anchor: 0,
            anchor_sub: null,
        },
    });

    const [jsonObj, setJsonObj] = createSignal<JValue>(a.obj("multiline",
        ["types", a.obj("multiline",
            ["string", "hi! this is a test string"],
            ["escapes string", "woah, this \"string\" includes\nmultiple lines. pretty fancy"],
            ["number", 25],
            ["boolean", true],
            ["array", a.arr("multiline",
                ["My numbers:"],
                [a.arr("inline", [1], [2], [3])],
                [a.obj("inline", ["an", "inline object"], ["pretty", "fancy"])],
            )],
            ["object", a.obj("inline", 
                ["type", "message"],
                ["value", a.obj("multiline", 
                    ["sender", "Jalak"],
                    ["content", "Welcome!"],
                )],
            )],
            ["empty inline object", a.obj("inline")],
            ["empty multiline object", a.obj("multiline")],
        )],
        ["slots", a.obj("multiline", 
            ["key", "value"],
            ["slot value", a.slot()],
            [a.slot(), "slot key"],
            ["missing key"],
            [a.slot()],
        )],
    ));

    return <><InputHandler
        onKeyDown={e => {
            if(e.code.startsWith("Arrow")) {
                e.preventDefault();
                e.stopPropagation();
                const lr = e.code === "ArrowLeft" || e.code === "ArrowUp" ? -1 : 1;
                const vc = visualCursor();
                const nv = any.move(jsonObj(), vc, {dir: lr, selecting: e.shiftKey || e.code === "ArrowUp" || e.code === "ArrowDown"});
                if(nv) setVisualCursor({
                    path: nv.path,
                    value: {
                        focus: nv.index,
                        anchor: nv.index,
                        anchor_sub: null,
                    },
                });
            }
        }}
        onBeforeInput={(e) => {
            const insert = (val: Obj) => {
                const vc = visualCursor();
                const nobj = any.insert(jsonObj(), val, {
                    path: vc.path,
                    index: vc.value.focus,
                }) as ReturnType<typeof jsonObj>;
                batch(() => {
                    setJsonObj(() => nobj);
                });
            }
            if(e.inputType === "insertText") {
                e.preventDefault();
                e.stopPropagation();
                const systext: SysText = {
                    kind: "@systext",
                    text: e.data ?? "",
                };
                insert(systext);
            }else if(e.inputType === "insertLineBreak") {
                const systext: SysText = {
                    kind: "@systext",
                    text: "\n",
                };
                insert(systext);
            // deleteContentBackward
            // deleteContentForward
            }else{
                console.log(e);
            }
        }}
    >
        <div
            class="border border-gray-600 rounded-md p-2 whitespace-pre-wrap"
            style="overflow-wrap: anywhere"
        >
            <JSONValueRender vc={visualCursor()} val={jsonObj()} depth={0} />
        </div>
    </InputHandler><div>
        <div
            class="border border-gray-600 rounded-md p-2 whitespace-pre-wrap select-text"
            style="overflow-wrap: anywhere"
        >
            {any.asText(jsonObj())}
        </div>
    </div></>;
}

export type Obj = {
    kind: string,
};
