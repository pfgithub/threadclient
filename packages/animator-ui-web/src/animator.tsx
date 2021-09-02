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
import { MultiPolygon, Polygon } from "polygon-clipping";
import { createEffect, createMemo, createSignal, JSX, onCleanup } from "solid-js";
import { switchKind } from "../../tmeta-util/src/util";
import { Action, findFrameIndex, State } from "./apply_action";
import { EventPoint, recognizeGestures } from "./gesture_recognizer";

export default function Animator(props: {state: State, applyAction: (action: Action) => void}): JSX.Element {
    return <div class="h-full">
        <DrawCurrentFrame state={props.state} applyAction={props.applyAction} />
        <GestureRecognizer state={props.state} applyAction={props.applyAction} />
    </div>;
}

type WH = {width: number, height: number};
function scaleCanvasValues(itm_size: WH): {
    scale: number,
    translate: {x: number, y: number},
} {
    const viewport_size: WH = {width: window.innerWidth, height: window.innerHeight};

    const padding = 50;
    const area_w = viewport_size.width;
    const area_h = viewport_size.height - 200;
    const itm_w = itm_size.width;
    const itm_h = itm_size.height;

    const min_v = Math.min((area_w - padding * 2) / itm_w, (area_h - padding * 2) / itm_h);
    const upd_a_w = area_w / min_v;
    const upd_a_h = area_h / min_v;

    return {
        scale: min_v,
        translate: {x: upd_a_w / 2 - itm_w / 2, y: upd_a_h / 2 - itm_h / 2},
    };
}
function scaleCanvas(ctx: CanvasRenderingContext2D, itm_size: WH) {
    const {scale, translate} = scaleCanvasValues(itm_size);

    ctx.scale(scale, scale);
    ctx.translate(translate.x, translate.y);
}

export function DrawCurrentFrame(props: {state: State, applyAction: (action: Action) => void}): JSX.Element {
    return <FullscreenCanvas2D render={(ctx, size) => {
        const start = Date.now();

        const current_audio_frame = currentAudioFrame();

        ctx.fillStyle = "#ccc";
        ctx.fillRect(0, 0, size.width, size.height);

        ctx.save();

        scaleCanvas(ctx, props.state.config);

        ctx.save();
        ctx.fillStyle = "#fff";
        // ctx.shadowColor = "#777";
        // ctx.shadowBlur = 15;
        // ctx.shadowOffsetY = 5;
        ctx.fillRect(0, 0, props.state.config.width, props.state.config.height);
        ctx.restore();

        ctx.strokeRect(0, 0, props.state.config.width, props.state.config.height);
        ctx.save();

        
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        if(current_audio_frame == null) {
            ctx.beginPath();
            ctx.moveTo(props.state.config.width / 2, 0);
            ctx.lineTo(props.state.config.width / 2, props.state.config.height);
            ctx.moveTo(0, props.state.config.height / 2);
            ctx.lineTo(props.state.config.width, props.state.config.height / 2);
            ctx.stroke();
        }
        ctx.restore();
        // TODO scale based on state

        let frame_raw = props.state.frame;
        if(current_audio_frame != null) {
            frame_raw = current_audio_frame;
        }
        const frame_index = findFrameIndex(frame_raw, props.state.cached_state);
        const frame = props.state.cached_state.frames[frame_index]!;

        if(current_audio_frame == null && frame_index - 1 >= 0) {
            const left_raw = frame_index - 1;
            const left_frame_index = findFrameIndex(left_raw, props.state.cached_state);
            const left_frame = props.state.cached_state.frames[left_frame_index]!;
            // const is_exact_frame = left_frame === left_raw;
            ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
            renderMultiPolygon(ctx, left_frame.merged_polygons);
        }
        if(current_audio_frame == null) {
            const right_frame_index_raw = frame_raw + 1;
            if(findFrameIndex(right_frame_index_raw, props.state.cached_state) !== frame_index) {
                const right_frame = props.state.cached_state.frames[right_frame_index_raw]!;
                ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
                renderMultiPolygon(ctx, right_frame.merged_polygons);
            }
        }

        // this is a bit confusing because while scrubbing it doesn't easily show you if
        // you're on an exact frame or not. I think that updating the scrubber bar to have
        // all the frame thumbnails and stuff will help a lot with that.
        const is_exact_frame = frame_index === frame_raw || current_audio_frame != null;

        ctx.fillStyle = is_exact_frame ? "#000000" : "#aaa";
        renderMultiPolygon(ctx, frame.merged_polygons);

        ctx.restore();

        const end = Date.now();
        ctx.fillStyle = "#000000";
        ctx.fillText("Last Update ms: " + (props.state.update_time), 10, 20);
        ctx.fillText("Draw ms: " + (end - start), 10, 30);
        ctx.fillText("Vertices: " + (frame.merged_polygons.reduce((t, poly) => (
            t + poly.reduce((q, points) => q + points.length, 0)
        ), 0)), 10, 40);
        ctx.fillText("Frame: " + (frame_raw) + " / " + (props.state.max_frame), 10, 50);
        ctx.fillText("Actions: " + (props.state.actions.length), 10, 60);
        ctx.fillText("Project: "
            + props.state.config.title
        , 10, 70);

    }} />;
}

type ActiveAudioSource = {
    source: AudioBufferSourceNode,
    offset: number,
    context: AudioContext,
};

let active_source: ActiveAudioSource | null = null;
if(import.meta.hot) {
    import.meta.hot.dispose(() => {
        stopSource();
    });
}

const [currentAudioFrame, setCurrentAudioFrame] = createSignal<number | null>(null);

function onAddedSource(source: ActiveAudioSource, framerate: number) {
    source.source.addEventListener("ended", () => {
        // stopSource();
    });
    const setNow = () => {
        if(!active_source) {
            setCurrentAudioFrame(null);
            return false;
        }
        setCurrentAudioFrame(((active_source.offset + active_source.context.currentTime) * framerate) |0);

        return true;
    };
    setNow();
    loopAnimationFrame(setNow);
}
function loopAnimationFrame(cb: () => boolean): void {
    const animFrame = () => requestAnimationFrame(() => {
        if(!cb()) return;
        animFrame();
    });

    animFrame();
}

function stopSource() {
    if(active_source) {
        active_source.source.stop();
        active_source = null;
    }
}
function setSource(source: ActiveAudioSource, framerate: number) {
    stopSource();
    active_source = {...source, offset: source.offset - source.context.currentTime};
    onAddedSource(source, framerate);
}

type PlannedStroke = {
    points: PressurePoint[],
    mode: "draw" | "erase",
};

export function GestureRecognizer(props: {state: State, applyAction: (action: Action) => void}): JSX.Element {
    const [plannedStrokes, setPlannedStrokes] = createSignal(new Map<string, PlannedStroke>());

    const commitStroke = (stroke: PlannedStroke) => (
        getStroke(stroke.points, {
            simulatePressure: stroke.points.every(pt => pt[2] === 0.5),
            size: stroke.mode === "erase" ? 100 : 8,
        }) as Point2D[]
    );
    const scalePoint = (e: EventPoint): PressurePoint => {
        const {scale, translate} = scaleCanvasValues(props.state.config);
        return [e[0] / scale - translate.x, e[1] / scale - translate.y, e[2]];
    };

    const playSegment = (frame: number) => {
        let nct = frame / props.state.config.framerate;
        if(nct < 0) nct = 0;
        if(nct > props.state.audio.duration) nct = props.state.audio.duration;

        const source = props.state.audio_ctx.createBufferSource();
        source.buffer = props.state.audio;
        source.connect(props.state.audio_ctx.destination);
        source.playbackRate.setValueAtTime(1, 0);
        source.start(0, nct, props.state.audio.duration - nct);
        setSource({source, offset: nct, context: props.state.audio_ctx}, props.state.config.framerate);
    };

    const [frameOffset, setFrameOffset] = createSignal<number | null>(null);
    const [dragOffset, setDragOffset] = createSignal(0);

    const [thumbnailSizeRaw, setThumbnailSize] = createSignal(250);
    const [thumbnailSizeOverlay, setThumbnailSizeOverlay] = createSignal(1);
    const thumbnailSize = () => thumbnailSizeRaw() * thumbnailSizeOverlay();

    const strokes = createMemo((): Point2D[][] => (
        [...plannedStrokes().values()].map(commitStroke)
    ));

    onCleanup(recognizeGestures((id, event) => {
        let planned_stroke_set = false;
        const setPlannedStroke = (planned_stroke: PlannedStroke) => {
            planned_stroke_set = true;
            setPlannedStrokes(s => {
                const copy = new Map(s);
                copy.set(id, planned_stroke);
                return copy;
            });
        };
        let offset_set = false;
        const setNewOffset = (new_offset: number) => {
            offset_set = true;
            setDragOffset(new_offset);
        };
        let zoom_set = false;
        const setNewThumbnailSize = (new_size: number) => {
            zoom_set = true;
            setThumbnailSizeOverlay(new_size);
        };

        // it might be useful to have an oncancel
        switchKind(event, {
            draw: draw => {
                const start = draw.points[0]!;
                if(start[1] > window.innerHeight - 200) {
                    const end = draw.points[draw.points.length - 1]!;
                    const offset = end[0] - start[0];
                    const frame_offset = -Math.round(offset / thumbnailSize());
                    if(draw.commit) {
                        props.applyAction({
                            kind: "set_frame",
                            frame: props.state.frame + frame_offset,
                        });
                    }else{
                        if(frame_offset !== frameOffset()) {
                            playSegment(props.state.frame + frame_offset);
                        }
                        setFrameOffset(frame_offset);
                        setNewOffset(offset + frame_offset * thumbnailSize());
                    }
                    return;
                }

                const mode = "draw" as "draw" | "erase";
                const stroke: PlannedStroke = {
                    points: draw.points.map(scalePoint),
                    mode: mode,
                };
                if(draw.commit) {
                    props.applyAction({
                        kind: mode === "draw" ? "add_polygon" : "erase_polygon",
                        polygon: commitStroke(stroke),
                        frame: props.state.frame,
                    });
                }else{
                    setPlannedStroke(stroke);
                }
            },
            touchzoom: tz => {
                const ptscale = (p: [EventPoint, EventPoint]) => {
                    return Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
                };
                const thumbbar_h = window.innerHeight - 200;
                if(tz.start[0][1] > thumbbar_h && tz.start[1][1] > thumbbar_h) {
                    const initial_scale = ptscale(tz.start);
                    const final_scale = ptscale(tz.end);
                    const overlay = (final_scale / initial_scale);
                    if(tz.commit) {
                        setThumbnailSize(ts => ts * overlay);
                    }else{
                        setNewThumbnailSize(overlay);
                    }
                }
            },
            tap: tap => {
                if(tap.points.length === 2) {
                    props.applyAction({kind: "undo"});
                }else if(tap.points.length === 3) {
                    props.applyAction({kind: "redo"});
                }
            },
            none: () => {
                //
            },
        });

        blk: if(!planned_stroke_set) {
            const stroke = plannedStrokes();
            if(!stroke.has(id)) break blk;
            const copy = new Map(stroke);
            copy.delete(id);
            setPlannedStrokes(copy);
        }
        if(!offset_set) {
            // note: this is incorrect
            // if two gestures are active at once, this won't work correctly
            setDragOffset(0);
            setFrameOffset(null);
            stopSource();
        }
        if(!zoom_set) {
            setThumbnailSizeOverlay(1);
        }
    }));

    return <FullscreenCanvas2D render={(ctx, size) => {
        ctx.save();
        scaleCanvas(ctx, props.state.config);

        const start_time = Date.now();
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

        ctx.restore();

        ctx.fillStyle = "#aaa";
        ctx.fillRect(0, size.height - 200, size.width, 200);

        const current_frame = props.state.frame + (frameOffset() ?? 0);

        {
            ctx.save();
            ctx.translate((size.width / 2) - (90), 0);
            ctx.scale(thumbnailSize() / 2500, 1);
            ctx.fillStyle = "#999";
            const xh = 100;
            ctx.fillRect(
                -xh, size.height - 200,
                props.state.config.width + (xh * 2),
                200,
            );
            ctx.restore();
        }        
        for(let j = -5; j < 5; j++) {
            const f = j + current_frame;
            if(f < 0) continue;
            const frame_index = findFrameIndex(f, props.state.cached_state);
            const is_exact_frame = frame_index === f;
            const thumbnail = props.state.cached_state.frames[frame_index]!.thumbnail;

            ctx.save();
            ctx.translate((size.width / 2) - (90) + (thumbnailSize() * j), size.height - 200 + 45);
            ctx.scale(thumbnailSize() / 2500, thumbnailSize() / 2500);
            ctx.translate(dragOffset() / 0.1, 0);
            if(!is_exact_frame) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
                ctx.fillRect(-580, 0, 580, props.state.config.height);
                ctx.fillStyle = "#ddd";
            }else{
                ctx.fillStyle = "#fff";
            }
            ctx.fillRect(0, 0, props.state.config.width, props.state.config.height);

            ctx.fillStyle = is_exact_frame ? "#000" : "#888";
            renderMultiPolygon(ctx, thumbnail);

            ctx.restore();
        }

        ctx.fillStyle = "#000";
        const data = props.state.audio_data;
        const start = (props.state.frame / props.state.config.framerate * props.state.audio.sampleRate) |0;
        // TODO visualizer including this and previous frames
        // + show frame thumbnails and stuff
        for(let i = 0; i < 15; i++) {
            ctx.fillText("" + Math.abs(data[start + i] ?? 0), 10, size.height - 200 + ((i + 5) * 10));
        }
        const end_time = Date.now();
        ctx.fillText("Draw ms: " + (end_time - start_time), 10, size.height - 200 + 20);
        ctx.fillText("Frame: " + (current_frame) + " / " + (props.state.max_frame), 10, size.height - 200 + 30);
    }} />;
}

function renderMultiPolygon(ctx: CanvasRenderingContext2D, polys: MultiPolygon): void {
    for(const poly of polys) renderPolygon(ctx, poly);
}
function renderPolygon(ctx: CanvasRenderingContext2D, poly: Polygon): void {
    ctx.beginPath();
    // let i = 0;
    for(const points of poly) {
        let zero = true;
        for(const [x, y] of points) {
            if(zero) {
                ctx.moveTo(x, y);
                zero = false;
            }else{
                ctx.lineTo(x, y);
            }
        }
        // break;
        // i++;
        // if(i > 10) break;
    }
    ctx.fill();
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
