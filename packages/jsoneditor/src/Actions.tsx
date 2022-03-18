import { createEffect, createMemo, createSignal, For, JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { Action, ActionPath, AnRoot, applyActionToSnapshot, collapseActions } from "./app_data";
import { Button, Buttons } from "./components";
import History from "./History";

function PathRender(props: {path: ActionPath}): JSX.Element {
    const [hovering, setHovering] = createSignal(false);
    return <div
        class="flex font-mono text-xs"
        onMouseEnter={e => e.target === e.currentTarget && setHovering(true)}
        onMouseLeave={e => e.target === e.currentTarget && setHovering(false)}
        title={"/"+props.path.join("/")}
    >
        <span class={
            "truncate text-ellipsis overflow-x-scroll break-all text-gray-400"
        } dir="rtl"><span dir="ltr">
            <For each={props.path.filter((__, i, a) => i !== a.length - 1)}>{ntry => (
                <>
                    <span class="inline-block overflow-hidden text-gray-500">/</span>
                    <span class="inline-block overflow-hidden">{ntry.substring(0, 1)}</span>
                    <span
                        class="inline-block overflow-hidden"
                        style={{
                            'text-overflow': "clip",
                            'transition': "0.2s width",
                        }}
                        ref={el => {
                            createEffect((prev) => {
                                if(hovering()) {
                                    el.style.width = "";
                                    const rect = el.getBoundingClientRect();
                                    el.style.width = "0px";
                                    el.offsetHeight;
                                    el.style.width = rect.width+"px";
                                }else{
                                    el.style.width = "0px";
                                }
                            });
                        }}
                    >{ntry.substring(1)}</span>
                </>
            )}</For>
        </span></span>
        <span>
            <span class="text-gray-300">/</span>
            <span>{props.path[props.path.length - 1]}</span>
        </span>
    </div>;
}

function Act(props: {action: Action}): JSX.Element {
    return <div class="bg-gray-900 p-2 rounded-md flex flex-col gap-2">
        <div
            class="flex flex-wrap bg-black rounded-md -m-2 mb-0 p-2 text-xs"
        >
            <span>{props.action.value.kind} · {props.action.from}</span>
            <span class="flex-1" />
            <span class="font-mono">{props.action.parent_updated}</span>
        </div>
        <SwitchKind item={props.action.value} fallback={v => <>
            <pre class="whitespace-pre-wrap"><code>
                {JSON.stringify(v, null, " ")}
            </code></pre>
        </>}>{{
            reorder_keys: (rok) => <>
                <pre class="whitespace-pre-wrap"><code>
                    {JSON.stringify(rok.new_keys, null, " ")}
                </code></pre>
                <PathRender path={rok.path} />
            </>,
            set_value: (sv) => <>
                <pre class="whitespace-pre-wrap"><code>
                    {JSON.stringify(sv.new_value, null, " ")}
                </code></pre>
                <PathRender path={sv.path} />
            </>,
        }}</SwitchKind>
    </div>;
}

export default function Actions(props: {
    root: AnRoot,
}): JSX.Element {
    const actions = createMemo(() => {
        props.root.actions_signal[0]();
        return props.root.actions;
    });
    const max_actions = 30;
    return <div class="space-y-2">
        <div>
            <History root={props.root} />
        </div>
        <div>
            <Show when={props.root.performance[0]()}>{perf => <>
                Applied {perf.applied_count} actions in {perf.time}ms.
            </>}</Show>
        </div>
        <div>
            {actions().length.toLocaleString()} actions
            <Buttons>
                <Button onClick={() => {
                    const collapsed = collapseActions(props.root.actions);
                    let recreated = undefined;
                    for(const action of collapsed) recreated = applyActionToSnapshot(action, recreated);
                    const ov = JSON.stringify(props.root.snapshot);
                    const nv = JSON.stringify(recreated);
                    alert("Collapsed to "+collapsed.length+" actions. Identical: "+(ov === nv));
                    if(ov !== nv) {
                        console.log("ov", props.root.snapshot, "nv", recreated);
                    }
                }}>Try collapse</Button>
            </Buttons>
        </div>
        <For each={[...actions()].reverse().splice(0, max_actions)}>{action => <Act action={action} />}</For>
        <Show if={actions().length > max_actions}><div>
            … and {actions().length - max_actions} more.
        </div></Show>
    </div>;
}