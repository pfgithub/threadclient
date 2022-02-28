import { JSX } from 'solid-js';
import { root_schema } from './default_schema';
import { NodeProvider, State } from './editor_data';
import JsonViewer from './JsonViewer';
import NodeEditor from './NodeEditor';

export default function App(props: {
  state: State,
}): JSX.Element {
  return <NodeProvider
    root={root_schema}
    state={props.state}
  >
    <div class="grid gap-20 md:grid-cols-2 max-w-6xl mx-auto h-full">
      <div class="bg-gray-800 p-4">
        <NodeEditor
          schema={root_schema.root}
          path={["data", "root"]}
        />
      </div>
      <div class="bg-gray-800 p-4">
        <JsonViewer
          schema={root_schema.root}
          path={["data", "root"]}
        />
      </div>
    </div>
  </NodeProvider>;
};
