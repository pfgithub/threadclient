import {JSX} from "solid-js";
import {render} from "solid-js/web";
import browser from "webextension-polyfill";

function Popup(): JSX.Element {
    return <div>
        <button onClick={() => {
            void browser.runtime.openOptionsPage();
        }}>open options</button>
    </div>;
}

render(() => <Popup />, document.getElementById("main") ?? document.body);
