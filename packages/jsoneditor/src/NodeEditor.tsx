import { createMemo, createSelector, ErrorBoundary, For, Show, untrack } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Button } from "./components";
import { getState, modValue, Path } from "./editor_data";
import { isObject } from "./guards";
import { Key } from "./Key";
import { AllLinksSchema, ArraySchema, BooleanSchema, LinkSchema, NodeSchema, ObjectSchema, sc, StringSchema, summarize, UnionSchema } from "./schema";
import { object_active_field } from "./symbols";
import { RichtextEditor } from "./TextEditor";
import { SwitchKind } from "./util";
import { UUID, uuid } from "./uuid";

// switch arrays to use objects
// and figure out how to make <For> accept a key

function TabOrListEditor<T>(props: {
  mode: undefined | "all" | "tab-bar",
  tabs: ({
    key: string | (() => string),
    title: string,
  })[],
  active: [() => unknown, (cb: (pv: unknown) => unknown) => void],
  children: (key: unknown) => JSX.Element,
}): JSX.Element {
  return createMemo((): JSX.Element => {
    if(props.mode === "tab-bar") return untrack((): JSX.Element => {
      const [active, setActive] = props.active;
      // TODO: active, setActive should be stored in state somehow
      // maybe have a seperate state thing for active values or something
      const isSelected = createSelector(active);

      const tabs = createMemo(() => props.tabs);

      const showingID = createMemo(() => {
        const id = active();
        if(id == null) return null;
        const tab = tabs().find(t => t.key === id);
        if(tab == null) return null;
        return id;
      });
    
      return <div>
        <div><For each={tabs()}>{tab => (
          <Button
            active={isSelected(tab.key)}
            onClick={() => {
              const key = typeof tab.key === "function" ? tab.key() : tab.key;
              setActive(v => v === key ? null : key);
            }}
          >{tab.title}</Button>
        )}</For></div>
        <Show when={showingID()}>{(id) => <>
          <div class="mt-2" />
          {untrack(() => props.children(id))}
        </>}</Show>
      </div>;
    });
    return untrack((): JSX.Element => {
      return <div class="space-y-2">
        <Key each={props.tabs} by={tab => tab.key}>{(tab, _, key: string | (() => string)) => {
          return <div>{
            typeof key === "function" ? <div>
              <Button onClick={() => {
                if(typeof key !== "function") return alert("EBAD");
                key();
              }}>{tab().title}</Button>
            </div> : <div>
              <div>{tab().title}</div>
              <div class="pl-2 border-l-[0.5rem] border-gray-700">
                {untrack(() => props.children(key))}
              </div>
            </div>
          }</div>;
        }}</Key>
      </div>;
    });
  });
}

function ArrayEditor(props: {schema: ArraySchema, path: Path}): JSX.Element {
  // TODO internally store arrays in an object
  // huh, if we mark it with a symbol we can make our data tostringable without
  // having to know the schema
  const [value, setValue] = modValue(() => props.path);

  return <TabOrListEditor
    mode={props.schema.opts.view_mode}
    tabs={[...(() => {
      const res = value();
      if(!isObject(res)) return [];
      return Object.entries(res).map(([key, item]) => {
        return {
          title: summarize(item, props.schema.child),
          key,
        };
      });
    })(), {
      title: "+",
      key: (): string => {
        const nsym = uuid();
        setValue(it => {
          const nv = {...(it != null && typeof it === "object" ? it : {}), [nsym]: null};
          console.log(it, nv);
          return nv;
        });
        return nsym;
      },
    }]}
    active={modValue(() => [...props.path, object_active_field])}
  >{(key) => {
    return <>
      <div><Button
        onClick={() => {
          setValue(it => Object.fromEntries(
            it != null && typeof it === "object" ? (
              Object.entries(it).filter(([k]) => k !== key)
            ) : (() => {
              throw new Error("is not array even though is");
            })(),
          ));
        }}
      >Delete</Button></div>
      <div class="mt-2" />
      <NodeEditor
        schema={props.schema.child}
        path={[...props.path, key as UUID]}
      />
    </>;
  }}</TabOrListEditor>;
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
  return <Show when={(() => {
    const v = value();
    return v != null && typeof v === "object";
  })()} fallback={(
    <div>
      <Button onClick={() => {
        setValue(() => ({}));
      }}>
        Create Object
      </Button>
      {" (value: "+value()+")"}
    </div>
  )}>
    <TabOrListEditor
      mode={props.schema.opts.display_mode}
      tabs={Object.entries(props.schema.fields).map(([key, field]) => ({
        key,
        title: field.opts.title ?? field.name,
      }))}
      active={modValue(() => [...props.path, object_active_field])}
    >{key => {
      const field = props.schema.fields[key as UUID];
      if(!field) throw new Error("unreachable");

      return <div>
        <NodeEditor
          schema={field.value}
          path={[...props.path, key as UUID]}
        />
      </div>;
    }}</TabOrListEditor>
  </Show>;
}

function UnionEditor(props: {schema: UnionSchema, path: Path}): JSX.Element {
  const [value, setValue] = modValue(() => props.path);
  return <Show when={(() => {
    const v = value();
    if(!isObject(v)) return false;
    if(!isObject(v["values"])) return false;
    return true;
  })()} fallback={(
    <div>
      <Button onClick={() => {
        setValue(() => ({
          values: {},
        }));
      }}>
        Create Union
      </Button>
      {" (value: "+value()+")"}
    </div>
  )}>
    <TabOrListEditor
      mode={"tab-bar"}
      tabs={Object.entries(props.schema.choices).map(([key, choice]) => ({
        key,
        title: choice.name,
      }))}
      active={modValue(() => [...props.path, "active"])}
    >{key => {
      const field = props.schema.choices[key as UUID];
      if(!field) throw new Error("unreachable");

      return <div>
        <NodeEditor schema={field.value} path={[...props.path, "values", key as UUID]} />
      </div>;
    }}</TabOrListEditor>
  </Show>;
}

function AllLinksEditor(props: {schema: AllLinksSchema, path: Path}): JSX.Element {
  const content_path = () => ["data", props.schema.tag];
  const [value, setValue] = modValue(content_path);
  const state = getState();
  const dataSchema = () => state.root_schema.symbols[props.schema.tag];
  return <Show when={isObject(value())} fallback={<div>
    <Button onClick={() => {
      setValue(() => ({}));
    }}>Create AllLinks</Button>
  </div>}><div>
    <ArrayEditor schema={sc.array(dataSchema(), props.schema.opts)} path={content_path()} />
  </div></Show>;
}

function LinkEditor(props: {schema: LinkSchema, path: Path}): JSX.Element {
  const [value, setValue] = modValue(() => props.path);
  const [choices, setChoices] = modValue(() => ["data", props.schema.tag]);
  const state = getState();
  const dataSchema = () => state.root_schema.symbols[props.schema.tag];
  const isSelected = createSelector(value);
  return <div>
    <select
      class="bg-gray-700 px-1 rounded-md"
      onInput={(e) => {
        const val = e.currentTarget.value;
        if(val === "") return setValue(() => undefined);
        setValue(() => val);
      }}
    >
      <option value={""} selected={isSelected(undefined)}>None</option>
      <For each={(() => {
        const c = choices();
        if(!isObject(c)) return [];
        return Object.entries(c);
      })()}>{([k, v], i) => {
        return <option value={k} selected={isSelected(k)}>
          {i()} {summarize(v, dataSchema())}
        </option>;
      }}</For>
    </select>
  </div>;
}

function NodeEditor(props: {schema: NodeSchema, path: Path}): JSX.Element {
  return <div><ErrorBoundary fallback={(err: Error, reset) => <>
    <div class="space-x-1">
      <span><Button onClick={() => reset()}>Reset</Button></span>
      <span><Button onClick={() => {
        console.log(err, props);
        console.log(JSON.parse(JSON.stringify(props)));
      }}>Code</Button></span>
    </div>
    <details>
      <summary class="text-gray-300"><span class="text-red-500">Error: </span>{err.toString().replace("Error: ", "")}</summary>
      <p>{err.stack ?? ""}</p>
    </details>
  </>}>
    <SwitchKind item={props.schema}>{{
      object: obj => <ObjectEditor schema={obj} path={props.path} />,
      string: str => <StringEditor schema={str} path={props.path} />,
      boolean: bool => <BooleanEditor schema={bool} path={props.path} />,
      array: arr => <ArrayEditor schema={arr} path={props.path} />,
      union: uni => <UnionEditor schema={uni} path={props.path} />,
      richtext: rt => <RichtextEditor schema={rt} path={props.path} />,
      all_links: al => <AllLinksEditor schema={al} path={props.path} />,
      link: link => <LinkEditor schema={link} path={props.path} />,
      dynamic: dynamic => <NodeEditor schema={dynamic.resolver(props.path)} path={props.path} />,
      optional: opt => <div>TODO opt</div>,
      enum: enm => <div>TODO enm</div>,
      function: fn => <div>TODO fn</div>,
    }}</SwitchKind>
  </ErrorBoundary></div>;
}

export default NodeEditor;