import {
    Accessor,
    createEffect, createSignal, JSX, on, untrack
} from "solid-js";
import { ShowBool } from "tmeta-util-solid";
import { navbar } from "../app";
import { getSettings, Settings } from "../util/utils_solid";

export let shift_pressed = false;
document.addEventListener("keydown", e => {
    if(e.key === "Shift") shift_pressed = true;
}, {capture: true});
document.addEventListener("keyup", e => {
    if(e.key === "Shift") shift_pressed = false;
}, {capture: true});
document.addEventListener("focus", e => {
    shift_pressed = false;
});

export function animationTime(): number {
    const settings = getSettings();
    if(untrack(() => settings.motion.value() === "reduce")) return 0;
    return untrack(() => (
        shift_pressed && settings.animation_dev_mode.value() === "shift_slow"
        ? 3 : settings.animation_time.value()
    ))
};

export function animateHeight(
    comment_root: HTMLElement,
    settings: Settings,
    transitionTarget: Accessor<boolean>,
    setState: (state: boolean, rising: boolean, temporary: boolean) => void,
): void {
    const [animating, setAnimating] = createSignal<number | null>(null);
    comment_root.addEventListener("transitionend", () => {
        setAnimating(null);
        setState(transitionTarget(), false, false);
    });
    createEffect(on([transitionTarget], () => {

        const initial_size = comment_root.getBoundingClientRect();
        const navbar_size = navbar.getBoundingClientRect();
        const visualTop = () => 5 + Math.max(
            0, 
            navbar_size.bottom,
            window.visualViewport.offsetTop,
        );
        const visualBottom = () => (
            window.visualViewport.offsetTop + window.visualViewport.height
        );

        console.log(initial_size.top, initial_size.bottom, visualTop(), visualBottom());

        let scroll_offset = 0;
        if(initial_size.top < visualTop() && initial_size.bottom > visualTop()) {
            const start_scroll = document.documentElement.scrollTop;
            comment_root.scrollIntoView();
            document.documentElement.scrollTop -= visualTop();
            const end_scroll = document.documentElement.scrollTop;
            scroll_offset = start_scroll - end_scroll;
        }

        const target = transitionTarget();
        if(settings.motion.value() === "reduce" || settings.animation_time.value() === 0) {
            setState(target, false, false);
            return;
        }

        const initial_height = Math.min(initial_size.bottom, visualBottom()) - initial_size.top - scroll_offset;
        const prev_scrolltop = document.documentElement.scrollTop;

        setAnimating(null);
        setState(target, false, true);

        requestAnimationFrame(() => {
            const final_size = comment_root.getBoundingClientRect();
            const final_height = Math.min(final_size.bottom, visualBottom()) - final_size.top;

            if(final_height === initial_height) {
                setState(target, false, false);
                return;
            }

            setState(target, true, true);

            setAnimating(initial_height);
            comment_root.scrollTop = scroll_offset;
            requestAnimationFrame(() => {
                document.documentElement.scrollTop = prev_scrolltop;
                comment_root.scrollTop = scroll_offset;

                setAnimating(final_height);
            });
        });
    }, {defer: true}));
    createEffect(() => {
        if(animating() != null) {
            console.log("ANIMATING", shift_pressed);
            comment_root.style.height = animating() + "px";
            comment_root.style.overflow = "hidden";
            comment_root.style.transition = animationTime() + "s height";
        }else{
            comment_root.style.removeProperty("height");
            comment_root.style.removeProperty("overflow");
            comment_root.style.removeProperty("transition");
        }
    });
}

// if={[condition]} when={[condition]}
// it's hard to have a when= in showAnimate because if the thing
// is removed you probably don't want to keep around a copy of it
export function ShowAnimate(props: {
    when: boolean,
    fallback?: undefined | JSX.Element,
    children: JSX.Element,
}): JSX.Element {
    const settings = getSettings();
    const [show, setShow] = createSignal({main: props.when, animating: false});
    return <div ref={v => {
        animateHeight(v, settings, () => props.when, (state, rising, temporary) => {
            setShow({main: state || rising, animating: temporary});
        });
        createEffect(() => {
            v.style.display = show().main || (props.fallback != null) ? "block" : "none";
        });
    }}>
        <ShowBool when={show().main || show().animating}>
            <div class={show().animating && !show().main ? "hidden" : ""}>
                {props.children}
            </div>
        </ShowBool>
        <ShowBool when={!show().main || show().animating}>
            <div class={show().animating && show().main ? "hidden" : ""}>
                {props.fallback}
            </div>
        </ShowBool>
    </div>;
}

// TODO <AnimateGroup>{(final: Accessor, animating: Accessor) => }</AnimateGroup>