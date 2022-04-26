// @ts-nocheck
/* eslint-disable */

import { batch, createMemo, createSignal, ErrorBoundary, For, JSX, untrack } from "solid-js";
import { createMergeMemo, Show } from "tmeta-util-solid";
import CopyUUIDButton from "./CopyUUIDButton";
import { unreachable } from "./guards";

// keybinds:
// ← out / → in
// ↑ prev / ↓ next

type Dot = {id: `-${string}`};

const capsule: Dot = {
    id: "-N0XUsb0qNRaLGPO5ozK",
};
const text: Dot = {
    id: "-N0XV2FiLWJAMynVk0ZX",
};
const char: Dot = {
    id: "-N0XWfQf03qhkJoqskTQ",
};

const sys_rawtext: Dot = {
    id: "@sys_rawtext",
};

const doc = {id: capsule.id, content: [
    {id: capsule.id, content: {id: text.id, content: [
        {id: char.id, content: "O"},
        {id: char.id, content: "n"},
        {id: char.id, content: "e"},
    ]}},
    {id: capsule.id, content: {id: text.id, content: [
        {id: char.id, content: "T"},
        {id: char.id, content: "w"},
        {id: char.id, content: "o"},
    ]}},
    {id: capsule.id, content: [
        {id: capsule.id, content: {id: text.id, content: [
            {id: char.id, content: "T"},
            {id: char.id, content: "h"},
            {id: char.id, content: "r"},
            {id: char.id, content: "e"},
            {id: char.id, content: "e"},
        ]}},
        {id: capsule.id, content: {id: text.id, content: [
            {id: char.id, content: "F"},
            {id: char.id, content: "o"},
            {id: char.id, content: "u"},
            {id: char.id, content: "r"},
        ]}},
    ]},
    {id: capsule.id, content: {id: text.id, content: [
        {id: char.id, content: "F"},
        {id: char.id, content: "i"},
        {id: char.id, content: "v"},
        {id: char.id, content: "e"},
    ]}},
]};

function cursorin(crs, i) {
    return crs.cursor.length === 1 && crs.cursor[0] === i;
}
// i forgot how to program so we're juts displaying the cursor and anchor for now. eventually we'll display
// the full selection with a highlighted background.
function anchorin(crs, i) {
    return crs.anchor.length === 1 && crs.anchor[0] === i;
}

function VCursor(props): JSX.Element {
    return <div class="h-2 relative">
        <Show if={cursorin(props.crs, props.i) || anchorin(props.crs, props.i)}>
            <div class="absolute top-0 bottom-0 w-full flex flex-col justify-center px-2">
                <div class={"h-[2px] rounded-md "+(cursorin(props.crs, props.i) ? "bg-blue-400" : "bg-gray-400")} />
            </div>
        </Show>
    </div>;
}

function HCursor(props): JSX.Element {
    return <div class="inline relative">
        <Show if={cursorin(props.crs, props.i) || anchorin(props.crs, props.i)}>
            <div class={`
                absolute inline-block w-[2px] text-transparent select-none transform translate-x-[-50%]
                rounded-md ${cursorin(props.crs, props.i) ? "bg-blue-400" : "bg-gray-400"}
            `}>.</div>
        </Show>
    </div>;
}

function crsdown(crs, i) {
    return {
        anchor: crs.anchor[0] === i ? crs.anchor.slice(1) : [],
        cursor:  crs.cursor[0] === i ? crs.cursor.slice(1) : [],
    };
}

function Object(props): JSX.Element {
    return <ErrorBoundary fallback={e => <div class="text-red-400">
        error: {e.toString()}
    </div>} children={createMemo(() => {
        const id = props.obj.id;
        if(id === capsule.id) return untrack(() => <>
            <div class="rounded-md border border-gray-600 px-2 border-collapse">
                {Array.isArray(props.obj.content) ? <>
                    <VCursor crs={props.crs} i={0} />
                    <For each={props.obj.content}>{(obj, i) => <>
                        <Object crs={crsdown(props.crs, i())} obj={obj} />
                        <VCursor crs={props.crs} i={i() + 1} />
                    </>}</For>
                </> : <div class="py-2">
                    <Object crs={props.crs} obj={props.obj.content} />
                </div>}
            </div>
        </>);
        if(id === text.id) return untrack(() => <>
            <span>
                <HCursor crs={props.crs} i={0} />
                <For each={props.obj.content}>{(obj, i) => <>
                    <Object crs={crsdown(props.crs, i())} obj={obj} />
                    <HCursor crs={props.crs} i={i() + 1} />
                </>}</For>
            </span>
        </>);
        if(id === char.id) return untrack(() => <>
            <span>{props.obj.content}</span>
        </>);
        return untrack(() => <span class="text-red-400">E:BAD-OBJ</span>);
    })} />;
}

type CursorMoveResult = -1 | 1 | number[];
function firstIn(obj): number | null {
    if(typeof obj.content === "string") return null;
    if(Array.isArray(obj.content)) {
        return 0;
    }
    return firstIn(obj.content);
}
function lastIn(obj): number | null {
    if(typeof obj.content === "string") return null;
    if(Array.isArray(obj.content)) {
        return obj.content.length;
    }
    return lastIn(obj.content);
}

function moveCursor(cursor_pos, obj, dir): CursorMoveResult {
    if(!Array.isArray(obj.content)) return moveCursor(cursor_pos, obj.content, dir);

    const start = cursor_pos[0];
    if(cursor_pos.length === 1) {
        if(dir > 0) {
            if(start >= obj.content.length) return 1;
            const next = firstIn(obj.content[start]);
            if(next != null) return [start, next];
            return [start + 1];
        }else{
            const si = start - 1;
            if(si < 0) return -1;
            const prev = lastIn(obj.content[si]);
            if(prev != null) return [si, prev];
            return [si];
        }
    }

    const ncp = cursor_pos.slice(1);
    const subch = obj.content[start];
    const mcres = moveCursor(ncp, subch, dir);
    if(typeof mcres !== "number") return [start, ...mcres];
    if(mcres > 0) {
        const next = start + 1;
        if(next > obj.content.length) return 1;
        return [next];
    }else{
        return [start];
    }
}

type InsertRes = {
    obj: Obj,
    saved_positions: Pos[],
};
function insertNode(insert_pos, obj, new_node, saved_positions): InsertRes {
    if(obj.id === capsule.id) {
        if(Array.isArray(obj.content)) {
            if(insert_pos.length === 1) {
                const ipos0 = insert_pos[0];
                const nnode = insertNode([0], {id: capsule.id, content: {
                    id: text.id,
                    content: [],
                }}, new_node, []);
                const ncontent = [...obj.content];
                ncontent.splice(ipos0, 0, nnode.obj);
                const lo = lastIn(nnode.obj);

                return {
                    obj: {...obj, content: ncontent},
                    saved_positions: saved_positions.map(pos => {
                        const cmpres = compareCursorPos(insert_pos, pos);
                        if(cmpres < 0) return pos;
                        if(pos.length !== 1) unreachable();
                        if(lo == null) return [pos[0] + 1];
                        return [pos[0], lo];
                    }),
                };
            }else{
                const ipos0 = insert_pos[0];
                const filteredpositions = saved_positions.filter(pos => pos[0] === ipos0 && pos[1] != null).map(pos => pos.slice(1));
                const nnode = insertNode(insert_pos.slice(1), obj.content[ipos0], new_node, filteredpositions);
                const ncontent = [...obj.content];
                ncontent[ipos0] = nnode.obj;

                let spi = 0;
                saved_positions = saved_positions.map(pos => {
                    if(pos[0] !== ipos0) return pos;
                    return [ipos0, ...nnode.saved_positions[spi++]];
                });
                return {
                    obj: {...obj, content: ncontent},
                    saved_positions,
                };
            }
        }else{
            const nnode = insertNode(insert_pos, obj.content, new_node, saved_positions);
            return {
                obj: {...obj, content: nnode.obj},
                saved_positions: nnode.saved_positions,
            };
        }
    }else if(obj.id === text.id) {
        if(insert_pos.length !== 1) unreachable();

        const nnodes = [...new_node.content].map(c => ({id: char.id, content: c}));
        console.log(nnodes);
        const ncontent = [...obj.content];
        ncontent.splice(insert_pos[0], 0, ...nnodes);
        return {
            obj: {...obj, content: ncontent},
            saved_positions: saved_positions.map(pos => {
                const cmpres = compareCursorPos(insert_pos, pos);
                if(cmpres < 0) return pos;
                if(pos.length !== 1) unreachable();
                return [pos[0] + nnodes.length];
            }),
        };
    }

    // ok I guess the question is still how to do stuff eg:
    // when you press enter, insert a newline. if there are two newlines, split the capsule in two

    // not sure. but it shouldn't be too hard to handle this way.
}

function compareCursorPos(a, b) {
    if(a[0] == null && b[0] != null) return -1;
    if(a[0] == null && b[0] == null) return 0;
    if(a[0] != null && b[0] == null) return 1;
    if(a[0] < b[0]) return -1;
    if(a[0] > b[0]) return 1;
    return compareCursorPos(a.slice(1), b.slice(1));
}

export default function Exploration(): JSX.Element {
    const [cursorPos, setCursorPos] = createSignal({
        anchor: [2, 0, 1],
        cursor: [2, 0, 1],
        // anchor: [0, 2],
        // cursor: [0, 2],
    });
    const [objRaw, setObject] = createSignal(doc);
    const object = createMergeMemo(objRaw, {key: null, merge: false});
    // const object = {get data() {return objRaw()}};
    

    return <div class="max-w-xl bg-gray-800 mx-auto min-h-screen p-2 space-y-2">
        <textarea
            rows={1}
            class="
                block
                bg-transparent resize-none border border-gray-600 rounded-md px-1
                focus:outline-none text-transparent placeholder-gray-500 focus:placeholder-transparent
                focus:bg-gray-600
            "
            placeholder="Click here"
            onKeyDown={e => {
                if(e.code === "ArrowLeft" || e.code === "ArrowRight") {
                    e.stopPropagation();
                    e.preventDefault();
    
                    const dir = e.code === "ArrowLeft" ? -1 : 1;
                    setCursorPos(prev => {
                        const cmp = compareCursorPos(prev.anchor, prev.cursor)
                        if(!e.shiftKey && cmp != 0) {
                            const [l, r] = cmp < 0 ? [prev.anchor, prev.cursor] : [prev.cursor, prev.anchor];
                            const t = dir === -1 ? l : r;
                            return {anchor: t, cursor: t};
                        }
                        let moveres = moveCursor(prev.cursor, object.data, dir);
                        if(!Array.isArray(moveres)) moveres = prev.cursor;
                        return {
                            anchor: e.shiftKey ? prev.anchor : moveres,
                            cursor: moveres,
                        };
                    });
                }
            }}
            onBeforeInput={e => {
                if(e.inputType === "insertText") {
                    e.stopPropagation();
                    e.preventDefault();

                    const text = e.data;
                    const sp_in = [cursorPos().cursor, cursorPos().anchor];
                    const nnode = insertNode(cursorPos().cursor, object.data, {
                        id: "@sys_rawtext",
                        content: text,
                    }, sp_in);
                    console.log(nnode, sp_in, nnode.saved_positions);
                    batch(() => {
                        setObject(nnode.obj);
                        setCursorPos({
                            cursor: nnode.saved_positions[0],
                            anchor: nnode.saved_positions[1],
                        });
                    });
                }

            }}
        />
        <CopyUUIDButton />
        <div class="py-4 space-y-2">
            <Object crs={cursorPos()} obj={object.data} />
        </div>
    </div>;
}