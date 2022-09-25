import * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { bioRender } from "../page1";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { classes } from "../util/utils_solid";
import { HorizontalActionButton } from "./ActionButtonHorizontal";
import { Body } from "./body";
import { getCounterState } from "./counter";
import Icon from "./Icon";
import Pfp from "./Pfp";
import { ClientPostOpts } from "./Post";
import proxyURL from "./proxy_url";

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
        )}>
            <Icon icon={props.action.increment.icon} bold={getState().your_vote === "increment"} label={null} />
            {" "}{props.action.increment.label}
        </button>
        <button class="hidden bg-gradient-to-b from-zinc-100 to-zinc-200 text-zinc-900 hover:text-white px-4 py-2 rounded ">
            Unsubscribe
        </button>
        <div>
            <div>{getState().pt_count} Subscribers</div>
        </div>
    </div>;
}