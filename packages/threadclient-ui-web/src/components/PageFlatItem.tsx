import {
    createSignal,
    For,
    JSX
} from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { getClientCached } from "../app";
import {
    classes, getWholePageRootContext, size_lt, ToggleColor
} from "../util/utils_solid";
import { addAction } from "./action_tracker";
import { CollapseButton } from "./CollapseButton";
import { CollapseData, FlatItem, getCState } from "./flatten";
import { ClientContentAny } from "./page2";

const rainbow = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
];
function getRainbow(n: number): string {
    // this should be @mod not @rem
    // doesn't matter though, n should never be less than 0
    return rainbow[n % rainbow.length]!;
}

export default function PageFlatItem(props: {item: FlatItem, collapse_data: CollapseData}): JSX.Element {
    return <SwitchKind item={props.item}>{{
        wrapper_start: () => <ToggleColor>{color => <div class={""
            + " " + color
            + " h-2 sm:rounded-xl mt-4"
        } style="border-bottom-left-radius: 0; border-bottom-right-radius: 0" />}</ToggleColor>,
        wrapper_end: () => <ToggleColor>{color => <div class={""
            + " " + color
            + " h-2 sm:rounded-xl mb-4"
        } style="border-top-left-radius: 0; border-top-right-radius: 0" />}</ToggleColor>,
        post: loader_or_post => <ToggleColor>{color => <div class={"px-2 "+color}>
            <Show if={size_lt.sm() && !loader_or_post.first_in_wrapper}>
                {/* I forgot - why is this duplicated and in different places for loaders vs for posts? */}
                {/* feels like it should be the same for both and there was some weird reason it couldn't be */}
                <div class="pt-2" />
            </Show>
            <div class="flex flex-row">
                <Show if={!size_lt.sm()} fallback={(
                    <Show if={loader_or_post.indent.length > 0}><div
                        style={{
                            'margin-left': ((loader_or_post.indent.length - 3) * 0.25)+"rem",
                        }}
                        class={classes(
                            "w-1",
                            "mr-2",
                            "pl-0.5",
                        )}
                    >
                        <div class={classes(
                            "w-full h-full",
                            getRainbow(loader_or_post.indent.length - 1),
                            "rounded-md",
                        )}></div>
                    </div></Show>
                )}>
                    <For each={loader_or_post.indent}>{indent => <>
                        <CollapseButton
                            collapsed_raw={false}
                            collapsed_anim={false}
                            onClick={() => {
                                const cs = getCState(props.collapse_data, indent.id);
                                cs.setCollapsed(v => !v);
                            }}
                            real={false}
                            cstates={props.collapse_data}
                            threaded={indent.threaded}
                            id={indent.id}
                        />
                    </>}</For>
                </Show>
                <div class="flex-1"><Show if={!size_lt.sm() && !loader_or_post.first_in_wrapper}>
                    <div class="pt-2" />
                </Show><SwitchKind item={loader_or_post.content}>{{
                    post: post => <>
                        <ClientContentAny
                            content={post.content}
                            opts={{
                                clickable: false, // TODO
                                frame: post,
                                client_id: post.client_id,
                                replies: post.replies,
                                at_or_above_pivot: loader_or_post.at_or_above_pivot,
                                is_pivot: loader_or_post.is_pivot,
                                collapse_data: props.collapse_data,
                                id: loader_or_post.id,
                            }}
                        />
                    </>,
                    loader: loader => {
                        const [loading, setLoading] = createSignal(false);
                        const [error, setError] = createSignal<null | string>(null);
                        const hprc = getWholePageRootContext();
                        return <div class="py-1"><button
                            class="text-blue-500 hover:underline"
                            disabled={loading()}
                            onClick={() => {
                                setLoading(true);
                                
                                addAction(
                                    getClientCached(loader.client_id)!.loader!(loader_or_post.id, loader),
                                ).then(r => {
                                    setLoading(false);
                                    setError(null);
                                    console.log("adding content", r.content, loader_or_post);
                                    hprc.addContent(r.content);
                                }).catch(er => {
                                    setLoading(false);
                                    const e = er as unknown as Error;
                                    console.log(e);
                                    setError(e.toString());
                                });
                            }}
                        >{
                            loading()
                            ? "Loading…"
                            : (error() != null ? "Retry Load" : "Load More")
                            + (loader.load_count != null ? " ("+loader.load_count+")" : "")
                        }</button><Show when={error()}>{err => (
                            <p class="text-red-600 dark:text-red-500">
                                Error loading; {err}
                            </p>
                        )}</Show></div>;
                    },
                }}</SwitchKind></div>
            </div>
        </div>}</ToggleColor>,
        horizontal_line: () => <hr
            class="my-2 border-t-2"
            style={{'border-top-color': "var(--collapse-line-color)"}}
        />,
        todo: todo => <div>TODO: {todo.note} <button onclick={() => console.log(todo.data)}>code</button></div>,
        error: error => <div class="text-red-500">
            Error: {error.note} <button onclick={() => console.log(error.data)}>code</button>
        </div>,
    }}</SwitchKind>;
}