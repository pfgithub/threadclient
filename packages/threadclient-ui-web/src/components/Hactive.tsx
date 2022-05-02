import {
    Accessor, createSignal, JSX, untrack
} from "solid-js";
import { signalFromMatchMedia } from "../util/utils_solid";

const canHover = signalFromMatchMedia("(hover: hover)", true, false);

// detecting :active in javascript
// https://stackoverflow.com/questions/44578580/detect-pseudo-css-activation
// literally: make a css class to apply a 0s animation when the element is active and then
// detect animationstart

// :/

export default function Hactive(props: {
    clickable: boolean,
    children: (state: Accessor<boolean>, ref: (el: HTMLElement) => void, addClass: Accessor<string>) => JSX.Element,
}): JSX.Element {
    const noChildrenHovering = () => true;

    const [hovering, setHovering] = createSignal(false);
    const [active, setActive] = createSignal(false);
    const state = () => {
        return props.clickable && (active()) || (noChildrenHovering() && canHover() && hovering());
    };

    return <>{untrack(() => props.children(state, el => {
        el.addEventListener("mouseenter", () => {
            setHovering(true);
        });
        el.addEventListener("mouseout", e => {
            console.log("MOUSEOUT");
            let parent = e.relatedTarget as Node | null;
            while(parent) {
                if(parent === el) {
                    setHovering(true);
                    return;
                }
                if(parent instanceof HTMLElement) {
                    if(parent.classList.contains("@TAKES-HOVER@")) {
                        setHovering(false);
                        return;
                    }
                }
                parent = parent.parentNode;
            }
            // code shouldn't get here
            setHovering(false);
        });
        el.addEventListener("mouseleave", () => {
            setHovering(false);
        });
        el.addEventListener("animationstart", (e) => {
            if(e.target !== e.currentTarget) return;
            setActive(true);
        });
        el.addEventListener("animationcancel", (e) => {
            if(e.target !== e.currentTarget) return;
            setActive(false);
        });
    }, () => props.clickable ? " js-detect-active @TAKES-HOVER@ handles-clicks " : ""))}</>;
}
