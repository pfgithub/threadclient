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
    collapse: CollapseButton | null,
    first_in_wrapper: boolean,

    is_pivot: boolean,
    at_or_above_pivot: boolean,
    threaded: boolean,
    depth: number,
    id: Generic.Link<Generic.Post>,
};

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
};

function unwrapPost(post: Generic.PostNotLoaded): Generic.PostNotLoaded {
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
export function postContentCollapseInfo(content: Generic.PostContent, opts: {is_pivot: boolean}): CollapseInfo {
    if(content.kind === "post") {
        const collapsible = content.collapsible;
        if(collapsible === false) {
            return {default_collapsed: false, user_controllable: false};
        }else if(collapsible === "collapsed-unless-pivot") {
            return {default_collapsed: true, user_controllable: opts.is_pivot};
        }else {
            return {default_collapsed: collapsible.default_collapsed, user_controllable: true};
        }
    }else return {default_collapsed: false, user_controllable: false};
}
export function postCollapseInfo(post: Generic.PostNotLoaded, opts: {is_pivot: boolean}): CollapseInfo {
    if(post.kind === "post") {
        return postContentCollapseInfo(post.content, opts);
    }else return {default_collapsed: false, user_controllable: false};
}

export function renderPost(
    post_link: Generic.Link<Generic.PostNotLoaded>,
    parent_indent: CollapseButton[],
    meta: Meta,
    opts: RenderPostOpts,
): FlatItem {
    const post_read = readLink(meta, post_link);
    if(post_read.error != null) return fi.err(post_read.error, post_link);
    const post = unwrapPost(post_read.value);

    const {default_collapsed, user_controllable: is_collapsible} = postCollapseInfo(post, opts);
    const self_collapsed = getCState(
        meta.collapse_data,
        post_link,
        {default: default_collapsed},
    ).collapsed();

    const final_indent: CollapseButton | null = is_collapsible ? {
        id: post_link,
        threaded: false,
        collapsed: self_collapsed,
    } : null;

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
        depth: opts.depth,
        id: post_link,
    };
}

function postReplies(listing: Generic.ListingData | null, meta: Meta): Generic.Link<Generic.PostNotLoaded>[] {
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
    addReplies(listing?.items ?? []);

    return res;
}

export function flattenPost(
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
    const post = unwrapPost(post_read.value);

    const rres = renderPost(post_link, parent_indent, meta, rpo);
    res.push(rres);

    if(rres.kind !== "post") return res;

    const indent_excl_self = rres.indent.map(v => v.threaded ? {...v, threaded: false} : v);
    const indent_incl_self: CollapseButton[] = [...indent_excl_self, ...rres.collapse ? [rres.collapse] : []];

    const show_replies = post.kind === "post" ? post.content.kind === "post" ?
        post.content.show_replies_when_below_pivot
    : true : true;

    if(show_replies) {
        const replies = postReplies(post.replies, meta);
        const replies_threaded = (
            meta.settings?.allow_threading !== false
        ) && replies.length === 1 && (rpo.threaded ? true : (
            readLink(meta, replies[0]!).value?.replies?.items.length === 1
        ));
        if((replies_threaded && rpo.threaded) || !(rres.collapse?.collapsed ?? false)) for(const reply of replies) {
            res.push(...flattenPost(
                reply,
                rpo.threaded && replies_threaded ? indent_excl_self : indent_incl_self,
                meta,
                {...rpo, first_in_wrapper: false, threaded: replies_threaded, depth: rpo.depth + 1},
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

    settings?: undefined | {
        allow_threading?: undefined | boolean,
    },
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

function flattenTopLevelReplies(replies: Generic.ListingData | null, meta: Meta): FlatItem[] {
    const res: FlatItem[] = [];

    if(replies?.reply) res.push(fi.todo("(add reply)", replies));
    const post_replies = postReplies(replies, meta);
    for(const reply of post_replies) {
        res.push({kind: "wrapper_start"});
        res.push(...flattenPost(reply, [], meta, {
            first_in_wrapper: true,
            is_pivot: false,
            at_or_above_pivot: false,
            threaded: false,
            depth: 0,
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

    const pivot = readLinkAssertFound(meta, pivot_link);

    const highest_arr = highestArray(pivot_link, meta);
    for(const item of highest_arr) {
        if(!('error' in item)) {
            const itmv = readLink(meta, item.value);
            if(itmv.value != null && itmv.value.kind === "post" && itmv.value.content.kind === "page") {
                const content = itmv.value.content;
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
        }

        res.push({kind: "wrapper_start"});
        if('error' in item) {
            res.push(fi.err(item.error, highest_arr));
        }else{
            res.push(renderPost(item.value, [], meta, {
                first_in_wrapper: true,
                at_or_above_pivot: true,
                is_pivot: item.pivot ?? false,
                threaded: false,
                depth: 0,
            }));
        }
        res.push({kind: "wrapper_end"});
    }

    // note scroll should probably center at the pivot post and things above should require scrolling
    // up like twitter does
    if(pivot.replies) {
        res.push({kind: "horizontal_line"});
        res.push(...flattenTopLevelReplies(pivot.replies, meta));
    }

    console.log("FLATTEN RESULT", res, meta, Object.entries(meta.content).length);

    return {
        header: res_header ?? undefined,
        sidebar: res_sidebar != null ? autokey(res_sidebar):  undefined,
        body: autokey(res),
    };
}

export function autokey(items: FlatItem[]): (FlatItem & {[array_key]: unknown})[] {
    let i_excl_post = 0;
    const autokeyItem = (itm: FlatItem): FlatItem & {[array_key]: unknown} => {
        const key: {v: unknown} = (() => {
            if(itm.kind === "post") {
                return {v: itm.id};
            }
            i_excl_post += 1;
            return {v: i_excl_post};
            // hmm. this isn't great keying. we can do better
        })();
        return {...itm, [array_key]: key.v};
    };
    return items.map(autokeyItem);
}