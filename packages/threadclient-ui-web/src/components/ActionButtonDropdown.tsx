import { JSX } from "solid-js";
import { classes } from "../util/utils_solid";
import { colorClass } from "./color";
import DropdownButton from "./DropdownButton";
import { ActionItem } from "./flat_posts";
import Icon from "./Icon";

export function DropdownActionButton(props: {action: ActionItem}): JSX.Element {
    return <DropdownButton
        icon={<Icon
            icon={props.action.icon}
            label={props.action.text}
            bold={props.action.color != null}
        />}
        class={classes(
            props.action.color == null ? "" : "font-bold",
            colorClass(props.action.color)
        )}
        url={
            // we'll pull this out into a function we can share between Button and
            // ActionButtonDropdown because we need the same thing for onclick
            (typeof props.action.onClick === "object")
            && ('url' in props.action.onClick)
            ? {href: props.action.onClick.url, client_id: props.action.client_id} : undefined
        }
    >
        {props.action.text}
    </DropdownButton>;
}