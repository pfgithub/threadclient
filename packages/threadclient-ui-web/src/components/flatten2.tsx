import * as Generic from "api-types-generic";
import { createMemo, For, JSX, useContext } from "solid-js";
import { updateQuery } from "threadclient-client-reddit";
import { createTypesafeChildren, Show } from "tmeta-util-solid";
import { allow_threading_override_ctx, collapse_data_context, getWholePageRootContext } from "../util/utils_solid";
import { CollapseButton, FlatItem, FlatPage2, FlatTreeItem, loaderToFlatLoader, RenderPostOpts, renderTreeItem, unwrapPost } from "./flatten";

const FlatReplyTsch = createTypesafeChildren<FlatTreeItem>();

function FlatRepliesHL(props: {
    replies: Generic.HorizontalLoader,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    return createMemo(() => {
        const val = Generic.readLink(hprc.content(), props.replies.key);
        if(val == null) {
            return FlatReplyTsch(loaderToFlatLoader(props.replies));
        }
        if(val.error != null) {
            return <FlatReplyTsch kind="error" msg={val.error} />;
        }
        return <For each={val.value ?? []}>{reply => createMemo(() => {
            if(typeof reply === "object") return <FlatRepliesHL replies={reply} />;
            const readlink = Generic.readLink(hprc.content(), reply);
            if(readlink == null) {
                return <FlatReplyTsch kind="error" msg={"e-link-bad: "+reply.toString()} />;
            }else if(readlink.error != null) {
                return <FlatReplyTsch kind="error" msg={readlink.error} />;
            }else{
                const rpli = readlink.value;
                if(rpli.kind === "tabbed") throw new Error("TODO support tabbed");
                return <FlatReplyTsch
                    kind="flat_post"
                    post={rpli}
                    link={reply}
                />;
            }
        })}</For>;
    });
}
function FlatReplies(props: {
    replies: Generic.PostReplies | null,
}): JSX.Element {
    return <>
        {props.replies != null ? <FlatRepliesHL replies={props.replies.loader} /> : null}
    </>;
}

const FlatItemTsch = createTypesafeChildren<FlatItem>();

function usePostReplies(replies: () => Generic.PostReplies | null): () => FlatTreeItem[] {
    return FlatReplyTsch.useChildren(() => <FlatReplies replies={replies()} />);
}

function FITodo(props: {msg: string, obj: unknown}): JSX.Element {
    return <FlatItemTsch
        kind="todo"
        note={props.msg}
        data={props.obj}
    />;
}

export function FlattenTreeItem(props: {
    tree_item: FlatTreeItem,
    parent_indent: CollapseButton[],
    rpo: RenderPostOpts,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    const cpsd = useContext(collapse_data_context)!;
    const allow_threading = useContext(allow_threading_override_ctx) ?? true;
    return createMemo(() => {
        // [!] TODO: this will needlessly rerender when the parent indent changes
        // or when any renderpostopts change
        // - should be a pretty simple fix by reimplementing renderTreeItem to have
        // some values be getters
        const rres = renderTreeItem(
            props.tree_item,
            props.parent_indent,
            {content: hprc.content(), collapse_data: cpsd},
            props.rpo,
        );

        if(props.tree_item.kind !== "flat_post") {
            return FlatItemTsch(rres);
        }

        const post = unwrapPost(props.tree_item.post);
        if(post.kind === "tabbed") throw new Error("TODO support tabbed");

        const indent_excl_self = rres.indent.map(v => v.threaded ? {...v, threaded: false} : v);
        const indent_incl_self: CollapseButton[] = [...indent_excl_self, ...rres.collapse ? [rres.collapse] : []];
        
        const maybe_show_replies = props.rpo.displayed_in === "tree";
        if(!maybe_show_replies) return FlatItemTsch(rres);
    
        const replies0 = usePostReplies(() => post.replies);
        const replies = createMemo(() => replies0());
        const replies_threaded = ((): boolean => {
            if(!allow_threading) return false;
            if(replies.length !== 1) return false;

            const rpo = props.rpo;

            // v here we wish we could return true. there's one reply, so we should thread right?
            //    unfortunately, we also need to check if that reply has one reply too so we don't
            //    mark something as threaded that immediately unthreads next comment.
            //
            // | comment one
            // ⤷ comment two
            // | | comment three
            // | | comment four
            // that's what we don't want happening.
            //
            // this could maybe be improved by doing threading in a second pass.

            // ok wait a second i'm missing something still
            // can't we tell comment two that the parent 'allows threading' and then only thread it if
            // it has one reply?
            // - no, because if something is threaded it needs to know in the 'renderTreeItem' call but we
            //   won't be able to tell it until this if statement down here

            if(rpo.threaded) return true;
            const rply0 = replies()[0]!;
            if(rply0.kind !== "flat_post") return false;
            // oh my… this is uuh
            // not ideal
            const rply0rplies = usePostReplies(() => rply0.post.replies)();
            if(rply0rplies.length !== 1) return false;
            return true;
        })();
        const show_replies = ((): boolean => {
            if(replies_threaded && props.rpo.threaded) return true;
            if(!(rres.collapse?.collapsed ?? false)) return true;
            return false;
        })();
        if(!show_replies) return FlatItemTsch(rres);
        return <>
            {FlatItemTsch(rres)}
            <For each={replies()}>{reply => (
                <FlattenTreeItem
                    tree_item={reply}
                    parent_indent={props.rpo.threaded && replies_threaded ? indent_excl_self : indent_incl_self}
                    rpo={{
                        is_pivot: false,
                        at_or_above_pivot: false,
                        first_in_wrapper: false,
                        threaded: replies_threaded,
                        get depth() {return props.rpo.depth + 1},
                        displayed_in: post.replies!.display,
                    }}
                />
            )}</For>
        </>;
    });
}

function FlattenTopLevelReplies(props: {
    replies: Generic.PostReplies | null,
}): JSX.Element {
    const replies = usePostReplies(() => props.replies);
    return <>
         <Show if={props.replies?.reply != null}>
            <FITodo msg="(add reply)" obj={props.replies} />
         </Show>
        <For each={replies()}>{reply => <>
            <FlatItemTsch kind="wrapper_start" />
            <FlattenTreeItem
                tree_item={reply}
                parent_indent={[]}
                rpo={{
                    first_in_wrapper: true,
                    is_pivot: false,
                    at_or_above_pivot: false,
                    threaded: false,
                    depth: 0,
                    displayed_in: props.replies!.display,
                }}
            />
            <FlatItemTsch kind="wrapper_end" />
        </>}</For>
    </>;
}

export function useFlatten(pivotLink: () => Generic.Link<Generic.Post>): FlatPage2 {
    const hprc = getWholePageRootContext();
    const pivot = createMemo(() => {
        const pivot_read = Generic.readLink(hprc.content(), pivotLink());
        if(pivot_read == null || pivot_read.error != null) throw new Error("ebadpivot");
        if(pivot_read.value.kind === "tabbed") throw new Error("TODO tabbed");
        return pivot_read.value;
    });

    const bodyCh = FlatItemTsch.useChildren(() => {
        const p = pivot(); // if pivot changes, we rerender everything
        return <>
            {FlatItemTsch({
                kind: "error",
                note: "TODO parents",
                data: 0,
            })}
            {p.replies ? <>
                {FlatItemTsch({
                    kind: "horizontal_line",
                })}
                {p.replies.display === "repivot_list" ? <>
                    <FlatItemTsch
                        kind="repivot_list_fullscreen_button"
                        client_id={p.client_id}
                        page={() => ({pivot: pivotLink(), content: hprc.content()})}
                        href={updateQuery(p.url ?? "@ENO", {'--tc-fullscreen': "true"})}
                    />
                </> : null}
                <FlattenTopLevelReplies replies={p.replies} />
            </> : null}
        </>;
    });
    return {
        header: undefined,
        get title() {
            return "TODO";
        },
        get body() {
            return bodyCh();
        },
        get sidebar() {
            return [];
        },
    };
}