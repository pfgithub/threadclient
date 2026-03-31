

const callbacks = new Map<Element, Set<(entry: IntersectionObserverEntry) => void>>();
export const intersection_observer = new IntersectionObserver(updates => {
    for (const upd of updates) {
        const cbs = callbacks.get(upd.target);
        if (!cbs) continue
        for (const cb of cbs) cb(upd);
    }
}, {
    rootMargin: "100%",
    threshold: 0,
});

// TODO: allow specifying custom options
// then use an options_to_observer map to map to the correct (observer,callbacks) list
export function intersectionObserverObserve(element: Element, callback: (entry: IntersectionObserverEntry) => void): (() => void) {
    let cbs = callbacks.get(element);
    if (!cbs) {
        cbs = new Set();
        callbacks.set(element, cbs);
    }
    if (cbs.has(callback)) return () => {};
    if (cbs.size === 0) intersection_observer.observe(element);
    cbs.add(callback);
    return () => {
        cbs.delete(callback);
        if (cbs.size === 0 && callbacks.has(element)) {
            callbacks.delete(element);
            intersection_observer.unobserve(element);
        }
    };
}