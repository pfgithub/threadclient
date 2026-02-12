import { createSignal, ErrorBoundary, JSX } from "solid-js";
import { Show } from "../../tmeta-util-solid/src/control_flow_solid";

export function DefaultErrorBoundary(props: {data: unknown, children: JSX.Element}): JSX.Element {
    const [showContent, setShowContent] = createSignal(true);
    return <ErrorBoundary fallback={(err: unknown, reset) => {
        console.log(err);
        return <div class={"min-h-full p-4 bg-red-900 text-white"}>
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
            <pre class="whitespace-pre-wrap"><code textContent={err instanceof Error ? (
                err.toString() + "\n\n" + (err.stack ?? "*no stack*")
            ) : "Something went wrong"} /></pre>
        </div>;
    }}>
        <Show if={showContent()} fallback={
            <>Retrying...</>
        }>
            {props.children}
        </Show>
    </ErrorBoundary>;
}