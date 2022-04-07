import { createSignal, JSX, onCleanup } from "solid-js";

export default function SwipeCollapse(props: {children?: JSX.Element | undefined}): JSX.Element {
    const [xoff, setXoff] = createSignal(0);
    let dragging = false;
    let cleanup_fns: (() => void)[] = [];
    onCleanup(() => {
        cleanup_fns.forEach(fn => fn());
    });
    return <div class="w-full overflow-x-clip"><div class="touch-pan-x" style={{
        'transform': "translateX("+xoff()+"px)",
    }} onPointerDown={initial_ev => {
        const id = initial_ev.pointerId;
        const el = initial_ev.currentTarget;
        if(initial_ev.pointerType === "mouse") return; // skip
        if(dragging) return; // no dragging twice at once
        dragging = true;

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
    }}>{props.children}</div></div>;
}