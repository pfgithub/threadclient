import { createSignal } from "solid-js";
import { ErrorBoundary, render } from "solid-js/web";
import { Debugtool, Show } from "tmeta-util-solid";
import App from "./App";
import { anBool, createAppData } from "./app_data";
import CopyUUIDButton from "./CopyUUIDButton";
import { RootState, Settings } from "./editor_data";
import Exploration from "./Exploration";
import System from "./fun/System";
import "./index.css";

const root_el = document.getElementById("root") as HTMLElement;

// this should really be a solid router thing
const [tab, setTab] = createSignal<"jsoneditor" | "system" | "exploration" | null>(null);

const root = createAppData<RootState>();
const settings = createAppData<Settings>();
render(() => {
  return <div class="h-full select-none"><ErrorBoundary fallback={(err: Error, reset) => {
    console.log("app error", err);
    return <div>
      <p>App errored.</p>
      <button onClick={() => reset()} class="bg-gray-700 mr-2">Reset</button>
      <button onClick={() => console.log(root)} class="bg-gray-700">Code</button>
      <pre class="text-red-500 whitespace-pre-wrap">
        {err.toString() + "\n" + err.stack}
      </pre>
    </div>;
  }}>
    <Show when={tab()} fallback={<>
      <div class="mx-auto max-w-2xl bg-gray-800 p-4 h-full space-y-2">
        <button
          class="bg-gray-700 rounded-md block w-full p-2"
          onClick={() => setTab("jsoneditor")}
        >JSON Editor</button>
        <button
          class="bg-gray-700 rounded-md block w-full p-2"
          onClick={() => setTab("system")}
        >System</button>
        <button
          class="bg-gray-700 rounded-md block w-full p-2"
          onClick={() => setTab("exploration")}
        >Exploration</button>
        <div class="flex flex-row flex-wrap gap-2">
          <CopyUUIDButton />
        </div>
      </div>
    </>}>{tabv => <>{
      tabv === "jsoneditor" ? (
        <App node={root} settings={settings} />
      ) : tabv === "system" ? (
        <System />
      ) : (
        <Exploration />
      )
    }</>}</Show>
  </ErrorBoundary></div>;
}, root_el);

const belowbody = document.createElement("div");
document.body.appendChild(belowbody);

render(() => <Show if={anBool(settings.highlight_updates) ?? true}>
  <Debugtool observe_root={root_el} />
</Show>, belowbody);