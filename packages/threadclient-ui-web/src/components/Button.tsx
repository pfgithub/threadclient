import "@fortawesome/fontawesome-free/css/all.css";
import { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { classes } from "../util/utils_solid";
import { A } from "./links";

export default function Button(props: {
    children: JSX.Element,
    onClick?: undefined | JSX.EventHandler<HTMLElement, MouseEvent>,
    url?: undefined | {href: string, client_id: string},
    btnref?: undefined | ((el: HTMLElement) => void),
    disabled?: undefined | boolean,
}): JSX.Element {
    return <A
        btnref={props.btnref}
        class={classes(
            "py-1 px-2 rounded-md",
            "text-gray-600", "hover:text-black",
            "bg-gray-200 border-b-1 border-gray-500",
            "dark:border-t-1 dark:border-b-0 dark:bg-white dark:border-gray-400",
            props.url != null ? "hover:underline" : "",
            "outline-default",
        )}
        onClick={props.onClick}
        href={props.url?.href}
        client_id={props.url?.client_id ?? "ENOCLILENTID"}
        disabled={props.disabled}
    >
        {props.children}
    </A>;
}