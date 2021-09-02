import polygonClipping, { MultiPolygon } from "polygon-clipping";
//@ts-expect-error
import simplify from "simplify-geojson";
import { assertNever } from "tmeta-util";
import { Config } from "./generated/security-rules";

export let initialState = (): CachedState => ({
    last_action_time: 0, // this has no last action
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
    actions: InsertedAction[], // from this, you can reconstruct the current state
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
    last_action_time: number,
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
    kind: "redo",
} | {
    kind: "set_frame",
    frame: number,
};

export type InsertedAction = IdentifiedAction & {
    insert_time: number,
} & ContentAction;

export type IdentifiedAction = {
    id: string,
} & DBAction;

export type DBAction = {
    session_id: string,
} & ContentAction;

export type ContentAction = {
    kind: "add_polygon",
    polygon: [x: number, y: number][],
    frame: number,
} | {
    kind: "erase_polygon",
    polygon: [x: number, y: number][],
    frame: number,
} | {
    kind: "invalidate_action",
    invalidate: {
        id: string,
        time: number,
    },
    frame: number,
};

export let applyActionsToState = function applyActionsToState(
    insert: InsertedAction[],

    most_recent_checkpoint: CachedState,
    old_actions: InsertedAction[],
    next_actions: InsertedAction[],
    config: Config,
    // once we start loading from checkpoints, this will require some changes because it
    // may encounter an invalidate_action that refers to an action before the latest one it has loaded.
): CachedState {
    let anchor = most_recent_checkpoint;
    let prev_actions: InsertedAction[] = [];

    const touched_frames = new Set<number>();
    const ignored_actions = new Set<string>();
    for(const {touch, actionSet} of [
        {touch: true, actionSet: () => insert},
        {touch: false, actionSet: () => next_actions},
        {touch: false, actionSet: () => prev_actions},
    ]) {
        for(const action of [...actionSet()].reverse()) {
            if(ignored_actions.has(action.id)) continue;
            if(touch) touched_frames.add(action.frame);
            else if(!touched_frames.has(action.frame)) continue;

            if(action.kind === "invalidate_action") {
                ignored_actions.add(action.invalidate.id); // ignore the action it's invalidating
                if(action.invalidate.time <= anchor.last_action_time) {
                    anchor = initialState();
                    prev_actions = old_actions;
                }
            }
        }
    }

    // the second half of looping over action set should be here

    const updated_frames: {[key: number]: CachedFrame} = {};
    for(const frame_index of touched_frames) {
        if(updated_frames[frame_index]) continue;
        updated_frames[frame_index] = {...anchor.frames[frame_index] ?? emptyFrame()};
    }

    let i = 0;

    for(const action of [...prev_actions, ...insert, ...next_actions]) {
        if(ignored_actions.has(action.id)) continue;
        if(!touched_frames.has(action.frame)) continue;
        i += 1;

        try {
            const frame = updated_frames[action.frame]!;
            if(action.kind === "add_polygon") {
                frame.merged_polygons = polygonClipping.union(frame.merged_polygons, [action.polygon]);
            }else if(action.kind === "erase_polygon") {
                frame.merged_polygons = polygonClipping.difference(frame.merged_polygons, [action.polygon]);
            }else if(action.kind === "invalidate_action") {
                // handled above
            }else assertNever(action);
        }catch(e) {
            alert("Error while processing frame "+action.frame+". This frame may be corrupted.");
            console.log(e);
        }
    }

    for(const frame_index of touched_frames) {
        const frame = updated_frames[frame_index]!;

        frame.thumbnail = genThumbnail(frame.merged_polygons, config);
    }

    const all_actions = [...prev_actions, ...insert, ...next_actions];
    const last_action_time = all_actions[all_actions.length - 1]?.insert_time ?? 0;

    console.log("regenerated frames:", touched_frames, "in", i, "ignoring", ignored_actions);

    return {
        ...anchor,
        frames: {...anchor.frames, ...most_recent_checkpoint.frames, ...updated_frames},
        last_action_time,
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
    }, Math.min(config.width, config.height) / 40)).geometry.coordinates;
}

export const hmr = {
    onAccept: (new_mod: typeof import("./apply_action")): void => {
        // https://vitejs.dev/guide/api-hmr.html#hot-accept-cb
        // > Note that Vite's HMR does not actually swap the originally imported module: if an HMR boundary module
        //   re-exports imports from a dep, then it is responsible for updating those re-exports (and these exports
        //   must be using let). In addition, importers up the chain from the boundary module will not be notified
        //   of the change.
        // > This simplified HMR implementation is sufficient for most dev use cases, while allowing us to skip the
        //   expensive work of generating proxy modules.
        new_mod.hmr.onAccept = hmr.onAccept;
        applyActionsToState = new_mod.applyActionsToState;
        findFrameIndex = new_mod.findFrameIndex;
        initialState = new_mod.initialState;
    },
};

if(import.meta.hot) {
    import.meta.hot.accept((new_mod: typeof import("./apply_action")) => {
        hmr.onAccept(new_mod);
    });
}