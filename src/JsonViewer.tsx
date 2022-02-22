import { JSX } from "solid-js/jsx-runtime";
import { switchKind } from "./util";
import { getState, getValueFromState, Path } from "./editor_data";
import { NodeSchema } from "./schema";

class JSONRaw {
  message: string;
  constructor(text: string) {
    this.message = text;
  }
}

// export type StringifyResult = {[key: string]: StringifyResult} | StringifyResult[] | …

function stringifySchemaEntry(path: Path, schema: NodeSchema): unknown {
  const root_state = getState();
  const state = getValueFromState(path, root_state.state);
  return switchKind(schema, {
    object: obj => {
      if(state == null || typeof state !== "object") return new JSONRaw("#E_NOT_OBJECT");
      return Object.fromEntries(obj.fields.map(field => {
        return [
          field.name,
          stringifySchemaEntry([...path, field.name], field.value),
        ];
      }));
    },
    string: () => {
      if(typeof state === "string") return state;
      return new JSONRaw("#E_NOT_STRING");
    },
    boolean: () => {
      if(typeof state === "boolean") return state;
      return new JSONRaw("#E_NOT_BOOLEAN");
    },
    array: arr => {
      if(state == null || typeof state !== "object") return new JSONRaw("#E_NOT_ARRAY");
      return Object.keys(state).map(key => stringifySchemaEntry([...path, key], arr.child));
    },
    union: uni => {
      if(state == null || typeof state !== "object") return new JSONRaw("#E_NOT_UNION");
      const tag = state[uni.tag_field];
      const choice = uni.choices.find(c => c.name === tag);
      if(!choice) return new JSONRaw("#E_BAD_TAG");
      return {
        [uni.tag_field]: tag,
        ...stringifySchemaEntry([...path, choice.name], choice.value) as Object,
      };
    },
    richtext: rt => {
      return new JSONRaw("#TODO_RICHTEXT");
    },
    all_links: al => {
      const state = getState();
      const schema = state.root_schema.symbols[al.tag];
      if(!schema) return new JSONRaw("#E_SCHEMA_MISSING_SYMBOL");
      const data = state.state.data.data[al.tag];
      if(!data) return {};
      if(typeof data !== "object") return new JSONRaw("#E_DATA_BAD_LINK_OBJECT");
      return Object.keys(data).map(key => stringifySchemaEntry(["data", al.tag, key], schema));
    },
    link: () => {
      if(typeof state === "string") return state;
      return new JSONRaw("#E_NOT_LINK");
    },
    dynamic: dyn => {
      return stringifySchemaEntry(path, dyn.resolver(path))
    },
  });
}

function stringifySchema(path: Path, schema: NodeSchema): string {
  const escapeString = (str: string): string => str.replaceAll("%", "<%>");
  return JSON.stringify(
    stringifySchemaEntry(path, schema),
    (key, value) => {
      if(typeof value === "string") return escapeString(value);
      if(value != null && typeof value === "object") {
        if(value instanceof JSONRaw) return "%"+escapeString(value.message)+"%";
        if(Array.isArray(value)) return value;
        if(value == null) return "%null%";
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [escapeString(k), v]),
        );
      }
      return value;
    },
    " ",
  ).replaceAll(/"%(.+?)%"/g, (_, full_str) => {
    return JSON.parse('"'+full_str+'"');
  }).replaceAll("<%>", "%");
}

export default function JsonViewer(props: {
  schema: NodeSchema,
  path: Path,
}): JSX.Element {
  return <pre class="font-mono whitespace-pre-wrap">{
    // TODO: untrack(() => stringifySchema)
    // then, track a symbol that changes when setState is called instead
    stringifySchema(props.path, props.schema)
  }</pre>
}