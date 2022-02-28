import { getState, getValueFromState } from "./editor_data";
import { asObject, asString, isObject } from "./guards";
import { NodeSchema, ObjectField, RootSchema, sc, summarize } from "./schema";
import { UUID } from "./uuid";

const person_link = "<!>person" as UUID;

const input_button = "<!>input_button" as UUID;
const output_button = "<!>output_button" as UUID;
const scene = "<!>scene" as UUID;
const layer = "<!>layer" as UUID;

const schema_nodes = "<!>schema_nodes" as UUID;
const schema_links = "<!>schema_links" as UUID;

const node_link_schema = sc.link(schema_nodes);
const field_opts = sc.object({
  title: sc.optional(sc.string()),
});
const object_field = sc.object({
  name: sc.string(),
  value: node_link_schema,
  opts: field_opts,
});
const object_opts = sc.object({
  summarize: sc.optional(sc.function("self", sc.string())),
  display_mode: sc.enum("all", "tab-bar"),
});
const object_schema = sc.object({
  fields: sc.array(object_field),
  opts: object_opts,
});
const array_opts = sc.object({
  view_mode: sc.enum("all", "tab-bar"),
});
const array_schema = sc.object({
  child: node_link_schema,
  opts: array_opts,
});
const union_field = sc.object({
  name: sc.string(),
  value: object_schema, // <- todo node_schema
});
const union_schema = sc.object({
  choices: sc.array(union_field),
});
const richtext_schema = sc.object({});
const string_schema = sc.object({});
const boolean_schema = sc.object({});
const link_schema = sc.object({
  tag: sc.link(schema_links),
});
const all_links_schema = sc.object({
  tag: sc.link(schema_links),
  opts: array_opts,
});
const dynamic_resolver_schema = sc.function("path", node_link_schema);
const dynamic_schema = sc.object({
  resolver: dynamic_resolver_schema,
});
const optional_schema = sc.object({
  child: node_link_schema,
});
const enum_schema = sc.object({
  choices: sc.array(node_link_schema),
});
const function_schema = sc.object({
  arg: sc.string(),
  retv: node_link_schema,
});

export const node_schema: NodeSchema = sc.union({
  object_schema,
  string_schema,
  boolean_schema,
  array_schema,
  union_schema,
  link_schema,
  all_links_schema,
  dynamic_schema,
  richtext_schema,
  optional_schema,
  enum_schema,
  function_schema,
});
// right. we'll define stringification fns that render to
// js schema types


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

export const root_schema: RootSchema = {
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

    schema: sc.object({
      root_type: sc.link(schema_nodes),
      types: sc.allLinks(schema_nodes),
      links: sc.allLinks(schema_links),
    }),
  }, {display_mode: "tab-bar"}),
  symbols: {
    [person_link]: person_schema,

    [input_button]: button_schema,
    [output_button]: button_schema,
    [scene]: layer_schema,
    [layer]: layer_schema,

    [schema_nodes]: sc.object({
      name: sc.string(),
      value: node_schema,
    }),
    [schema_links]: sc.object({
      name: sc.string(),
      value: sc.link(schema_nodes),
    }),
  },
};