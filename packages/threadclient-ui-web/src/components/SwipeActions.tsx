import { Accessor, batch, createEffect, createMemo, createSignal, JSX, onCleanup, untrack } from "solid-js";
import { Show } from "tmeta-util-solid";

// BROKEN ON iOS SAFARI DUE TO A REGRESSION
// https://bugs.webkit.org/show_bug.cgi?id=232545
//
// Other projects get around this by using touch events instead of pointer events and
// then manually blocking scrolling:
// https://github.com/marekrozmus/react-swipeable-list/blob/main/src/SwipeableListItem.js
//
// Another possible workaround is to make the page one pixel wider horizontally than
// it's supposed to be, enabling horizontal scrolling on the body which fixes the issue
// for some reason.
//
// ^ That workaround has been applied in src/main.scss

export default function SwipeActions(props: {
    children: JSX.Element,
    background: (offset: Accessor<number>) => JSX.Element,
    onRelease: (offset: number) => void,
}): JSX.Element {
    const [xoff, setXoff] = createSignal<number | null>(null);
    const isDragging = createMemo(() => xoff() != null);
    const [isAnimating, setIsAnimating] = createSignal(false);
    const isDragVisible = createMemo(() => isDragging() || isAnimating());

    let prev_xoff = 0;
    createEffect(() => {
        const xof = xoff();
        if(xof != null) prev_xoff = xof;
    });

    let el!: HTMLDivElement;
    let cleanup_fns: (() => void)[] = [];
    onCleanup(() => {
        cleanup_fns.forEach(fn => fn());
    });
    return <div style={{
        'width': "100%",
        'overflow-x': isDragVisible() ? "hidden" : "unset",
        'touch-action': "pan-y pinch-zoom",
        'position': "relative",
    }} onPointerDown={initial_ev => {
        const id = initial_ev.pointerId;
        if(initial_ev.pointerType === "mouse") return; // skip
        if(isDragging()) return; // no dragging twice at once

        let started = false;

        // el.setPointerCapture(id);
        // not using it because it seems to have a bug on ios where pointercancel never
        // gets called on the element.

        initial_ev.preventDefault();

        el.style.transition = "";

        const end = () => {
            const needs_transition = xoff() !== 0 && xoff() != null;
            el.style.transition = "0.1s transform";
            if(needs_transition) el.offsetWidth;
            batch(() => {
                if(needs_transition) setIsAnimating(true);
                setXoff(null);
            });
            cleanup();
        };

        const onptrmove = (e: PointerEvent) => {
            if(e.pointerId !== id) return;
            const offset_x = e.clientX - initial_ev.clientX;
            // const offset_y = e.clientY - initial_ev.clientY;
            // ^ TODO: check the ratio and it has to be less than a 30 degree angle off the thing
            if(started || Math.abs(offset_x) > 10) {
                started = true;
                setXoff(offset_x);
            }
            //
        };
        const onptrup = (e: PointerEvent) => {
            if(e.pointerId !== id) return;
            props.onRelease(xoff() ?? 0);
            end();
        };
        const onptrcancel = (e: PointerEvent) => {
            if(e.pointerId !== id) return;
            end();
        };

        document.addEventListener("pointermove", onptrmove);
        document.addEventListener("pointerup", onptrup);
        document.addEventListener("pointercancel", onptrcancel);
        const cleanup = () => {
            cleanup_fns = cleanup_fns.filter(fn => fn !== cleanup);
            document.removeEventListener("pointermove", onptrmove);
            document.removeEventListener("pointerup", onptrup);
            document.removeEventListener("pointercancel", onptrcancel);
        };
        cleanup_fns.push(cleanup);
    }}>
        <Show if={isDragVisible()}>
            <div class="absolute top-0 left-0 w-full h-full">
                {untrack(() => props.background(() => xoff() ?? prev_xoff))}
            </div>
        </Show>
        <div ref={el} style={{
            'transform': (() => {const v = xoff(); return v != null ? "translateX("+v+"px)" : ""})(),
        }} onTransitionEnd={e => {
            if(e.target !== e.currentTarget) return;
            setIsAnimating(false);
        }}>{props.children}</div>
    </div>;
}