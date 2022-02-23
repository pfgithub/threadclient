export const object_active_field = Symbol("object_active_field");
export const text_editor_selection = Symbol("text_editor_selection");

if(import.meta.hot) {
    import.meta.hot.accept((new_module) => {
        alert("cannot reload symbols.ts, please refresh page.");
    });
}

// we should be able to add hmr support if we use Symbol.of() or something for now