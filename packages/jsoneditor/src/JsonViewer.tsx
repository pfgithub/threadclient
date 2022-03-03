import { createMemo, createSelector, createSignal, For, untrack } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { ScNode, State, StateValue } from "./app_data";
import { Button } from "./components";
import { getState } from "./editor_data";
import { asString } from "./guards";
import { UUID } from "./uuid";

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

const colors = [
  "text-red-300",
  "text-orange-300",
  "text-yellow-300",
  "text-green-300",
  "text-blue-300",
  "text-purple-300",
];

export function StoreViewerElement(props: {
  state: State<ScNode>,
  level: number,
}): JSX.Element {
  const color = () => colors[props.level % colors.length |0]!;

  return createMemo((): JSX.Element => {
    const pv = props.state();
    if(typeof pv === "object" && pv != null) return untrack((): JSX.Element => {
      const ntries = createMemo<[UUID, State<ScNode>][]>((prev_value) => {
        const ntrieson = Object.entries(pv as object);
        const res = ntrieson as [UUID, State<ScNode>][];
        if(!prev_value) return res;

        const prev_map = new Map<UUID, [UUID, State<ScNode>]>();
        for(const ntry of prev_value) prev_map.set(ntry[0], ntry);
        return res.map(([k, v]) => {
          const itm = prev_map.get(k);
          if(itm && itm[1] === v) return itm;
          return [k, v];
        })
      });
      return <span>{"{"}<For each={ntries()}>{(item, index) => {
        return <span>{index() !== 0 ? "," : ""}{"\n" + " ".repeat(props.level) + " "}
          <span class={color()}>{JSON.stringify(item[0])}</span>{": "}
          <StoreViewerElement state={item[1]} level={props.level + 1} />
        </span>;
      }}</For>{(ntries().length !== 0 ? "\n" + " ".repeat(props.level) : "") + "}"}</span>;
    }); else return untrack((): JSX.Element => {
      return <span class={color()}>{pv === undefined ? "#E_UNDEFINED" : JSON.stringify(pv)}</span>;
    });
  });
}
export function StoreViewer(props: {
  state: State<ScNode>,
}): JSX.Element {
  return <pre class="font-mono whitespace-pre-wrap">
    <StoreViewerElement state={props.state} level={0} />
    {"\n\n\n---\n\n"}
    {JSON.stringify(props.state, null, " ")}
    {"\n\n---\n\n"}
    <div><Button onClick={() => console.log({value: props.state})}>log</Button></div>
  </pre>;
}

export default function JsonViewer(): JSX.Element {
  const root_state = getState();
  const [viewModeRaw, setViewMode] = createSignal<StateValue>(undefined);
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
    {
      viewMode() === "internal"
      ? <StoreViewer state={root_state.state} />
      : <pre class="font-mono whitespace-pre-wrap">
        {"TODO allow the schema creator to define their own stringification"}
      </pre>
    }
  </div>;
}