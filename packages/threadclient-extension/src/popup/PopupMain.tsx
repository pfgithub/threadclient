import {JSX} from "solid-js";
import {render} from "solid-js/web";
import { resolveThreadClientSupportedURL } from "tmeta-util";
import { Show } from "tmeta-util-solid";
import browser from "webextension-polyfill";

function Popup(props: {tab?: browser.Tabs.Tab}): JSX.Element {
    const supported = resolveThreadClientSupportedURL(props.tab?.url ?? "");
    return <div>
        <Show if={supported != null} fallback={<>
            <a href={`https://thread.pfg.pw/#shell/find-threads?u=${encodeURIComponent(props.tab?.url ?? "")}`}>
                Search for Threads
            </a>
        </>}>
            <a href={`https://thread.pfg.pw/#${props.tab?.url}`}>
                Open in ThreadClient
            </a>
        </Show>
        <button onClick={() => {
            void browser.runtime.openOptionsPage();
            window.close();
        }}>Options</button>
    </div>;
}

browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
    render(() => <Popup tab={tabs[0]} />, document.getElementById("main") ?? document.body);
}).catch(e => {
    console.error(e);
    document.body.appendChild(document.createTextNode(e.toString()));
});
