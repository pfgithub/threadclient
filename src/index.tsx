import { createStore } from 'solid-js/store';
import { render } from 'solid-js/web';
import App from './App';
import { StateValue } from './editor_data';
import './index.css';

render(() => {
  const [data, setData] = createStore<{data: StateValue}>({
    data: {
      root: undefined,
    },
  });
  return <App state={{data, setData}} />;
}, document.getElementById('root') as HTMLElement);
