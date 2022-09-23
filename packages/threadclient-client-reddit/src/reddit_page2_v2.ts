import * as Generic from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import { getSrId, subUrl } from "./page2_from_listing";
import { client, SubrInfo, SubSort } from "./reddit";

// attempt 3 at making a page2 version of reddit

type ItemDetails = {
    basic: unknown, // TODO: basic should be a stringifiable type. an object id should be a stringified version of its basic.
    full: unknown,
    result: object, // cannot be null
};
type XI<T extends ItemDetails> = T;

// ah:
// see sidebar for example
// there is still a sidebar node. sidebars just don't use it as their parent, it's a node that
// only exists for the /sidebar path

// so the goal: every node defines how to load it from the different places it may be loaded from
// ie: load my replies | load as a parent

// load_as_parent: unknown, load_replies: unknown
// the unknown is any additional data needed when creating a loader for this thing
// so the sidebar object itself would be what you request when you were asked for a sidebar page
// - it would be client > sidebar object > sidebar content
//   - not including a sub id card because then we'd have double sidebars
// and when you click a sidebar item, its parent is
// - what is its parent? the sub id card? now we have duplicate sidebars again
// not sure. maybe we'll need a flag

export type Item = {
    "client": XI<{
        basic: 0,
        full: never, // if we want the client to have eg your username, maybe it should actually have some full data
        result: Generic.Post,
    }>,
    "load_client": XI<{
        basic: 0,
        full: never,
        result: Generic.Opaque<"loader">,
    }>,
    "subreddit": XI<{
        basic: {
            sub: SubrInfo,
            sort: null | SubSort,

            // always use 'hot' if not provided
            // TODO: consider overriding defaults for some subreddits which are intended to be viewed on /new
        },
        full: {
            listing: Reddit.Listing,
            // before: null | string, after: null | string,
        },
        result: Generic.Post,

        // replies_loader:
        // - before: null | string, after: null | string
    }>,
    "subreddit_content": XI<{
        basic: {
            sub: SubrInfo,
            sort: null | SubSort,
        },
        full: {
            listing: Reddit.Listing,
        },
        result: Generic.HorizontalLoaded,
    }>,
    "subreddit_loader": XI<{
        basic: {
            sub: SubrInfo,
            sort: null | SubSort,
        },
        full: never,
        result: Generic.Opaque<"loader">,
    }>,
    "subreddit_sidebarbio_loader": XI<{
        basic: {
            sub: SubrInfo,
            sort: null | SubSort,
        },
        full: never,
        result: Generic.Opaque<"loader">,
    }>,
    "subreddit_sidebar_content": XI<{
        basic: {
            sub: SubrInfo,
            sort: null | SubSort,
        },
        full: "TODO",
        result: Generic.HorizontalLoaded,
    }>,
    "subreddit_bio": XI<{
        basic: {
            sub: SubrInfo,
            sort: null | SubSort,
        },
        full: "TODO",
        result: Generic.RedditHeader,
    }>,
};
// this won't quite work yet because if something is created with only basic info, it won't get
// filled in once full info is available. that's all that we have to fix though.
// ok maybe we do the following:
// - any time getOrCreateItem is called, store its basic
// - if it is called with full content, create immediately
// - else, defer creation until the end when we while(basic only items remaining) {generate basic only item}
// no that's not quite right because something might get created as basic at first and then we find the content
// later. ig we can just regenerate when we get full content available.
// ^ that should work.

// ok so something I'm trying to do is
// - a 'basic' and 'full' version of the object should always be the same
// so why do we have to call twice? simple:
// - the 'fill' function also describes how to generate child objects.
// oh! here's how we do it
// fill(content, basic)
// - key: getOrCreateItem(content, "subreddit_content", basic, autofill(full => full))
// autofill uses dependency tracking. when a 'full' is available for the object, we update all
// dependencies.

// this might actually work
// it doesn't solve:
// - ergonomics of loaders (every loader is painful)
// - 'basic's being guarenteed to be unique strings (we should be able to solve this by assembling 'bits' you can make
//   your basic out of, and then the final string is: [item id, ...bits].join("/")). ie a subreddit would have a SubBit and a SortBit
// it does solve
// - the huge disorganized mess in page2_from_listing and issues with 'how do I get the parent for this object'

// ok so this could work
// so the next things to do are:
// - fix 'basic's
// - proof of concept

// so how do we fix loaders?
// a loader is:
// - it has a key
// - it has a value. the value is empty and only gets filled once its full is available

type ItemV = {
    basic: unknown, // this is the same as the key to the map, just in object form

    full_available: boolean,

    // all watchers are notified when a full becomes available for this object
    watchers: null | ((full: unknown) => void)[],

    value: unknown,
};
export class Psys {
    items: Map<string, ItemV>;

    constructor() {
        this.items = new Map();
    }

    item<Kind extends keyof Item>(
        kind: Kind,
        basic: Item[Kind]["basic"],
        full?: undefined | Item[Kind]["full"],
        // TODO: we can now differentiate between Links and NullableLinks
    ): Generic.Link<Item[Kind]["result"]> {
        const data = item_data[kind];
        if(data == null) return Generic.p2.stringLink(kind + "[E-no-content-fn]");

        // if(info == null) return a link to an error
        const id_str = kind + "/" + data.id(basic);
        const id_link = Generic.p2.stringLink<Item[Kind]["result"]>(id_str);

        let prevv: ItemV | undefined = this.items.get(id_str);
        if('basic' in data) {
            if(prevv == null) {
                const watchers_a: ((full: unknown) => void)[] = [];
                this.items.set(id_str, prevv = {
                    basic,
                    full_available: false,
                    watchers: watchers_a,
                    value: data.basic(this, basic, (cb) => {
                        watchers_a.push(cb as ((full: unknown) => void));
                    }),
                });
            }
            if(full != null && !prevv.full_available) {
                prevv.full_available = true;
                prevv.watchers?.forEach(w => w(full));
                prevv.watchers = null;
            }
        }else if(full != null && prevv == null) {
            this.items.set(id_str, {
                basic,
                full_available: true,
                watchers: null,
                value: data.full(this, basic, full),
            });
        }

        return id_link;
    }

    render(): Generic.Page2Content {
        const content: Generic.Page2Content = {};
        for(const [key, value] of this.items.entries()) {
            const link_id = Generic.p2.stringLink(key);
            Generic.p2.fillLink(content, link_id, value.value);
        }
        return content;
    }
}

type ItemDataType = {[key in keyof Item]?: undefined | {
    id: (basic: Item[key]["basic"]) => string,
} & ({
    // used for everything else. these should be filled once, immediately.
    basic: (
        psys: Psys,
        basic: Item[key]["basic"],
        onfill: <U>(cb: (full: Item[key]["full"]) => U) => void,
    ) => Item[key]["result"] | null,
} | {
    // used for loader values. these should only be filled once the full is available.
    full: (
        psys: Psys,
        basic: Item[key]["basic"],
        full: Item[key]["full"],
    ) => Item[key]["result"] | null,
})};
const item_data: ItemDataType = {
    subreddit: {id(basic) {
        return "SUB_"+getSrId(basic.sub, basic.sort);
    }, basic(psys, basic, onfill): Generic.Post {
        // alternative onfill option:
        // item.subreddit_content.from(content, basic)
        // onfill(full => item.subreddit_content.fill(content, basic, full));

        onfill(full => {
            psys.item("subreddit_content", basic, full);
        });

        const replies: Generic.PostReplies = {
            display: "repivot_list",

            loader: {
                kind: "horizontal_loader",
                key: psys.item("subreddit_content", basic),
                load_count: null,
                request: psys.item("subreddit_loader", basic),
                client_id: client.id,
                autoload: true,
            },

            sort_options: [
                {kind: "url", name: "Hot", url: subUrl(basic.sub, {v: "hot", t: "all"})},
                {kind: "url", name: "Best", url: subUrl(basic.sub, {v: "best", t: "all"})},
                {kind: "url", name: "New", url: subUrl(basic.sub, {v: "new", t: "all"})},
                {kind: "url", name: "Rising", url: subUrl(basic.sub, {v: "rising", t: "all"})},
                {kind: "more", name: "Top", submenu: [
                    {kind: "url", name: "Hour", url: subUrl(basic.sub, {v: "top", t: "hour"})},
                    {kind: "url", name: "Day", url: subUrl(basic.sub, {v: "top", t: "day"})},
                    {kind: "url", name: "Week", url: subUrl(basic.sub, {v: "top", t: "week"})},
                    {kind: "url", name: "Month", url: subUrl(basic.sub, {v: "top", t: "month"})},
                    {kind: "url", name: "Year", url: subUrl(basic.sub, {v: "top", t: "year"})},
                    {kind: "url", name: "All", url: subUrl(basic.sub, {v: "top", t: "all"})},
                ]},
                {kind: "more", name: "Controversial", submenu: [
                    {kind: "url", name: "Hour", url: subUrl(basic.sub, {v: "controversial", t: "hour"})},
                    {kind: "url", name: "Day", url: subUrl(basic.sub, {v: "controversial", t: "day"})},
                    {kind: "url", name: "Week", url: subUrl(basic.sub, {v: "controversial", t: "week"})},
                    {kind: "url", name: "Month", url: subUrl(basic.sub, {v: "controversial", t: "month"})},
                    {kind: "url", name: "Year", url: subUrl(basic.sub, {v: "controversial", t: "year"})},
                    {kind: "url", name: "All", url: subUrl(basic.sub, {v: "controversial", t: "all"})},
                ]},
            ],
        };

        return {
            kind: "post",
            client_id: client.id,
            url: "/"+basic.sub.base.join("/"),
            parent: {
                loader: {
                    // look at this mess. we need to be able to call
                    // psys.loader("client", 0, 0) and have it generate this for us.
                    // (arg 1 is , arg 2 is data used for generating the loader. ie a load_count could be)
                    // (extracted from it or a temp_parent could be used)
                    kind: "vertical_loader",
                    key: psys.item("client", 0),
                    temp_parent: null,
                    load_count: 1,
                    request: psys.item("load_client", 0),
                    client_id: client.id,
                    autoload: true,
                },
            },
            replies,
            content: {
                kind: "page",
                title: basic.sub.base.join("/"),
                wrap_page: {
                    sidebar: {
                        display: "tree",
                        // return a loader with load_on_view: true
                        // also use load_on_view for any loader that should not be seen by default but
                        // might be seen on a repivot

                        loader: {
                            kind: "horizontal_loader",
                            key: psys.item("subreddit_sidebar_content", basic),
                            load_count: null,
                            request: psys.item("subreddit_sidebarbio_loader", basic),
                            client_id: client.id,
                            autoload: true,
                        },
                    },
                    // v TODO: this should be a loader but [!] it is linked to the loader above.
                    //   only one at a time should load and loading one should fill in both.
                    // also for now we can keep using page1 bios but eventually we'll want to
                    // redo bios
                    header: {
                        kind: "one_loader",
                        key: psys.item("subreddit_bio", basic),
                        load_count: null,
                        request: psys.item("subreddit_sidebarbio_loader", basic),
                        client_id: client.id,
                        autoload: true,
                    },
                },
            },
            internal_data: basic,
        };
    }}
};
