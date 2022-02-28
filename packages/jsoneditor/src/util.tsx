import { createMemo, JSX } from 'solid-js';

export type Include<T, U> = T extends U ? T : never;

export function kindIs<K extends string, T extends {kind: string}>(value: T, key: K): Include<T, {kind: K}> | null {
    return value.kind === key ? value as unknown as null : null;
}

export type MatchFn<T, Key, R> = (value: Include<T, {kind: Key}>) => R;

export function switchKindCB<U>(item: {kind: string}, choices: {[key: string]: (item: any) => U}): () => U {
    const match = choices[item.kind] ?? choices["unsupported"] ?? (() => {
        throw new Error("condition "+item.kind+" was not handled and no unsupported branch");
    });
    return () => match(item);
}
export function switchKind<T extends {kind: string}, U>(
    item: T,
    choices: {[Key in T["kind"]]: MatchFn<T, Key, U>},
): U {
    return switchKindCB<U>(item, choices)();
}

export function SwitchKind<T extends {kind: string}>(props: {
  item: T,
  children: {[Key in T["kind"]]: MatchFn<T, Key, JSX.Element>},
}): JSX.Element {
  return createMemo(() => {
      const match = switchKindCB<JSX.Element>(props.item, props.children);
      return match();
  });
}
