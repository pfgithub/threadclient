/* eslint-disable */

import { createMemo, createSignal, For, JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { InputHandler } from "./Exploration";
import { unreachable } from "./guards";

const idStr = <T,>() => <W extends string>(w: W): W & {__is: T} => {
    return w as W & {__is: T};
};

type JFields = {
    fields: JField[],
    multiline: boolean,
};

type JObject = {
    kind: "-N0gk9Mfm2iXGUkeWUMS",
} & JFields;
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
type JArray = {
    kind: "-N0gkrMd2kkRkNrVMEU2",
} & JFields;
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
    kind: "-N0gpdqw6BjkuWrRqqTG",
};

type JValue = JObject | JArray | JString | JNumber | JBoolean | JNull | JSlot;

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
                "absolute top-0 left-0 w-full h-1 transform translate-y-[-50%]",
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

function JFields(props: {
    vc: VisualCursor | null,
    obj: JFields,
    depth: number,
}): JSX.Element {
    // v 
    return <span class={props.obj.multiline ? "block pl-2 w-full border-l border-gray-700" : ""}>
        <TempCrs vc={props.vc} idx={0} covers={
            <>{props.obj.multiline ? "" : " "}</>
        } view={props.obj.multiline ? "horizontal" : "covers"} />
        {createMemo((): JSX.Element => {
            if(props.obj.fields.length === 0) return <>…</>;
            return <For each={props.obj.fields}>{(field, i) => (
                <span class={props.obj.multiline ? "block" : ""}>
                    <JField
                        vc={subvc(props.vc, i())}
                        field={field}
                        depth={props.depth + 1}
                    />
                    <TempCrs vc={props.vc} idx={i() + 1} covers={
                        <>
                            {(props.obj.multiline ? "," : i() !== props.obj.fields.length  - 1) ? "," : ""}
                            {props.obj.multiline ? "" : " "}
                        </>
                    } view={props.obj.multiline ? "horizontal" : "covers"} />
                </span>
            )}</For>;
        })}
    </span>;
}

function JSONValueRender(props: {
    vc: VisualCursor | null,
    val: JValue,
    depth: number,
}): JSX.Element {
    return <SwitchKind item={props.val}>{{
        [j_array.kind]: jarr => <span class={colrfor(props.depth).white}>
            <span>{"["}</span>
                <JFields vc={props.vc} obj={jarr} depth={props.depth} />
            <span>{"]"}</span>
        </span>,
        [j_object.kind]: jobj => <span class={colrfor(props.depth).white}>
            <span>{"{"}</span>
                <JFields vc={props.vc} obj={jobj} depth={props.depth} />
            <span>{"}"}</span>
        </span>,
        // we could even do jnum.toLocaleString() or Intl.NumberFormat
        // also note: consider making numbers, booleans, and null a different color
        // https://github.com/th00ber/atom-json-color
        [j_number.kind]: jnum  => <>{JSON.stringify(jnum.num)}</>,
        ["-N0gl-Obi0cyd58QHO85"]: jbool => <>{jbool.value.toString()}</>,
        ["-N0l0aP4SXjljg-GoC-S"]: () => <>{"null"}</>,
        [j_string.kind]:  jstr => {
            const halfwayPoint = createMemo(() => props.vc === null ? 0
            : props.vc.path.length === 0 ? props.vc.value.focus : unreachable());
            return <>
                <span class={colrfor(props.depth).dark}>"</span>
                <span class={
                    jstr.text.includes("\n".codePointAt(0)!) ? "block pl-2 "+colrfor(props.depth + 1).light : ""
                }>
                    <TempCrs vc={props.vc} idx={0} covers={""} view={"vertical"} />
                    {new TextDecoder().decode(jstr.text.slice(0, halfwayPoint()))}
                    <TempCrs vc={props.vc} idx={halfwayPoint()} covers={""} view={"vertical"} />
                    {new TextDecoder().decode(jstr.text.slice(halfwayPoint()))}
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
};

const handlers_map = new Map<string, ObjHandlers<Obj>>();
function register<T extends Obj>(kind: T["kind"], handlers: ObjHandlers<T>): ObjHandlers<T> {
    handlers_map.set(kind, handlers); // wow that's not typesafe, ts is lying.
    return handlers;
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

const any: ObjHandlers<Obj> = {
    move(itm, vc, stop) {
        return debugprint(["move handler", itm, vc, stop], () => {
            const ih = handlers_map.get(itm.kind);
            if(!ih) throw new Error("missing handler for "+itm.kind);
            return ih.move(itm, vc, stop);
        });
    },
    side(itm, side) {
        return debugprint(["side handler", itm, side], () => {
            const ih = handlers_map.get(itm.kind);
            if(!ih) throw new Error("missing handler for "+itm.kind);
            return ih.side(itm, side);
        });
    },
    child(itm, idx) {
        return debugprint(["child handler", itm, idx], () => {
            const ih = handlers_map.get(itm.kind);
            if(!ih) throw new Error("missing handler for "+itm.kind);
            return ih.child(itm, idx);
        });
    },
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
});

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
});

const fields_move: ObjHandlers<JObject | JArray> = {
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
};

register<JObject>("-N0gk9Mfm2iXGUkeWUMS", fields_move);
register<JArray>("-N0gkrMd2kkRkNrVMEU2", fields_move);

type userstr = string | JString;
type usernum = number | JNumber;
type userbool = boolean | JBoolean;
type useractualobj = {[key: string]: userval | JSlot};
type userobj = useractualobj | JObject;
type useractualarr = (userval | JSlot)[];
type userarr = useractualarr | JArray;
type useronefield = [value: userval | JSlot];
type userfield = [key: userstr | JSlot, value: userval | JSlot] | useronefield;

type userval = userstr | usernum | userbool | userobj | userarr;

type sources = userval | JSlot;

type targetsof<T extends sources> = T extends {
    kind: string,
} ? T : T extends string ? JString : T extends number ? JNumber : T extends boolean ? (
    JBoolean
) : T extends useractualobj ? JObject : T extends useractualarr ? JArray : never;

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
                "-N0gk9Mfm2iXGUkeWUMS", "-N0gkrMd2kkRkNrVMEU2", "-N0gkxU5wAjciRZnERvO",
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
            kind: j_object.kind,
            multiline: v === "multiline", 
            fields: obj.map(o => a.jfield(o))
        };
    },
    arr(v: "inline" | "multiline", ...obj: userfield[]): JArray {
        return {
            kind: j_array.kind,
            multiline: v === "multiline", 
            fields: obj.map(o => a.jfield(o))
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
        )],
        ["slots", a.obj("multiline", 
            ["key", "value"],
            ["slot value", a.slot()],
            [a.slot(), "slot key"],
            ["missing key"],
            [a.slot()],
        )],
    ));

    return <InputHandler
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
        onBeforeInput={() => {}}
    >
        <div
            class="border border-gray-600 rounded-md p-2 whitespace-pre-wrap"
            style="overflow-wrap: anywhere"
        >
            <JSONValueRender vc={visualCursor()} val={jsonObj()} depth={0} />
        </div>
    </InputHandler>;
}


type ObjSpec<T extends Obj> = {
    kind: T["kind"],
    children(obj: T): number | null,
    child(obj: T, n: number): Obj,
};

function renderJObject(obj: JObject): JSX.Element {
    return <>{"{}"}</>;
}
const j_object: ObjSpec<JObject> = {
    kind: "-N0gk9Mfm2iXGUkeWUMS",
    children(obj) {
        return obj.fields.length;
    },
    child(obj, n) {
        return obj.fields[n]!;
    },
};

function renderJArray(j: JArray): JSX.Element {
    return <>{"[]"}</>;
}
const j_array: ObjSpec<JArray> = {
    kind: "-N0gkrMd2kkRkNrVMEU2",
    children(obj) {
        return obj.fields.length;
    },
    child(obj, n) {
        return obj.fields[n]!;
    },
};

function renderJString(j: JString): JSX.Element {
    // when you're typing in here, you should be able to type "\" and it should show a menu to
    // let you insert escapes. basically like an ime.
    // also, typing any character should insert the actual character. eg you can press enter
    // to insert "\n" and press dblquote to insert "\"". pasting should convert the pasted content to
    // text and then insert.
    //
    // a fun thing we can do is display newlines because we're a node-based editor. so we can do that
    // if we want. we could even display double quotes without the escape.
    return <>{JSON.stringify(j.text)}</>;
}
const j_string: ObjSpec<JString> = {
    kind: "-N0gkxU5wAjciRZnERvO",
    children(obj) {
        return obj.text.length;
    },
    child(obj, n) {
        throw new Error("todo return a fake char node");
    },
};

function renderJNumber(j: JNumber): JSX.Element {
    // when you're editing in here, it should be looser than once you've clicked out
    // basically: when you're focused in the jnumber, we should have a custom editor. it should
    // show a little outline so you know.
    //
    // this also means if multiple people are editing, they each commit once
    // so it doesn't do normal text reconciliation stuff. it's like clicking a button and having a popup
    // appear and when you press "ok" it updates for everyone.
    return <>{JSON.stringify(j.num)}</>;
}
const j_number: ObjSpec<JNumber> = {
    kind: "-N0gkzBWv3Cx0Ryyouky",
    children(obj) {
        return 1; // two positions for the cursor to be in
        // when the cursor is there, we'll show our overlay and handle cursor movements within
        // the overlay.
    },
    child(obj, n) {
        throw new Error("todo return something");
    },
};

const j_field: ObjSpec<JField> = {
    kind: "-N0gkJ4N6etM-Md1KiyT",
    children(obj) {
        // sl|ot
        // |value|
        // sl|ot: sl|ot
        // |key|: sl|ot
        // sl|ot: |value|
        // |key|: |value|
        const val_slot = obj.value.kind === "-N0gpdqw6BjkuWrRqqTG";
        if(obj.key == null) return 1 -+ val_slot;
        const key_slot = obj.key?.kind === "-N0gpdqw6BjkuWrRqqTG";
        return 3 -+ val_slot -+ key_slot;
        // if you're at the end of value and you type ':', if value is a string it will switch it to
        // the key and focus you in value

        // if you delete from index 1 to 2:
        // - what to do?
        //   - if value is a slot, just set value to key and key to null
        //   - if key is a slot, delete
        //   - otherwise:
        //     - select range 0 to 2

        // ok what I actually want is for you not to be able to select from 1 to 2
        // you can select 0 to 1 and then 1 to 3, or 3 to 2 and then 2 to 0, or 1 to 3, or 2 to 0
        //
        // that should be pretty easy to do, we just define a custom selection stop function

        // if you type ',' at index 1 or 2:
        // - split in half

        // delete from index 2 to 3:
        // - replace the node with a slot

        // delete from index 0 to 1:
        // - replace the node with a slot
    },
    child(obj) {
        throw new Error("todo get child");
    },
};

const capsule_id = idStr<Capsule>()("-N0XUsb0qNRaLGPO5ozK");
export type Capsule = {
    kind: typeof capsule_id,
    items: (Text | Capsule)[],
};
const text_id = idStr<Text>()("-N0XV2FiLWJAMynVk0ZX");
export type Text = {
    kind: typeof text_id,
    chars: Char[],
};
const char_id = idStr<Char>()("-N0XWfQf03qhkJoqskTQ");
export type Char = {
    kind: typeof char_id,
    char: string,
};
const sys_rawtext_id = idStr<SysRawtext>()("@sys_rawtext");
export type SysRawtext = {
    kind: typeof sys_rawtext_id,
    text: string,
};

export type Obj = {
    kind: string,
};

function is<T extends Obj>(obj: Obj, id: string & {__is: T}): obj is T {
    return obj.kind === id;
}

// ok these are bad
// instead, the node can handle the insert event and convert the content as needed.

// I guess the question is if you eg paste an image in a span
// - it needs to split the span
// but that's okay, the node can handle that or something.

function capsuleInsert(obj: Capsule, index: number, new_items: Obj[]): Obj[] {
    const items = [...obj.items];
    // if the items don't fit in the capsule:
    // - insert them in a text
    // - fall through any that don't fit in the text
    // if when doing an insertion, any items fall through out the root of the page:
    // - cancel the operation

    // alternatively:
    // if any items don't fit in the capsule:
    // - insert them in a text
    // - error if any fall through the text
    throw new Error("TODO");
}

function textInsert(obj: Text, index: number, new_items: Obj[]): Obj[] {
    /*
    alternatively:
    obj.chars.map(char => {
        if(is(elem, char_id)) return char;
        if(is(elem, sys_rawtext_id)) {
            return ;
        }
    })
    */

    const items: Obj[] = [...obj.chars];
    items.splice(index, 0, ...new_items);

    const committed: Obj[] = [];
    const newWorking = () => ({kind: text_id, chars: []});
    let working: Text = newWorking();
    const addChar = (item: Char) => {
        working.chars.push(item);
    };
    const addOther = (item: Obj) => {
        commit();
        committed.push(item);
    };
    const commit = () => {
        if(working.chars.length > 0) {
            committed.push(working);
            working = newWorking();
        }
    };
    for(const elem of items) {
        if(is(elem, char_id)) {
            addChar(elem);
        }else if(is(elem, sys_rawtext_id)) {
            for(const char of [...elem.text]) {
                addChar({kind: char_id, char});
            }
        }else{
            addOther(elem);
        }
    }
    commit();

    return committed;
}