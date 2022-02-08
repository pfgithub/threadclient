import { createMemo, JSX } from 'solid-js';
import NodeEditor from './NodeEditor';

export default function App(): JSX.Element {
  return (
    <div class="ml-auto mr-auto max-w-2xl w-full h-full bg-gray-800 p-4">
      <NodeEditor schema={{
        kind: "object",
        fields: [
          {name: "name", value: {kind: "string"}},
          {name: "description", value: {kind: "string"}},
          {name: "attributes", value: {kind: "object", fields: [
            {name: "administrator", value: {kind: "boolean"}},
            {name: "moderator", value: {kind: "boolean"}},
          ]}},
          {name: "tags", value: {kind: "array", child: {
            kind: "string",
          }}},
        ],
      }} />
    </div>
  );
};

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
