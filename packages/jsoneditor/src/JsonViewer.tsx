import { createMemo, createSelector, createSignal, For, untrack } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Node, Root } from "./app_data";
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
  node: Node<unknown>,
  level: number,
}): JSX.Element {
  const color = () => colors[props.level % colors.length |0]!;

  return createMemo((): JSX.Element => {
    const pv = props.node.readPrimitive();
    if(typeof pv === "object" && pv != null) return untrack((): JSX.Element => {
      return <span>{"{"}<For each={pv.keys()}>{(key, index) => {
        return <span>{index() !== 0 ? "," : ""}{"\n" + " ".repeat(props.level) + " "}
          <span class={color()}>{JSON.stringify(key)}</span>{": "}
          <StoreViewerElement node={(props.node as Node<any>).get(key as any)} level={props.level + 1} />
        </span>;
      }}</For>{(pv.keys().length !== 0 ? "\n" + " ".repeat(props.level) : "") + "}"}</span>;
    }); else return untrack((): JSX.Element => {
      return <span class={color()}>{pv === undefined ? "#E_UNDEFINED" : JSON.stringify(pv)}</span>;
    });
  });
}
export function StoreViewer(props: {
  node: Node<unknown>,
}): JSX.Element {
  return <pre class="font-mono whitespace-pre-wrap">
    <StoreViewerElement node={props.node} level={0} />
    {"\n\n\n---\n\n"}
    {/*JSON.stringify(props.state, null, " ")*/"todo"}
    {"\n\n---\n\n"}
    <div><Button onClick={() => console.log({value: props.node})}>log</Button></div>
  </pre>;
}

export default function JsonViewer(): JSX.Element {
  const root_state = getState();
  return <div class="space-y-2">
    <StoreViewer node={root_state.state} />
  </div>;
}