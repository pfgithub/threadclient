import polygonClipping, { MultiPolygon } from "polygon-clipping";
import { switchKind } from "tmeta-util";
//@ts-expect-error
import simplify from "simplify-geojson";

export let initialState = (): CachedState => ({
    frames: {
        0: emptyFrame(), // the 0 frame is required to exist.
    },
});
function emptyFrame(): CachedFrame {
    return {
        merged_polygons: [],
        thumbnail: [],
    };
}

export type Config = {
    drawing_size: [w: number, h: number],
    framerate: number,
    attribution: {
        title: NameLink,
        author: NameLink,
        license: NameLink,
    },
};
export type NameLink = {
    text: string,
    url?: undefined | string,
};

export type State = {
    actions: ContentAction[], // from this, you can reconstruct the current state
    cached_state: CachedState,
    update_time: number,

    frame: number,
    
    // readonly props:
    max_frame: number,
    config: Config,
    // Objects of these types are designed to hold small audio snippets, typically less
    // than 45 s. For longer sounds, objects implementing the MediaElementAudioSourceNode
    // are more suitable.
    audio: AudioBuffer,
    audio_ctx: AudioContext,
    audio_data: Float32Array,
};

export let findFrameIndex = function findFrameIndex(frame: number, state: CachedState): number {
    for(const frame_index_str of Object.keys(state.frames).reverse()) {
        const frame_index =+ frame_index_str;
        if(frame >= frame_index) return frame_index;
    }
    throw new Error("requested frame "+frame+" not found. note: the zero frame is required to exist.");
};

export type CachedState = {
    frames: {[key: number]: CachedFrame},
};
export type CachedFrame = {
    // the polygons of the frame
    merged_polygons: MultiPolygon,

    // a very low res version of the frame
    thumbnail: MultiPolygon,
};

export type Action = ContentAction | {
    kind: "undo",
} | {
    kind: "set_frame",
    frame: number,
};
//

export type ContentAction = {
    kind: "add_polygon",
    polygon: [x: number, y: number][],
    frame: number,
} | {
    kind: "erase_polygon",
    polygon: [x: number, y: number][],
    frame: number,
};

export let applyActionsToState = function applyActionsToState(
    actions: ContentAction[],
    anchor: CachedState,
    config: Config,
): CachedState {
    const touched_frames = new Set<number>();
    let cached_state = anchor;
    for(const action of actions) {
        cached_state = switchKind(action, {
            // a solution easier than all of these (although off-thread is probably
            // still a good idea):
            // - store the bounding boxes of the polygons along with the polygons
            // - only update the polygons with bounds that overlap the polygon being added

            // ideally, these would be done off-thread and simulated in rendering
            // until the operations are completed.
            // while something is calculating, add things to be simulated until it's done,
            // then send those all over to be calculated
            // - making webworkers is easy:
            // - write the code in a seperate file
            // - import it with `?worker`
            // - vite will handle stuff.

            // if there's some other obvious and simple way to improve perf here, I'm not
            // sure what it is. there are some complex things I could do eg: splitting the scene into
            // chunks and only updating the chunks that are modified
            // depending on the size of the chunks, that may work to improve perf a bit. a
            // chunk with 1.4k vertices updates in ~16ms, although hopefully chunks would be closer
            // to like <500 vertices in which case it'd be quite fast. that's with a pretty small
            // chunk size and a lot of chunks have to be updated for large strokes, which could
            // be bad. and updating a chunk is:
            // 1. union the polygon with nothing (to optimize it).
            // 2. for each chunk in range: (note that chunks are slightly larger than squares to account for error)
            //    - and a rectangle a bit bigger than the chunk with the optimized polygon
            //    - union the result with the chunk content
            // who knows what the perf on that would be for long lines
            // and it'd be complicated and I'd rather do simple stuff first
            // - https://mourner.github.io/simplify-js/ here's something fun
            // - https://www.npmjs.com/package/simplify-geojson or this one
            //   if I ever want to try to recreate my infinite canvas program, I can do level of detail
            //   for chunks and stuff which could be neat. unfortunately, it will still suffer from
            //   floating point precision loss if you zoom out too far, but this would make it possible
            //   to do quite high performance edits probably
            // - note that simplify with a tolerance of 1 can multiply vertex count by ~0.6, which
            //   is pretty nice. 
            
            // I think I can get away with ignoring this issue for now and just fixing undo time which
            // isn't that difficult, and start working on other parts of the animator
            add_polygon: (add_poly): CachedState => {
                const frame: CachedFrame = cached_state.frames[add_poly.frame] ?? emptyFrame();
                touched_frames.add(add_poly.frame);
                const merged = polygonClipping.union(frame.merged_polygons, [add_poly.polygon]);
                const res_frame: CachedFrame = {
                    ...frame,
                    merged_polygons: merged,
                };
                return {
                    ...cached_state,
                    frames: {...cached_state.frames, [add_poly.frame]: res_frame},
                };
            },
            erase_polygon: (erase_poly): CachedState => {
                const frame: CachedFrame = cached_state.frames[erase_poly.frame] ?? emptyFrame();
                touched_frames.add(erase_poly.frame);
                const merged = polygonClipping.difference(frame.merged_polygons, [erase_poly.polygon]);
                const res_frame: CachedFrame = {
                    ...frame,
                    merged_polygons: merged,
                };
                return {
                    ...cached_state,
                    frames: {...cached_state.frames, [erase_poly.frame]: res_frame},
                };
            },
        });
    }

    // TODO update thumbnails off-thread
    for(const frame_index of touched_frames) {
        const frame = cached_state.frames[frame_index];
        if(!frame) continue;

        const res_frame: CachedFrame = {
            ...frame,
            thumbnail: genThumbnail(frame.merged_polygons, config),
        };

        cached_state = {
            ...cached_state,
            frames: {...cached_state.frames, [frame_index]: res_frame},
        };
    }

    return cached_state;
};

function genThumbnail(frame: MultiPolygon, config: Config): MultiPolygon {
    // TODO https://github.com/seabre/simplify-geometry

    // target size is eg like 100×100 or something tiny

    // eslint-disable-next-line
    return (simplify({
        type: "Feature",
        geometry: {
            type: "MultiPolygon",
            coordinates: frame,
        }
    }, Math.min(...config.drawing_size) / 50)).geometry.coordinates;
}

if(import.meta.hot) {
    import.meta.hot.accept((new_mod: typeof import("./apply_action")) => {
        // https://vitejs.dev/guide/api-hmr.html#hot-accept-cb
        // > Note that Vite's HMR does not actually swap the originally imported module: if an HMR boundary module
        //   re-exports imports from a dep, then it is responsible for updating those re-exports (and these exports
        //   must be using let). In addition, importers up the chain from the boundary module will not be notified
        //   of the change.
        // > This simplified HMR implementation is sufficient for most dev use cases, while allowing us to skip the
        //   expensive work of generating proxy modules.
        applyActionsToState = new_mod.applyActionsToState;
        findFrameIndex = new_mod.findFrameIndex;
        initialState = new_mod.initialState;
    });
}