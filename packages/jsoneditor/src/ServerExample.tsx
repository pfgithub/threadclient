import { createSignal, JSX, onCleanup } from "solid-js";
import { io } from "socket.io-client";
import { Show } from "tmeta-util-solid";

// ok we get to pick:
// should we recieve:
// - all events related to a document
// or:
// - only events related to anything we subscribe to

// choices:
// - all events means that the app won't work as well with large documents but
//   significantly simplifies stuff
// - only events we subscribe to is nice but i think it makes the reconcile() function
//   in app_data harder
//   - oh this would be really slow wouldn't it. we'd ask for keys and then based on
//     the result ask for more data and then it would end up not being very good
//
// ok so thinking about all events:
// - change everything into an action. so when you reconcile, it appends a batch of
//   actions to the action list
// - when we recieve an event from the server, we apply the action
//
// - ok so I'm going to reorganize app_data around actions and then we can start
//   working with the server probably

export default function ServerExample(): JSX.Element {
    const connection = io("http://localhost:3564/document-example")
    connection.connect();
    onCleanup(() => {
        connection.disconnect();
    });

    const [connected, setConnected] = createSignal(false);
    const [error, setError] = createSignal<any>(null);

    connection.on("connect", () => {
        setConnected(true);
        console.log("socket connected", connection);
    });
    connection.on("connect_error", () => {
        setError("errored");
    });
    connection.on("disconnect", () => {
        setConnected(false);
        console.log("socket disconnected", connection);
    });

    connection.on("data", () => {

    });

    return <Show if={connected()} fallback={<>
        Connecting…
        <Show when={error()}>{emsg => <div>
            Got error: {emsg}
        </div>}</Show>
    </>}>
        Connected.
    </Show>;
}