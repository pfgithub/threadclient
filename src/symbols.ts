export const object_active_field = Symbol("object_active_field");

if(import.meta.hot) {
    import.meta.hot.accept((new_module) => {
        alert("cannot reload symbols.ts, please refresh page.");
    });
}