import { For, JSX } from "solid-js";
import { createTypesafeChildren } from "tmeta-util-solid";

type Button = {
    onClick?: () => void,
    children: JSX.Element,
    active?: undefined | boolean,
    disabled?: undefined | boolean,
};

export const Button = createTypesafeChildren<Button>();

export function Buttons(props: {
    children: JSX.Element,
}): JSX.Element {
    const ch = Button.useChildren(() => props.children);
    return <div>
        <For each={ch()}>{child => (
            <button
                class={""
                    + "px-2 first:rounded-l-md last:rounded-r-md mr-1 last:mr-0 "
                    + (child.active ? "bg-gray-500 " : "bg-gray-700 ")
                }
                onClick={() => {
                    if(!child.onClick) return alert("E_NOT_SET");
                    child.onClick();
                }}
                disabled={child.disabled}
            >{child.children}</button>
        )}</For>
    </div>;
}

export function ActionBar(props: {children: JSX.Element}) {
    return <div>{props.children}</div>;
}