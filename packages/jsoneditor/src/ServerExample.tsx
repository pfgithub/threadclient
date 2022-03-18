import { io } from "socket.io-client";
import { createMemo, createSignal, JSX, onCleanup } from "solid-js";
import { Show } from "tmeta-util-solid";
import { AnRoot, collapseActions, FloatingAction, modifyActions } from "./app_data";
import { Button, Buttons } from "./components";

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

const act_sent = Symbol("act_sent");

const [serverConnections, setServerConnections] = createSignal(new Set<AnRoot>());
export default function ServerExample(props: {root: AnRoot}): JSX.Element {
    let owns = false;
    return createMemo((): JSX.Element => {
        if(!owns) {
            const cnxns = serverConnections();
            if(cnxns.has(props.root)) return <div>
                Cannot manage the same root twice. Close the other server connection first.
            </div>;
        }
        owns = true;
        setServerConnections(v => new Set(v).add(props.root));
        onCleanup(() => {
            setServerConnections(v => {
                const res = new Set(v);
                res.delete(props.root);
                return res;
            });
        });
        return <ServerMain root={props.root} />;
    });
}
function ServerMain(props: {root: AnRoot}): JSX.Element {
    const connection = io("http://localhost:3564/document-example");
    connection.connect();
    onCleanup(() => {
        connection.disconnect();
    });

    const [connected, setConnected] = createSignal(false);
    const [error, setError] = createSignal<null | Error>(null);
    const [reconnectState, setReconnectState] = createSignal(0);

    const intv = setInterval(() => {
        const client_actions = props.root.actions.filter(act => (
            act.from === "client" && !(act_sent in act)
        ));
        const collapsed = collapseActions(client_actions);
        for(const action of collapsed) {
            Object.defineProperty(action, act_sent, {});
        }
        modifyActions(props.root, {insert: collapsed, remove: client_actions.map(a => a.id)});
        if(client_actions.length > 0) {
            connection.emit("create actions", collapsed);
        }
        // ↑ socket.io will resend emits automatically until success; no need to
        //   resend ourselves
    }, 200);
    onCleanup(() => clearInterval(intv));

    connection.on("connect", () => {
        setConnected(true);
        console.log("socket connected");
    });
    connection.on("connect_error", e => {
        // console.log(e);
        setError(e);
    });
    connection.on("disconnect", () => {
        setConnected(false);
        console.log("socket disconnected");
    });

    connection.on("create actions", (d: FloatingAction[]) => {
        console.log("got data", d);
        modifyActions(props.root, {insert: d, remove: []});
    });

    connection.io.on("reconnect", () => {
        console.log("reconnect");
        setReconnectState(1);
    });
    connection.io.on("reconnect_attempt", () => {
        console.log("reconnect_attempt");
        setReconnectState(1);
    });
    connection.io.on("reconnect_error", () => {
        console.log("Reconnect_error");
        setReconnectState(2);
    });
    connection.io.on("reconnect_failed", () => {
        console.log("Reconnect_failed");
        setReconnectState(3);
    });

    return <Show if={connected()} fallback={<>
        {[
            "Connecting…",
            "Reconnecting…",
            "Reconnect errored. Retrying…",
            "Could not connect.",
        ][reconnectState()]}
        <Show when={error()}>{emsg => <div>
            Got error: {emsg.toString()}
            <Buttons><Button onClick={() => console.log(emsg)}>Log</Button></Buttons>
            <pre class="whitespace-pre-wrap"><code>{emsg.stack}</code></pre>
        </div>}</Show>
    </>}>
        {(() => {
            props.root.actions_signal[0]();
            const unsaved_count = props.root.actions.filter(v => v.from === "client").length;
            if(unsaved_count > 0) {
                return "Saving "+unsaved_count+" changes…";
            }
            return "✓ Saved";
        })()}
    </Show>;
}