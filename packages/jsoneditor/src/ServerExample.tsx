import { createSignal, JSX, onCleanup } from "solid-js";
import { io } from "socket.io-client";
import { Show } from "tmeta-util-solid";

// [!] batch actions by ~200ms before submitting to the server
//   - we can make a fn to batchActions(actions) that will merge any duplicate sets
//   - this is for playingcards and anything else that has fast input from users
// [!] we need more types of actions or we need some way to define special values within
//     reconcile
//   - eg say we have a counter with + and -. when two people click + at once, both adds
//     should be counted. this involves either making a special incrementNumber action or
//     using a special value like `{"@operation": "++", "default": 0}` that when the
//     server recieves it it uses to create an atomic number increment in the database
//   - eg like `{@operation: "date-now"}` and it will insert using the client's date
//     at first but then update to the server's date once the insert happens on the server

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