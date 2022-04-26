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

function VCursor(props): JSX.Element {
    return <div class="h-2 relative">
        <Show if={props.crs.cursor.length === 1 && props.crs.cursor[0] === props.i}>
            <div class="absolute top-0 bottom-0 w-full flex flex-col justify-center">
                <div class="h-[2px] rounded-md bg-blue-400" />
            </div>
        </Show>
    </div>;
}

function HCursor(props): JSX.Element {
    return <div class="inline relative">
        <Show if={props.crs.cursor.length === 1 && props.crs.cursor[0] === props.i}>
            <div class="
                absolute inline-block bg-blue-400 w-[2px] text-transparent select-none transform translate-x-[-50%]
                rounded-md
            ">.</div>
        </Show>
    </div>;
}

function crsdown(crs, i) {
    return {
        anchor: crs.anchor[0] === i ? crs.anchor.slice(1) : [],
        cursor: crs.cursor[0] === i ? crs.cursor.slice(1) : [],
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

export default function Exploration(): JSX.Element {
    const [cursorPos, setCursorPos] = createSignal({
        anchor: [0, 2, 0, 1],
        cursor: [0, 0, 2],
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
        />
        <CopyUUIDButton />
        <div class="py-4 space-y-2">
            <Object crs={crsdown(cursorPos(), 0)} obj={doc} />
        </div>
    </div>;
}