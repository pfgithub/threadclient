import { createSignal, ErrorBoundary, JSX } from "solid-js";
import { render } from "solid-js/web";
import "windi.css";
import { ShowBool } from "../../tmeta-util-solid/src/control_flow_solid";
import AnimatorState from "./animator_state";

function DefaultErrorBoundary(props: {data: unknown, children: JSX.Element}): JSX.Element {
    const [showContent, setShowContent] = createSignal(true);
    return <ErrorBoundary fallback={(err: unknown, reset) => {
        console.log(err);
        return <div class={"overflow-y-scroll h-full p-4"}>
            <pre class="whitespace-pre-wrap"><code textContent={err instanceof Error ? (
                err.toString() + "\n\n" + err.stack ?? "*no stack*"
            ) : "Something went wrong"} /></pre>
            <button
                class={"border px-2"}
                onClick={() => console.log(err, props.data)}
            >Code</button>{" / "}
            <button
                class={"border px-2"}
                onClick={() => {
                    setShowContent(false);
                    setTimeout(() => setShowContent(true), 200);
                    reset();
                }}
            >Retry</button>
        </div>;
    }}>
        <ShowBool when={showContent()} fallback={
            <>Retrying...</>
        }>
            {props.children}
        </ShowBool>
    </ErrorBoundary>;
}

render(() => <DefaultErrorBoundary data={0}><AnimatorState /></DefaultErrorBoundary>, document.getElementById("app")!);