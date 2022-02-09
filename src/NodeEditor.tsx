import { createSignal, For, Show } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { SetStoreFunction, Store } from "solid-js/store";
import { SwitchKind } from "./App";
import { ArraySchema, BooleanSchema, NodeSchema, ObjectSchema, StringSchema } from "./schema";

export type Path = (string | number)[];

export type State = {
  data: Store<{data: unknown}>,
  setData: SetStoreFunction<{data: unknown}>,
};

function ArrayEditor(props: {schema: ArraySchema, path: Path, state: State}): JSX.Element {
  const [value, setValue] = modValue(() => props.path, () => props.state);
  return <div class="space-y-2">
    <For each={(() => {
      const res = value();
      if(Array.isArray(res)) return res;
      return [];
    })()}>{(item, index) => <div class="space-y-2">
      <div>
        {index()}
        {" "}
        <Button
          onClick={() => setValue(it => Array.isArray(it) ? it.filter(v => {
            return v.array_symbol !== item.array_symbol;
          }) : (() => {
            throw new Error("is not array even though is");
          })())}
        >X</Button>
      </div>
      <div class="pl-2 border-l-[0.5rem] border-gray-700">
        <NodeEditor
          schema={props.schema.child}
          path={[...props.path, index(), "array_item"]}
          state={props.state}
        />
      </div>
    </div>}</For>
    <div><Button onClick={() => setValue(it => Array.isArray(it) ? [...it, {
      "array_symbol": Symbol(),
    }] : [{
      "array_symbol": Symbol(),
    }])}>+ Add</Button></div>
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

function BooleanEditor(props: {schema: BooleanSchema, path: Path, state: State}): JSX.Element {
  // we need an unset vs false. true/false/unset.
  const [value, setValue] = modValue(() => props.path, () => props.state);
  return <div>
    <Button active={value() === false} onClick={() => setValue(pv => pv === false ? undefined : false)}>Off</Button>
    <Button active={value() === true} onClick={() => setValue(pv => pv === true ? undefined : true)}>On</Button>
  </div>;
}

function StringEditor(props: {schema: StringSchema, path: Path, state: State}): JSX.Element {
  const [value, setValue] = modValue(() => props.path, () => props.state);
  return <div>
    <Show
      when={typeof value() === "string"}
      fallback={(
        <Button onClick={() => setValue(() => "")}>Create String</Button>
      )}
    >
      <input
        type="text"
        class="w-full bg-gray-700 rounded-sm px-1"
        value={"" + value()}
        // onChange here maybe?
        onInput={e => setValue(() => e.currentTarget.value)}
      />
    </Show>
  </div>;
}

function ObjectEditor(props: {schema: ObjectSchema, path: Path, state: State}): JSX.Element {
  const [value, setValue] = modValue(() => props.path, () => props.state);
  return <Show when={typeof value() === "object"} fallback={(
    <div>
      <Button onClick={() => {
        setValue(() => ({}));
      }}>
        Create Object
      </Button>
      {" (value: "+value()+")"}
    </div>
  )}>
    <div class="space-y-2">
      <For each={props.schema.fields}>{field => <div>
        <div>{field.name}</div>
        {/* TODO: make the border red if it does not pass validation vv */}
        <div class="pl-2 border-l-[0.5rem] border-gray-700">
          <NodeEditor
            schema={field.value}
            path={[...props.path, field.name]}
            state={props.state}
          />
        </div>
      </div>}</For>
    </div>
  </Show>;
}

function modValue(
  path: () => Path,
  state: () => State,
): [
  value: () => unknown,
  setValue: (cb: (pv: unknown) => unknown) => void,
] {
  return [
    () => getValueFromState(path(), state()),
    (nv) => setValueFromState(path(), state(), nv),
  ];
}
function getValueFromState(path: Path, state: State): unknown {
  let node = state.data;
  for(const entry of path) {
    node = node[entry];
  }
  return node;
}
function setValueFromState(path: Path, state: State, value: unknown) {
  state.setData(...path as unknown as ["data"], value);
}

function NodeEditor(props: {schema: NodeSchema, path: Path, state: State}): JSX.Element {
  return <div ref={node => {
    console.log("transitioning");
    node.className = "opacity-0";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        node.className = "opacity-100 transition-opacity duration-200";
        node.addEventListener("transitionend", () => {
          node.className = "";
        }, {once: true});
      });
    });
  }}>
    <SwitchKind item={props.schema}>{{
      object: obj => <ObjectEditor schema={obj} path={props.path} state={props.state} />,
      string: str => <StringEditor schema={str} path={props.path} state={props.state} />,
      boolean: bool => <BooleanEditor schema={bool} path={props.path} state={props.state} />,
      array: arr => <ArrayEditor schema={arr} path={props.path} state={props.state} />,
    }}</SwitchKind>
  </div>;
}

export default NodeEditor;