import { createSignal } from 'solid-js';
import { ErrorBoundary, render } from 'solid-js/web';
import { Debugtool, Show } from 'tmeta-util-solid';
import App from './App';
import { anBool, createAppData } from './app_data';
import { RootState } from './editor_data';
import './index.css';

const root_el = document.getElementById('root') as HTMLElement;

// this should really be a solid router thing
const [tab, setTab] = createSignal<"jsoneditor" | null>(null);

const root = createAppData<RootState>();
render(() => {
  return <ErrorBoundary fallback={(err, reset) => {
    console.log("app error", err);
    return <div>
      <p>App errored.</p>
      <button onClick={() => reset()} class="bg-gray-700 mr-2">Reset</button>
      <button onClick={() => console.log(root)} class="bg-gray-700">Code</button>
      <pre class="text-red-500 whitespace-pre-wrap">
        {err.toString() + "\n" + err.stack}
      </pre>
    </div>
  }}>
    <Show when={tab()} fallback={<>
      <div class="mx-auto max-w-2xl bg-gray-800 p-4 h-full space-y-2">
        <button class="bg-gray-700 rounded-md block w-full p-2" onClick={() => setTab("jsoneditor")}>JSON Editor</button>
      </div>
    </>}>{tabv => <>
      <App node={root} />
    </>}</Show>
  </ErrorBoundary>;
}, root_el);

const belowbody = document.createElement("div");
document.body.appendChild(belowbody);

render(() => <Show if={anBool(root.settings.highlight_updates) ?? true}>
  <Debugtool observe_root={root_el} />
</Show>, belowbody);