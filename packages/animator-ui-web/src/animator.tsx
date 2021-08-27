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

    return <canvas ref={canvas => {
        const ctx = canvas.getContext("2d")!;

        createEffect(() => {
            canvas.width = pageSize().width;
            canvas.height = pageSize().height;
            // redraw
        });

        createEffect(() => {
            const point_s = stroke();
            const page_size = pageSize();
            ctx?.clearRect(0, 0, page_size.width, page_size.height);
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
        onpointerdown={e => {
            e.preventDefault();
            setDrawing(true);
            setPoints([
                [e.pageX, e.pageY, e.pressure],
            ]);
        }}
        onpointermove={e => {
            if(drawing()) {
                e.preventDefault();
                setPoints(pts => [
                    ...pts,
                    [e.pageX, e.pageY, e.pressure],
                ]);
            }
        }}
        onpointerup={e => {
            e.preventDefault();
            setDrawing(false);
            setPoints(pts => [
                ...pts,
                [e.pageX, e.pageY, e.pressure],
            ]);
        }}
        onpointercancel={e => {
            setDrawing(false);
            setPoints([]);
        }}
    />;
}

export default function Animator(): JSX.Element {
    return <div class="h-full">
        <AnimationCanvas />    
    </div>;
}