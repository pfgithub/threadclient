import { JSX } from "solid-js/jsx-runtime";
import { switchKind } from "./App";
import { getState } from "./editor_data";
import { NodeSchema } from "./schema";

class JSONRaw {
  message: string;
  constructor(text: string) {
    this.message = text;
  }
}

function stringifySchemaEntry(state: unknown, schema: NodeSchema): unknown {
  return switchKind(schema, {
    object: obj => {
      if(typeof state !== "object") return new JSONRaw("#E_NOT_OBJECT");
      return Object.fromEntries(obj.fields.map(field => {
        return [
          field.name,
          stringifySchemaEntry(state[field.name], field.value),
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
      if(!Array.isArray(state)) return new JSONRaw("#E_NOT_ARRAY");
      return state.map(entry => {
        if(typeof entry !== "object") return new JSONRaw("#E_NOT_ARRAY_CHILD");
        if(!('array_symbol' in entry)) return new JSONRaw("#E_NOT_ARRAY_CHILD");
        return stringifySchemaEntry(entry.array_item, arr.child);
      });
    },
    all_links: al => {
      const state = getState();
      const schema = state.root_schema.symbols.find(v => v[0] === al.tag)?.[1];
      if(!schema) return new JSONRaw("#E_SCHEMA_MISSING_SYMBOL");
      const data = state.state.data.data[al.tag];
      if(!Array.isArray(data)) return new JSONRaw("#E_DATA_MISSING_LINK_OBJECT");
      return data.map((value) => {
        // TODO: keep a map to make unique string keys based on the symbol key
        return stringifySchemaEntry(value.array_item, schema);
      });
    },
    link: () => new JSONRaw("@TODO(link)"),
  });
}

function stringifySchema(state: unknown, schema: NodeSchema): string {
  const escapeString = (str: string): string => str.replaceAll("%", "<%>");
  return JSON.stringify(
    stringifySchemaEntry(state, schema),
    (key, value) => {
      if(typeof value === "string") return escapeString(value);
      if(typeof value === "object") {
        if(value instanceof JSONRaw) return "%"+escapeString(value.message)+"%";
        if(Array.isArray(value)) return value;
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [escapeString(k), v]),
        );
      }
      return value;
    },
    " ",
  ).replaceAll("\"%", "").replaceAll("%\"", "").replaceAll("<%>", "%");
}

export default function JsonViewer(props: {
  schema: NodeSchema,
  value: unknown,
}): JSX.Element {
  return <pre class="font-mono whitespace-pre-wrap">{
    // TODO: untrack(() => stringifySchema)
    // then, track a symbol that changes when setState is called instead
    stringifySchema(props.value, props.schema)
  }</pre>
}