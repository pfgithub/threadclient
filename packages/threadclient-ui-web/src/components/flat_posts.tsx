import type * as Generic from "api-types-generic";
import { Accessor, children as useChildren, createMemo, For, JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { CounterState } from "../app";
import { addAction } from "./action_tracker";
import { actAuto, getCounterState } from "./counter";
import { getCState } from "./flatten";
import { ClientPostOpts } from "./Post";

export type InfoBarItem = {
    value: ["percent" | "number" | "timeago" | "hidden" | "none", number],
    icon: Generic.Icon,
    color: null | Generic.Color,
    text: string,
    disabled?: undefined | boolean,
};

function InfoBarItemRaw(props: InfoBarItem): JSX.Element {
    return props as unknown as JSX.Element; // has getters so no need to memo it
    // oh that's annoying I want to do {...props, [symbol_is_infobar_item]: true}
    // can't because of the getters. I'd have to use solid spread() or use a proxy
}

function InfoBarItems(props: {post: Generic.PostContentPost}): JSX.Element {
    // TODO make the order user-configurable
    //     we should be able to make a
    //     <ConfigurableOrder>
    //         <ConfigurableOrderItem key="" title="">
    //     and then have configurableorder reorder its children automatically based
    //     on what you configure
    // [!] its children would be required to be static; no children() call for it, just
    //     an assertion that props.children is an array. this is because it needs to
    //     be able to know what all the things it even has to reorder are and that can't
    //     change.
    return <>
        <Show if={props.post.info?.pinned === true}>
            <InfoBarItemRaw
                icon="pinned"
                value={["none", -1000]}
                color="green"
                text="Pinned"
            />
        </Show>
        <Show when={props.post.actions?.vote}>{voteact => {
            const [stateR] = getCounterState(() => voteact);
            // const state = stateR();
            const ptCount = () => stateR().pt_count;
            return <>
                <InfoBarItemRaw {...(() => {
                    const pt_count = ptCount();
                    const state = stateR();
                    return {
                        value: pt_count === "hidden"
                        ? ["hidden", -1000] : pt_count === "none" ? ["none", -1000]
                        : ["number", pt_count + ({
                            increment: 1,
                            decrement: -1,
                            none: 0,
                        } as const)[state.your_vote ?? "none"]],
                        icon: ({
                            none: voteact.neutral_icon ?? voteact.increment.icon,
                            increment: voteact.increment.icon,
                            decrement: voteact.decrement?.icon ?? voteact.increment.icon,
                        } as const)[state.your_vote ?? "none"],
                        color: ({
                            none: null,
                            increment: voteact.increment.color,
                            decrement: voteact.decrement?.color ?? voteact.increment.color,
                        } as const)[state.your_vote ?? "none"],
                        text: "Points",
                        disabled: state.loading,
                    };
                })()} />
                <Show when={voteact.percent}>{percent => (
                    <InfoBarItemRaw
                        icon="controversiality"
                        value={["percent", percent]}
                        color={null}
                        text="Controversiality"
                    />
                )}</Show>
            </>;
        }}</Show>
        <Show when={props.post.info?.comments}>{comments => (
            <InfoBarItemRaw
                icon="comments"
                value={["number", comments]}
                color={null}
                text="Comments"
            />
        )}</Show>
        <Show when={props.post.info?.creation_date}>{creation_date => (
            <InfoBarItemRaw
                icon="creation_time"
                value={["timeago", creation_date]}
                color={null}
                text="Posted"
            />
        )}</Show>
        <Show when={props.post.info?.edited}>{edited => (
            <InfoBarItemRaw
                icon="edit_time"
                value={edited.date == null ? ["none", -1000] : ["timeago", edited.date]}
                color={null}
                text="Edited"
            />
        )}</Show>
    </>;
}

// v to make this even better we could handle adding a proxy with a unique symbol
// ourselves and give you the guard function and child element function. this is good
// enough for now though
function useTypesafeChildren<T extends {[key: string]: unknown}>(
    rawChildrenAccessor: Accessor<JSX.Element>, guard: (v: unknown) => v is T,
): Accessor<T[]> {
    const children = useChildren(rawChildrenAccessor);
    return createMemo((): T[] => {
        let cv = children();
        if(!Array.isArray(cv)) {
            cv = [cv];
        }
        return cv.filter(itm => itm).map((v): T => {
            if(!guard(v)) throw new Error("invalid typesafechildren child item");
            return v;
        });
    });
}

export function useInfoBar(post: () => Generic.PostContentPost): () => InfoBarItem[] {
    return useTypesafeChildren(() => <InfoBarItems post={post()} />, (v): v is InfoBarItem => {
        return true;
    });
}

export type ActionItem = {
    icon: Generic.Icon,
    color: null | Generic.Color,
    text: string,
    // disabled: boolean,

    // onClick will be a link | a thing that makes a CancellableAction
    onClick: "disabled" | {url: string} | (() => void),
    client_id: string,
};

function CounterAction(props: {
    action: Generic.CounterAction,
    state: CounterState,
    setState: (nv: CounterState) => void,
    direction: "increment" | "decrement",
    client_id: string,
}): JSX.Element {
    return <ActionItemRaw {...((): ActionItem => {
        const {action, state, setState, direction, client_id} = props;
        const your_vote = state.your_vote;
        return {
            icon: action[direction]!.icon,
            color: your_vote === direction ?
            action[direction]!.color : null,
            text: your_vote === direction ?
            action[direction]!.undo_label : action[direction]!.label,
            onClick: state.loading ? "disabled" : () => {
                void addAction(actAuto(
                    your_vote === direction ? undefined : direction,
                    state,
                    setState,
                    action,
                ));
            },
    
            client_id: client_id,
        };
    })()} />;
}

function GetActionsFromAction(props: {action: Generic.Action, opts: ClientPostOpts}): JSX.Element {
    return <SwitchKind item={props.action} fallback={v => <>
        <ActionItemRaw
            icon="code"
            color={null} // grayed out maybe
            text={"TODO "+v.kind}
            onClick="disabled"

            client_id="*UNUSED*"
        />
    </>}>{{
        counter: voteact => {
            const [getState, setState] = getCounterState(() => voteact);
            return <>
                <CounterAction {...{
                    action: voteact,
                    state: getState(),
                    setState,
                    direction: "increment",
                    client_id: props.opts.client_id,
                }} />
                <Show if={voteact.decrement != null}>
                    <CounterAction {...{
                        action: voteact,
                        state: getState(),
                        setState,
                        direction: "decrement",
                        client_id: props.opts.client_id,
                    }} />
                </Show>
            </>;
        },
    }}</SwitchKind>;
}

function ActionItemRaw(props: ActionItem): JSX.Element {
    return props as unknown as JSX.Element;
}

function ActionBarItems(props: {
    post: Generic.PostContentPost,
    opts: ClientPostOpts,
}): JSX.Element {
    return <>
        {/* now I want a <Show whenAll={{a, b, c}}>{(props) => } */}
        {props.opts.collapse_data && props.opts.id && props.post.collapsible !== false && !props.opts.is_pivot ? <>
            <ActionItemRaw {...((): ActionItem => {
                const cs = getCState(props.opts.collapse_data, props.opts.id);
                const collapsed = cs.collapsed();
                return {
                    icon: collapsed ? "chevron_down" : "chevron_up",
                    color: null,
                    text: collapsed ? "Uncollapse" : "Collapse",
                    onClick: () => cs.setCollapsed(v => !v),

                    client_id: props.opts.client_id,
                };
            })()}/>
        </> : null}

        {props.opts.frame?.url != null ? <>
            <ActionItemRaw
                icon="link"
                color={null}
                text={props.post.info?.comments != null ? (
                    props.post.info.comments.toLocaleString() + " comment"+(
                        props.post.info.comments === 1 ? "" : "s"
                    )
                ) : (
                    "Comments"
                )}
                onClick={{url: props.opts.frame.url}}

                client_id={props.opts.client_id}
            />
        </> : null}

        <Show when={props.post.actions?.vote}>{voteact => (
            <GetActionsFromAction action={voteact} opts={props.opts} />
        )}</Show>

        <Show when={props.opts.frame?.replies?.reply}>{reply => (
            <ActionItemRaw
                icon="reply"
                color={null}
                text="Reply"
                onClick={() => alert("TODO")}

                client_id={props.opts.client_id}
                // wait a sec can't I just make the useActionBar call
                // add client id automatically
            />
        )}</Show>

        <For each={props.post.actions?.other ?? []}>{action => (
            <GetActionsFromAction action={action} opts={props.opts} />
        )}</For>

        <Show when={props.post.actions?.code} fallback={(
            <ActionItemRaw
                icon="code"
                color={null}
                text="Code"
                onClick={() => {
                    console.log(props.post, props.opts);
                }}

                client_id={props.opts.client_id}
            />
        )}>{codeact => (
            <GetActionsFromAction action={codeact} opts={props.opts} />
        )}</Show>
    </>;
}

export function useActions(post: () => Generic.PostContentPost, opts: () => ClientPostOpts): () => ActionItem[] {
    return useTypesafeChildren(() => <ActionBarItems post={post()} opts={opts()} />, (v): v is ActionItem => {
        return true;
    });
}
