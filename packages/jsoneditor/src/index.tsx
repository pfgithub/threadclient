import { createEffect, createSignal, onCleanup } from "solid-js";
import { ErrorBoundary, Portal, render } from "solid-js/web";
import { Debugtool, Show } from "tmeta-util-solid";
import App from "./App";
import { anBool, anRoot, createAppData } from "./app_data";
import { Button, Buttons } from "./components";
import { RootState, Settings } from "./editor_data";
import "./index.css";
import ServerExample from "./ServerExample";
import { uuid } from "./uuid";

const root_el = document.getElementById("root") as HTMLElement;

// this should really be a solid router thing
const [tab, setTab] = createSignal<"jsoneditor" | null>(null);

const root = createAppData<RootState>();
const settings = createAppData<Settings>();
render(() => {
  const [copied, setCopied] = createSignal(false);
  const [serverActive, setServerActive] = createSignal(false);
  createEffect(() => {
    if(copied()) {
      const to = setTimeout(() => {
        setCopied(false);
      }, 1000);
      onCleanup(() => clearTimeout(to));
    }
  });

  return <ErrorBoundary fallback={(err: Error, reset) => {
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
        <div class="flex flex-row flex-wrap gap-2">
          <Buttons>
            <Button
              disabled={copied()}
              onClick={() => void navigator.clipboard.writeText(uuid()).then(() => setCopied(true))}
              // .catch(setCopied(false))
            >
              {copied() ? "✓ Copied" : "Copy New UUID"}
            </Button>
          </Buttons>
        </div>
        <div>
          <Buttons>
            <Button active={serverActive()} onClick={() => setServerActive(v => !v)}>
              Server
            </Button>
          </Buttons>
        </div>
      </div>
    </>}>{tabv => <>
      <App node={root} settings={settings} />
    </>}</Show>
    <Show if={serverActive()}>
      <Portal>
        <div class="fixed top-0 left-0">
          <ServerExample root={anRoot(root)} />
        </div>
      </Portal>
    </Show>
  </ErrorBoundary>;
}, root_el);

const belowbody = document.createElement("div");
document.body.appendChild(belowbody);

render(() => <Show if={anBool(settings.highlight_updates) ?? true}>
  <Debugtool observe_root={root_el} />
</Show>, belowbody);