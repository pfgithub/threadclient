import { createContext, JSX, useContext } from "solid-js";
import { AnNode } from "./app_data";
import { UUID } from "./uuid";

export type Path = (string | UUID)[];

export type RootState = {
  data: {
    root: unknown,
    [key: string]: unknown,
  },
};

export type ContextData = {
  node: AnNode<RootState>,
};

const NodeContext = createContext<ContextData>();

export function NodeProvider(props: {
  node: AnNode<RootState>,
  children: JSX.Element,
}): JSX.Element {
  return <NodeContext.Provider value={{
    node: props.node,
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