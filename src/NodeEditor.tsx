import { Accessor, createMemo, createSelector, createSignal, For, Setter, Show, untrack } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { SwitchKind } from "./util";
import { getState, getValueFromState, Path, setValueFromState, State } from "./editor_data";
import { AllLinksSchema, ArraySchema, BooleanSchema, LinkSchema, NodeSchema, ObjectSchema, sc, StringSchema, summarize, UnionSchema } from "./schema";
import { UUID, uuid } from "./uuid";
import { Key } from "./Key";
import { object_active_field } from "./symbols";
import { RichtextEditor } from "./TextEditor";

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

  const state = getState();

  return <TabOrListEditor
    mode={props.schema.opts.view_mode}
    tabs={[...(() => {
      const res = value();
      if(typeof res !== "object") return [];
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
      tabs={props.schema.fields.map(field => ({
        key: field.name,
        title: field.opts.title ?? field.name,
      }))}
      active={modValue(() => [...props.path, object_active_field])}
    >{key => {
      const field = props.schema.fields.find(field => field.name === key);
      if(!field) throw new Error("unreachable");

      return <div>
        <NodeEditor
          schema={field.value}
          path={[...props.path, field.name]}
        />
      </div>;
    }}</TabOrListEditor>
  </Show>;
}

function UnionEditor(props: {schema: UnionSchema, path: Path}): JSX.Element {
  const [value, setValue] = modValue(() => props.path);
  return <Show when={(() => {
    const v = value();
    return v != null && typeof v === "object";
  })()} fallback={(
    <div>
      <Button onClick={() => {
        setValue(() => ({}));
      }}>
        Create Union
      </Button>
      {" (value: "+value()+")"}
    </div>
  )}>
    <TabOrListEditor
      mode={"tab-bar"}
      tabs={props.schema.choices.map(choice => ({
        key: choice.name,
        title: choice.name,
      }))}
      active={modValue(() => [...props.path, props.schema.tag_field])}
    >{key => {
      const field = props.schema.choices.find(field => field.name === key);
      if(!field) throw new Error("unreachable");

      return <div>
        <NodeEditor schema={field.value} path={[...props.path, field.name]} />
      </div>;
    }}</TabOrListEditor>
  </Show>;
}

function AllLinksEditor(props: {schema: AllLinksSchema, path: Path}): JSX.Element {
  const state = getState();
  const dataSchema = () => state.root_schema.symbols[props.schema.tag];
  return <div>
    <ArrayEditor schema={sc.array(dataSchema(), props.schema.opts)} path={["data", props.schema.tag]} />
  </div>;
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
        if(val === "") return setValue(undefined);
        setValue(() => val);
      }}
    >
      <option value={""} selected={isSelected(undefined)}>None</option>
      <For each={(() => {
        const c = choices();
        if(typeof c !== "object") return [];
        return Object.entries(c);
      })()}>{([k, v], i) => {
        return <option value={k} selected={isSelected(k)}>
          {i()} {summarize(v, dataSchema())}
        </option>;
      }}</For>
    </select>
  </div>;
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
      union: uni => <UnionEditor schema={uni} path={props.path} />,
      richtext: rt => <RichtextEditor schema={rt} path={props.path} />,
      all_links: al => <AllLinksEditor schema={al} path={props.path} />,
      link: link => <LinkEditor schema={link} path={props.path} />,
      dynamic: dynamic => <NodeEditor schema={dynamic.resolver(props.path)} path={props.path} />
    }}</SwitchKind>
  </div>;
}

export default NodeEditor;