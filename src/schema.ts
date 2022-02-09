import { Path } from "./editor_data";
import { UUID } from "./uuid";

export const sc = {
  object: (obj: {[key: string]: NodeSchema}, opts: ObjectOpts = {}): ObjectSchema => {
    return {
      kind: "object",
      fields: Object.entries(obj).map(entry => ({name: entry[0], value: entry[1]})),
      opts,
    };
  },
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
  | LinkSchema
  | AllLinksSchema
  | DynamicSchema
;

export type RootSchema = {
  root: NodeSchema,
  symbols: {[key: UUID]: NodeSchema}
};

export type ObjectOpts = {
  summarize?: undefined | ((v: unknown) => string),
};
export type ObjectField = {
  name: string,
  value: NodeSchema,
};
export type ObjectSchema = {
  kind: "object",
  fields: ObjectField[],
  opts: ObjectOpts,
};
export type ArrayOpts = {
  view_mode?: undefined | "all" | "tab-bar",
};
export type ArraySchema = {
  kind: "array",
  child: NodeSchema,
  opts: ArrayOpts,
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
  if(schema.kind === "object") {
    return schema.opts.summarize?.(value) ?? "E_NO_SUMMARY";
  }
  return "E_NO_SUMMARY";
}

// link should stringify to its name
// the name can be found in the root data

// !
// schemas define how the data should be rendered
// we should:
// - define a parser and stringifier for each schema
// - define an editor for each schema
//
// !
// should stringification be possible without knowing the schema?
// - the reason it isn't right now is for:
//   - schema-defined field order in objects
//   - 'array_symbol', 'array_item' in ArraySchema