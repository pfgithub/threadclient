import {JSX} from "solid-js";

export type StackChild = {
    kind: "item",
    fullscreen: boolean,
    fillrem: boolean,
    content: JSX.Element,
};