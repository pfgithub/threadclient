import { Path } from "./editor_data";
import { UUID } from "./uuid";

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
      fields: Object.entries(obj).map(([key, value]): ObjectField => ({
        name: key,
        value: isSpecialField(value) ? value.value : value,
        opts: isSpecialField(value) ? value.opts : {},
      })),
      opts,
    };
  },
  union: (tag_field: string, uni: {[key: string]: ObjectSchema}): UnionSchema => ({
    kind: "union",
    tag_field: tag_field,
    choices: Object.entries(uni).map(([key, value]): UnionField => ({
      name: key,
      value: value,
    })),
  }),
  richtext: (): RichtextSchema => ({kind: "richtext"}),
  string: (): StringSchema => ({kind: "string"}),
  boolean: (): BooleanSchema => ({kind: "boolean"}),
  array: (child: NodeSchema, opts: ArrayOpts = {}): ArraySchema => ({kind: "array", child, opts}),
  link: (tag: UUID): LinkSchema => ({kind: "link", tag}),
  allLinks: (tag: UUID, opts: ArrayOpts = {}): AllLinksSchema => ({kind: "all_links", tag, opts}),
  dynamic: (resolver: DynamicResolver): DynamicSchema => ({kind: "dynamic", resolver}),
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

export type RootSchema = {
  root: NodeSchema,
  symbols: {[key: UUID]: NodeSchema}
};

export type FieldOpts = {
  title?: undefined | string,
};
export type ObjectField = {
  name: string,
  value: NodeSchema,
  opts: FieldOpts,
};
export type ObjectOpts = {
  summarize?: undefined | ((v: unknown) => string),
  display_mode?: undefined | "all" | "tab-bar",
};
export type ObjectSchema = {
  kind: "object",
  fields: ObjectField[],
  opts: ObjectOpts,
  // to put union fields inside an object we could have an option here
  // to flatten the result
};
export type ArrayOpts = {
  view_mode?: undefined | "all" | "tab-bar",
};
export type ArraySchema = {
  kind: "array",
  child: NodeSchema,
  opts: ArrayOpts,
};
export type UnionField = {
  name: string,
  value: ObjectSchema,
};
export type UnionSchema = {
  kind: "union",
  tag_field: string,
  choices: UnionField[],
};
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
export type StringSchema = {
  kind: "string",
};
export type BooleanSchema = {
  kind: "boolean",
};
export type LinkSchema = {
  kind: "link",
  tag: UUID,
};
export type AllLinksSchema = {
  kind: "all_links",
  tag: UUID,
  opts: ArrayOpts,
};
export type DynamicResolver = (
  path: Path,
) => NodeSchema;
export type DynamicSchema = {
  kind: "dynamic",
  resolver: DynamicResolver,
};

// TODO: summarize should return a JSX.Element rather than just a single
// string.
export function summarize(value: unknown, schema: NodeSchema): string {
  if(schema != null && schema.kind === "object") {
    return schema.opts.summarize?.(value) ?? "E_NO_SUMMARY";
  }
  return "E_NO_SUMMARY";
}
