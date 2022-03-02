export const array_key = "@@!!ARRAY_KEY"; // can't use a symbol for some reason?

if(import.meta.hot) {
    // TODO move const nodecontext into its own file and only do this there
    import.meta.hot.accept((new_module) => {
        alert("cannot reload symbols.ts, please refresh page.");
    });
}