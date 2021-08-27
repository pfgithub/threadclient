// outline:
// - have a large canvas you can draw on
//   - https://github.com/wobsoriano/solid-whiteboard
//   - https://github.com/steveruizok/perfect-freehand
// - load audio data
// - have a list of frames at the bottom. scrolling through them should play the sound clips
//   like this https://github.com/pfgithub/lyrictimer/blob/main/src/app.ts#L196
// - empty frames should show the content of the last displayed frame
// - connect to the server via websocket
// - post your drawings to the websocket

import { createEffect, createMemo, createSignal, JSX, onCleanup } from "solid-js";
import getStroke from "perfect-freehand";

type Point = [
    x: number,
    y: number,
    pressure: number,
];

function AnimationCanvas(): JSX.Element {
    const getPageSize = () => {
        return {width: window.innerWidth, height: window.innerHeight};
    };
    const [pageSize, setPageSize] = createSignal<{width: number, height: number}>(getPageSize());
    const onresize = () => {
        setPageSize(getPageSize());
    };
    window.addEventListener("resize", onresize);
    onCleanup(() => window.removeEventListener("resize", onresize));

    const [points, setPoints] = createSignal<Point[]>([]);
    const [drawing, setDrawing] = createSignal(false);

    const stroke = createMemo(() => (
        getStroke(points()) as [number, number][]
    ));

    const [transform, setTransform] = createSignal(new DOMMatrixReadOnly());

    const onpointerdown = (e: PointerEvent) => {
        e.preventDefault();
        setDrawing(true);
        setPoints([
            eventToPoint(e),
        ]);
    };
    document.addEventListener("pointerdown", onpointerdown);
    onCleanup(() => document.removeEventListener("pointerdown", onpointerdown));

    const eventToPoint = (e: PointerEvent): Point => {
        const point = transform().transformPoint(new DOMPoint(e.pageX, e.pageY));
        return [point.x, point.y, e.pressure];
    };

    const onpointermove = (e: PointerEvent) => {
        if(drawing()) {
            e.preventDefault();
            setPoints(pts => [
                ...pts,
                eventToPoint(e),
            ]);
        }
    };
    document.addEventListener("pointermove", onpointermove);
    onCleanup(() => document.removeEventListener("pointermove", onpointermove));

    const onpointerup = (e: PointerEvent) => {
        e.preventDefault();
        setDrawing(false);
        setPoints(pts => [
            ...pts,
            eventToPoint(e),
        ]);
    };
    document.addEventListener("pointerup", onpointerup);
    onCleanup(() => document.removeEventListener("pointerup", onpointerup));

    const onpointercancel = (e: PointerEvent) => {
        setDrawing(false);
        setPoints([]);
    };
    document.addEventListener("pointercancel", onpointercancel);
    onCleanup(() => document.removeEventListener("pointercancel", onpointercancel));

    const onkeypress = (e: KeyboardEvent) => {
        if(e.key === "a") {
            setTransform(t => t.rotate(0.2));
        }
    };
    document.addEventListener("keypress", onkeypress);
    onCleanup(() => document.removeEventListener("keypress", onkeypress));

    // const draw_size: [w: number, h: number] = [1920, 1080];

    return <canvas ref={canvas => {
        const ctx = canvas.getContext("2d")!;

        createEffect(() => {
            const point_s = stroke();
            const page_size = pageSize();
            const pr = window.devicePixelRatio;
            if(canvas.width !== page_size.width * pr) canvas.width = page_size.width * pr;
            if(canvas.height !== page_size.height * pr) canvas.height = page_size.height * pr;
            ctx.setTransform(new DOMMatrixReadOnly().scale(pr));
            ctx?.clearRect(0, 0, page_size.width, page_size.height);

            ctx.setTransform(transform().inverse().scale(pr));

            ctx.beginPath();
            let zero = true;
            for(const [x, y] of point_s) {
                if(zero) {
                    ctx.moveTo(x, y);
                    zero = false;
                }else{
                    ctx.lineTo(x, y);
                }
            }
            ctx.fill();
        });
    }}
        class="w-full h-full"
    />;
}

export default function Animator(): JSX.Element {
    return <div class="h-full">
        <AnimationCanvas />    
    </div>;
}