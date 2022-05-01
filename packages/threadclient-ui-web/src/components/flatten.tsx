//! flattens higherarchical page2 structure to a flat array

// todo import Generic from "api-types-generic";
// it's a trivial change just change the entrypoint and export.
import * as Generic from "api-types-generic";
import { Accessor, createSignal, Setter, untrack } from "solid-js";
import { array_key } from "./symbols";

// indent: post id[]

export type FlatPage = {
    header?: undefined | Generic.RedditHeader,
    body: (FlatItem & {
        [array_key]: unknown,
    })[],
    sidebar?: undefined | (FlatItem & {
        [array_key]: unknown,
    })[],
    title: string,
};

export type CollapseButton = {
    // post_anvdhla
    // | post_ndhcajk: {indent: [{id: "post_anvdhla"}]}
    collapsed: boolean,
    id: Generic.Link<Generic.Post>,
    threaded: boolean,
    // start: boolean, end: boolean,
};

/*

[log in] [sign up]       todo

↳----------------------. wrapper_start
| link post            | post
'----------------------' wrapper_end
↳----------------------. wrapper_start
| reply above focus    | post
'----------------------' wrapper_end

------------------------ horizontal_line

(write reply)            todo
,----------------------. wrapper_start
| top level post       | post
| | comment post       | post
| | | wow amazing      | post
| | | load more…       | post
'----------------------' wrapper_end
,----------------------. wrapper_start
| top level post       | post
| ↳ threaded reply     | post
| ↳ another threaded   | post
'----------------------' post

*/

// TODO probably add a key: string/symbol for easier diffing
export type FlatItem = ({
    kind: "wrapper_start" | "wrapper_end" | "horizontal_line",
} | FlatPost | {
    kind: "todo",
    note: string,
    data: unknown,
} | {
    kind: "error",
    note: string,
    data: unknown,
}); // TODO {kind: "collapse_anchor"}
// ^ put a collapse anchor above and below everything that is going to change when a node is collapsed
// then, when collapsing, scroll so the top collapse_anchor is in view

export type FlatPost = {
    kind: "post",
    content: FlatTreeItem, // note rather than generic.post we can be fancier to reduce complexity when rendering
    indent: CollapseButton[],
    collapse: CollapseButton | null,
    first_in_wrapper: boolean,
    last_in_wrapper: boolean,

    // ok why am i representing an enum{above, pivot, below} with two booleans? like it works but one of them
    // is an invalid state? we could even "position: -1 | 0 | 1" and then "position <= 0"
    is_pivot: boolean,
    at_or_above_pivot: boolean,
    threaded: boolean,
    depth: number,

    displayed_in: "tree" | "repivot_list",
};

export type FlatLoader = {
    kind: "flat_loader",
} & Generic.BaseLoader;
export type FlatTreeItem = {
    kind: "error",
    msg: string,
} | {
    kind: "flat_post",
    link: Generic.Link<Generic.Post>,
    post: Generic.ActualPost,
} | FlatLoader;

function loaderToFlatLoader(loader: Generic.HorizontalLoader | Generic.VerticalLoader): FlatLoader {
    return {
        kind: "flat_loader",
        load_count: loader.load_count,
        request: loader.request,
        client_id: loader.client_id,
        autoload: loader.autoload,
    };
}

const fi = {
    todo: (note: string, data: unknown): FlatItem => ({kind: "todo", note, data}),
    err: (note: string, data: unknown): FlatItem => ({kind: "error", note, data}),
};

export type RenderPostOpts = {
    first_in_wrapper: boolean,
    is_pivot: boolean,
    at_or_above_pivot: boolean,
    threaded: boolean,
    depth: number,
    displayed_in: "tree" | "repivot_list",
};

function unwrapPost(post: Generic.Post): Generic.Post {
    if(post.kind === "post") {
        if(post.content.kind === "special") {
            return {...post, content: post.content.fallback};
        }
        // TODO also do this for eg:
        // - a page that is displaying its fallback
        // - … more
    }
    return post;
}

export type CollapseInfo = {
    default_collapsed: boolean,
    user_controllable: boolean,
};
export type PostContentCollapseInfoOpts = {
    is_pivot: boolean,
    displayed_in: "tree" | "repivot_list",
};
export function postContentCollapseInfo(content: Generic.PostContent, opts: PostContentCollapseInfoOpts): CollapseInfo {
    if(content.kind === "post") {
        const collapsible = content.collapsible;
        if(collapsible === false) {
            return {default_collapsed: false, user_controllable: false};
        }else {
            return {
                default_collapsed: collapsible.default_collapsed,
                user_controllable: opts.is_pivot || opts.displayed_in === "tree",
            };
        }
    }else return {default_collapsed: false, user_controllable: false};
}
export function postCollapseInfo(post: FlatTreeItem, opts: PostContentCollapseInfoOpts): (CollapseInfo & {
    collapse_link: Generic.Link<Generic.Post>,
}) | ({
    default_collapsed: boolean,
    user_controllable: false,
}) {
    if(post.kind === "flat_post") {
        return {...postContentCollapseInfo(post.post.content, opts), collapse_link: post.link};
    }else return {default_collapsed: false, user_controllable: false};
}

export function renderTreeItem(
    tree_item: FlatTreeItem,
    parent_indent: CollapseButton[],
    meta: Meta,
    opts: RenderPostOpts,
): FlatPost {
    const ci = postCollapseInfo(tree_item, opts);
    const self_collapsed = ci.user_controllable ? getCState(
        meta.collapse_data,
        ci.collapse_link,
        {default: ci.default_collapsed},
    ).collapsed() : ci.default_collapsed;

    const final_indent: CollapseButton | null = ci.user_controllable ? {
        id: ci.collapse_link,
        threaded: false,
        collapsed: self_collapsed,
    } : null;

    return {
        kind: "post",
        content: tree_item,
        indent: opts.threaded ? parent_indent.map((idnt, i, a) => {
            if(i === a.length - 1) {
                return {...idnt, threaded: true};
            }
            return idnt;
        }) : parent_indent,
        collapse: final_indent,
        first_in_wrapper: opts.first_in_wrapper,
        last_in_wrapper: false,

        is_pivot: opts.is_pivot,
        at_or_above_pivot: opts.at_or_above_pivot,
        threaded: opts.threaded,
        depth: opts.depth,

        displayed_in: opts.displayed_in,
    };
}

function postReplies(listing: Generic.PostReplies | null, meta: Meta): FlatTreeItem[] {
    const res: FlatTreeItem[] = [];
    
    function addReplies(replies: Generic.HorizontalLoader) {
        const val = readLink(meta, replies.key);
        if(val == null) {
            res.push(loaderToFlatLoader(replies));
            return;
        }
        if(val.error != null) {
            res.push({kind: "error", msg: val.error});
        }
        for(const reply of val.value ?? []) {
            if(typeof reply === "object") {
                addReplies(reply);
                continue;
            }
            const readlink = readLink(meta, reply);
            if(readlink == null) {
                res.push({kind: "error", msg: "e-link-bad: "+reply.toString()});
            } else if(readlink.error != null) {
                res.push({kind: "error", msg: readlink.error});
            }else{
                const rpli = readlink.value;
                if(rpli.kind === "tabbed") throw new Error("TODO support tabbed");
                res.push({
                    kind: "flat_post",
                    post: rpli,
                    link: reply,
                });
            }
        }
    }
    if(listing) addReplies(listing.loader);

    return res;
}

export function flattenTreeItem(
    tree_item: FlatTreeItem,
    parent_indent: CollapseButton[],
    meta: Meta,
    rpo: RenderPostOpts,
): FlatItem[] {
    const res: FlatItem[] = [];

    const rres = renderTreeItem(tree_item, parent_indent, meta, rpo);
    res.push(rres);

    if(tree_item.kind !== "flat_post") {
        return res;
    }

    const post = unwrapPost(tree_item.post);
    if(post.kind === "tabbed") throw new Error("TODO support tabbed");

    const indent_excl_self = rres.indent.map(v => v.threaded ? {...v, threaded: false} : v);
    const indent_incl_self: CollapseButton[] = [...indent_excl_self, ...rres.collapse ? [rres.collapse] : []];

    const maybe_show_replies = rpo.displayed_in === "tree";
    if(maybe_show_replies) {
        const replies = postReplies(post.replies, meta);
        const replies_threaded = ((): boolean => {
            if(meta.settings?.allow_threading === false) return false;
            if(replies.length !== 1) return false;

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
            const rply0 = replies[0]!;
            if(rply0.kind !== "flat_post") return false;
            const rply0rplies = postReplies(rply0.post.replies, meta);
            if(rply0rplies.length !== 1) return false;
            return true;
        })();
        const show_replies = ((): boolean => {
            if(replies_threaded && rpo.threaded) return true;
            if(!(rres.collapse?.collapsed ?? false)) return true;
            return false;
        })();
        if(show_replies) for(const reply of replies) {
            res.push(...flattenTreeItem(
                reply,
                rpo.threaded && replies_threaded ? indent_excl_self : indent_incl_self,
                meta,
                {
                    is_pivot: false,
                    at_or_above_pivot: false,
                    first_in_wrapper: false,
                    threaded: replies_threaded,
                    depth: rpo.depth + 1,
                    displayed_in: post.replies!.display,
                },
            ));
        }
    }
        
    return res;
}

export type CollapseData = {
    // map from a Link<Post> to an array of watchers and a current value
    map: Map<Generic.Link<Generic.Post>, CollapseEntry>,
};
export type CollapseEntry = {
    hovering: Accessor<number>,
    setHovering: Setter<number>,
    collapsed: Accessor<boolean>,
    setCollapsed: Setter<boolean>,
};

export function getCState(cst: CollapseData, id: Generic.Link<Generic.Post>, opts?: {
    default: boolean,
} | undefined): CollapseEntry {
    return untrack((): CollapseEntry => {
        const csv = cst.map.get(id);
        if(csv == null) {
            if(!opts) {
                console.error("Eaccessing cstate", cst, {id});
                throw new Error("accessing cstate before it has been created");
            }
            const [hovering, setHovering] = createSignal(0);
            const [collapsed, setCollapsed] = createSignal(opts.default);
            const nv: CollapseEntry = {
                hovering, setHovering,
                collapsed, setCollapsed,
            };
            cst.map.set(id, nv);
            return nv;
        }
        return csv;
        // huh we should probably gc this once there are no watchers left
        // not going to worry about that for now
    });
}

type Meta = {
    collapse_data: CollapseData,
    content: Generic.Page2Content,

    settings?: undefined | {
        allow_threading?: undefined | boolean,
    },
};

function readLink<T>(meta: Meta, link: Generic.Link<T>): null | Generic.ReadLinkResult<T> {
    const root_context = meta.content;
    return Generic.readLink(root_context, link);
}

function highestArray(post: Generic.Link<Generic.Post>, meta: Meta): (FlatTreeItem & {
    pivot?: undefined | boolean,
})[] {
    const res: (FlatTreeItem & {
        pivot?: undefined | boolean,
    })[] = [];

    // working around a typescript bug. we should probably check if this is fixed in the latest release
    let highest = ((): Generic.Link<Generic.Post> | null => post)();
    const setHighest = (nh: Generic.Link<Generic.Post> | null): void => void (highest = nh);

    while(highest) {
        const postloaded = readLink(meta, highest);
        if(postloaded == null) {
            res.push({kind: "error", msg: "[flat]link not found: "+highest.toString()});
            highest = null;
            break;
        }
        if(postloaded.error != null) {
            res.push({kind: "error", msg: postloaded.error});
            setHighest(null);
            break;
        }
        if(postloaded.value.kind === "tabbed") throw new Error("TODO support tabbed");
        res.push({
            kind: "flat_post",
            link: highest,
            post: postloaded.value,
        });

        const parent = postloaded.value.parent;
        if(!parent) {
            setHighest(null);
            continue;
        }

        const {loader} = parent;
        const loaded = readLink(meta, loader.key);
        if(!loaded) {
            // insert a loader and the temp_parent and then continue with temp_parent.parent
            res.push(loaderToFlatLoader(loader));
            setHighest(loader.temp_parent);
            continue;
        }
        if(loaded.error != null) {
            //^ loader.key resolves to an error
            //v display both the error and the temp_parent
            res.push({kind: "error", msg: loaded.error});
            setHighest(loader.temp_parent);
            continue;
        }
        // vv this is weird, isn't it?
        // there are a bunch of conditions we'll check at the top of the next loop that we don't need to
        // because the link is known good
        setHighest(loaded.value == null ? null : loader.key);
        continue;
    }

    const rrlm0 = res[0];
    if(rrlm0) rrlm0.pivot = true;

    return [...res].reverse();
}

// comments:
// we could easily move this to createTypesafeChildren
// do we want to though?
//
// - I think the answer is no
// - because:
//   - when we repivot, we want to reuse children too
//   - but solid js wouldn't make that trivial. it would rerender anything that uses
//     children. not what we want.

// ok I have to think about what my goal with repivoting is and how to keep the data
// structured well for repivoting with minimal perf impact

function flattenTopLevelReplies(replies: Generic.PostReplies | null, meta: Meta): FlatItem[] {
    const res: FlatItem[] = [];

    if(replies?.reply) res.push(fi.todo("(add reply)", replies));
    const post_replies = postReplies(replies, meta);
    for(const reply of post_replies) {
        res.push({kind: "wrapper_start"});
        res.push(...flattenTreeItem(reply, [], meta, {
            first_in_wrapper: true,
            is_pivot: false,
            at_or_above_pivot: false,
            threaded: false,
            depth: 0,
            displayed_in: replies!.display,
        }));
        res.push({kind: "wrapper_end"});
    } if(replies != null && post_replies.length === 0) {
        res.push(fi.todo("*There are no replies*", replies));
    }

    return res;
}

export function flatten(pivot_link: Generic.Link<Generic.Post>, meta: Meta): FlatPage {
    const res: FlatItem[] = [];

    let res_sidebar: FlatItem[] | null = null;
    let res_header: Generic.RedditHeader | null = null;

    const pivot_read = readLink(meta, pivot_link);
    if(pivot_read == null || pivot_read.error != null) throw new Error("ebadpivot");
    const {value: pivot} = pivot_read;

    if(pivot.kind === "tabbed") throw new Error("TODO support tabbed");

    let title: string | null = null;

    const highest_arr = highestArray(pivot_link, meta);
    for(const item of highest_arr) {
        if(item.kind === "flat_post") {
            const post = unwrapPost(item.post);
            if(post.kind === "post" && post.content.kind === "page") {
                const content = post.content;
                if(res_sidebar == null) {
                    res_sidebar = flattenTopLevelReplies(content.wrap_page.sidebar, meta);
                }
                if(res_header == null && (item.pivot ?? false)) {
                    res_header = content.wrap_page.header;
                    // oh TODO figure out what to do if there are items higher than this - like where do they
                    // go?
                    // I guess instead of being a special thing, header could just be a flatitem[]
                    // not really sure
                    // I was thinking users would want headers in their sidebar but actually we can make users
                    // just like subreddits and have their headers at the top. no reason to put them on the side.
                    //
                    // I guess subreddits will want a header on the sidebar when you're viewing a comment thread

                    // ok I'm just not going to worry about this for now
                    continue; // don't insert in the list
                }
            }
            if(post.kind === "post" && post.content.kind === "post") {
                if(title == null && post.content.title != null) {
                    title = post.content.title.text;
                }
            }
        }

        res.push({kind: "wrapper_start"});
        res.push(renderTreeItem(item, [], meta, {
            first_in_wrapper: true,
            at_or_above_pivot: true,
            is_pivot: item.pivot ?? false,
            threaded: false,
            depth: 0,
            displayed_in: "repivot_list", // all at_or_above_pivot is a repivot list
            // note: the pivot is never clickable
        }));
        res.push({kind: "wrapper_end"});
    }

    // note scroll should probably center at the pivot post and things above should require scrolling
    // up like twitter does
    if(pivot.replies) {
        res.push({kind: "horizontal_line"});
        res.push(...flattenTopLevelReplies(pivot.replies, meta));
    }

    // add last_in_wrapper to posts
    const addLastInWrapper = (ar: FlatItem[]) => ar.forEach((post, i, a) => {
        const next = a[i + 1];
        if(next?.kind === "wrapper_end")  {
            if(post.kind === "post") {
                post.last_in_wrapper = true;
            }
        }
    });
    addLastInWrapper(res);
    if(res_sidebar) addLastInWrapper(res_sidebar);

    return {
        header: res_header ?? undefined,
        sidebar: res_sidebar != null ? autokey(res_sidebar):  undefined,
        body: autokey(res),
        title: title ?? "*ERR_NO_TITLE*",
    };
}

export function autokey(items: FlatItem[]): (FlatItem & {[array_key]: unknown})[] {
    let i_excl_post = 0;
    const autokeyItem = (itm: FlatItem): FlatItem & {[array_key]: unknown} => {
        const key: {v: unknown} = (() => {
            if(itm.kind === "post") {
                if(itm.content.kind === "flat_post") {
                    return {v: itm.content.link};
                }
            }
            i_excl_post += 1;
            return {v: i_excl_post};
            // hmm. this isn't great keying. we can do better
        })();
        return {...itm, [array_key]: key.v};
    };
    return items.map(autokeyItem);
}