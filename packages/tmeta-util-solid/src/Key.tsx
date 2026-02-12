import {
  createRoot,
  createSignal,
  createMemo,
  onCleanup,
  untrack,
  JSX,
  Accessor,
  Signal
} from "solid-js";

export function Key<T, U>(props: {
  each: T[],
  by: (item: T) => U,
  children: (item: Accessor<T>, i: Accessor<number>, key: U) => JSX.Element,
}): JSX.Element {
  type PrevNode = {
    index: Signal<number>,
    item: Signal<T>,
    result: JSX.Element,
  };

  const key = props.by;
  const mapFn = props.children;
  const disposers = new Map<U, () => void>();
  let prev = new Map<U, PrevNode>();
  onCleanup(() => {
    for (const disposer of disposers.values()) disposer();
  });

  return <>{createMemo(() => {
    const list = props.each;
    const mapped: JSX.Element[] = [];
    const new_nodes = new Map<U, PrevNode>();
    return untrack(() => {
      list.forEach((list_item, i) => {
        const key_value = key(list_item);
        const lookup = prev.get(key_value);
        if (!lookup) {
          mapped[i] = createRoot((dispose) => {
            disposers.set(key_value, dispose);
            const index = createSignal(i);
            const item = createSignal(list_item);
            const result = mapFn(item[0], index[0], key_value);
            new_nodes.set(key_value, { index, item, result });
            return result;
          });
        } else {
          lookup.index[1](i);
          lookup.item[1](() => list_item);
          mapped[i] = lookup.result;
          new_nodes.set(key_value, lookup);
        }
      });
      for (const old of prev.keys()) {
        if (!new_nodes.has(old)) {
          const disposer = disposers.get(old)!;
          disposers.delete(old);
          disposer();
        }
      }
      prev = new_nodes;
      return mapped;
    });
  })}</>;
}
  