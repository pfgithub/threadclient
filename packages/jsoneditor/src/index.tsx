import { createSignal } from 'solid-js';
import { ErrorBoundary, render, Show } from 'solid-js/web';
import { Debugtool } from 'tmeta-util-solid';
import App from './App';
import { object, State, wrap } from './app_data';
import { RootState } from './editor_data';
import './index.css';

const root_el = document.getElementById('root') as HTMLElement;

render(() => {
  // this should really be a solid router thing
  const [tab, setTab] = createSignal<"jsoneditor" | null>(null);
  const state: State<RootState> = wrap(object({
    data: wrap(object({
      root: wrap(null),
    })),
  }));
  return <ErrorBoundary fallback={(err, reset) => {
    console.log("app error", err);
    return <div>
      <p>App errored.</p>
      <button onClick={() => reset()} class="bg-gray-700 mr-2">Reset</button>
      <button onClick={() => console.log(state)} class="bg-gray-700">Code</button>
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
      <App state={state} />
    </>}</Show>
  </ErrorBoundary>;
}, root_el);

const belowbody = document.createElement("div");
document.body.appendChild(belowbody);

render(() => <Debugtool observe_root={root_el} />, belowbody);