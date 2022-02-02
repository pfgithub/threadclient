import { JSX } from "solid-js";
import { ShowCond } from "tmeta-util-solid";
import { classes } from "../util/utils_solid";

export default function DropdownButton(props: {
    icon?: undefined | JSX.Element,
    children: JSX.Element,
    class?: undefined | string,
}): JSX.Element {
    return <button
        class={classes(
            "w-full block p-2 text-left hover:bg-gray-200",
            "focus-visible:bg-gray-200 rounded-lg",
        )}
    ><div class={"w-full "+props.class}>
        <ShowCond when={props.icon}>{icon => <>
            {icon}
            <span class="ml-2" />
        </>}</ShowCond>
        {props.children}
    </div></button>;
}