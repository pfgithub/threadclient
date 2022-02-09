import { createStore } from 'solid-js/store';
import { ErrorBoundary, render } from 'solid-js/web';
import App from './App';
import { StateValue } from './editor_data';
import './index.css';

render(() => {
  const [data, setData] = createStore<{data: StateValue}>({
    data: {
      root: undefined,
    },
  });
  return <ErrorBoundary fallback={(err, reset) => {
    console.log("app error", err);
    return <div>
      <p>App errored.</p>
      <button onClick={() => reset()} class="bg-gray-700 mr-2">Reset</button>
      <button onClick={() => console.log(data, setData)} class="bg-gray-700">Code</button>
      <pre class="text-red-500 whitespace-pre-wrap">
        {err.toString() + "\n" + err.stack}
      </pre>
    </div>
  }}>
    <App state={{data, setData}} />
  </ErrorBoundary>;
}, document.getElementById('root') as HTMLElement);
