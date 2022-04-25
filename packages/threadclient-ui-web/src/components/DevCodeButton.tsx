import { Show } from "tmeta-util-solid";
import { getSettings } from "../util/utils_solid";

export default function DevCodeButton(props: {[key: string]: unknown}) {
    const settings = getSettings();
    return <Show if={settings.dev.showLogButtons() === "on"}>
        <button
            class="text-zinc-400 light:text-slate-600 text-sm px-2"
            onClick={() => console.log({...props})}
        >
            Code
        </button>
    </Show>;
}