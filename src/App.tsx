import { JSX } from 'solid-js';
import { NodeProvider, State } from './editor_data';
import JsonViewer from './JsonViewer';
import NodeEditor from './NodeEditor';
import { NodeSchema, RootSchema, sc } from './schema';

const person_schema: NodeSchema = sc.object({
  name: sc.string(),
  description: sc.string(),
  attributes: sc.object({
    administrator: sc.boolean(),
    moderator: sc.boolean(),
  }),
  tags: sc.array(sc.string()),
}, {
  summarize: v => {
    if(typeof v === "object" && ('name' in v) && typeof v["name"] === "string") {
      return v["name"];
    }
    return "*Unnamed*";
  }
});

const button_schema: NodeSchema = sc.object({
  name: sc.string(),
  id: sc.string(),
  entry: sc.string(),
}, {
  summarize: (v) => {
    if(typeof v === "object"
    && ('name' in v)
    && typeof v["name"] === "string") return v["name"];
    return "*Unnamed*";
  },
});
const action_schema: NodeSchema = sc.object({
  action: sc.string(),
});
const layer_schema: NodeSchema = sc.object({
  todo: action_schema,
});

// button_schema:
//   sc.object({
//     name: string,
//     id: string,
//   })

// links:
//   input_button: button_schema,
//   output_button: button_schema,

const person_link = Symbol("person_link");

const input_button = Symbol("input_button");
const output_button = Symbol("output_button");
const scene = Symbol("scene");
const layer = Symbol("layer");

const root_schema: RootSchema = {
  root: sc.object({
    demo1: sc.object({
      people: sc.allLinks(person_link),
      root_person: sc.link(person_link),
    }),
    rebind: sc.object({
      buttons: sc.object({
        input: sc.allLinks(input_button),
        output: sc.allLinks(output_button),
      }),
      default_scene: sc.link(scene),

      // for scenes, we want a map where every input button
      // maps to an action
      scenes: sc.allLinks(scene),

      // for layers, we want a map where every input button
      // maps to undefined | an action
      layers: sc.allLinks(layer),
    }),
  }),
  symbols: [
    [person_link, person_schema],

    [input_button, button_schema],
    [output_button, button_schema],
    [scene, layer_schema],
    [layer, layer_schema],
  ],
};
// buttons:
//   input:
//     sc.all_links("input_button")
//   output:
//     sc.all_links("output_button")
// scenes:
//   sc.all_links("scene")
// default_scene: sc.link("scene")
// layers:
//   sc.all_links("layers")

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
          value={props.state.data.data.root}
        />
      </div>
    </div>
  </NodeProvider>;
};
