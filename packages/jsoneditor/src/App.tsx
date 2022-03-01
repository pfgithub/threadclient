import { JSX } from 'solid-js';
import { get, State } from './app_data';
import { root_schema } from './default_schema';
import { NodeProvider } from './editor_data';
import { asObject } from './guards';
import JsonViewer from './JsonViewer';
import NodeEditor from './NodeEditor';
import { UUID } from './uuid';

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
          state={asObject(get(asObject(get(props.state))!["data" as UUID]))!["root" as UUID]}
        />
      </div>
      <div class="bg-gray-800 p-4">
        <JsonViewer
          schema={root_schema.root}
        />
      </div>
    </div>
  </NodeProvider>;
};
