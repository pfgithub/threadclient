import {
  createRoot,
  createSignal,
  createMemo,
  onCleanup,
  untrack,
  JSX,
  Accessor
} from "solid-js";

export function Key<T>(props: {
  each: T[],
  by: (item: T) => unknown,
  children: (item: Accessor<T>, i: Accessor<number>) => JSX.Element,
}) {
  const key = props.by;
  const mapFn = props.children;
  const disposers = new Map();
  let prev = new Map();
  onCleanup(() => {
    for (const disposer of disposers.values()) disposer();
  });

  return createMemo(() => {
    const list = props.each || [];
    const mapped = [];
    const newNodes = new Map();
    return untrack(() => {
      for (let i = 0; i < list.length; i++) {
        const listItem = list[i];
        const keyValue = key(listItem);
        const lookup = prev.get(keyValue);
        if (!lookup) {
          mapped[i] = createRoot((dispose) => {
            disposers.set(key, dispose);
            const index = createSignal(i);
            const item = createSignal(listItem);
            const result = mapFn(item[0], index[0]);
            newNodes.set(keyValue, { index, item, result });
            return result;
          });
        } else {
          lookup.index[1](i);
          lookup.item[1](listItem);
          mapped[i] = lookup.result;
          newNodes.set(keyValue, lookup);
        }
      }
      // disposal
      for (const old of prev.keys()) {
        if (!newNodes.has(old)) disposers.get(old)();
      }
      prev = newNodes;
      return mapped;
    });
  });
}
  