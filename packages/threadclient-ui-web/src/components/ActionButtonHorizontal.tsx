import { JSX } from "solid-js";
import { getActionDisabled, getActionOnclick, getActionURL } from "./act";
import Button from "./Button";
import { colorClass } from "./color";
import { ActionItem } from "./flat_posts";
import Icon from "./Icon";

export function HorizontalActionButton(props: {action: ActionItem}): JSX.Element {
    return <Button
        url={getActionURL(props.action)}
        onClick={getActionOnclick(props.action)}
        disabled={getActionDisabled(props.action)}
    >
        <span class={
            props.action.color == null ? undefined : "font-bold " + colorClass(props.action.color)
        }>
            <Icon
                icon={props.action.icon}
                label={props.action.text}
                bold={props.action.color != null}
            />{" "}
            {props.action.text}
        </span>
    </Button>;
}