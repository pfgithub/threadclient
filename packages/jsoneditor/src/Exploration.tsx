// @ts-nocheck
/* eslint-disable */

import { createMemo, createSignal, ErrorBoundary, For, JSX, untrack } from "solid-js";
import { Show } from "tmeta-util-solid";
import CopyUUIDButton from "./CopyUUIDButton";

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
function moveCursor(cursorPos, obj, dir): CursorMoveResult {
    console.log(cursorPos, obj, dir);
    if(!Array.isArray(obj.content)) return moveCursor(cursorPos, obj.content, dir);

    const start = cursorPos[0];
    if(cursorPos.length === 1) {
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

    const ncp = cursorPos.slice(1);
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

function insertNode(insert_pos, obj, new_node) {
    // in capsule:
    // - create capsule containing text
    // - call insertNode on that text

    // in text:
    // - convert the raw node to characters
    // - insert

    // back in the capsule:
    // - break up any newlines? sure why not

    // also this can probably be a pure function that just returns
    // either the layer's state or an array of operations

    // operations are nicer because we can transform cursor positions by applying operations

    if(obj.id === capsule.id) {
        if(Array.isArray(obj.content)) {
            if(insert_pos.length === 1) {
                // call insertNode([0], {id: text.id, content: []},  new_node);
                // splice that into a copy of the content array
                // return
            }else{
                // update in a copy of the array the value at the index with insertNode(…)
                // return
            }
        }else{
            // update the object with insertNode()
            // return
        }
    }else if(obj.id === text.id) {

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
                e.stopPropagation();
                e.preventDefault();

                if(e.code !== "ArrowLeft" && e.code !== "ArrowRight") return;
                const dir = e.code === "ArrowLeft" ? -1 : 1;
                setCursorPos(prev => {
                    const cmp = compareCursorPos(prev.anchor, prev.cursor)
                    if(!e.shiftKey && cmp != 0) {
                        const [l, r] = cmp < 0 ? [prev.anchor, prev.cursor] : [prev.cursor, prev.anchor];
                        const t = dir === -1 ? l : r;
                        return {anchor: t, cursor: t};
                    }
                    let moveres = moveCursor(prev.cursor, doc, dir);
                    if(!Array.isArray(moveres)) moveres = prev.cursor;
                    return {
                        anchor: e.shiftKey ? prev.anchor : moveres,
                        cursor: moveres,
                    };
                });
            }}
        />
        <CopyUUIDButton />
        <div class="py-4 space-y-2">
            <Object crs={cursorPos()} obj={doc} />
        </div>
    </div>;
}