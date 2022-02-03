import { JSX } from "solid-js";
import { colorClass } from "./color";
import DropdownButton from "./DropdownButton";
import { ActionItem } from "./flat_posts";
import Icon from "./Icon";

export function DropdownActionButton(props: {action: ActionItem}): JSX.Element {
    return <DropdownButton icon={
        <Icon
            icon={props.action.icon}
            label={props.action.text}
            bold={props.action.color != null}
        />
    } class={props.action.color == null ? undefined : "font-bold " + colorClass(props.action.color)}>
        {props.action.text}
    </DropdownButton>;
}