import { JSX } from "solid-js/jsx-runtime";
import { switchKind } from "./util";
import { getState } from "./editor_data";
import { NodeSchema } from "./schema";

class JSONRaw {
  message: string;
  constructor(text: string) {
    this.message = text;
  }
}

type SymMap = {
  map: Map<symbol, number>,
  index: number,
};

function getSymName(sym: symbol, symm: SymMap): string {
  // TODO: include short summary defined in the schema
  const num = symm.map.get(sym) ?? (() => {
    const nv = symm.index++;
    symm.map.set(sym, nv);
    return nv;
  })();
  return "#"+num;
}

function stringifySchemaEntry(state: unknown, schema: NodeSchema, sym_map: SymMap): unknown {
  return switchKind(schema, {
    object: obj => {
      if(typeof state !== "object") return new JSONRaw("#E_NOT_OBJECT");
      return Object.fromEntries(obj.fields.map(field => {
        return [
          field.name,
          stringifySchemaEntry(state[field.name], field.value, sym_map),
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
        return stringifySchemaEntry(entry.array_item, arr.child, sym_map);
      });
    },
    all_links: al => {
      const state = getState();
      const schema = state.root_schema.symbols[al.tag];
      if(!schema) return new JSONRaw("#E_SCHEMA_MISSING_SYMBOL");
      const data = state.state.data.data[al.tag];
      if(!data) return {};
      if(!Array.isArray(data)) return new JSONRaw("#E_DATA_BAD_LINK_OBJECT");
      return Object.fromEntries(data.map((value) => {
        // TODO: keep a map to make unique string keys based on the symbol key
        const sym = value.array_symbol;
        return [
          getSymName(sym, sym_map),
          stringifySchemaEntry(value.array_item, schema, sym_map),
        ];
      }));
    },
    link: () => {
      if(typeof state === "symbol") return getSymName(state, sym_map);
      return new JSONRaw("#E_NOT_LINK");
    },
  });
}

function stringifySchema(state: unknown, schema: NodeSchema): string {
  const escapeString = (str: string): string => str.replaceAll("%", "<%>");
  const sym_map: SymMap = {
    map: new Map(),
    index: 0,
  };
  return JSON.stringify(
    stringifySchemaEntry(state, schema, sym_map),
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