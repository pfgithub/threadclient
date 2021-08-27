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

import { batch, createEffect, createMemo, createSignal, JSX, onCleanup } from "solid-js";
import getStroke from "perfect-freehand";

type Point = [
    x: number,
    y: number,
    pressure: number,
];

const config: {
    drawing_size: [x: number, y: number],
    framerate: number,
} = {
    drawing_size: [1920, 1080],
    framerate: 30,
};

type Point2D = [x: number, y: number];
type Vector = [origin: Point2D, dest: Point2D];

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

    const [committedStrokes, setCommittedStrokes] = createSignal<Point2D[][]>([]);
    const [points, setPoints] = createSignal(new Map<string, Point[]>());

    const commitStroke = (sp: Point[]) => (
        getStroke(sp) as Point2D[]
    );
    const strokes = createMemo((): Point2D[][] => (
        [...points().values()].map(commitStroke)
    ));

    // transform (drawing point[1920×1080] → page coord[W×H])
    const [getTransform, setTransform] = createSignal(new DOMMatrixReadOnly());
    const transform = () => {
        return transformScaled(getTransform());
    };
    const transformScaled = (transform_v: DOMMatrixReadOnly) => {
        const page_size = pageSize();

        const scale = Math.min(
            page_size.width / config.drawing_size[0],
            page_size.height / config.drawing_size[1],
        );

        return transform_v.scale(scale, scale);
    };
    const transformZoomed = (transform_v: DOMMatrixReadOnly) => {
        const zoomv = zoom();
        if(!zoomv) return transform_v;
        const centerpt = (pt: Vector): Point2D => {
            return [
                (pt[1][0] - pt[0][0]) / 2 + pt[0][0],
                (pt[1][1] - pt[0][1]) / 2 + pt[0][1],
            ];
        };
        const translation_vec: Vector = [
            centerpt(zoomv[0]),
            centerpt(zoomv[1]),
        ];
        const translation: Point2D = [
            translation_vec[1][0] - translation_vec[0][0],
            translation_vec[1][1] - translation_vec[0][1],
        ];
        const center = translation_vec[1];
        return transform_v.translate(
            center[0], center[1],
        ).rotate((
            Math.atan2(zoomv[0][1][0] - zoomv[0][0][0], zoomv[0][1][1] - zoomv[0][0][1]) -
            Math.atan2(zoomv[1][1][0] - zoomv[1][0][0], zoomv[1][1][1] - zoomv[1][0][1])
        ) * (180 / Math.PI)).scale(
            Math.hypot(zoomv[1][1][0] - zoomv[1][0][0], zoomv[1][1][1] - zoomv[1][0][1]) /
            Math.hypot(zoomv[0][1][0] - zoomv[0][0][0], zoomv[0][1][1] - zoomv[0][0][1])
        ).translate(
            translation[0] - center[0], translation[1] - center[1],
        );
    };
    const [zoom, setZoom] = createSignal<[start: Vector, end: Vector] | null>(null);

    type Pointer = {
        points: Map<number, {start: number, point: Point}>,
        mode: "draw" | "zoom",
    };
    const pointers = new Map<string, Pointer>();
    const getPointerMap = (type: string) => {
        const submap = pointers.get(type);
        if(!submap || submap.points.size === 0) {
            const setv: Pointer = {
                points: new Map(),
                mode: "draw",
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
            if(pmap.mode === "zoom" || [...pmap.points.values()][0]!.start < Date.now() - 200) {
                pmap.points.delete(e.pointerId);
                return;
            }
            pmap.mode = "zoom";
            setPoints(pts => {
                const res = new Map(pts);
                res.delete(e.pointerType);
                return res;
            });
            const ppv = [...pmap.points.values()];
            if(ppv.length < 2) return;
            const start: Vector = [[ppv[0]!.point[0], ppv[0]!.point[1]], [ppv[1]!.point[0], ppv[1]!.point[1]]];
            setZoom([start, start]);
            // gestureCancel()
            // gestureStart(zoom)
            return;
        }

        setPoints(pts => new Map(pts).set(e.pointerType, [eventToPoint(e)]));
    };
    document.addEventListener("pointerdown", onpointerdown);
    onCleanup(() => document.removeEventListener("pointerdown", onpointerdown));

    const eventToPoint = (e: PointerEvent): Point => {
        const point = transform().inverse().transformPoint(new DOMPoint(e.pageX, e.pageY));
        return [point.x, point.y, e.pressure];
    };

    const onpointermove = (e: PointerEvent) => {
        const pmap = getPointerMap(e.pointerType);
        const prev = pmap.points.get(e.pointerId);
        if(prev) {
            e.preventDefault();

            prev.point = eventToPoint(e);

            if(e.pointerType === "touch" && pmap.mode === "zoom") {
                const ppv = [...pmap.points.values()];
                if(ppv.length < 2) return;
                const current: Vector = [[ppv[0]!.point[0], ppv[0]!.point[1]], [ppv[1]!.point[0], ppv[1]!.point[1]]];
                setZoom(z => [z![0], current]);
                return;
            }
            
            setPoints(pts => new Map(pts).set(e.pointerType, [
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
        if(e.pointerType === "touch" && pmap.mode === "zoom") {
            if(pmap.points.size < 2) {
                batch(() => {
                    setTransform(t => transformZoomed(t).inverse());
                    setZoom(null);
                });
            }
            return;
        }

        const value = points().get(e.pointerType) ?? [];
        batch(() => {
            setPoints(pts => {
                const res = new Map(pts);
                res.delete(e.pointerType);
                return res;
            });
            setCommittedStrokes(cs => [...cs, commitStroke(value)]);
        });
    };
    document.addEventListener("pointerup", onpointerup);
    onCleanup(() => document.removeEventListener("pointerup", onpointerup));

    const onpointercancel = (e: PointerEvent) => {
        const pmap = getPointerMap(e.pointerType);
        if(!pmap.points.has(e.pointerId)) return;
        pmap.points.delete(e.pointerId);
        if(e.pointerType === "touch" && pmap.mode === "zoom") {
            if(pmap.points.size < 2) setZoom(null);
            return;
        }

        setPoints(pts => {
            const res = new Map(pts);
            res.delete(e.pointerType);
            return res;
        });
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
            const point_s = strokes();
            const page_size = pageSize();
            const pr = window.devicePixelRatio;
            if(canvas.width !== page_size.width * pr) canvas.width = page_size.width * pr;
            if(canvas.height !== page_size.height * pr) canvas.height = page_size.height * pr;
            ctx.setTransform(new DOMMatrixReadOnly().scale(pr));
            ctx?.clearRect(0, 0, page_size.width, page_size.height);

            ctx.setTransform(transformScaled(transformZoomed(getTransform())).scale(pr));

            ctx.strokeRect(0, 0, config.drawing_size[0], config.drawing_size[1]);

            // possibly use two seperate canvases for these so that committedstrokes
            // doesn't have to be fully updated constantly
            for(const stroke of [...committedStrokes(), ...point_s]) {
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

            const zoomv = zoom();

            if(zoomv) {
                ctx.beginPath();
                ctx.moveTo(zoomv[0][0][0], zoomv[0][0][1]);
                ctx.lineTo(zoomv[0][1][0], zoomv[0][1][1]);
                ctx.stroke();
                // ctx.beginPath();
                // ctx.moveTo(zoomv[1][0][0], zoomv[1][0][1]);
                // ctx.lineTo(zoomv[1][1][0], zoomv[1][1][1]);
                // ctx.stroke();
            }
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