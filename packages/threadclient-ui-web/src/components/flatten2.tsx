import * as Generic from "api-types-generic";
import { Accessor, createMemo, For, JSX, useContext } from "solid-js";
import { updateQuery } from "tmeta-util";
import { createTypesafeChildren, Show } from "tmeta-util-solid";
import { allow_threading_override_ctx, collapse_data_context } from "../util/contexts";
import { getWholePageRootContext, PageRootContext } from "../util/utils_solid";
import { CollapseButton, CollapseData, FlatItem, FlatPage2, FlatTreeItem, getCState, loaderToFlatLoader, postCollapseInfo, RenderPostOpts, unwrapPost } from "./flatten";

/*
NOTE:
- can we remove collapse halding from flatten?
- switch back to dom collapsing?
- it will significantly improve performance and remove a lot of mess from this code and make
  animations way easier

that way we would be reducing the influence pageflat has. pageflat would be for top level objects only and
hopefully not have to deal with post content too much.

I'm going to do a from-scratch experiment I think and see either if we should transfer our existing
work to it or transfer it to our existing work.
*/

export const FlatReplyTsch = createTypesafeChildren<FlatTreeItem>();

export function FlatRepliesHL(props: {
    replies: Generic.HorizontalLoader,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    return createMemo(() => {
        const val = hprc.content.view(props.replies.key);
        if(val == null) {
            return FlatReplyTsch(loaderToFlatLoader(props.replies));
        }
        if(val.error != null) {
            return <FlatReplyTsch kind="error" msg={val.error} />;
        }
        return <For each={val.value ?? []}>{reply => createMemo(() => {
            if(typeof reply === "object") return <FlatRepliesHL replies={reply} />;
            const readlink = hprc.content.view(reply);
            if(readlink == null) {
                return <FlatReplyTsch kind="error" msg={"e-link-bad: "+reply.toString()} />;
            }else if(readlink.error != null) {
                return <FlatReplyTsch kind="error" msg={readlink.error} />;
            }else{
                const rpli = readlink.value;
                return <FlatReplyTsch
                    kind="flat_post"
                    post={rpli}
                    link={reply}
                />;
            }
        })}</For>;
    });
}
export function FlatReplies(props: {
    replies: Generic.PostReplies | null,
}): JSX.Element {
    return <>
        <Show when={props.replies}>{rplysv => <FlatRepliesHL replies={rplysv.loader} />}</Show>
    </>;
}
// ok here's a question
// why does highestarray include the pivot?
// we should just make it not include the pivot
// would solve a lot of problems
function HighestArray(props: {
    post: Generic.NullableLink<Generic.Post> | null,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    return createMemo(() => {
        const highest = props.post;
        if(highest == null) return [];

        const postloaded = hprc.content.view(highest);
        if(postloaded == null) {
            return <FlatReplyTsch kind="error" msg={"[flat]link not found: "+highest.toString()} />;
        }
        if(postloaded.error != null) {
            return <FlatReplyTsch kind="error" msg={postloaded.error} />;
        }
        return <>
            {createMemo((): JSX.Element => {
                const parent = postloaded.value.parent;
                if(!parent) {
                    return [];
                }

                const {loader} = parent;
                const loaded = hprc.content.view(loader.key);
                const tempParent = createMemo((): Generic.Link<Generic.Post> | null => {
                    const temp_parents = loader.temp_parents;
                    return temp_parents.find(itm => hprc.content.view(itm) != null ? itm : null) ?? null;
                });
                // ok what we want is:
                // - change 'key' to 'keys'
                // - change this to display:
                //   - the first key with data. if an error, display the error and then the next key.
                //   - if keys[0] has no data, display a loader
                if(!loaded) {
                    // insert a loader and the temp_parent and then continue with temp_parent.parent
                    return <>
                        <HighestArray post={tempParent()} />
                        {FlatReplyTsch(loaderToFlatLoader(loader))}
                    </>;
                }
                if(loaded.error != null) {
                    //^ loader.key resolves to an error
                    //v display both the error and the temp_parent
                    return <>
                        <HighestArray post={tempParent()} />
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

type TII = {
    indent: CollapseButton[],
    collapse: CollapseButton | null,
};

function getTreeItemIndent(
    hprc: PageRootContext,
    csc: CollapseData,
    tree_item: FlatTreeItem,
    parent_indent: CollapseButton[],
    opts: RenderPostOpts,
): TII {
    const ci = postCollapseInfo(hprc, tree_item, opts);
    const self_collapsed = ci.user_controllable ? getCState(
        csc,
        ci.collapse_link,
        {default: ci.default_collapsed},
    ).collapsed() : ci.default_collapsed;

    const final_indent: CollapseButton | null = ci.user_controllable ? {
        id: ci.collapse_link,
        threaded: false,
        collapsed: self_collapsed,
    } : null;

    return {
        indent: opts.threaded ? parent_indent.map((idnt, i, a) => {
            if(i === a.length - 1) {
                return {...idnt, threaded: true};
            }
            return idnt;
        }) : parent_indent,
        collapse: final_indent,
    };
}

function RenderTreeItem(props: {
    tree_item: FlatTreeItem,
    opts: RenderPostOpts,
    tii: TII,
    last: boolean,
}): JSX.Element {
    return <FlatItemTsch
        kind="post"
        content={props.tree_item}
        indent={props.tii.indent}
        collapse={props.tii.collapse}
        first_in_wrapper={props.opts.first_in_wrapper}
        last_in_wrapper={props.last} // TODO fix

        is_pivot={props.opts.is_pivot}
        at_or_above_pivot={props.opts.at_or_above_pivot}
        threaded={props.opts.threaded}
        depth={props.opts.depth}

        displayed_in={props.opts.displayed_in}
    />;
}
function RenderTreeItemAuto(props: {
    tree_item: FlatTreeItem,
    parent_indent: CollapseButton[],
    opts: RenderPostOpts,
    last: boolean,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    const csc = useContext(collapse_data_context)!;
    return <RenderTreeItem
        tree_item={props.tree_item}
        opts={props.opts}
        tii={getTreeItemIndent(hprc, csc, props.tree_item, props.parent_indent, props.opts)}
        last={props.last}
    />;
}

export function FlattenTreeItem(props: {
    tree_item: FlatTreeItem,
    parent_indent: CollapseButton[],
    rpo: RenderPostOpts,
    last: boolean,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    const allowThreading = useContext(allow_threading_override_ctx) ?? (() => true);
    const csc = useContext(collapse_data_context)!;
    const tii = createMemo(() => getTreeItemIndent(hprc, csc, props.tree_item, props.parent_indent, props.rpo));
    return createMemo(() => {
        // [!] TODO: this will needlessly rerender when the parent indent changes
        // or when any renderpostopts change
        // - should be a pretty simple fix by reimplementing renderTreeItem to have
        // some values be getters

        if(props.tree_item.kind !== "flat_post") {
            return <RenderTreeItem
                tree_item={props.tree_item}
                opts={props.rpo}
                tii={tii()}
                last={props.last}
            />;
        }

        const post = unwrapPost(props.tree_item.post);
        
        const maybe_show_replies = props.rpo.displayed_in === "tree";
        if(!maybe_show_replies) {
            return <RenderTreeItem
                tree_item={props.tree_item}
                opts={props.rpo}
                tii={tii()}
                last={props.last}
            />;
        }
    
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
            //     - we can literally do that. `renderTreeItem` does nothing interesting and there's zero reason
            //       we need to call it before counting the replies

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
            if(!(tii().collapse?.collapsed ?? false)) return true;
            return false;
        });
        return <>
            <RenderTreeItem
                tree_item={props.tree_item}
                opts={props.rpo}
                tii={tii()}
                last={showReplies() && replies().length > 0 ? false : props.last}
            />
            <Show if={showReplies()}>
                <For each={replies()}>{(reply, i) => (
                    <FlattenTreeItem
                        tree_item={reply}
                        parent_indent={((): CollapseButton[] => {
                            const ti = tii();
                            const indent_excl_self = ti.indent.map(v => v.threaded ? {...v, threaded: false} : v);
                            if(props.rpo.threaded && repliesThreaded()) {
                                return indent_excl_self;
                            }
                            return [
                                ...indent_excl_self, ...ti.collapse ? [ti.collapse] : [],
                            ];
                        })()}
                        rpo={{
                            is_pivot: false,
                            at_or_above_pivot: false,
                            first_in_wrapper: false,
                            threaded: repliesThreaded(),
                            get depth() {return props.rpo.depth + 1},
                            displayed_in: post.replies!.display,
                        }}
                        last={false}
                    />
                )}</For>

            </Show>
            <Show if={props.last && showReplies() && replies().length > 0}>
                <FlatItemTsch kind="wrapper_end" />
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
                last={true}
            />
        </>}</For>
    </>;
}

export function useFlatten(pivotLink: () => Generic.Link<Generic.Post>): Accessor<FlatPage2> {
    const hprc = getWholePageRootContext();
    const pivot = createMemo(() => {
        const pivot_read = hprc.content.view(pivotLink());
        if(pivot_read == null || pivot_read.error != null) return null;
        return pivot_read.value;
    });
    return createMemo((): FlatPage2 => {
        const pivot_v = pivot();
        if(pivot_v != null) {
            return useFlattenMain(pivotLink(), pivot_v);
        }else{
            return {
                aboveBody: [],
                body: [
                    {kind: "error", note: "Pivot is not defined ["+pivotLink().toString()+"]; Error", data: hprc},
                ],
                title: "Err No Pivot",
                url: null,
            };
        }
    });
}

function useFlattenMain(pivot_link: Generic.Link<Generic.Post>, pivot: Generic.Post): FlatPage2 {
    // why don't we return a createMemo on the pivot?
    // should save some logic maybe
    // and we have to regenerate everything if the pivot changes anyway

    const hprc = getWholePageRootContext();

    const parentsArr = useHighestArray(() => pivot_link);
    const parentsFiltered = createMemo((): {
        view_parents: FlatTreeItem[],
        view_header_in_sidebar: null | FlatTreeItem,
        view_sidebar: null | Generic.PostReplies,
        view_above_body: FlatTreeItem[],
        title: string,
    } => {
        const pa = parentsArr();
        const pivotlink = pivot_link;
        const res: FlatTreeItem[] = [];
        let view_header_in_sidebar: null | FlatTreeItem = null;
        let view_sidebar: null | Generic.PostReplies = null;
        const view_above_body: FlatTreeItem[] = [];

        let above_header = false;

        const title: string[] = [];
        for(const item of [...pa].reverse()) {
            const uwv = item.kind === "flat_post" ? unwrapPost(item.post) : null;

            if(uwv?.content.kind === "post") {
                if(uwv.content.title != null) {
                    title.push(uwv.content.title.text);
                }
            }else if(uwv?.content.kind === "page") {
                above_header = true;
                const header = uwv.content.wrap_page.header;
                const known_value = hprc.content.view(header.filled.key);
                if(known_value != null) {
                    if(known_value.error != null) {
                        title.push("*Error* ("+header.temp_title+")");
                    }else{
                        title.push(known_value.value.names.display ?? known_value.value.names.raw);
                    }
                }else{
                    title.push(header.temp_title);
                }
            }else if(uwv?.content.kind === "client") {
                title.push(uwv.client_id);
            }

            let item_is_sidebar = false;
            if(view_sidebar == null && uwv?.content.kind === "page") {
                view_sidebar = uwv.content.wrap_page.sidebar;
                item_is_sidebar = true;
            }

            const target = above_header ? view_above_body : res;

            if(item.kind === "flat_post" && item.link === pivotlink) {
                target.push(item);
            }else if(item_is_sidebar && uwv?.content.kind === "page") {
                view_header_in_sidebar = item;
            }else{
                target.push(item);
            }
        }
        return {
            view_parents: [...res].reverse(),
            view_header_in_sidebar,
            view_sidebar,
            view_above_body: [...view_above_body].reverse(),
            title: title.join(" | "),
        };
    });

    const bodyCh = FlatItemTsch.useChildren(() => {
        const p = pivot; // if pivot changes, we rerender everything
        return <>
            <For each={parentsFiltered().view_parents}>{(item): JSX.Element => <>
                <FlatItemTsch kind="wrapper_start" />
                <RenderTreeItemAuto
                    tree_item={item}
                    parent_indent={[]}
                    opts={{
                        first_in_wrapper: true,
                        at_or_above_pivot: true,
                        is_pivot: item.kind === "flat_post" && item.link === pivot_link,
                        threaded: false,
                        depth: 0,
                        displayed_in: "repivot_list", // all at_or_above_pivot is a repivot list
                        // note: the pivot is never clickable
                    }}
                    last={true}
                />
            </>}</For>
            {p.replies?.display === "repivot_list" ? <>
                <FlatItemTsch
                    kind="repivot_list_fullscreen_button"
                    client_id={p.client_id}
                    pivot={() => pivot_link}
                    href={updateQuery(p.url ?? "@ENO", {'--tc-view': "reader"})}
                    name="Reader"
                />
            </> : null}
            {p.replies ? <>
                {FlatItemTsch({
                    kind: "horizontal_line",
                })}
                {p.replies.sort_options != null ? <>
                    <FlatItemTsch
                        kind="sort_buttons"
                        sort_buttons={p.replies.sort_options}
                        client_id={p.client_id}
                    />
                </> : null}
                {p.replies.display === "repivot_list" ? <>
                    <FlatItemTsch
                        kind="repivot_list_fullscreen_button"
                        client_id={p.client_id}
                        pivot={() => pivot_link}
                        href={updateQuery(p.url ?? "@ENO", {'--tc-view': "fullscreen"})}
                        name="Fullscreen"
                    />
                </> : null}
                {p.replies.reply != null ? <>
                    <FlatItemTsch
                        kind="todo"
                        note="TODO reply button"
                        data={p.replies}
                    />
                </> : null}
                <FlattenTopLevelReplies replies={p.replies} />
            </> : null}
        </>;
    });
    const sidebarCh = FlatItemTsch.useChildren(() => {
        return <>
            <Show when={parentsFiltered().view_header_in_sidebar}>{headerv => <>
                <FlatItemTsch kind="wrapper_start" />
                <RenderTreeItemAuto
                    tree_item={headerv}
                    parent_indent={[]}
                    opts={{
                        first_in_wrapper: true,
                        at_or_above_pivot: false,
                        is_pivot: false,
                        threaded: false,
                        depth: 0,
                        displayed_in: "repivot_list",
                    }}
                    last={true}
                />
            </>}</Show>
            <Show when={parentsFiltered().view_sidebar}>{sidebarv => (
                <FlattenTopLevelReplies replies={sidebarv} />
            )}</Show>
        </>;
    });
    const aboveBodyCh = FlatItemTsch.useChildren(() => {
        return <>
            <For each={parentsFiltered().view_above_body}>{ch => <>
                <FlatItemTsch kind="wrapper_start" />
                <RenderTreeItemAuto
                    tree_item={ch}
                    parent_indent={[]}
                    opts={{
                        first_in_wrapper: true,
                        at_or_above_pivot: false,
                        is_pivot: ch.kind === "flat_post" && ch.link === pivot_link,
                        threaded: false,
                        depth: 0,
                        displayed_in: "repivot_list",
                    }}
                    last={true}
                />
            </>}</For>
        </>;
    });

    // consider:
    // get abovePivot()
    // get pivot()
    // get belowPivot()
    // also consider:
    // - instead of FlatItem[]
    //   - do: TopLevelObject[]
    // - then TopLevelObject would contain FlatItem[]
    return {
        get title() {
            return parentsFiltered().title;
        },
        get url() {
            const focus = pivot;
            return focus.url;
        },
        get body() {
            return bodyCh();
        },
        get sidebar() {
            return sidebarCh();
        },
        get aboveBody() {
            return aboveBodyCh();
        },
    };
}