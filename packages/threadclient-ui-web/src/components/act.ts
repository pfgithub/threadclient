import { ClickAction } from "./Clickable";
import { ActionItem } from "./flat_posts";

export function getActionClickAct(action: ActionItem): ClickAction {
    if(typeof action.onClick === "string") return {url: action.onClick, client_id: action.client_id};
    if('url' in action.onClick) return {url: action.onClick.url, client_id: action.client_id};
    if(typeof action.onClick === "function") return action.onClick;
    return "TODO";
}

export function getActionDisabled(action: ActionItem): boolean {
    return action.onClick === "disabled";
}