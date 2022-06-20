import { JSX } from "solid-js";
import { classes } from "../util/utils_solid";
import Clickable, { ClickAction } from "./Clickable";

export default function Button(props: {
    children: JSX.Element,
    action: ClickAction,
    btnref?: undefined | ((el: HTMLElement) => void),
    disabled?: undefined | boolean,
}): JSX.Element {
    return <Clickable
        btnref={props.btnref}
        class={classes(
            "py-1 px-2 rounded-md",
            "text-gray-600", "hover:text-black",
            "bg-gray-200 border-b-1 border-gray-500",
            "dark:border-t-1 dark:border-b-0 dark:bg-white dark:border-gray-400",
            typeof props.action === "object" ? "hover:underline" : "",
            "outline-default",
        )}
        action={props.action}
        disabled={props.disabled}
    >
        {props.children}
    </Clickable>;
}