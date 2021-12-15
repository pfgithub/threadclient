import {JSX} from "solid-js";
import {render} from "solid-js/web";
// import browser from "webextension-polyfill";

function Options(): JSX.Element {
    return <div class="m-4">
        <h1>Options</h1>
        <p>"options loaded (dev: "+__DEV__+")"</p>
        <h2>Chat Unread Indicators</h2>
        <p>
            [status indicator]
            [check button]
            [click here to activate chat unread indicators] (it goes to
            reddit.com/#chat-unread-indicators) and a script will be injected
            to say if it succeeded in getting the token or not. if it fails, it will
            ask you to sign in or submit an issue on github if it's not working.
        </p>
    </div>;
}

render(() => <Options />, document.getElementById("main") ?? document.body);
