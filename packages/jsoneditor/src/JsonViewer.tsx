import { createMemo, For, untrack } from "solid-js";
import { JSX } from "solid-js";
import { anGet, anKeys, AnNode } from "./app_data";
import { Button, Buttons } from "./components";
import { getState } from "./editor_data";
import { isObject } from "./guards";

export class JSONRaw {
  message: string;
  constructor(text: string) {
    this.message = text;
  }
}

export function stringifyWithJsonRaw(root: unknown): string {
  const escapeString = (str: string): string => str.replaceAll("%", "<%>");
  return JSON.stringify(
    root,
    (key, value: unknown) => {
      if(typeof value === "string") return escapeString(value);
      if(isObject(value)) {
        if(value instanceof JSONRaw) return "%"+escapeString(value.message)+"%";
        if(Array.isArray(value)) return value as unknown[];
        if(value == null) return "%null%";
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [escapeString(k), v]),
        );
      }
      return value;
    },
    " ",
  ).replaceAll(/"%(.+?)%"/g, (__, full_str) => {
    return JSON.parse('"'+full_str+'"') as string;
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
  node: AnNode<unknown>,
  level: number,
}): JSX.Element {
  const color = () => colors[props.level % colors.length |0]!;

  return createMemo((): JSX.Element => {
    const pv = anGet(props.node);
    if(typeof pv === "object" && pv != null) return untrack((): JSX.Element => {
      return <span>{"{"}<For each={anKeys(props.node)}>{(key, index) => {
        return <span>{index() !== 0 ? "," : ""}{"\n" + " ".repeat(props.level) + " "}
          <span class={color()}>{JSON.stringify(key)}</span>{": "}
          <StoreViewerElement
            node={(props.node as unknown as AnNode<{[key: string]: unknown}>)[key]!}
            level={props.level + 1}
          />
        </span>;
      }}</For>{(anKeys(props.node).length !== 0 ? "\n" + " ".repeat(props.level) : "") + "}"}</span>;
    }); else return untrack((): JSX.Element => {
      return <span class={color()}>{pv === undefined ? "#E_UNDEFINED" : JSON.stringify(pv)}</span>;
    });
  });
}
export function StoreViewer(props: {
  node: AnNode<unknown>,
}): JSX.Element {
  return <pre class="font-mono whitespace-pre-wrap">
    <StoreViewerElement node={props.node} level={0} />
    {"\n\n\n---\n\n"}
    {/*JSON.stringify(props.state, null, " ")*/"todo"}
    {"\n\n---\n\n"}
    <Buttons><Button onClick={() => console.log({value: props.node})}>log</Button></Buttons>
  </pre>;
}

export default function JsonViewer(): JSX.Element {
  const root_state = getState();
  return <div class="space-y-2">
    <StoreViewer node={root_state.node as unknown as AnNode<unknown>} />
  </div>;
}