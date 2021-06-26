import { createSignal, JSX, Show, For } from "solid-js";
import { testHtmlToRichtext } from "../clients/reddit/html_to_richtext.spec";
export * from "../util/interop_solid";

export type TestState = {
    title: string,
    mode: "none" | "progress" | "done" | "error",
    text: string[],
};

function TestBatch(props: {title: string, execute: (cb: (update: TestState[]) => void) => Promise<void>}): JSX.Element {
    const [state, setState] = createSignal<TestState[] | undefined>(undefined);

    return <div>
        <h2>{props.title}</h2>
        <button onClick={() => {
            void props.execute(setState);
        }}>Run</button>
        <Show when={state()} fallback={<div>Not running.</div>}>{list => <>
            <div>
                Completed: {list.filter(itm => itm.mode === "done" || itm.mode === "error").length}/{list.length}.{" "}
                Errors: {list.filter(itm => itm.mode === "error").length}
            </div>
            <ul class="list-disc ml-10">
                <For each={list}>{item => <li>
                    <h3>{item.title}</h3>
                    <div>{item.mode}</div>
                    <pre><For each={item.text}>{line => <code class="block">{line}</code>}</For></pre>
                </li>}</For>
            </ul>
        </>}</Show>
    </div>;
}

export function Root(props: {_?: undefined}): JSX.Element {
    return <div>
        Automated Tests
        <TestBatch title="Reddit HTML to Richtext" execute={testHtmlToRichtext} />
    </div>;
}