import { createSelector, createSignal, For, JSX } from 'solid-js';
import { State } from './app_data';
import { root_schema } from './default_schema';
import Design from './design';
import { NodeProvider } from './editor_data';
import JsonViewer from './JsonViewer';
import NodeEditor from './NodeEditor';
import { UUID } from './uuid';

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
      {props.choices[selection()]?.component()}
    </div>
  </div>;
}

export default function App(props: {
  state: State,
}): JSX.Element {
  const windows: {[key: string]: Window} = {
    node_editor: {
      title: "Node Editor",
      component: () => <NodeEditor
        schema={root_schema.root}
        state={props.state.getKey("data" as UUID).getKey("root" as UUID)}
      />,
    },
    json_viewer: {
      title: "JSON Viewer",
      component: () => <JsonViewer
        schema={root_schema.root}
      />,
    },
    design: {
      title: "Design",
      component: () => <Design />,
    },
  };
  return <NodeProvider
    root={root_schema}
    state={props.state}
  >
    <div class="grid gap-20 md:grid-cols-2 max-w-6xl mx-auto h-full">
      <AnyWindow choices={windows} default={"node_editor"} />
      <AnyWindow choices={windows} default={"json_viewer"} />
    </div>
  </NodeProvider>;
};
