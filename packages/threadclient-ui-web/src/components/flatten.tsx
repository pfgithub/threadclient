//! flattens higherarchical page2 structure to a flat array

// todo import Generic from "api-types-generic";
// it's a trivial change just change the entrypoint and export.
import * as Generic from "api-types-generic";
import { Accessor, createSignal, Setter, untrack } from "solid-js";
import { array_key } from "./symbols";

// indent: post id[]

export type FlatPage = {
    // header: FlatItem[],
    body: (FlatItem & {
        [array_key]: unknown,
    })[],
    // sidebar: FlatItem[],
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
});

export type FlatPost = {
    kind: "post",
    content: Generic.PostNotLoaded, // note rather than generic.post we can be fancier to reduce complexity when rendering
    indent: CollapseButton[],
    collapse: CollapseButton,
    first_in_wrapper: boolean,

    is_pivot: boolean,
    at_or_above_pivot: boolean,
    threaded: boolean,
    id: Generic.Link<Generic.Post>,
};

const fi = {
    todo: (note: string, data: unknown): FlatItem => ({kind: "todo", note, data}),
    err: (note: string, data: unknown): FlatItem => ({kind: "error", note, data}),
};

type RenderPostOpts = {
    first_in_wrapper: boolean,
    is_pivot: boolean,
    at_or_above_pivot: boolean,
    threaded: boolean,
};

function renderPost(
    post_link: Generic.Link<Generic.PostNotLoaded>,
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
        indent: opts.threaded ? parent_indent.map((idnt, i, a) => {
            if(i === a.length - 1) {
                return {...idnt, threaded: true};
            }
            return idnt;
        }) : parent_indent,
        collapse: final_indent,
        first_in_wrapper: opts.first_in_wrapper,

        is_pivot: opts.is_pivot,
        at_or_above_pivot: opts.at_or_above_pivot,
        threaded: opts.threaded,
        id: post_link,
    };
}

function postReplies(post: Generic.Post, meta: Meta): Generic.Link<Generic.PostNotLoaded>[] {
    const res: Generic.Link<Generic.PostNotLoaded>[] = [];
    
    function addReplies(replies: Generic.Link<Generic.Post>[]) {
        for(const reply of replies) {
            const readlink = readLink(meta, reply);
            if(readlink.error != null) {
                res.push(Symbol("error; "+readlink.error) as Generic.Link<Generic.PostNotLoaded>);
            }else{
                const rpli = readlink.value;
                if(rpli.kind === "loaded") {
                    addReplies(rpli.replies?.items ?? []);
                }else{
                    res.push(reply as Generic.Link<Generic.PostNotLoaded>);
                }
            }
        }
    }
    addReplies(post.replies?.items ?? []);

    return res;
}

function flattenPost(
    post_link: Generic.Link<Generic.PostNotLoaded>,
    parent_indent: CollapseButton[],
    meta: Meta,
    rpo: RenderPostOpts,
): FlatItem[] {
    const res: FlatItem[] = [];

    const post_read = readLink(meta, post_link);
    if(post_read.error != null) {
        res.push(fi.err(post_read.error, post_link));
        return res;
    }
    const post = post_read.value;

    const rres = renderPost(post_link, parent_indent, meta, rpo);
    res.push(rres);

    if(rres.kind !== "post") return res;

    const indent_excl_self = rres.indent.map(v => v.threaded ? {...v, threaded: false} : v);
    const indent_incl_self = [...indent_excl_self, rres.collapse];

    const show_replies = post.kind === "post" ? post.content.kind === "post" ?
        post.content.show_replies_when_below_pivot
    : true : true;

    if((rpo.threaded || !rres.collapse.collapsed) && show_replies) {
        const replies = postReplies(post, meta);
        for(const reply of replies) {
            res.push(...flattenPost(
                reply,
                rpo.threaded ? indent_excl_self : indent_incl_self,
                meta,
                {...rpo, first_in_wrapper: false, threaded: replies.length === 1},
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

type HighestArrayItem = ({
    value: Generic.Link<Generic.PostNotLoaded>,
} | {
    error: string,
}) & {
    pivot?: undefined | boolean,
};
function highestArray(post: Generic.Link<Generic.Post>, meta: Meta): HighestArrayItem[] {
    const res: HighestArrayItem[] = [];

    function addOne(item: Generic.Link<Generic.Post>): Generic.Link<Generic.Post> | null {
        const loaded = readLink(meta, item);
        if(loaded.error != null) {
            res.push({error: loaded.error});
            return null;
        }
        const child = loaded.value;

        if(child.kind === "loaded") {
            for(const reply of [...child.replies?.items ?? []].reverse()) {
                void addOne(reply);
            }
            // should we return the first item of the replies array's parent?
            // instead of the "loaded"'s parent?
        }else{
            res.push({value: item as Generic.Link<Generic.PostNotLoaded>});
        }

        return child.parent;
    }

    // for(let highest = post; highest; highest = addOne(highest));
    let highest: Generic.Link<Generic.Post> | null = post;
    while(highest) {
        highest = addOne(highest);
    }

    const rrlm0 = res[0];
    if(rrlm0) rrlm0.pivot = true;

    return [...res].reverse();
}

export function flatten(pivot_link: Generic.Link<Generic.Post>, meta: Meta): FlatPage {
    const res: FlatItem[] = [];

    const pivot = readLinkAssertFound(meta, pivot_link);

    const highest_arr = highestArray(pivot_link, meta);
    for(const item of highest_arr) {
        res.push({kind: "wrapper_start"});
        if('error' in item) {
            res.push(fi.err(item.error, highest_arr));
        }else{
            res.push(renderPost(item.value, [], meta, {
                first_in_wrapper: true,
                at_or_above_pivot: true,
                is_pivot: item.pivot ?? false,
                threaded: false,
            }));
        }
        res.push({kind: "wrapper_end"});
    }

    // note scroll should probably center at the pivot post and things above should require scrolling
    // up like twitter does
    if(pivot.replies) {
        res.push({kind: "horizontal_line"});
        if(pivot.replies?.reply) res.push(fi.todo("(add reply)", pivot));
        for(const reply of postReplies(pivot, meta)) {
            res.push({kind: "wrapper_start"});
            res.push(...flattenPost(reply, [], meta, {
                first_in_wrapper: true,
                is_pivot: false,
                at_or_above_pivot: false,
                threaded: false,
            }));
            res.push({kind: "wrapper_end"});
        } if(pivot.replies.items.length === 0) {
            res.push(fi.todo("*There are no replies*", pivot));
        }
    }

    console.log("FLATTEN RESULT", res, meta, Object.entries(meta.content).length);

    let i_excl_post = 0;
    return {body: res.map(itm => {
        const key: {v: unknown} = (() => {
            if(itm.kind === "post") {
                return {v: itm.id};
            }
            i_excl_post += 1;
            return {v: i_excl_post};
            // hmm. this isn't great keying. we can do better
        })();
        return {...itm, [array_key]: key.v};
    })};
}