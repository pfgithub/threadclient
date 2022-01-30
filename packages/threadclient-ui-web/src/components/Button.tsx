import "@fortawesome/fontawesome-free/css/all.css";
import { JSX } from "solid-js";
import { classes } from "../util/utils_solid";

export default function Button(props: {
    children: JSX.Element,
    onClick?: undefined | JSX.DOMAttributes<HTMLButtonElement>["onClick"],
    btnref?: undefined | ((el: HTMLButtonElement) => void),
}): JSX.Element {
    return <button ref={props.btnref} class={classes(
        "py-1 px-2 rounded-md",
        "text-gray-600",
        "bg-gray-200 border-b-1 border-gray-500",
        "dark:border-t-1 dark:border-b-0 dark:bg-white dark:border-gray-400",
    )} onClick={props.onClick}>{props.children}</button>;
}