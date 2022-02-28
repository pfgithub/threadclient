import { JSX } from 'solid-js';
import { getState, getValueFromState, NodeProvider, State } from './editor_data';
import { asObject, asString, isObject } from './guards';
import JsonViewer from './JsonViewer';
import NodeEditor from './NodeEditor';
import { NodeSchema, ObjectField, RootSchema, sc, summarize } from './schema';
import { UUID } from './uuid';

const person_link = "<!>person" as UUID;

const input_button = "<!>input_button" as UUID;
const output_button = "<!>output_button" as UUID;
const scene = "<!>scene" as UUID;
const layer = "<!>layer" as UUID;

const person_schema = sc.object({
  name: sc.string(),
  description: sc.string(),
  attributes: sc.object({
    administrator: sc.boolean(),
    moderator: sc.boolean(),
  }),
  tags: sc.array(sc.string()),
}, {
  summarize: v_in => {
    const [name_field] = Object.keys(person_schema.fields);
  
    const v = asObject(v_in) ?? {};
    return asString(v[name_field]) ?? "*Unnamed*";
  }
});

const button_schema = sc.object({
  name: sc.string(),
  id: sc.string(),
}, {
  summarize: (v) => {
    const [name_field, id_field] = Object.keys(button_schema.fields);

    if(isObject(v)) return "" + asString(v[name_field]) + " (" + asString(v[id_field]) + ")";
    return "*Unnamed*";
  },
});
const action_schema: NodeSchema = sc.union({
  press: sc.object({
    buttons: sc.array(sc.link(output_button)),
  }),
  hold_layer: sc.object({
    layers: sc.array(sc.link(layer)),
  }),
});
const layer_schema: NodeSchema = sc.object({
  title: sc.string(),
  buttons: sc.dynamic((path) => {
    const state = getState();
    const objv = asObject(getValueFromState(["data", input_button], state.state)) ?? {};
    return {
      kind: "object",
      fields: Object.fromEntries(Object.entries(objv).map(
        ([key, value]): [UUID, ObjectField] => {
          return [key as UUID, {
            name: asString((asObject(value) ?? {}).name) ?? "*unnamed*",
            value: action_schema,
            opts: {
              title: summarize(value, button_schema),
            },
          }];
        },
      )),
      opts: {
        display_mode: "tab-bar"
      },
    };
  }),
}, {
  summarize: (v) => {
    if(isObject(v)
    && typeof v["title"] === "string") return v["title"];
    return "*Unnamed*";
  },
});

const resources_schema = sc.array(sc.object({
  resource: sc.string(), // sc.link(resource)
  cost: sc.string(),
}), {
  view_mode: "tab-bar",
});

const clicker_schema: NodeSchema = sc.union({
  none: sc.object({}),
  spacer: sc.object({}),
  separator: sc.object({}),
  counter: sc.object({
    name: sc.string(),
    description: sc.string(),
  }),
  button: sc.object({
    name: sc.string(),
    price: resources_schema, // sc.opt(),
    requirements: resources_schema, // sc.opt(),
    effects: resources_schema, // sc.opt(),
  }),
});

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

    // there should be a view mode that displays as a list but only one selected item
    // has its editors rendered, the rest are shown as a fancy rendered object
    clicker: sc.array(clicker_schema),

    text_editor: sc.richtext(),
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
