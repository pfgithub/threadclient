import { JSX } from "solid-js";
import { ActionItem } from "./flat_posts";

export function getActionURL(action: ActionItem): undefined | {href: string, client_id: string} {
    if(typeof action.onClick === "string") return undefined;
    if('url' in action.onClick) return {href: action.onClick.url, client_id: action.client_id};
    return undefined;
}

export function getActionOnclick(action: ActionItem): undefined | JSX.EventHandler<HTMLElement, MouseEvent> {
    if(typeof action.onClick === "string") return undefined;
    if(typeof action.onClick === "function") return action.onClick;
    return undefined;
}

export function getActionDisabled(action: ActionItem): boolean {
    return action.onClick === "disabled";
}