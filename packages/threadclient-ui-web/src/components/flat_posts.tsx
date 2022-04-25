import type * as Generic from "api-types-generic";
import { For, JSX } from "solid-js";
import { createTypesafeChildren, Show, SwitchKind } from "tmeta-util-solid";
import { CounterState } from "../app";
import { addAction } from "./action_tracker";
import { actAuto, getCounterState } from "./counter";
import { getCState, postContentCollapseInfo } from "./flatten";
import { ClientPostOpts } from "./Post";

export type InfoBarItem = {
    value: ["percent" | "number" | "timeago" | "hidden" | "none", number],
    icon: Generic.Icon,
    color: null | Generic.Color,
    text: string,
    disabled?: undefined | boolean,
};

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

const InfoBarItemRaw = createTypesafeChildren<InfoBarItem>();

export function useInfoBar(post: () => Generic.PostContentPost): () => InfoBarItem[] {
    return InfoBarItemRaw.useChildren(() => <InfoBarItems post={post()} />);
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

function ActionBarItems(props: {
    post: Generic.PostContentPost,
    opts: ClientPostOpts,
}): JSX.Element {
    return <>
        {/* now I want a <Show whenAll={{a, b, c}}>{(props) => } */}
        {props.opts.collapse_data && props.opts.flat_frame != null && (
            postContentCollapseInfo(props.post, props.opts.flat_frame).user_controllable
            // TODO: dispatch this event to the post - eg a post may not have collapse data but still
            // have a collapse button and we need to tell it to collapse then
        ) && !props.opts.flat_frame.is_pivot ? <>
            <ActionItemRaw {...((): ActionItem => {
                const cs = getCState(props.opts.collapse_data, props.opts.flat_frame.collapse!.id);
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

        <Show when={props.post.actions?.code}>{codeact => (
            <GetActionsFromAction action={codeact} opts={props.opts} />
        )}</Show>
    </>;
}

const ActionItemRaw = createTypesafeChildren<ActionItem>();

export function useActions(post: () => Generic.PostContentPost, opts: () => ClientPostOpts): () => ActionItem[] {
    return ActionItemRaw.useChildren(() => <ActionBarItems post={post()} opts={opts()} />);
}

// TODO let's generate the thumbnail based on the body or something
// also eg for text instead of having a big image with a small text icon in the corner,
// have a big text icon with a small image in the corner
export type ThumbnailPreview = {
    kind: "icon",
    icon: "text" | "video" | "link" | "other",
} | {
    // for video we could do eg 3:56 like gallery is
    kind: "gallery",
    count: number,
} | null;
export function getThumbnailPreview(body: Generic.Body): ThumbnailPreview {
    if(body.kind === "array") {
        const actual_items = body.body.filter(v => v && v.kind !== "none");
        const ai0 = actual_items[0];
        if(ai0 != null) return getThumbnailPreview(ai0);
        return null;
    }
    if(body.kind === "text" || body.kind === "richtext") {
        return {kind: "icon", icon: "text"};
    } else if(body.kind === "captioned_image") {
        return null;
    } else if(body.kind === "none") {
        return null;
    } else if(body.kind === "video") {
        return {kind: "icon", icon: "video"};
    } else if(body.kind === "gallery") {
        return {kind: "gallery", count: body.images.length};
    } else if(body.kind === "link") {
        return {kind: "icon", icon: "link"};
    } else return {
        kind: "icon",
        icon: "other",
    };
}