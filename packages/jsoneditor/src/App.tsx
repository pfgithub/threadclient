import { createSelector, ErrorBoundary, For, JSX, untrack } from "solid-js";
import Actions from "./Actions";
import { AnNode, anRoot } from "./app_data";
import { Button, Buttons } from "./components";
import Design from "./design";
import { NodeProvider, RootState, Settings as SettingsTy } from "./editor_data";
import JsonViewer from "./JsonViewer";
import PlayingCards from "./PlayingCards";
import Schemaless from "./Schemaless";
import ServerExample from "./ServerExample";
import Settings from "./Settings";
import { createUIState, UIStateSplit } from "./ui_state";

type Window = {
  component: () => JSX.Element,
  title: string,
};
function AnyWindow(props: {
  choices: {[key: string]: Window},
  default: string,
  state_node: AnNode<unknown>,
}): JSX.Element {
  const [selection, setSelection] = createUIState(props.state_node, "-MyO7IrrnjehmvXYn1an", props.default);
  const [fullPage, setFullPage] = createUIState(props.state_node, "-MyO7fk-DUc3EvqSUjGf", false);
  const isSelected = createSelector(selection);
  return <div class={"bg-gray-800 " + (fullPage() ? "!m-0 fixed top-0 left-0 w-full h-full" : "")}>
    <div class="bg-black p-4 flex flex-row flex-wrap gap-2">
      <select
        class="bg-gray-700 px-1 rounded-md"
        onInput={(e) => {
          setSelection(e.currentTarget.value);
        }}
      >
        <For each={Object.keys(props.choices)}>{(key, i) => {
          return <option value={key} selected={isSelected(key)}>
            {props.choices[key]!.title}
          </option>;
        }}</For>
      </select>
      <Buttons>
        <Button onClick={() => {
          setFullPage(v => !v);
        }}>{fullPage() ? "Return" : "Full Page"}</Button>
      </Buttons>
    </div>
    <div class="p-4">
      <ErrorBoundary fallback={(err: Error, reset) => {
        console.log("app error", err);
        return <div>
          <p>App errored.</p>
          <button onClick={() => reset()} class="bg-gray-700 mr-2">Reset</button>
          <pre class="text-red-500 whitespace-pre-wrap">
            {err.toString() + "\n" + err.stack}
          </pre>
        </div>;
      }}>
        {(() => {
          const v = props.choices[selection()]!.component;
          return untrack(() => v());
        })()}
      </ErrorBoundary>
    </div>
  </div>;
}

export default function App(props: {
  node: AnNode<RootState>,
  settings: AnNode<SettingsTy>,
}): JSX.Element {
  const windows: {[key: string]: Window} = {
    schemaless: {
      title: "Schemaless",
      component: () => <Schemaless
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        node={props.node.data.root as any}
      />,
    },
    json_viewer: {
      title: "JSON Viewer",
      component: () => <JsonViewer />,
    },
    design: {
      title: "Design",
      component: () => <Design />,
    },
    settings: {
      title: "Settings",
      component: () => <Settings node={props.settings} />,
    },
    cards: {
      title: "Cards",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      component: () => <PlayingCards node={props.node.playingcards as any} />,
    },
    server: {
      title: "Server",
      component: () => <ServerExample root={anRoot(props.node)} />,
    },
    actions: {
      title: "Actions",
      component: () => <Actions root={anRoot(props.node)} />,
    },
  };
  return <NodeProvider
    node={props.node}
  >
    <div class="grid gap-20 md:grid-cols-2 max-w-6xl mx-auto h-full">
      <UIStateSplit key={"-MyO8ElMY2c_Ii137kpJ"}>
        <AnyWindow choices={windows} default={"schemaless"} state_node={props.node as unknown as AnNode<unknown>} />
      </UIStateSplit>
      <UIStateSplit key={"-MyO8Flrf5aY4D_xrZX-"}>
        <AnyWindow choices={windows} default={"json_viewer"} state_node={props.node as unknown as AnNode<unknown>} />
      </UIStateSplit>
    </div>
  </NodeProvider>;
}
