//! flattens higherarchical page2 structure to a flat array

// todo import Generic from "api-types-generic";
// it's a trivial change just change the entrypoint and export.
import * as Generic from "api-types-generic";
import { Accessor, createSignal, Setter, untrack } from "solid-js";

// indent: post id[]

type FlatPage = {
    // header: FlatItem[],
    body: FlatItem[],
    // sidebar: FlatItem[],
};

type CollapseButton = {
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
type FlatItem = {
    kind: "wrapper_start" | "wrapper_end" | "horizontal_line",
} | FlatPost | {
    kind: "todo",
    note: string,
    data: unknown,
} | {
    kind: "error",
    note: string,
    data: unknown,
};

type FlatPost = {
    kind: "post",
    content: Generic.Post, // note rather than generic.post we can be fancier to reduce complexity when rendering
    indent: CollapseButton[],
    collapse: CollapseButton,
    first_in_wrapper: boolean,

    is_pivot: boolean,
    at_or_above_pivot: boolean,
    id: Generic.Link<Generic.Post>,
};

const fi = {
    todo: (note: string, data: unknown): FlatItem => ({kind: "todo", note, data}),
    err: (note: string, data: unknown): FlatItem => ({kind: "error", note, data}),
};

type CollapseStates = Map<Generic.Link<Generic.Post>, boolean>;

type RenderPostOpts = {
    first_in_wrapper: boolean,
    is_pivot: boolean,
    at_or_above_pivot: boolean,
};

function renderPost(
    post_link: Generic.Link<Generic.Post>,
    parent_indent: CollapseButton[],
    meta: Meta,
    opts: RenderPostOpts,
): FlatItem {
    const post_read = readLink(meta, post_link);
    if(post_read.error != null) return fi.err(post_read.error, post_link);
    const post = post_read.value;

    const default_collapsed = (
        post.kind === "post" ? post.content.kind === "post" ? post.content.collapsible !== false ?
        post.content.collapsible.default_collapsed : false : false : false
    );
    const self_collapsed = getCState(
        meta.collapse_data,
        post_link,
        {default: default_collapsed},
    ).collapsed();

    const final_indent: CollapseButton = {
        id: post_link,
        threaded: false,
        collapsed: self_collapsed,
    };

    return {
        kind: "post",
        content: post,
        indent: parent_indent,
        collapse: final_indent,
        first_in_wrapper: opts.first_in_wrapper,

        is_pivot: opts.is_pivot,
        at_or_above_pivot: opts.at_or_above_pivot,
        id: post_link,
    };
}

function flattenPost(
    post_link: Generic.Link<Generic.Post>,
    parent_indent: CollapseButton[],
    meta: Meta,
    rpo: RenderPostOpts,
): FlatItem[] {
    const res: FlatItem[] = [];

    const rres = renderPost(post_link, parent_indent, meta, rpo);
    res.push(rres);

    if(rres.kind !== "post") return res;
    const post_read = readLink(meta, post_link);
    if(post_read.error != null) {
        res.push(fi.err(post_read.error, post_link));
        return res;
    }
    const post = post_read.value;

    const self_indent = [...rres.indent, rres.collapse];


    const show_replies = post.kind === "post" ? post.content.kind === "post" ?
        post.content.show_replies_when_below_pivot
    : true : true;
    if(!rres.collapse.collapsed && show_replies) if(post.replies) for(const reply of post.replies.items) {
        res.push(...flattenPost(reply, self_indent, meta, {...rpo, first_in_wrapper: false}));
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
            if(!opts) throw new Error("accessing cstate before it has been created");
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
};

function readLink<T>(meta: Meta, link: Generic.Link<T>): Generic.ReadLinkResult<T> {
    const root_context = meta.content;
    return Generic.readLink(root_context, link);
}
function readLinkAssertFound<T>(meta: Meta, link: Generic.Link<T>): T {
    const res = readLink(meta, link);
    if(res.error != null) {
        console.log("Failed to read link. Link:", link, "Result:", res, "Searching in", meta.content);
        throw new Error("Could not read link; "+res.error);
    }
    return res.value;
}

export function flatten(pivot_link: Generic.Link<Generic.Post>, meta: Meta): FlatPage {
    const res: FlatItem[] = [];

    const pivot = readLinkAssertFound(meta, pivot_link);

    let highest: Generic.Link<Generic.Post> = pivot_link;
    const above_pivot: FlatItem[] = [];
    let is_pivot = true;
    while(true) {
        above_pivot.unshift({kind: "wrapper_end"});
        above_pivot.unshift(renderPost(highest, [], meta, {
            first_in_wrapper: true,
            at_or_above_pivot: true,
            is_pivot,
        }));
        above_pivot.unshift({kind: "wrapper_start"});
        is_pivot = false;

        const readv = readLink(meta, highest);
        if(readv.error != null) {
            above_pivot.unshift(fi.err(readv.error, highest));
            break;
        }
        const readc = readv.value;
        if(!readc.parent) break;
        highest = readc.parent;
    }
    res.push(...above_pivot);

    // note scroll should probably center at the pivot post and things above should require scrolling
    // up like twitter does
    if(pivot.replies) {
        res.push({kind: "horizontal_line"});
        if(pivot.replies?.reply) res.push(fi.todo("(add reply)", pivot));
        for(const reply of pivot.replies.items) {
            res.push({kind: "wrapper_start"});
            res.push(...flattenPost(reply, [], meta, {
                first_in_wrapper: true,
                is_pivot: false,
                at_or_above_pivot: false,
            }));
            res.push({kind: "wrapper_end"});
        } if(pivot.replies.items.length === 0) {
            res.push(fi.todo("*There are no replies*", pivot));
        }
    }

    return {body: res};
}