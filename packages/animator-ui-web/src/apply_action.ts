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
} | {
    kind: "erase_polygon",
    polygon: [x: number, y: number][],
};

//

export default function (actions: ContentAction[], anchor: CachedState): CachedState {
    let cached_state = anchor;
    for(const action of actions) {
        cached_state = switchKind(action, {
            // ideally, these would be done off-thread and simulated in rendering
            // until the operations are completed.
            // while something is calculating, add things to be simulated until it's done,
            // then send those all over to be calculated

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
            
            // I think I can get away with ignoring this issue for now and just fixing undo time which
            // isn't that difficult, and start working on other parts of the animator
            add_polygon: (add_poly): CachedState => {
                const merged = polygonClipping.union(cached_state.merged_polygons, [add_poly.polygon]);
                return {
                    ...cached_state,
                    merged_polygons: merged,
                };
            },
            erase_polygon: (erase_poly): CachedState => {
                const merged = polygonClipping.difference(cached_state.merged_polygons, [erase_poly.polygon]);
                //
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
    import.meta.hot.accept((new_module) => {
        console.log(new_module);
        // for some reason it isn't replacing the exports of this module with the new one?
    });
}