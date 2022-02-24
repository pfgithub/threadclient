import { JSX } from "solid-js/jsx-runtime";
import { switchKind } from "./util";
import { getState, getValueFromState, modValue, Path } from "./editor_data";
import { NodeSchema } from "./schema";
import { createSelector, createSignal } from "solid-js";
import { Button } from "./components";
import { asObject, asString, isObject } from "./guards";
import { json_viewer_view_mode } from "./symbols";

export class JSONRaw {
  message: string;
  constructor(text: string) {
    this.message = text;
  }
}

export function stringifyWithJsonRaw(value: unknown): string {
  const escapeString = (str: string): string => str.replaceAll("%", "<%>");
  return JSON.stringify(
    value,
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
  const root_state = getState();
  const [viewModeRaw, setViewMode] = modValue(() => ["data", json_viewer_view_mode]);
  const viewMode = () => {
    return asString(viewModeRaw()) ?? "internal";
  };
  const vmsel = createSelector(viewMode);

  // ok I want to display json data with a real json viewer
  // this means we need to keep state for objects eg: collapsed
  // so we can use a what's it called
  // WeakMap
  // either that or store the data directly in the object with a custom symbol key
  // actually that would be fine too
  // oh huh
  //
  // a note:
  // symbol keys can actually be per-viewer
  // they are not persisted
  //
  // so I think we should treat symbol keys as per-viewer for now and then eventually
  // we'll program them to actually be per-viewer when we replace the store with
  // our own thing.
  //
  // [!] oh wait
  // what if we display the same data twice within the viewer
  // just don't do that for now I guess

  // we might actually get rid of rendered view for now. serialization and deserialization
  // of data is important but that should be user-defined.
  //
  // internal is useful because it's what we should actually store and what the program
  // edits.
  return <div class="space-y-2">
    <div>
      <Button active={vmsel("rendered")} onClick={() => setViewMode(() => "rendered")}>rendered</Button>
      <Button active={vmsel("internal")} onClick={() => setViewMode(() => "internal")}>internal</Button>
    </div>
    <pre class="font-mono whitespace-pre-wrap">{
      // TODO: untrack(() => stringifySchema)
      // then, track a symbol that changes when setState is called instead
      viewMode() === "rendered"
      ? "TODO allow the schema creator to define their own stringification"
      : JSON.stringify(root_state.state.data.data, null, " ")
    }</pre>
  </div>;
}