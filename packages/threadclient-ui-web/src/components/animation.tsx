import {
    Accessor,
    createEffect, createSignal, JSX, on, untrack
} from "solid-js";
import { Show } from "tmeta-util-solid";
import { navbar } from "../router";
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
    if(untrack(() => settings.motion() === "reduce")) return 0;
    return untrack(() => (
        shift_pressed && settings.animationDevMode() === "shift_slow"
        ? 3 : settings.animationTime()
    ));
}

export function animateHeight(
    comment_root: HTMLElement,
    settings: Settings,
    transitionTarget: Accessor<boolean>,
    setState: (state: boolean, rising: boolean, temporary: boolean) => void,
    opts?: undefined | {mode?: undefined | "clip" | "height"},
): void {
    const mode = opts?.mode ?? "height";

    const onTransitionTargetChangedImmediate = () => {
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

        console.log("ANIMATE!", initial_size.top, initial_size.bottom, visualTop(), visualBottom());

        let scroll_offset = 0;
        if(initial_size.top < visualTop() && initial_size.bottom > visualTop()) {
            const start_scroll = document.documentElement.scrollTop;
            comment_root.scrollIntoView();
            document.documentElement.scrollTop -= visualTop();
            const end_scroll = document.documentElement.scrollTop;
            scroll_offset = start_scroll - end_scroll;
        }

        const target = transitionTarget();
        if(
            settings.motion() === "reduce"
            || settings.animationTime() === 0
            || initial_size.top > visualBottom()
            || initial_size.bottom < visualTop()
        ) {
            setState(target, false, false);
            return;
        }

        const initial_height = Math.min(initial_size.bottom, visualBottom()) - initial_size.top - scroll_offset;
        const prev_scrolltop = document.documentElement.scrollTop;

        // setAnimating(null);
        setState(target, false, true);

        const final_size = comment_root.getBoundingClientRect();
        const final_height = Math.min(final_size.bottom, visualBottom()) - final_size.top;

        if(final_height === initial_height) {
            setState(target, false, false);
            return;
        }

        setState(target, true, true);

        const current_size = comment_root.getBoundingClientRect();

        const anq = (target_height: number, total_height: number): Keyframe => (mode === "height" ? {
            height: target_height + "px",
            overflow: "hidden",
        } : {
            clipPath: "inset(0 0 "+(total_height - target_height)+"px "+"0px)",
        });
        const anim = comment_root.animate([
            anq(initial_height, current_size.height),
            anq(final_height, current_size.height),
        ], {
            duration: animationTime() * 1000,
            easing: "ease-in-out",
        });

        comment_root.scrollTop = scroll_offset;

        document.documentElement.scrollTop = prev_scrolltop;
        comment_root.scrollTop = scroll_offset;

        anim.onfinish = () => setState(transitionTarget(), false, false);
        anim.oncancel = () => setState(transitionTarget(), false, false);
    };
    createEffect(on([transitionTarget], () => {
        setTimeout(() => onTransitionTargetChangedImmediate(), 0); // unbatch()
    }, {defer: true}));
}

// if={condition} when={condition}
// it's hard to have a when= in showAnimate because if the thing
// is removed you probably don't want to keep around a copy of it

// TODO: when reduce motion is on, use opacity instead of animateHeight()
export function ShowAnimate(props: {
    mode?: undefined | "clip" | "height", // = "height" //[!] not reactive
    if: boolean,
    fallback?: undefined | JSX.Element,
    children: JSX.Element,
}): JSX.Element {
    const settings = getSettings();
    const [show, setShow] = createSignal({main: props.if, animating: false});
    return <tc:show-animate ref={v => {
        animateHeight(v, settings, () => props.if, (state, rising, temporary) => {
            setShow({main: state || rising, animating: temporary});
        }, {
            mode: props.mode,
        });
        createEffect(() => {
            v.style.display = show().main || (props.fallback != null) ? "block" : "none";
        });
    }}>
        <Show if={show().main || show().animating}>
            <tc:children ref={el => {
                createEffect(() => {
                    if(props.if === true) {
                        el.removeAttribute("inert");
                    }else{
                        el.setAttribute("inert", "true");
                    }
                });
            }} class={show().animating && !show().main ? "hidden" : "flex-col"}>
                <div>
                    {props.children}
                </div>
            </tc:children>
        </Show>
        <Show if={!show().main || show().animating}>
            <tc:fallback ref={el => {
                createEffect(() => {
                    if(props.if === true) {
                        el.setAttribute("inert", "true");
                    }else{
                        el.removeAttribute("inert");
                    }
                });
            }} class={show().animating && show().main ? "hidden" : "flex-col"}>
                <div>
                    {props.fallback}
                </div>
            </tc:fallback>
        </Show>
    </tc:show-animate>;
}

// TODO <AnimateGroup>{(final: Accessor, animating: Accessor) => }</AnimateGroup>