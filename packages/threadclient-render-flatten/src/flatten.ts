//! flattens higherarchical page2 structure to a flat array

// todo import Generic from "api-types-generic";
// it's a trivial change just change the entrypoint and export.
import * as Generic from "api-types-generic";

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
    id: string | symbol,
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
};

const fi = {
    todo: (note: string, data: unknown): FlatItem => ({kind: "todo", note, data}),
    err: (note: string, data: unknown): FlatItem => ({kind: "error", note, data}),
};

type CollapseStates = Map<string | symbol, boolean>;

function renderPost(post: Generic.Post, parent_indent: CollapseButton[], meta: Meta): FlatPost {
    const id = "TODO unique id "+post.url+Math.random();

    const self_collapsed = meta.collapse_states.get(id) ?? (
        post.kind === "post" ? post.content.kind === "post" ? post.content.collapsible !== false ?
        post.content.collapsible.default_collapsed : false : false : false
    );

    const final_indent: CollapseButton = {
        id,
        threaded: false,
        collapsed: self_collapsed,
    };

    return {
        kind: "post",
        content: post,
        indent: parent_indent,
        collapse: final_indent,
    };
}

function flattenPost(post: Generic.Post, parent_indent: CollapseButton[], meta: Meta): FlatItem[] {
    const res: FlatItem[] = [];

    const rres = renderPost(post, parent_indent, meta);
    res.push(rres);

    const self_indent = [...rres.indent, rres.collapse];

    if(!rres.collapse.collapsed) if(post.replies) for(const reply of post.replies.items) {
        if(reply.err !== undefined) res.push(fi.err(reply.err, reply));
        else res.push(...flattenPost(reply.ref, self_indent, meta));
    }

    return res;
}

type Meta = {
    collapse_states: CollapseStates,
};

export function flatten(page: Generic.Page2, meta: Meta): FlatPage {
    const res: FlatItem[] = [];

    if(page.pivot.err !== undefined) throw new Error("no pivot; "+page.pivot.err);
    const pivot = page.pivot.ref;

    let highest: Generic.Post = pivot;
    const above_pivot: FlatItem[] = [];
    while(true) {
        above_pivot.unshift({kind: "wrapper_end"});
        above_pivot.unshift(renderPost(highest, [], meta));
        above_pivot.unshift({kind: "wrapper_start"});

        if(!highest.parent) break;
        if(highest.parent.err !== undefined) {
            above_pivot.push(fi.err(highest.parent.err, highest));
            break;
        }
        highest = highest.parent.ref;
    }
    res.push(...above_pivot);

    // note scroll should probably center at the pivot post and things above should require scrolling
    // up like twitter does
    if(pivot.replies) {
        res.push({kind: "horizontal_line"});
        if(pivot.replies?.reply) res.push(fi.todo("(add reply)", pivot));
        for(const reply of pivot.replies.items) {
            res.push({kind: "wrapper_start"});
            if(reply.err !== undefined) res.push(fi.err(reply.err, reply));
            else res.push(...flattenPost(reply.ref, [], meta));
            res.push({kind: "wrapper_end"});
        } if(pivot.replies.items.length === 0) {
            res.push(fi.todo("*There are no replies*", pivot));
        }
    }

    return {body: res};
}