import { createMemo, JSX } from 'solid-js';
import { createStore } from "solid-js/store";
import NodeEditor from './NodeEditor';
import { NodeSchema, sc } from './schema';


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

function stringifySchema(state: unknown, schema: NodeSchema): unknown {
  return switchKind(schema, {
    object: obj => {
      if(typeof state !== "object") return "#E_NOT_OBJECT";
      return Object.fromEntries(obj.fields.map(field => {
        return [
          field.name,
          stringifySchema(state[field.name], field.value),
        ];
      }));
    },
    string: () => {
      if(typeof state === "string") return state;
      return "#E_NOT_STRING";
    },
    boolean: () => {
      if(typeof state === "boolean") return state;
      return "#E_NOT_BOOLEAN";
    },
    array: arr => {
      if(!Array.isArray(state)) return "#E_NOT_ARRAY";
      return state.map(entry => {
        if(typeof entry !== "object") return "#E_NOT_ARRAY_CHILD";
        if(!('array_symbol' in entry)) return "#E_NOT_ARRAY_CHILD";
        return stringifySchema(entry.array_item, arr.child);
      });
    },
  });
}

export default function App(): JSX.Element {
  const [data, setData] = createStore({
    // in order to add links, we'll switch this to contian link kinds and arrays
    // of values. it will no longer be directly JSON.toString() able, instead you'll
    // have to stringify based on the schema
    //
    // actually maybe don't do that. maybe keep it tostringable
    //
    // hmm idk
    data: undefined,
  });

  return (
    <div class="grid gap-20 md:grid-cols-2 max-w-6xl mx-auto h-full">
      <div class="bg-gray-800 p-4">
        <NodeEditor schema={root_schema} path={["data"]} state={{data, setData}} />
      </div>
      <div class="bg-gray-800 p-4 font-mono whitespace-pre-wrap">
        {JSON.stringify(stringifySchema(data.data, root_schema), null, " ")}
      </div>
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
