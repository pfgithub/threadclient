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

import getStroke from "perfect-freehand";
import { batch, createEffect, createMemo, createSignal, JSX, onCleanup } from "solid-js";
import { findFrameIndex, Action, State } from "./apply_action";

export default function Animator(props: {state: State, applyAction: (action: Action) => void}): JSX.Element {
    return <div class="h-full">
        <DrawCurrentFrame state={props.state} applyAction={props.applyAction} />
        <GestureRecognizer state={props.state} applyAction={props.applyAction} />
    </div>;
}

export function DrawCurrentFrame(props: {state: State, applyAction: (action: Action) => void}): JSX.Element {
    return <FullscreenCanvas2D render={(ctx, size) => {
        const start = Date.now();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size.width, size.height);
        // TODO scale based on state

        const frame_index = findFrameIndex(props.state.frame, props.state.cached_state);
        const frame = props.state.cached_state.frames[frame_index]!;

        for(const face of frame.merged_polygons) {
            let i = -1;
            for(const points of face) {
                i++;
                ctx.beginPath();
                let zero = true;
                for(const [x, y] of points) {
                    if(zero) {
                        ctx.moveTo(x, y);
                        zero = false;
                    }else{
                        ctx.lineTo(x, y);
                    }
                }
                if(i === 0) {
                    ctx.fillStyle = frame_index === props.state.frame ? "#000000" : "#555555";
                    ctx.fill();
                }else{
                    ctx.fillStyle = "#ffffff";
                    ctx.fill();
                }
            }
        }
        const end = Date.now();
        ctx.fillStyle = "#000000";
        ctx.fillText("Last Update ms: " + (props.state.update_time), 10, 20);
        ctx.fillText("Draw ms: " + (end - start), 10, 30);
        ctx.fillText("Vertices: " + (frame.merged_polygons.reduce((t, poly) => (
            t + poly.reduce((q, points) => q + points.length, 0)
        ), 0)), 10, 40);
        ctx.fillText("Frame: " + (props.state.frame) + " / " + (props.state.max_frame), 10, 50);
        ctx.fillText("Audio: "
            + props.state.config.attribution.author.text
            + " - " + props.state.config.attribution.title.text
            + " / " + props.state.config.attribution.license.text
        , 10, 60);
    }} />;
}

let source: AudioBufferSourceNode | undefined;

export function GestureRecognizer(props: {state: State, applyAction: (action: Action) => void}): JSX.Element {
    const [plannedStrokes, setPlannedStrokes] = createSignal(new Map<string, PressurePoint[]>());

    const commitStroke = (sp: PressurePoint[]) => (
        getStroke(sp, {
            simulatePressure: sp.every(pt => pt[2] === 0.5),
        }) as Point2D[]
    );
    const eventToPoint = (e: PointerEvent): PressurePoint => {
        return [e.pageX, e.pageY, e.pressure];
    };
    type Pointer = {
        points: Map<number, {start: number, point: PressurePoint}>,
        mode: {kind: "draw"} | {kind: "zoom"} | {kind: "switch_frame", start_x: number},
    };
    const pointers = new Map<string, Pointer>();
    const getPointerMap = (type: string) => {
        const submap = pointers.get(type);
        if(!submap || submap.points.size === 0) {
            const setv: Pointer = {
                points: new Map(),
                mode: {kind: "draw"},
            };
            pointers.set(type, setv);
            return setv;
        }
        return submap;
    };

    const onpointerdown = (e: PointerEvent) => {
        e.preventDefault();

        const pmap = getPointerMap(e.pointerType);
        pmap.points.set(e.pointerId, {start: Date.now(), point: eventToPoint(e)});

        if(e.pointerType === "touch" && pmap.points.size > 1) {
            if(pmap.mode.kind === "zoom" || [...pmap.points.values()][0]!.start < Date.now() - 200) {
                pmap.points.delete(e.pointerId);
                return;
            }
            pmap.mode = {kind: "zoom"};
            setPlannedStrokes(pts => {
                const res = new Map(pts);
                res.delete(e.pointerType);
                return res;
            });
            props.applyAction({kind: "undo"});
            const ppv = [...pmap.points.values()];
            if(ppv.length < 2) return;
            const start: Vector = [[ppv[0]!.point[0], ppv[0]!.point[1]], [ppv[1]!.point[0], ppv[1]!.point[1]]];
            // setZoom([start, start]);
            () => start;
            return;
        }
        if(e.pageY > window.innerHeight - 200) {
            pmap.mode = {kind: "switch_frame", start_x: e.pageX};
            return;
        }

        setPlannedStrokes(pts => new Map(pts).set(e.pointerType, [eventToPoint(e)]));
    };
    document.addEventListener("pointerdown", onpointerdown);
    onCleanup(() => document.removeEventListener("pointerdown", onpointerdown));

    const onpointermove = (e: PointerEvent) => {
        const pmap = getPointerMap(e.pointerType);
        const prev = pmap.points.get(e.pointerId);
        if(prev) {
            e.preventDefault();

            prev.point = eventToPoint(e);

            if(e.pointerType === "touch" && pmap.mode.kind === "zoom") {
                const ppv = [...pmap.points.values()];
                if(ppv.length < 2) return;
                const current: Vector = [[ppv[0]!.point[0], ppv[0]!.point[1]], [ppv[1]!.point[0], ppv[1]!.point[1]]];
                // setZoom(z => [z![0], current]);
                () => current;
                return;
            }
            if(pmap.mode.kind === "switch_frame") {
                const start_frame = props.state.frame;
                while(e.pageX < pmap.mode.start_x - 20) {
                    props.applyAction({kind: "set_frame", frame: props.state.frame + 1});
                    pmap.mode.start_x -= 20;
                }
                while(e.pageX > pmap.mode.start_x + 20) {
                    props.applyAction({kind: "set_frame", frame: props.state.frame - 1});
                    pmap.mode.start_x += 20;
                }
                if(props.state.frame !== start_frame) {
                    if(source) source.stop();

                    let nct = props.state.frame / props.state.config.framerate;
                    if(nct < 0) nct = 0;
                    if(nct > props.state.audio.duration) nct = props.state.audio.duration;

                    source = props.state.audio_ctx.createBufferSource();
                    source.buffer = props.state.audio;
                    source.connect(props.state.audio_ctx.destination);
                    source.start(0, nct, (1 / props.state.config.framerate) * 2);
                }
                return;
            }
            
            setPlannedStrokes(pts => new Map(pts).set(e.pointerType, [
                ...pts.get(e.pointerType) ?? [],
                eventToPoint(e),
            ]));
        }
    };
    document.addEventListener("pointermove", onpointermove);
    onCleanup(() => document.removeEventListener("pointermove", onpointermove));

    const onpointerup = (e: PointerEvent) => {
        e.preventDefault();

        const pmap = getPointerMap(e.pointerType);
        if(!pmap.points.has(e.pointerId)) return;
        pmap.points.delete(e.pointerId);
        if(e.pointerType === "touch" && pmap.mode.kind === "zoom") {
            if(pmap.points.size < 2) {
                // batch(() => {
                //     setTransform(t => transformZoomed(t).inverse());
                //     setZoom(null);
                // });
            }
            return;
        }
        if(pmap.mode.kind === "switch_frame") {
            return;
        }

        const value = plannedStrokes().get(e.pointerType) ?? [];
        batch(() => {
            setPlannedStrokes(pts => {
                const res = new Map(pts);
                res.delete(e.pointerType);
                return res;
            });
            const stroke = commitStroke(value);
            if(stroke.some(item => isNaN(item[0]) || isNaN(item[1]))) return;
            props.applyAction({
                kind: e.pointerType === "touch" || (e.button === 2) ? "erase_polygon" : "add_polygon",
                polygon: stroke,
                frame: props.state.frame,
            });
        });
    };
    document.addEventListener("pointerup", onpointerup);
    onCleanup(() => document.removeEventListener("pointerup", onpointerup));

    const onpointercancel = (e: PointerEvent) => {
        const pmap = getPointerMap(e.pointerType);
        if(!pmap.points.has(e.pointerId)) return;
        pmap.points.delete(e.pointerId);
        if(e.pointerType === "touch" && pmap.mode.kind === "zoom") {
            // if(pmap.points.size < 2) setZoom(null);
            return;
        }
        if(pmap.mode.kind === "switch_frame") {
            return;
        }

        setPlannedStrokes(pts => {
            const res = new Map(pts);
            res.delete(e.pointerType);
            return res;
        });
    };
    document.addEventListener("pointercancel", onpointercancel);
    onCleanup(() => document.removeEventListener("pointercancel", onpointercancel));

    const oncontextmenu = (e: Event) => {
        e.preventDefault();
    };
    document.addEventListener("contextmenu", oncontextmenu);
    onCleanup(() => document.removeEventListener("pointercancel", oncontextmenu));

    const strokes = createMemo((): Point2D[][] => (
        [...plannedStrokes().values()].map(commitStroke)
    ));

    return <FullscreenCanvas2D render={(ctx, size) => {
        ctx.fillStyle = "#000";
        for(const stroke of strokes()) {
            ctx.beginPath();
            let zero = true;
            for(const [x, y] of stroke) {
                if(zero) {
                    ctx.moveTo(x, y);
                    zero = false;
                }else{
                    ctx.lineTo(x, y);
                }
            }
            ctx.fill();
        }

        ctx.fillStyle = "#aaa";
        ctx.fillRect(0, size.height - 200, size.width, 200);

        ctx.fillStyle = "#000";
        const data = props.state.audio_data;
        const start = (props.state.frame / props.state.config.framerate * props.state.audio.sampleRate) |0;
        // TODO visualizer including this and previous frames
        // + show frame thumbnails and stuff
        for(let i = 0; i < 18; i++) {
            ctx.fillText("" + Math.abs(data[start + i] ?? 0), 10, size.height - 200 + ((i + 2) * 10));
        }
    }} />;
}

export function FullscreenCanvas2D(props: {
    render: (
        ctx: CanvasRenderingContext2D,
        size: {width: number, height: number},
    ) => void,
}): JSX.Element {
    const getPageSize = () => {
        return {width: window.innerWidth, height: window.innerHeight};
    };
    const [pageSize, setPageSize] = createSignal<{width: number, height: number}>(getPageSize());
    const onresize = () => {
        setPageSize(getPageSize());
    };
    window.addEventListener("resize", onresize);
    onCleanup(() => window.removeEventListener("resize", onresize));

    return <canvas ref={canvas => {
        const ctx = canvas.getContext("2d")!;


        createEffect(() => {
            const page_size = pageSize();
            const pr = window.devicePixelRatio;
            if(canvas.width !== page_size.width * pr) canvas.width = page_size.width * pr;
            if(canvas.height !== page_size.height * pr) canvas.height = page_size.height * pr;

            ctx.setTransform(new DOMMatrixReadOnly().scale(pr));
            ctx?.clearRect(0, 0, page_size.width, page_size.height);

            props.render(ctx, page_size);
        });
    }}
        class="w-full h-full fixed top-0 left-0 bottom-0 right-0"
    />;
}

type PressurePoint = [
    x: number,
    y: number,
    pressure: number,
];

type Point2D = [x: number, y: number];
type Vector = [origin: Point2D, dest: Point2D];
