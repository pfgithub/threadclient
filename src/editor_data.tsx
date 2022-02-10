import { createContext, JSX, useContext } from "solid-js";
import { SetStoreFunction, Store } from "solid-js/store";
import { RootSchema } from "./schema";
import { UUID } from "./uuid";

export type Path = (string | number | UUID | symbol)[];

export type StateValue = {
  root: unknown,
  [k: UUID]: unknown[],
};

export type State = {
  data: Store<{data: StateValue}>,
  setData: SetStoreFunction<{data: unknown}>,
};

export function getValueFromState(path: Path, state: State): unknown {
  let node = state.data;
  for(const entry of path) {
    if(!node) {
      console.log("EPATH", path);
      throw new Error("path is undefined. path: `"+path.join(" / ")+"`");
    }
    node = node[entry];
  }
  return node;
}
export function setValueFromState(path: Path, state: State, value: unknown) {
  state.setData(...path as unknown as ["data"], value);
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

if(import.meta.hot) {
  import.meta.hot.accept((new_module) => {
      alert("cannot reload editor_data.tsx, please refresh page.");
  });
}