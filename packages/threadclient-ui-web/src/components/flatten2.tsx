import * as Generic from "api-types-generic";
import { createMemo, For, JSX, useContext } from "solid-js";
import { updateQuery } from "threadclient-client-reddit";
import { createTypesafeChildren, Show } from "tmeta-util-solid";
import { allow_threading_override_ctx, collapse_data_context, getWholePageRootContext } from "../util/utils_solid";
import { CollapseButton, FlatItem, FlatPage2, FlatTreeItem, loaderToFlatLoader, RenderPostOpts, renderTreeItem, unwrapPost } from "./flatten";

/*
CRITICAL TODO:
hprc.content() needs to be changed
currently it is a signal that updates any time any content changes
we need to change it to a map of signals so it only changes if the link you read was modified

- ok I went to do this by making a class and that would have worked fine and taken a few minutes of
  refactoring after
- I can also do this by changing hprc.content() to return a proxy holding the object it normally holds
- either method should work fine. the proxy method doesn't require any refactoring but might be a bit
  more complicated to program.

type MutableContentBackingValue<T> = undefined | {data: T} | {error: string};
type MutableContentBackingSym<T> = Signal<MutableContentBackingValue<T>>;
// wait there's no reason to do this i can literally make a proxy
export class MutableContent {
    backing: Map<
        Generic.Link<unknown>,
        MutableContentBackingSym<unknown>
        // note: this never gets gc'd. ideally it would gc when no watchers remain.
    >;
    constructor() {
        this.backing = new Map();
    }

    getSignal<T>(link: Generic.Link<T>): MutableContentBackingSym<T> {
        const value = this.backing.get(link);
        if(value != null) return value as MutableContentBackingSym<T>;
        const nv = createSignal<MutableContentBackingValue<unknown>>(undefined);
        this.backing.set(link, nv);
        return nv as MutableContentBackingSym<T>;
    }

    readLink<T>(link: Generic.Link<T>): null | Generic.ReadLinkResult<T> {
        const signal = this.getSignal(link);
        const value = signal[0]();
        if(value == null) return null;
        if('error' in value) return {error: value.error, value: null};
        return {value: value.data, error: null};
    }

    toGenericContent(): Generic.Page2Content {
        return Object.fromEntries([...this.backing.entries()].map(([k, v]) => [k, v()]));
    }
}

More TODO:
- fix the last replies not being marked as last. we can fix that with a postprocess step if we need
  - consider using the post flag when the post has no children but a kind="wrapper_end" node if it does.
    it looks weird if you hover the last child and it also shows the bottom of the object as being highlighted
- delete flatten.tsx (after moving over functions and stuff) and change our new homepage to use the new one
*/

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
// ok here's a question
// why does highestarray include the pivot?
// we should just make it not include the pivot
// would solve a lot of problems
function HighestArray(props: {
    post: Generic.Link<Generic.Post> | null,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    return createMemo(() => {
        const highest = props.post;
        if(highest == null) return [];

        const postloaded = Generic.readLink(hprc.content(), highest);
        if(postloaded == null) {
            return <FlatReplyTsch kind="error" msg={"[flat]link not found: "+highest.toString()} />;
        }
        if(postloaded.error != null) {
            return <FlatReplyTsch kind="error" msg={postloaded.error} />;
        }
        if(postloaded.value.kind === "tabbed") throw new Error("TODO support tabbed");
        return <>
            {createMemo((): JSX.Element => {
                if(postloaded.value.kind === "tabbed") throw new Error("TODO support tabbed");

                const parent = postloaded.value.parent;
                if(!parent) {
                    return [];
                }

                const {loader} = parent;
                const loaded = Generic.readLink(hprc.content(), loader.key);
                if(!loaded) {
                    // insert a loader and the temp_parent and then continue with temp_parent.parent
                    return <>
                        <HighestArray post={loader.temp_parent} />
                        {FlatReplyTsch(loaderToFlatLoader(loader))}
                    </>;
                }
                if(loaded.error != null) {
                    //^ loader.key resolves to an error
                    //v display both the error and the temp_parent
                    return <>
                        <HighestArray post={loader.temp_parent} />
                        <FlatReplyTsch kind="error" msg={loaded.error} />
                    </>;
                }
                return <>
                    <HighestArray post={loaded.value == null ? null : loader.key} />
                </>;
            })}
            <FlatReplyTsch kind="flat_post" link={highest} post={postloaded.value} />
        </>;
    });
}

export const FlatItemTsch = createTypesafeChildren<FlatItem>();

function usePostReplies(replies: () => Generic.PostReplies | null): () => FlatTreeItem[] {
    return FlatReplyTsch.useChildren(() => <FlatReplies replies={replies()} />);
}
function useHighestArray(post: () => Generic.Link<Generic.Post>): () => FlatTreeItem[] {
    return FlatReplyTsch.useChildren(() => <HighestArray post={post()} />);
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
    const allowThreading = useContext(allow_threading_override_ctx) ?? (() => true);
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
        const repliesThreaded = createMemo((): boolean => {
            if(!allowThreading()) return false;
            const rplys = replies();
            if(rplys.length !== 1) return false;

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
            //   - why does it need to know there? can't we add the indent after rendering the object?

            if(rpo.threaded) return true;
            const rply0 = rplys[0]!;
            if(rply0.kind !== "flat_post") return false;
            // oh my… this is uuh
            // not ideal
            const rply0rplies = usePostReplies(() => rply0.post.replies)();
            if(rply0rplies.length !== 1) return false;
            return true;
        });
        const showReplies = ((): boolean => {
            if(repliesThreaded() && props.rpo.threaded) return true;
            if(!(rres.collapse?.collapsed ?? false)) return true;
            return false;
        });
        return <>
            {FlatItemTsch(rres)}
            <Show if={showReplies()}>
                <For each={replies()}>{reply => (
                    <FlattenTreeItem
                        tree_item={reply}
                        parent_indent={props.rpo.threaded && repliesThreaded() ? indent_excl_self : indent_incl_self}
                        rpo={{
                            is_pivot: false,
                            at_or_above_pivot: false,
                            first_in_wrapper: false,
                            threaded: repliesThreaded(),
                            get depth() {return props.rpo.depth + 1},
                            displayed_in: post.replies!.display,
                        }}
                    />
                )}</For>

            </Show>
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
    // why don't we return a createMemo on the pivot?
    // should save some logic maybe
    // and we have to regenerate everything if the pivot changes anyway

    const hprc = getWholePageRootContext();
    const cpsd = useContext(collapse_data_context)!;
    const pivot = createMemo(() => {
        const pivot_read = Generic.readLink(hprc.content(), pivotLink());
        if(pivot_read == null || pivot_read.error != null) throw new Error("ebadpivot");
        if(pivot_read.value.kind === "tabbed") throw new Error("TODO tabbed");
        return pivot_read.value;
    });

    const parentsArr = useHighestArray(() => pivotLink());

    const bodyCh = FlatItemTsch.useChildren(() => {
        const p = pivot(); // if pivot changes, we rerender everything
        return <>
            <For each={parentsArr()}>{(item): JSX.Element => <>
                <FlatItemTsch kind="wrapper_start" />
                {FlatItemTsch(renderTreeItem(item, [],
                {content: hprc.content(), collapse_data: cpsd}, {
                    first_in_wrapper: true,
                    at_or_above_pivot: true,
                    is_pivot: item.kind === "flat_post" && item.link === pivotLink(),
                    threaded: false,
                    depth: 0,
                    displayed_in: "repivot_list", // all at_or_above_pivot is a repivot list
                    // note: the pivot is never clickable
                }))}
                <FlatItemTsch kind="wrapper_end" />
            </>}</For>
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
    const sidebarCh = FlatItemTsch.useChildren(() => {
        for(const itm of [...parentsArr()].reverse()) {
            if(itm.kind !== "flat_post") continue;
            const post = unwrapPost(itm.post);
            if(post.kind === "post" && post.content.kind === "page") {
                const content = post.content;
                return <FlattenTopLevelReplies replies={content.wrap_page.sidebar} />;
            }
        }
        return [];
    });

    return {
        // TODO don't do headers, just put them in the body like normal nodes
        header: undefined,
        get title() {
            for(const itm of [...parentsArr()].reverse()) {
                if(itm.kind !== "flat_post") continue;
                const post = unwrapPost(itm.post);
                if(post.kind === "post" && post.content.kind === "post") {
                    if(post.content.title != null) {
                        return post.content.title.text;
                    }
                }
            }
            return "*ERROR_NO_TITLE*";
        },
        get body() {
            return bodyCh();
        },
        get sidebar() {
            return sidebarCh();
        },
    };
}