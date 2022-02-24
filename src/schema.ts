import { Path } from "./editor_data";
import { uuid, UUID } from "./uuid";

const is_specialfield: unique symbol = Symbol("special_field");
type SpecialField = {
  [is_specialfield]: true,
  value: NodeSchema,
  opts: FieldOpts,
};

function isSpecialField(v: NodeSchema | SpecialField): v is SpecialField {
  return is_specialfield in v;
}

// TODO I want to be able to specify eg:
// sc.object<TypescriptType>() and have it check that the fields I put match that type

// also that way I can make a renderer for a thing that renders
// DeepPartial<TypescriptType>
export const sc = {
  field: (value: NodeSchema, opts: FieldOpts = {}): SpecialField => ({[is_specialfield]: true, value, opts}),
  object: (obj: {[key: string]: NodeSchema | SpecialField}, opts: ObjectOpts = {}): ObjectSchema => {
    return {
      kind: "object",
      fields: Object.fromEntries(Object.entries(obj).map(([key, value]): [UUID, ObjectField] => ["<!>"+key as UUID, {
        name: key,
        value: isSpecialField(value) ? value.value : value,
        opts: isSpecialField(value) ? value.opts : {},
      }])),
      opts,
    };
  },
  union: (tag_field: string, uni: {[key: string]: ObjectSchema}): UnionSchema => ({
    kind: "union",
    tag_field: tag_field,
    choices: Object.fromEntries(Object.entries(uni).map(([key, value]): [UUID, UnionField] => ["<!>"+key as UUID, {
      name: key,
      value: value,
    }])),
  }),
  richtext: (): RichtextSchema => ({kind: "richtext"}),
  string: (): StringSchema => ({kind: "string"}),
  boolean: (): BooleanSchema => ({kind: "boolean"}),
  array: (child: NodeSchema, opts: ArrayOpts = {}): ArraySchema => ({kind: "array", child, opts}),
  link: (tag: UUID): LinkSchema => ({kind: "link", tag}),
  allLinks: (tag: UUID, opts: ArrayOpts = {}): AllLinksSchema => ({kind: "all_links", tag, opts}),
  dynamic: (resolver: DynamicResolver): DynamicSchema => ({kind: "dynamic", resolver}),

  // TODO:
  optional: (...args: any[]) => undefined as unknown as NodeSchema,
  enum: (...args: any[]) => undefined as unknown as NodeSchema,
  function: (...args: any[]) => undefined as unknown as NodeSchema,
} as const;

export type NodeSchema =
  | ObjectSchema
  | StringSchema
  | BooleanSchema
  | ArraySchema
  | UnionSchema
  | LinkSchema
  | AllLinksSchema
  | DynamicSchema
  | RichtextSchema
;
const node_schema: NodeSchema = {} as NodeSchema;

const all_symbols = "<!>all_symbols" as UUID;

export type RootSchema = {
  root: NodeSchema,
  symbols: {[key: UUID]: NodeSchema}
};
const root_schema = sc.object({
  root: sc.link(all_symbols),
  symbols: sc.allLinks(all_symbols),
});

export type FieldOpts = {
  title?: undefined | string,
};
const field_opts = sc.object({
  title: sc.optional(sc.string()),
});
export type ObjectField = {
  name: string,
  value: NodeSchema,
  opts: FieldOpts,
};
const object_field = sc.object({
  name: sc.string(),
  value: node_schema,
  opts: field_opts,
});
export type ObjectOpts = {
  summarize?: undefined | ((v: unknown) => string),
  display_mode?: undefined | "all" | "tab-bar",
};
const object_opts = sc.object({
  summarize: sc.optional(sc.function("self", sc.string())),
  display_mode: sc.enum("all", "tab-bar", {default: "all"}),
});
export type ObjectSchema = {
  kind: "object",
  fields: {[key: UUID]: ObjectField},
  opts: ObjectOpts,
  // to put union fields inside an object we could have an option here
  // to flatten the result
};
const object_schema = sc.object({
  fields: sc.array(object_field),
  opts: object_opts,
});
export type ArrayOpts = {
  view_mode?: undefined | "all" | "tab-bar",
};
const array_opts = sc.object({
  view_mode: sc.enum("all", "tab-bar", {default: "all"}),
});
export type ArraySchema = {
  kind: "array",
  child: NodeSchema,
  opts: ArrayOpts,
};
const array_schema = sc.object({
  child: node_schema,
  opts: array_opts,
});
export type UnionField = {
  name: string,
  value: ObjectSchema,
};
const union_field = sc.object({
  name: sc.string(),
  value: object_schema, // <- todo node_schema
});
export type UnionSchema = {
  kind: "union",
  tag_field: string,
  // ^ TODO don't use this in internal data to store the active field
  choices: {[key: string]: UnionField},
};
const union_schema = sc.object({
  tag_field: sc.string(), // <- todo remove this as it only exists for json stringification
  // and we want to use custom serializers/deserializers
  choices: sc.array(union_field),
});
export type RichtextSchema = {
  kind: "richtext",

  // merge: (a: node, b: node): undefined | node
  // node_types:
  // - root:
  //   - paragraph:
  //     - text (bold | italic | …)
  //     - inline_code
  //   - multiline_code_block

  // and then we need to specify renderers, probably seperately?
};
const richtext_schema = sc.object({});
export type StringSchema = {
  kind: "string",
};
const string_schema = sc.object({});
export type BooleanSchema = {
  kind: "boolean",
};
const boolean_schema = sc.object({});
export type LinkSchema = {
  kind: "link",
  tag: UUID,
};
const link_schema = sc.object({
  tag: sc.link(all_symbols),
});
export type AllLinksSchema = {
  kind: "all_links",
  tag: UUID,
  opts: ArrayOpts,
};
const all_links_schema = sc.object({
  tag: sc.link(all_symbols),
  opts: array_opts,
});
export type DynamicResolver = (
  path: Path,
) => NodeSchema;
const dynamic_resolver_schema = sc.function("path", node_schema);
export type DynamicSchema = {
  kind: "dynamic",
  resolver: DynamicResolver,
};
const dynamic_schema = sc.object({
  resolver: dynamic_resolver_schema,
});


Object.assign(node_schema, sc.union("UNUSED", {
  object_schema,
  string_schema,
  boolean_schema,
  array_schema,
  union_schema,
  link_schema,
  all_links_schema,
  dynamic_schema,
  richtext_schema,
}));

// TODO: summarize should return a JSX.Element rather than just a single
// string.
export function summarize(value: unknown, schema: NodeSchema): string {
  if(schema != null && schema.kind === "object") {
    return schema.opts.summarize?.(value) ?? "E_NO_SUMMARY";
  }
  return "E_NO_SUMMARY";
}
