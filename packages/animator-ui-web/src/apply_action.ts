import polygonClipping, { MultiPolygon } from "polygon-clipping";
import { switchKind } from "tmeta-util";

export const initialState = (): CachedState => ({
    merged_polygons: [],
});

export type State = {
    actions: ContentAction[], // from this, you can reconstruct the current state
    cached_state: CachedState,
    transform: DOMRectReadOnly,
    update_time: number,
};

export type CachedState = {
    // the polygons of the frame
    merged_polygons: MultiPolygon,
};

export type Action = ContentAction | {
    kind: "undo",
};
//

export type ContentAction = {
    kind: "add_polygon",
    polygon: [x: number, y: number][],
};

//

export default function applyActionsToState(actions: ContentAction[], anchor: CachedState): CachedState {
    let cached_state = anchor;
    for(const action of actions) {
        // note: TODO batching
        cached_state = switchKind(action, {
            add_polygon: (add_poly): CachedState => {
                // note: this is a slow operation
                // preferrably it would be run on a seperate thread and until
                // it is completed, strokes would be rendered directly
                const merged = polygonClipping.union(cached_state.merged_polygons, [add_poly.polygon]);
                return {
                    ...cached_state,
                    merged_polygons: merged,
                };
            },
        });
    }
    return cached_state;
}

if(import.meta.hot) {
    import.meta.hot.accept();
}