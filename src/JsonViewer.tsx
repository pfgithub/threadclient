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

function stringifySchemaEntry(path: Path, schema: NodeSchema): unknown {
  const root_state = getState();
  const state = getValueFromState(path, root_state.state);
  return switchKind(schema, {
    object: obj => {
      if(typeof state !== "object") return new JSONRaw("#E_NOT_OBJECT");
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
      if(!Array.isArray(state)) return new JSONRaw("#E_NOT_ARRAY");
      return state.map((entry, key) => {
        if(typeof entry !== "object") return new JSONRaw("#E_NOT_ARRAY_CHILD");
        if(!('array_symbol' in entry)) return new JSONRaw("#E_NOT_ARRAY_CHILD");
        return stringifySchemaEntry([...path, key, "array_item"], arr.child);
      });
    },
    all_links: al => {
      const state = getState();
      const schema = state.root_schema.symbols[al.tag];
      if(!schema) return new JSONRaw("#E_SCHEMA_MISSING_SYMBOL");
      const data = state.state.data.data[al.tag];
      if(!data) return {};
      if(!Array.isArray(data)) return new JSONRaw("#E_DATA_BAD_LINK_OBJECT");
      return Object.fromEntries(data.map((value, key) => {
        // TODO: keep a map to make unique string keys based on the symbol key
        const sym = value.array_symbol;
        return [
          sym,
          stringifySchemaEntry(["data", al.tag, key, "array_item"], schema),
        ];
      }));
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
  path: Path,
}): JSX.Element {
  return <pre class="font-mono whitespace-pre-wrap">{
    // TODO: untrack(() => stringifySchema)
    // then, track a symbol that changes when setState is called instead
    stringifySchema(props.path, props.schema)
  }</pre>
}