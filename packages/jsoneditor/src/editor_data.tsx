import { createContext, JSX, useContext } from "solid-js";
import { AnNode } from "./app_data";
import { UUID } from "./uuid";

export type Path = (string | UUID)[];

export type RootState = {
  data: {
    root: unknown,
    [key: string]: unknown,
  },
  settings: Settings,
  playingcards?: undefined | unknown,
};
export type Settings = {
  highlight_updates: boolean,
};

export type ContextData = {
  node: AnNode<RootState>,
};

const node_context = createContext<ContextData>();

export function NodeProvider(props: {
  node: AnNode<RootState>,
  children: JSX.Element,
}): JSX.Element {
  return <node_context.Provider value={{
    node: props.node,
  }}>{props.children}</node_context.Provider>;
}

export function getState(): ContextData {
  return useContext(node_context) ?? (() => {
    throw new Error("nodecontext not available");
  })();
}

if(import.meta.hot) {
  // TODO move const nodecontext into its own file and only do this there
  import.meta.hot.accept((new_module) => {
      alert("cannot reload editor_data.tsx, please refresh page.");
  });
}