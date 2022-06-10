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
export type FlatPage2 = {
    header?: undefined | Generic.RedditHeader,
    body: FlatItem[],
    sidebar?: undefined | FlatItem[],
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
} | {
    kind: "repivot_list_fullscreen_button",

    client_id: string,
    page: () => Generic.Page2,
    href: string,
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

export function loaderToFlatLoader(loader: Generic.HorizontalLoader | Generic.VerticalLoader): FlatLoader {
    return {
        kind: "flat_loader",
        load_count: loader.load_count,
        request: loader.request,
        client_id: loader.client_id,
        autoload: loader.autoload,
    };
}

export type RenderPostOpts = {
    first_in_wrapper: boolean,
    is_pivot: boolean,
    at_or_above_pivot: boolean,
    threaded: boolean,
    depth: number,
    displayed_in: "tree" | "repivot_list",
};

export function unwrapPost(post: Generic.Post): Generic.Post {
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

export function postReplies(listing: Generic.PostReplies | null, meta: Meta): FlatTreeItem[] {
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
