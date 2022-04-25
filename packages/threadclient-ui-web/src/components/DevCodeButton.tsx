import { Show } from "tmeta-util-solid";

export default function DevCodeButton(props: {[key: string]: unknown}) {
    return <Show if={true}>
        <button
            class="text-zinc-400 light:text-slate-600 text-sm px-2"
            onClick={() => console.log({...props})}
        >
            Code
        </button>
    </Show>;
}