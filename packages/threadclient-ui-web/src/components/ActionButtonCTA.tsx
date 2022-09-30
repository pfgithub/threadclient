import * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { classes } from "../util/utils_solid";
import { addAction } from "./action_tracker";
import { actAuto, getCounterState } from "./counter";
import { voteItemStr } from "./flat_posts";
import Icon from "./Icon";
import { formatItemString } from "./InfoBar";

export default function ActionButtonCTA(props: {
    action: Generic.CounterAction,
}): JSX.Element {
    const [getState, setState] = getCounterState(() => props.action);

    return <div class="flex flex-row flex-wrap gap-4 items-center">
        <button class={classes(
            "bg-gradient-to-b px-4 py-2 rounded",
            getState().your_vote === "increment" ?
            "from-zinc-50 to-zinc-100 text-zinc-900" :
            "from-blue-600 to-blue-700 text-slate-50 dark:text-zinc-50"
        )} disabled={getState().loading} onClick={() => {
            void addAction(actAuto(getState().your_vote === "increment" ? undefined : "increment", getState(), setState, props.action));
        }}>
            <Icon icon={props.action.increment.icon} bold={getState().your_vote === "increment"} label={null} />
            {" "}{getState().your_vote === "increment" ? props.action.increment.undo_label : props.action.increment.label}
        </button>
        <Show if={props.action.decrement != null}><div>[TODO decrement]</div></Show>
        <div>
            <div>{formatItemString(voteItemStr(getState().pt_count, getState().your_vote)).long}</div>
        </div>
    </div>;
}