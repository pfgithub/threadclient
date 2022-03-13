import { createSelector, createSignal, ErrorBoundary, For, JSX, untrack } from 'solid-js';
import { AnNode } from './app_data';
import Design from './design';
import { NodeProvider, RootState } from './editor_data';
import JsonViewer from './JsonViewer';
import PlayingCards from './playingcards';
import Schemaless from './Schemaless';
import Settings from './Settings';

type Window = {
  component: () => JSX.Element,
  title: string,
};
function AnyWindow(props: {
  choices: {[key: string]: Window},
  default: string,
}): JSX.Element {
  const [selection, setSelection] = createSignal(props.default);
  const isSelected = createSelector(selection);
  return <div class="bg-gray-800 p-4 space-y-2">
    <select
      class="bg-gray-700 px-1 rounded-md"
      onInput={(e) => {
        setSelection(e.currentTarget.value);
      }}
    >
      <For each={Object.keys(props.choices)}>{(key, i) => {
        return <option value={key} selected={isSelected(key)}>
          {props.choices[key].title}
        </option>;
      }}</For>
    </select>
    <div>
      <ErrorBoundary fallback={(err, reset) => {
        console.log("app error", err);
        return <div>
          <p>App errored.</p>
          <button onClick={() => reset()} class="bg-gray-700 mr-2">Reset</button>
          <pre class="text-red-500 whitespace-pre-wrap">
            {err.toString() + "\n" + err.stack}
          </pre>
        </div>
      }}>
        {(() => {
          const v = props.choices[selection()]?.component;
          return untrack(() => v());
        })()}
      </ErrorBoundary>
    </div>
  </div>;
}

export default function App(props: {
  node: AnNode<RootState>,
}): JSX.Element {
  const windows: {[key: string]: Window} = {
    schemaless: {
      title: "Schemaless",
      component: () => <Schemaless
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
      component: () => <Settings node={props.node.settings} />,
    },
    cards: {
      title: "Cards",
      component: () => <PlayingCards node={props.node.playingcards as any} />,
    },
  };
  return <NodeProvider
    node={props.node}
  >
    <div class="grid gap-20 md:grid-cols-2 max-w-6xl mx-auto h-full">
      <AnyWindow choices={windows} default={"schemaless"} />
      <AnyWindow choices={windows} default={"json_viewer"} />
    </div>
  </NodeProvider>;
};
