import { createContext, JSX, useContext } from "solid-js";
import { ScNode, ScObject, State } from "./app_data";
import { UUID } from "./uuid";

export type Path = (string | UUID)[];

export type RootState = ScObject<{
  data: ScObject<{
    root: ScNode,
    [key: string]: ScNode,
  }>,
}>;

export type ContextData = {
  state: State<RootState>,
};

const NodeContext = createContext<ContextData>();

export function NodeProvider(props: {
  state: State<RootState>,
  children: JSX.Element,
}): JSX.Element {
  return <NodeContext.Provider value={{
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