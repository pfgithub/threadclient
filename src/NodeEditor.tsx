import { createSignal, For, Show } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { SetStoreFunction, Store } from "solid-js/store";
import { SwitchKind } from "./App";
import { getState, getValueFromState, Path, setValueFromState, State } from "./editor_data";
import { AllLinksSchema, ArraySchema, BooleanSchema, LinkSchema, NodeSchema, ObjectSchema, sc, StringSchema } from "./schema";

function ArrayEditor(props: {schema: ArraySchema, path: Path}): JSX.Element {
  const [value, setValue] = modValue(() => props.path);
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
          // should we use the item array_symbol rather than
          // its actual index in the path?
          // I think that would be a good idea
          path={[...props.path, index(), "array_item"]}
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

function BooleanEditor(props: {schema: BooleanSchema, path: Path}): JSX.Element {
  // we need an unset vs false. true/false/unset.
  const [value, setValue] = modValue(() => props.path);
  return <div>
    <Button active={value() === false} onClick={() => setValue(pv => pv === false ? undefined : false)}>Off</Button>
    <Button active={value() === true} onClick={() => setValue(pv => pv === true ? undefined : true)}>On</Button>
  </div>;
}

function StringEditor(props: {schema: StringSchema, path: Path}): JSX.Element {
  const [value, setValue] = modValue(() => props.path);
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

function ObjectEditor(props: {schema: ObjectSchema, path: Path}): JSX.Element {
  const [value, setValue] = modValue(() => props.path);
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
          />
        </div>
      </div>}</For>
    </div>
  </Show>;
}

function AllLinksEditor(props: {schema: AllLinksSchema, path: Path}): JSX.Element {
  const state = getState();
  const data_schema = state.root_schema.symbols.find(sym => sym[0] === props.schema.tag)?.[1];
  return <div>
    <ArrayEditor schema={sc.array(data_schema)} path={["data", props.schema.tag]} />
  </div>;
}

function LinkEditor(props: {schema: LinkSchema, path: Path}): JSX.Element {
  return <div>TODO</div>;
}

function modValue(
  path: () => Path,
): [
  value: () => unknown,
  setValue: (cb: (pv: unknown) => unknown) => void,
] {
  const state = getState();
  return [
    () => getValueFromState(path(), state.state),
    (nv) => setValueFromState(path(), state.state, nv),
  ];
}

function NodeEditor(props: {schema: NodeSchema, path: Path}): JSX.Element {
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
      object: obj => <ObjectEditor schema={obj} path={props.path} />,
      string: str => <StringEditor schema={str} path={props.path} />,
      boolean: bool => <BooleanEditor schema={bool} path={props.path} />,
      array: arr => <ArrayEditor schema={arr} path={props.path} />,
      all_links: al => <AllLinksEditor schema={al} path={props.path} />,
      link: link => <LinkEditor schema={link} path={props.path} />,
    }}</SwitchKind>
  </div>;
}

export default NodeEditor;