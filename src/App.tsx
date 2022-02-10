import { JSX } from 'solid-js';
import { getState, getValueFromState, NodeProvider, State } from './editor_data';
import JsonViewer from './JsonViewer';
import NodeEditor from './NodeEditor';
import { NodeSchema, ObjectField, RootSchema, sc, summarize } from './schema';
import { UUID } from './uuid';

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
}, {
  summarize: (v) => {
    if(typeof v === "object") return "" + v["name"] + " (" + v["id"] + ")";
    return "*Unnamed*";
  },
});
const action_schema: NodeSchema = sc.object({
  action: sc.string(),
  // ok I can hack it with a dynamic schema and an enum or I can make a proper
  // union schema
});
const layer_schema: NodeSchema = sc.object({
  title: sc.string(),
  buttons: sc.dynamic((path) => {
    const state = getState();
    return {
      kind: "object",
      fields: Object.entries(getValueFromState(["data", input_button], state.state) ?? {}).map(
        ([key, value]): ObjectField => {
          return {
            name: value.array_symbol,
            value: action_schema,
            opts: {
              title: summarize(value.array_item, button_schema),
            },
          }
        },
      ),
      opts: {
        display_mode: "tab-bar"
      },
    };
  }),
}, {
  summarize: (v) => {
    if(typeof v === "object"
    && ('title' in v)
    && typeof v["title"] === "string") return v["title"];
    return "*Unnamed*";
  },
});

// button_schema:
//   sc.object({
//     name: string,
//     id: string,
//   })

// links:
//   input_button: button_schema,
//   output_button: button_schema,

// TODO:
// - use uuids instead of symbols
// - this will keep them stable

const person_link = "5bdcd7dc-ab06-47c7-9d8b-f9c79dd46284" as UUID;

const input_button = "0cdfae1d-775f-4f49-9ab4-094633ed1e09" as UUID;
const output_button = "96b24915-2fd0-46e4-b2a7-4d591a36d0fa" as UUID;
const scene = "9a1bb843-89b9-4281-8958-f71d341cbf8a" as UUID;
const layer = "a374e26e-0882-41b1-b6d8-efba29409452" as UUID;

const root_schema: RootSchema = {
  root: sc.object({
    demo1: sc.object({
      people: sc.allLinks(person_link),
      root_person: sc.link(person_link),
    }),
    rebind: sc.object({
      buttons: sc.object({
        input: sc.allLinks(input_button, {view_mode: "tab-bar"}),
        output: sc.allLinks(output_button, {view_mode: "tab-bar"}),
      }, {display_mode: "tab-bar"}),
      default_scene: sc.link(scene),

      // for scenes, we want a map where every input button
      // maps to an action
      scenes: sc.allLinks(scene, {view_mode: "tab-bar"}),

      // for layers, we want a map where every input button
      // maps to undefined | an action
      layers: sc.allLinks(layer, {view_mode: "tab-bar"}),
    }, {display_mode: "tab-bar"}),
  }, {display_mode: "tab-bar"}),
  symbols: {
    [person_link]: person_schema,

    [input_button]: button_schema,
    [output_button]: button_schema,
    [scene]: layer_schema,
    [layer]: layer_schema,
  },
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
          path={["data", "root"]}
        />
      </div>
    </div>
  </NodeProvider>;
};
