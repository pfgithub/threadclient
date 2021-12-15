import {JSX} from "solid-js";
import {render} from "solid-js/web";
import browser from "webextension-polyfill";

function Popup(): JSX.Element {
    return <div>
        <button onClick={() => {
            void browser.runtime.openOptionsPage();
        }}>open options</button>
        <a href="error" target="_blank" rel="noopener">
            [if page == reddit]Open in ThreadClient,
            [if page == threadclient]Open in Reddit,
        </a>
    </div>;
}

render(() => <Popup />, document.getElementById("main") ?? document.body);
