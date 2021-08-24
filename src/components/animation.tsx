import {
    Accessor,
    createEffect, createSignal, JSX, on
} from "solid-js";
import { navbar } from "../app";
import { getSettings, Settings, ShowBool } from "../util/utils_solid";

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
        const navbar_y = 5 + navbar_size.bottom;

        let scroll_offset = 0;
        if(initial_size.top < navbar_y && initial_size.bottom > navbar_y) {
            const start_scroll = document.documentElement.scrollTop;
            comment_root.scrollIntoView();
            document.documentElement.scrollTop -= navbar_y;
            const end_scroll = document.documentElement.scrollTop;
            scroll_offset = start_scroll - end_scroll;
        }

        const target = transitionTarget();
        if(settings.motion.value() === "reduce") {
            setState(target, false, false);
            return;
        }

        const window_height = window.innerHeight;
        const initial_height = Math.min(initial_size.bottom, window_height) - initial_size.top - scroll_offset;

        setAnimating(null);
        setState(target, false, true);

        requestAnimationFrame(() => {
            const final_size = comment_root.getBoundingClientRect();
            const final_height = Math.min(final_size.bottom, window_height) - final_size.top;

            if(final_height === initial_height) {
                setState(target, false, false);
                return;
            }

            setState(target, true, true);

            setAnimating(initial_height);
            comment_root.scrollTop = scroll_offset;
            requestAnimationFrame(() => {
                comment_root.scrollTop = scroll_offset;

                setAnimating(final_height);
            });
        });
    }, {defer: true}));
    createEffect(() => {
        if(animating() != null) {
            comment_root.style.height = animating() + "px";
            comment_root.style.overflow = "hidden";
            comment_root.style.transition = "0.2s height";
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
export function ShowAnimate(props: {when: boolean, fallback?: JSX.Element, children: JSX.Element}): JSX.Element {
    const settings = getSettings();
    const [show, setShow] = createSignal({main: props.when, animating: false});
    return <div ref={v => {
        animateHeight(v, settings, () => props.when, (state, rising, temporary) => {
            setShow({main: state || rising, animating: temporary});
        });
        createEffect(() => {
            v.style.display = show().main || (props.fallback != null) ? "block" : "none";
            console.log(v.style.display);
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