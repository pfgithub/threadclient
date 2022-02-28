import { createContext, JSX, untrack, useContext } from "solid-js";
import { reconcile, SetStoreFunction, Store } from "solid-js/store";
import { isObject } from "./guards";
import { RootSchema } from "./schema";
import { UUID } from "./uuid";

export type Path = (string | number | UUID | symbol)[];

export type StateValue = {
  root: unknown,
  [k: UUID]: unknown[],
};

export type State = {
  data: Store<{data: unknown}>,
  setData: SetStoreFunction<{data: unknown}>,
};

export function getValueFromState(path: Path, state: State): unknown {
  let node: unknown = state.data;
  for(const entry of path) {
    if(!isObject(node)) {
      console.log("EPATH", path, "AT ENTRY", entry, "WHOLE STATE", state);
      throw new Error("path is undefined. path: `"+path.map(v => v.toString()).join(" / ")+"`");
    }
    node = node[entry];
  }
  return node;
}
export function setValueFromState(path: Path, state: State, value: unknown) {
  state.setData(...path as unknown as ["data"], reconcile(
    typeof value === "function" ? value(untrack(() => getValueFromState(path, state))) : value,
    {merge: false},
  ));
}

export type ContextData = {
  root_schema: RootSchema,
  state: State,
};

const NodeContext = createContext<ContextData>();

export function NodeProvider(props: {
  root: RootSchema,
  state: State,
  children: JSX.Element,
}): JSX.Element {
  return <NodeContext.Provider value={{
    root_schema: props.root,
    state: props.state,
  }}>{props.children}</NodeContext.Provider>;
}

export function getState(): ContextData {
  return useContext(NodeContext) ?? (() => {
    throw new Error("nodecontext not available");
  })()
}

export function modValue(
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

if(import.meta.hot) {
  // TODO move const nodecontext into its own file and only do this there
  import.meta.hot.accept((new_module) => {
      alert("cannot reload editor_data.tsx, please refresh page.");
  });
}