import { createSignal, For } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { SwitchKind } from "./App";

export const sc = {
  object: (obj: {[key: string]: NodeSchema}): ObjectSchema => {
    return {
      kind: "object",
      fields: Object.entries(obj).map(entry => ({name: entry[0], value: entry[1]})),
    };
  },
  string: (): StringSchema => ({kind: "string"}),
  boolean: (): BooleanSchema => ({kind: "boolean"}),
  array: (child: NodeSchema): ArraySchema => ({kind: "array", child}),
} as const;

export type NodeSchema =
  | ObjectSchema
  | StringSchema
  | BooleanSchema
  | ArraySchema
;

export type ObjectField = {
  name: string,
  value: NodeSchema,
};
export type ObjectSchema = {
  kind: "object",
  fields: ObjectField[],
};
export type ArraySchema = {
  kind: "array",
  child: NodeSchema,
};
export type StringSchema = {
  kind: "string",
};
export type BooleanSchema = {
  kind: "boolean",
};

function ArrayEditor(props: {schema: ArraySchema}): JSX.Element {
  const [items, setItems] = createSignal<Symbol[]>([]);
  return <div class="space-y-2">
    <For each={items()}>{(item, index) => <div class="space-y-2">
      <div>
        {index()}
        {" "}
        <Button
          onClick={() => setItems(it => it.filter(v => v !== item))}
        >X</Button>
      </div>
      <div class="pl-2 border-l-[0.5rem] border-gray-700">
        <NodeEditor schema={props.schema.child} />
      </div>
    </div>}</For>
    <div><Button onClick={() => setItems(it => [...it, Symbol()])}>+ Add</Button></div>
  </div>;
}

function Button(props: {
  onClick: () => void,
  children: JSX.Element,
  active?: undefined | boolean,
}): JSX.Element {
    return <button
      class={""
        + "px-2 first:rounded-l-md last:rounded-r-md mr-1 last:mr-0 "
        + (props.active ? "bg-gray-500 " : "bg-gray-700 ")
      }
      onClick={props.onClick}
    >{props.children}</button>;
}

function BooleanEditor(props: {schema: BooleanSchema}): JSX.Element {
  // we need an unset vs false. true/false/unset.
  const [value, setValue] = createSignal(false);
  return <div>
    <Button active={value() === false} onClick={() => setValue(false)}>Off</Button>
    <Button active={value() === true} onClick={() => setValue(true)}>On</Button>
  </div>;
}

function StringEditor(props: {schema: StringSchema}): JSX.Element {
  return <div>
    <input type="text" class="w-full bg-gray-700 rounded-sm px-1" />
  </div>;
}

function ObjectEditor(props: {schema: ObjectSchema}): JSX.Element {
  return <div class="space-y-2">
    <For each={props.schema.fields}>{field => <div>
      <div>{field.name}</div>
      <div class="pl-2 border-l-[0.5rem] border-gray-700">
        <NodeEditor schema={field.value} />
      </div>
    </div>}</For>
  </div>;
}

function NodeEditor(props: {schema: NodeSchema}): JSX.Element {
  return <SwitchKind item={props.schema}>{{
    object: obj => <ObjectEditor schema={obj} />,
    string: str => <StringEditor schema={str} />,
    boolean: bool => <BooleanEditor schema={bool} />,
    array: arr => <ArrayEditor schema={arr} />,
  }}</SwitchKind>;
}

export default NodeEditor;