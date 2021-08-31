import polygonClipping, { MultiPolygon } from "polygon-clipping";
//@ts-expect-error
import simplify from "simplify-geojson";
import { assertNever } from "tmeta-util";
import { Config } from "./generated/security-rules";

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

export type NameLink = {
    text: string,
    url?: undefined | string,
};

export type State = {
    actions: IdentifiedAction[], // from this, you can reconstruct the current state
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

export type IdentifiedAction = {
    id: string,
    saved: boolean,
} & ContentAction;

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
    shared: ContentAction[],
    insert: ContentAction[],
    remove: ContentAction[],
    next: ContentAction[],
    anchor: CachedState,
    recent: CachedState,
    config: Config,
): CachedState {
    const touched_frames = new Set<number>();

    for(const action of [...insert, ...remove]) {
        touched_frames.add(action.frame);
    }

    const updated_frames: {[key: number]: CachedFrame} = {};
    for(const frame_index of touched_frames) {
        if(updated_frames[frame_index]) continue;
        updated_frames[frame_index] = {...anchor.frames[frame_index] ?? emptyFrame()};
    }

    for(const action of [...shared, ...insert, ...next]) {
        if(!touched_frames.has(action.frame)) continue;

        const frame = updated_frames[action.frame]!;
        if(action.kind === "add_polygon") {
            frame.merged_polygons = polygonClipping.union(frame.merged_polygons, [action.polygon]);
        }else if(action.kind === "erase_polygon"){
            frame.merged_polygons = polygonClipping.difference(frame.merged_polygons, [action.polygon]);
        }else assertNever(action);
    }

    // TODO update thumbnails off-thread
    for(const frame_index of touched_frames) {
        const frame = updated_frames[frame_index]!;

        frame.thumbnail = genThumbnail(frame.merged_polygons, config);
    }

    console.log("Applying Actions", updated_frames, shared, insert, next);

    return {
        ...anchor,
        frames: {...anchor.frames, ...recent.frames, ...updated_frames},
    };
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
    }, Math.min(config.width, config.height) / 50)).geometry.coordinates;
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