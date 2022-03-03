import { createContext, JSX, untrack, useContext } from "solid-js";
import { reconcile, SetStoreFunction, Store } from "solid-js/store";
import { ScNode, ScObject, State } from "./app_data";
import { isObject } from "./guards";
import { RootSchema } from "./schema";
import { UUID } from "./uuid";

export type Path = (string | UUID)[];

export type RootState = ScObject<{
  data: ScObject<{
    root: ScNode,
    [key: string]: ScNode,
  }>,
}>;

export type ContextData = {
  root_schema: RootSchema,
  state: State<RootState>,
};

const NodeContext = createContext<ContextData>();

export function NodeProvider(props: {
  root: RootSchema,
  state: State<RootState>,
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
  // TODO move const nodecontext into its own file and only do this there
  import.meta.hot.accept((new_module) => {
      alert("cannot reload editor_data.tsx, please refresh page.");
  });
}