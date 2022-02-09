export const sc = {
  object: (obj: {[key: string]: NodeSchema}): ObjectSchema => {
    return {
      kind: "object",
      fields: Object.entries(obj).map(entry => ({name: entry[0], value: entry[1]})),
    };
  },
  string: (): StringSchema => ({kind: "string"}),
  boolean: (): BooleanSchema => ({kind: "boolean"}),
  array: (child: NodeSchema): ArraySchema => ({kind: "array", child}),
} as const;

export type NodeSchema =
  | ObjectSchema
  | StringSchema
  | BooleanSchema
  | ArraySchema
;

export type ObjectField = {
  name: string,
  value: NodeSchema,
};
export type ObjectSchema = {
  kind: "object",
  fields: ObjectField[],
};
export type ArraySchema = {
  kind: "array",
  child: NodeSchema,
};
export type StringSchema = {
  kind: "string",
};
export type BooleanSchema = {
  kind: "boolean",
};