import { createMemo, JSX } from 'solid-js';
import NodeEditor, { NodeSchema, sc } from './NodeEditor';

const person_schema: NodeSchema = sc.object({
  name: sc.string(),
  description: sc.string(),
  attributes: sc.object({
    administrator: sc.boolean(),
    moderator: sc.boolean(),
  }),
  tags: sc.array(sc.string()),
});

const buttons_schema: NodeSchema = sc.object({
  name: sc.string(),
  id: sc.string(),
});

// button_schema:
//   sc.object({
//     name: string,
//     id: string,
//   })

// links:
//   input_button: button_schema,
//   output_button: button_schema,

const root_schema: NodeSchema = sc.object({
  // buttons:
  //   input:
  //     sc.all_links("input_button")
  //   output:
  //     sc.all_links("output_button")
  // scenes:
  //   sc.all_links("scene")
  // default_scene: sc.link("scene")
  // layers:
  //   sc.all_links("layers")
  person: person_schema,
});

export default function App(): JSX.Element {
  return (
    <div class="ml-auto mr-auto max-w-2xl w-full h-full bg-gray-800 p-4">
      <NodeEditor schema={root_schema} />
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
