import { JSX } from "solid-js";
import { classes } from "../util/utils_solid";
import { getActionDisabled, getActionOnclick, getActionURL } from "./act";
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
        url={getActionURL(props.action)}
        onClick={getActionOnclick(props.action)}
        disabled={getActionDisabled(props.action)}
    >
        {props.action.text}
    </DropdownButton>;
}