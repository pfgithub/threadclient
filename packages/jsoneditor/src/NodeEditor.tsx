import { createMemo, createSelector, createSignal, ErrorBoundary, For, Show, untrack } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Key } from "tmeta-util-solid";
import { get, object, setReconcile, State, StateValue, wrap } from "./app_data";
import { Button } from "./components";
import { getState } from "./editor_data";
import { asObject, asString, isObject, isString } from "./guards";
import { AllLinksSchema, ArraySchema, BooleanSchema, ColorSchema, LinkSchema, NodeSchema, ObjectSchema, sc, StringSchema, summarize, UnionSchema } from "./schema";
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
  active: [() => StateValue, (cb: (pv: StateValue) => StateValue) => void],
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

function ArrayEditor(props: {schema: ArraySchema, state: State}): JSX.Element {
  const plusButton = (): string => {
    const nsym = uuid();
    setReconcile(props.state, it => {
      const nv = {...(asObject(it) ?? {}), [nsym]: null};
      console.log(it, nv);
      return object(nv);
    });
    return nsym;
  };
  return <TabOrListEditor
    mode={props.schema.opts.view_mode}
    tabs={[...(() => {
      const res = get(props.state);
      if(!isObject(res)) return [];
      return Object.entries(res).map(([key, item]) => {
        return {
          title: summarize(item, props.schema.child),
          key,
        };
      });
    })(), {
      title: "+",
      key: plusButton,
    }]}
    active={createSignal<StateValue>(undefined)}
  >{(key) => {
    return <>
      <div><Button
        onClick={() => {
          setReconcile(props.state, it => object(Object.fromEntries(
            it != null && typeof it === "object" ? (
              Object.entries(it).filter(([k]) => k !== key)
            ) : (() => {
              throw new Error("is not array even though is");
            })(),
          )));
        }}
      >Delete</Button></div>
      <div class="mt-2" />
      <NodeEditor
        schema={props.schema.child}
        state={asObject(get(props.state))?.[key as UUID]!}
      />
    </>;
  }}</TabOrListEditor>;
}

function BooleanEditor(props: {schema: BooleanSchema, state: State}): JSX.Element {
  // we need an unset vs false. true/false/unset.
  return <div>
    <Button active={get(props.state) === false} onClick={() => setReconcile(props.state, pv => pv === false ? null : false)}>Off</Button>
    <Button active={get(props.state) === true} onClick={() => setReconcile(props.state, pv => pv === true ? null : true)}>On</Button>
  </div>;
}

function StringEditor(props: {schema: StringSchema, state: State}): JSX.Element {
  return <div>
    <Show
      when={typeof isString(get(props.state))}
      fallback={(
        <Button onClick={() => setReconcile(props.state, () => "")}>Create String</Button>
      )}
    >
      <input
        type="text"
        class="w-full bg-gray-700 rounded-sm px-1"
        value={asString(get(props.state)) ?? ""}
        // onChange here maybe?
        onInput={e => setReconcile(props.state, () => e.currentTarget.value)}
      />
    </Show>
  </div>;
}

function ObjectEditor(props: {schema: ObjectSchema, state: State}): JSX.Element {
  return <Show when={isObject(get(props.state))} fallback={(
    <div>
      <Button onClick={() => {
        setReconcile(props.state, () => object({}));
      }}>
        Create Object
      </Button>
      {" (value: "+get(props.state)+")"}
    </div>
  )}>
    <TabOrListEditor
      mode={props.schema.opts.display_mode}
      tabs={Object.entries(props.schema.fields).map(([key, field]) => ({
        key,
        title: field.opts.title ?? field.name,
      }))}
      active={createSignal<StateValue>(undefined)}
    >{key => {
      const field = props.schema.fields[key as UUID];
      if(!field) throw new Error("unreachable");

      return <div>
        <NodeEditor
          schema={field.value}
          state={asObject(get(props.state))?.[key as UUID]!}
        />
      </div>;
    }}</TabOrListEditor>
  </Show>;
}

function UnionEditor(props: {schema: UnionSchema, state: State}): JSX.Element {
  return <Show when={(() => {
    const v = get(props.state);
    if(!isObject(v)) return false;
    const value = get(v["values" as UUID]);
    if(!isObject(value)) return false;
    return true;
  })()} fallback={(
    <div>
      <Button onClick={() => {
        setReconcile(props.state, () => object({
          ["values" as UUID]: wrap(object({})),
        }));
      }}>
        Create Union
      </Button>
      {" (value: "+get(props.state)+")"}
    </div>
  )}>
    <TabOrListEditor
      mode={"tab-bar"}
      tabs={Object.entries(props.schema.choices).map(([key, choice]) => ({
        key,
        title: choice.name,
      }))}
      active={[
        () => get(asObject(get(props.state))!["active" as UUID]!),
        (nv) => {
          setReconcile(asObject(get(props.state))!["active" as UUID], nv);
        }
      ]}
    >{key => {
      const field = props.schema.choices[key as UUID];
      if(!field) throw new Error("unreachable");

      return <div>
        <NodeEditor schema={field.value} state={asObject(get(asObject(get(props.state))!["values" as UUID]!))![key as UUID]!} />
      </div>;
    }}</TabOrListEditor>
  </Show>;
}

function AllLinksEditor(props: {schema: AllLinksSchema, state: State}): JSX.Element {
  const state = getState();
  const contentState = () => asObject(get(asObject(get(state.state))!["data" as UUID]))![props.schema.tag];
  const dataSchema = () => state.root_schema.symbols[props.schema.tag];
  return <Show when={isObject(get(contentState()))} fallback={<div>
    <Button onClick={() => {
      setReconcile(contentState(), () => object({}));
    }}>Create AllLinks</Button>
  </div>}><div>
    <ArrayEditor schema={sc.array(dataSchema(), props.schema.opts)} state={contentState()} />
  </div></Show>;
}

function LinkEditor(props: {schema: LinkSchema, state: State}): JSX.Element {
  const state = getState();
  const choices = () => asObject(get(asObject(get(state.state))!["data" as UUID]))![props.schema.tag];
  const dataSchema = () => state.root_schema.symbols[props.schema.tag];
  const isSelected = createSelector(() => get(props.state));
  return <div>
    <select
      class="bg-gray-700 px-1 rounded-md"
      onInput={(e) => {
        const val = e.currentTarget.value;
        if(val === "") return setReconcile(props.state, () => undefined);
        setReconcile(props.state, () => val);
      }}
    >
      <option value={""} selected={isSelected(undefined)}>None</option>
      <For each={(() => {
        const c = get(choices());
        if(!isObject(c)) return [];
        return Object.entries(c);
      })()}>{([key, value], i) => {
        return <option value={key} selected={isSelected(key)}>
          {i()} {summarize(value, dataSchema())}
        </option>;
      }}</For>
    </select>
  </div>;
}

function ColorEditor(props: {schema: ColorSchema, state: State}): JSX.Element {
  // we should show just the color and the picker should show in a dropdown
  // also I should just use someone's premade color picker shouldn't I
  // no reason to make my own

  // oh we could have a DropdownSchema that says to show a thing in a dropdown
  // and otherwise displays a rendered summary
  //
  // that's a good idea I think

  return <div>
    <div class="w-64 h-64 rounded-md overflow-hidden" style={{
      "background-color": "#00FF00",
    }}>
      <div class="w-full h-full" style={{
        "background": "linear-gradient(to right, #FFFFFFFF, #FFFFFF00)",
      }}>
        <div class="w-full h-full" style={{
          "background": "linear-gradient(to bottom, #00000000, #000000FF)",
        }} />
      </div>
    </div>
  </div>;
}

function NodeEditor(props: {schema: NodeSchema, state: State}): JSX.Element {
  return <div><ErrorBoundary fallback={(err: Error, reset) => <>
    <div class="space-x-1">
      <span><Button onClick={() => reset()}>Reset</Button></span>
      <span><Button onClick={() => {
        console.log(err, props);
        console.log(JSON.parse(JSON.stringify(props)));
      }}>Code</Button></span>
    </div>
    <details>
      <summary class="text-gray-300"><span class="text-red-500">Error: </span>{err.toString()}</summary>
      <p>{err.stack ?? ""}</p>
    </details>
  </>}>
    <SwitchKind item={props.schema}>{{
      object: obj => <ObjectEditor schema={obj} state={props.state} />,
      string: str => <StringEditor schema={str} state={props.state} />,
      boolean: bool => <BooleanEditor schema={bool} state={props.state} />,
      array: arr => <ArrayEditor schema={arr} state={props.state} />,
      union: uni => <UnionEditor schema={uni} state={props.state} />,
      richtext: rt => <RichtextEditor schema={rt} state={props.state} />,
      all_links: al => <AllLinksEditor schema={al} state={props.state} />,
      link: link => <LinkEditor schema={link} state={props.state} />,
      dynamic: dynamic => <NodeEditor schema={dynamic.resolver(props.state)} state={props.state} />,
      optional: opt => <div>TODO opt</div>,
      enum: enm => <div>TODO enm</div>,
      function: fn => <div>TODO fn</div>,
      color: col => <ColorEditor schema={col} state={props.state} />,
    }}</SwitchKind>
  </ErrorBoundary></div>;
}

export default NodeEditor;