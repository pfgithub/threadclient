import type * as Generic from "api-types-generic";
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

export function getInfoBar(post: Generic.PostContentPost): InfoBarItem[] {
    const res: InfoBarItem[] = [];

    // TODO make the order user-configurable

    if(post.info?.pinned === true) {
        res.push({
            icon: "pinned",
            value: ["none", -1000],
            color: "green",
            text: "Pinned",
        });
    }
    if(post.actions?.vote) {
        const voteact = post.actions.vote;
        const [stateR] = getCounterState(() => post.actions!.vote!);
        const state = stateR();
        const pt_count = state.pt_count;
        res.push({
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
        });
        if(post.actions.vote.percent != null) {
            res.push({
                icon: "controversiality",
                value: ["percent", post.actions.vote.percent],
                color: null,
                text: "Controversiality",
            });
        }
    }
    if(post.info?.comments != null) {
        res.push({
            icon: "comments",
            value: ["number", post.info.comments],
            color: null,
            text: "Comments",
        });
    }
    if(post.info?.creation_date != null) {
        res.push({
            icon: "creation_time",
            value: ["timeago", post.info.creation_date],
            color: null,
            text: "Posted",
        });
    }
    if(post.info?.edited) {
        res.push({
            icon: "edit_time",
            value: post.info.edited.date == null ? ["none", -1000] :
            ["timeago", post.info.edited.date],
            color: null,
            text: "Edited",
        });
    }

    // if(getSettings().dev_mode ==)
    // res.push({
    //     icon: "code",
    //     value: ["number", Date.now() % 999],
    //     color: null,
    //     text: "Random",
    // })

    return res;
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

function counterAction(
    action: Generic.CounterAction,
    [state, setState]: [CounterState, (nv: CounterState) => void],
    direction: "increment" | "decrement",
    client_id: string,
): ActionItem {
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
}

export function getActionsFromAction(action: Generic.Action, opts: ClientPostOpts): ActionItem[] {
    const actions: ActionItem[] = [];

    if(action.kind === "counter") {
        const [getState, setState] = getCounterState(() => action);
        const state = getState();

        actions.push(counterAction(action, [state, setState], "increment", opts.client_id));
        if(action.decrement) {
            actions.push(counterAction(action, [state, setState], "decrement", opts.client_id));
        }
    }else{
        // assertNever(action);
    }

    return actions;
}

export function getActions(post: Generic.PostContentPost, opts: ClientPostOpts): ActionItem[] {
    const actions: ActionItem[] = [];

    if(opts.collapse_data && opts.id && post.collapsible !== false && !opts.is_pivot) {
        const cs = getCState(opts.collapse_data, opts.id);
        const collapsed = cs.collapsed();
        actions.push({
            icon: collapsed ? "chevron_down" : "chevron_up",
            color: null,
            text: collapsed ? "Uncollapse" : "Collapse",
            onClick: () => cs.setCollapsed(v => !v),

            client_id: opts.client_id
        });
    }

    if(opts.frame?.url != null) {
        actions.push({
            icon: "link",
            color: null,
            text: post.info?.comments != null ? (
                post.info.comments.toLocaleString() + " comment"+(
                    post.info.comments === 1 ? "" : "s"
                )
            ) : (
                "Comments"
            ),
            onClick: {url: opts.frame.url},

            client_id: opts.client_id,
        });
    }

    if(post.actions?.vote) {
        actions.push(...getActionsFromAction(post.actions.vote, opts));
    }

    if(opts.frame?.replies?.reply) {
        // if=props.content.show_replies_when_below_pivot && !props.opts.at_or_above_pivot
        // ?
        actions.push({
            icon: "reply",
            color: null,
            text: "Reply",
            onClick: () => alert("TODO"),

            client_id: opts.client_id,
        });
    }

    for(const action of post.actions?.other ?? []) {
        actions.push(...getActionsFromAction(action, opts));
    }

    if(post.actions?.code) {
        actions.push(...getActionsFromAction(post.actions.code, opts));
    }else{
        actions.push({
            icon: "code",
            color: null,
            text: "Code",
            onClick: () => {
                console.log(post, opts);
            },

            client_id: opts.client_id,
        });
    }

    return actions;
}
