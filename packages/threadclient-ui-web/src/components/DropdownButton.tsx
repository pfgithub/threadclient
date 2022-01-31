import { JSX } from "solid-js";
import { classes } from "../util/utils_solid";

export default function DropdownButton(props: {
    icon: JSX.Element,
    children: JSX.Element,
    class?: undefined | string,
}): JSX.Element {
    return <button
        class={classes(
            "w-full block p-2 text-left hover:bg-gray-200",
            "focus-visible:bg-gray-200 rounded-lg",
        )}
    ><div class={"w-full "+props.class}>
        {props.icon}
        <span class="ml-2" />
        {props.children}
    </div></button>;
}