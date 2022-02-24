// this is just for hmr
// ideally everywhere we're using these should be replaced
// with a signal instead.

export const object_active_field = Symbol("object_active_field");
export const text_editor_selection = Symbol("text_editor_selection");
export const json_viewer_view_mode = Symbol("json_viewer_view_mode");

if(import.meta.hot) {
    import.meta.hot.accept((new_module) => {
        alert("cannot reload symbols.ts, please refresh page.");
    });
}

// we should be able to add hmr support if we use Symbol.of() or something for now