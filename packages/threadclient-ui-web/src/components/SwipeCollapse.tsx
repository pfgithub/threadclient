import { createMemo, createSignal, JSX, onCleanup } from "solid-js";

export default function SwipeCollapse(props: {children?: JSX.Element | undefined}): JSX.Element {
    const [xoff, setXoff] = createSignal(0);
    const isDragging = createMemo(() => xoff() !== 0);
    let el!: HTMLDivElement;
    let dragging = false;
    let cleanup_fns: (() => void)[] = [];
    onCleanup(() => {
        cleanup_fns.forEach(fn => fn());
    });
    return <div class={
        "w-full "+(isDragging() ? "overflow-x-hidden" : "")
    } style={{
        'touch-action': "pan-y pinch-zoom",
    }} onPointerDown={initial_ev => {
        const id = initial_ev.pointerId;
        if(initial_ev.pointerType === "mouse") return; // skip
        if(dragging) return; // no dragging twice at once
        dragging = true;

        // el.setPointerCapture(id);
        // not using it because it seems to have a bug on ios where pointercancel never
        // gets called on the element.

        initial_ev.preventDefault();

        el.style.transition = "";

        const end = () => {
            dragging = false;
            el.style.transition = "0.1s transform";
            el.offsetWidth;
            setXoff(0);
            cleanup();
            // [!] don't do actions here. do onptrup instead.
        };

        const onptrmove = (e: PointerEvent) => {
            if(e.pointerId !== id) return;
            setXoff(e.clientX - initial_ev.clientX);
            //
        };
        const onptrup = (e: PointerEvent) => {
            if(e.pointerId !== id) return;
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
    }}><div ref={el} style={{
        'transform': "translateX("+xoff()+"px)",
    }}>{props.children}</div></div>;
}