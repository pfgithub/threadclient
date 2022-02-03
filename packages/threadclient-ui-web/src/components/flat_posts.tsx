import type * as Generic from "api-types-generic";
import { getCounterState } from "./counter";
import { ClientPostOpts } from "./Post";

export type InfoBarItem = {
    value: ["percent" | "number" | "timeago" | "hidden" | "none", number],
    icon: Generic.Icon,
    color: null | Generic.Color,
    text: string,
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
        // TODO support other types of voting
        // eg: mastodon will be star/unstar so we should use a star icon
        // and yellow color
        // the vote thing should have a way to specify:
        // increment_icon, increment_color, decrement_icon, decrement_color
        const [stateR] = getCounterState(() => post.actions!.vote!);
        const state = stateR();
        const pt_count = state.pt_count;
        res.push({
            value: pt_count === "hidden"
            ? ["hidden", -1000] : pt_count === "none" ? ["none", -1000]
            : ["number", pt_count],
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
    onClick: "TODO" | {url: string} | (() => void),
};

export function getActionsFromAction(action: Generic.Action, opts: ClientPostOpts): ActionItem[] {
    const actions: ActionItem[] = [];

    if(action.kind === "counter") {
        const [stateR] = getCounterState(() => action);
        const state = stateR();
        const your_vote = state.your_vote;

        actions.push({
            icon: action.increment.icon,
            color: your_vote === "increment" ?
            action.increment.color : null,
            text: your_vote === "increment" ?
            action.increment.undo_label : action.increment.label,
            onClick: "TODO",
        });
        if(action.decrement) {
            actions.push({
                icon: action.decrement.icon,
                color: your_vote === "decrement" ?
                action.decrement.color : null,
                text: your_vote === "decrement" ?
                action.decrement.undo_label : action.decrement.label,
                onClick: "TODO",
            });
        }
    }else{
        // assertNever(action);
    }

    return actions;
}

export function getActions(post: Generic.PostContentPost, opts: ClientPostOpts): ActionItem[] {
    const actions: ActionItem[] = [];

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
            onClick: "TODO",
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
        });
    }

    return actions;
}