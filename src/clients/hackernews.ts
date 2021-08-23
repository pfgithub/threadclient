import type * as Generic from "../types/generic";
import type * as HN from "./hackernews/hn_types";
import { assertNever } from "../util";
import type { ThreadClient } from "./base";
import { ParsedPath, parseLink } from "./hackernews/hn_router";

export type ID = string;
export type IDMap = Map<ID, IDMapEntry>;

type IDMapEntry = {
    kind: "unprocessed" | "processing" | "processed",
    link: Generic.Link<Generic.PostData>,

    data: IDMapData,
};
type IDMapData = {
    kind: "item",
    item: HN.Item,
    parent: string,
} | {
    kind: "header",
    parsed: ParsedPath,
    replies: HN.Item[],
};

function setUpMap(map: IDMap, data: IDMapData): void {
    const entry_id = getEntryID(data);
    const prev_value = map.get(entry_id);
    if(prev_value) {
        if(prev_value.data !== data) {
            throw new Error("ERROR it already exists "+entry_id+" but it's different");
        }
        throw new Error("ERROR it already exists "+entry_id);
    }

    if(data.kind === "header") {
        for(const reply of data.replies) {
            setUpMap(map, {
                kind: "item",
                item: reply,
                parent: entry_id,
            });
        }
    }else if(data.kind === "item") {
        for(const reply of data.item.comments ?? []) {
            setUpMap(map, {
                kind: "item",
                item: reply,
                parent: entry_id,
            });
        }
        // TODO if no data.item.comments, make a loader
    }else assertNever(data);

    map.set(entry_id, {
        kind: "unprocessed",
        link: createLink(),
        data,
    });
}
function createLink<T>(): Generic.Link<T> {
    return {ref: undefined, err: "processing not completed"};
}
function getPostData(map: IDMap, key: string): Generic.Link<Generic.PostData> {
    const value = map.get(key);
    if(!value) {
        // TODO determine which load more to use
        return {ref: undefined, err: "post was not found in tree (TODO load more) ("+key+")"};
    }
    if(value.kind === "unprocessed") {
        value.kind = "processing";

        const res = postDataFromListingMayError(map, value);
        [value.link.ref, value.link.err] = [res, undefined];

        value.kind = "processed";

        return value.link;
    }else if(value.kind === "processing" || value.kind === "processed") {
        return value.link;
    }else assertNever(value.kind);
}

function postDataFromListingMayError(map: IDMap, value: IDMapEntry): Generic.PostData {
    if(value.data.kind === "header") {
        return getPageHeader(value.data.parsed, {
            sort: null,
            reply: null,
            items: value.data.replies.map(reply => ({kind: "post", post: getPostData(map, getID(reply))})),
        });
    }else if(value.data.kind === "item") {
        const item = value.data.item;
        return {
            kind: "post",
            url: "/item?id="+item.id,

            parent: getPostData(map, value.data.parent),
            replies: {
                sort: null,
                reply: null,
                items: (item.comments ?? []).map(reply => ({kind: "post", post: getPostData(map, getID(reply))})),
            },
            content: {
                kind: "post",
                title: item.title != null ? {text: item.title, body_collapsible: {default_collapsed: true}} : null,
                thumbnail: item.title != null ? {kind: "default", thumb: "default"} : undefined,
                author: item.user != null ? {
                    name: item.user,
                    color_hash: item.user.toLowerCase(),
                    link: "/user?id="+item.user,
                } : undefined,
                info: {
                    creation_date: item.time * 1000,
                },
                body: item.content != null ? {
                    kind: "text",
                    markdown_format: "reddit_html",
                    content: item.content,
                } : item.url != null ? {
                    kind: "link",
                    url: item.url,
                } : {
                    kind: "none",
                },
                actions: {
                    vote: item.type !== "job" ? {
                        kind: "counter",
                        unique_id: "/vote/"+getEntryID(value.data),
                        time: Date.now(),
                        incremented_label: "Voted",
                        label: "Vote",
                        count_excl_you: item.points ?? "hidden",
                        you: undefined,
                        actions: {},
                    } : undefined,
                },
                show_replies_when_below_pivot: item.title != null ? false : {default_collapsed: false},
            },
            internal_data: value,
            display_style: "centered",
        };
    }else assertNever(value.data);
}

function getEntryID(entry: IDMapData): string {
    if(entry.kind === "item") {
        return getID(entry.item);
    }else if(entry.kind === "header") {
        return "PAGE_HEADER";
    }else assertNever(entry);
}
function getID(v: HN.Item): string {
    return "item="+v.id;
}

export const client: ThreadClient = {
    id: "hackernews",
    async getPage(pathraw): Promise<Generic.Page2> {
        const [parsed, path] = parseLink(pathraw);

        const url = getFetchUrlFromParsed(parsed, path);

        const map: IDMap = new Map();

        if(url.kind === "firebaseio") {
            throw new Error("TODO");
        }else if(url.kind === "node-hnapi") {
            const fetchres = (await fetch(url.url).then(r => r.json())) as HN.Page;

            setUpMap(map, {
                kind: "header",
                parsed,
                replies: Array.isArray(fetchres) ? fetchres : [fetchres],
            });

            return {
                pivot: getPostData(map, Array.isArray(fetchres) ? "PAGE_HEADER" : getID(fetchres)),
            };
        }else assertNever(url);
    }
};
function getPageHeader(parsed: ParsedPath, replies: Generic.ListingData): Generic.PostData {
    return {
        kind: "post",
        url: null,

        parent: null,
        replies,

        content: {
            kind: "page",
            title: parsed.kind === "home" ? {
                news: "Hacker News",
                newest: "New Links",
                newcomments: "New Comments",
                ask: "Ask",
                show: "Show",
                jobs: "Jobs",
            }[parsed.tab] : parsed.kind,
            wrap_page: {
                sidebar: {
                    sort: null,
                    reply: null,
                    items: [],
                },
                header: {
                    kind: "bio",
                    banner: null,
                    icon: null,
                    name: {
                        link_name: parsed.kind === "home" ? parsed.tab : parsed.kind
                    },
                    body: {kind: "none"},
                    menu: null,
                    raw_value: parsed,
                }
            },
        },
        internal_data: parsed,
        display_style: "fullscreen",
    };
}

type FetchUrl = {kind: "node-hnapi", url: string} | {kind: "firebaseio", url: string, resp_type: "user"};
function getFetchUrlFromParsed(parsed: ParsedPath, raw: string): FetchUrl {
    if(parsed.kind === "user") {
        throw new Error("TODO user");
    }
    if(parsed.kind === "home" || parsed.kind === "front") {
        return {kind: "node-hnapi", url: "https://node-hnapi.herokuapp.com"+raw};
    }
    if(parsed.kind === "item") {
        // note: node-hnapi does not handle /item/ very well
        // - the parent is missing
        // - things are the wrong type
        // - comment opacity is missing
        // it may be better to use
        // - https://hacker-news.firebaseio.com/v0/item/….json
        // to get some info (although that does not give comment opacity either)
        return {kind: "node-hnapi", url: "https://node-hnapi.herokuapp.com/item/"+parsed.id};
    }
    assertNever(parsed);
}