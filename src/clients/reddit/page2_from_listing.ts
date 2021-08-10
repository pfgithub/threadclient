import * as Reddit from "../../types/api/reddit";
import * as Generic from "../../types/generic";
import { rt } from "../../types/generic";
import { assertNever } from "../../util";
import {
    authorFromPostOrComment, awardingsToFlair, deleteButton, getCodeButton, getCommentBody,
    getPointsOn, getPostBody, ParsedPath, replyButton, reportButton, saveButton, SortedPermalink, sortWrap,
    ThreadOpts, updateQuery, urlNotSupportedYet
} from "../reddit";
export type ID = string;
export type IDMap = Map<ID, IDMapEntry>;

// // needs to be able to tell you if it's a thing or load more or whatever
// // also it should like update in the future
// // idk
type IDMapEntry = {
    kind: "unprocessed" | "processing" | "processed",
    link: Generic.Link<Generic.PostData>,

    listing_raw: Reddit.Post,
    options: ThreadOpts,
    parent_permalink: SortedPermalink,

    refs: {
        parent: string | null,
        replies: string[] | null,
    },
};

export function page2FromListing(
    id_map: IDMap,
    pathraw: string,
    path: ParsedPath,
    page: Reddit.AnyResult,
): Generic.Link<Generic.PostData> {
    if(Array.isArray(page)) {
        if(page[0].data.children.length !== 1) {
            return unsupportedPage(pathraw, page);
        }
        const firstchild = page[0].data.children[0]!;
        if(firstchild.kind !== "t3") {
            return unsupportedPage(pathraw, page);
        }

        const link_fullname = firstchild.data.name;
        const default_sort: Reddit.Sort = firstchild.data.suggested_sort ?? "confidence";
        // const is_contest_mode = firstchild.data.contest_mode;
        // const can_mod_post = firstchild.data.can_mod_post;
        const permalink: string = firstchild.data.permalink;
        // const is_locked = firstchild.data.locked;
        const is_chat = firstchild.data.discussion_type === "CHAT";

        const children_root = page[1].data.children;
        const root0 = children_root[0];
        if(root0 && root0.kind === "t1" && root0.data.parent_id !== link_fullname) {
            // TODO figure out how to handle these in IDMap
            // there are two IDs which need to link to the same node
            // the parent node's reply is this load more
            // and the reply's parent is this load more
            // header_children.push(loadMoreContextNode(
            //     root0.data.subreddit,
            //     (link_fullname ?? "").replace("t3_", ""),
            //     root0.data.parent_id.replace("t1_", "")
            // ));
        }

        for(const reply of [...page[0].data.children]) {
            setUpMap(id_map, reply, {}, {
                permalink,
                sort: default_sort,
                is_chat: is_chat,
            }, {
                parent: null,
                replies: page[1].data.children.map(r => r.data.name),
            });
        }
        const first_page = page[0].data.children[0]!.data;
        for(const reply of [...page[1].data.children]) {
            setUpMap(id_map, reply, {}, {
                permalink,
                sort: default_sort,
                is_chat: is_chat,
            }, {
                parent: first_page.name,
                replies: [],
            });
        }

        let focus = first_page.name;
        if(path.kind === "comments" && path.focus_comment != null) {
            focus = "t1_"+path.focus_comment.toLowerCase();
            if(!id_map.has(focus)) focus = first_page.name;
        }

        return getPostData(id_map, focus);
    }
    //expectUnsupported(page.kind);

    return unsupportedPage(pathraw, page);
}

function unsupportedPage(pathraw: string, page: unknown): Generic.Link<Generic.PostData> {
    return {ref: {
        kind: "post",
        parent: null,
        url: null,
        replies: null,
        content: {
            kind: "post",
            title: {text: "Error!", body_collapsible: null},
            author: null,
            body: {
                kind: "richtext",
                content: [
                    ...urlNotSupportedYet(pathraw),
                    rt.pre(JSON.stringify(page, null, "  "), "json"),
                ],
            },
            show_replies_when_below_pivot: false,
        },
        internal_data: null,
        display_style: "centered",
    }, err: undefined};
}

export function setUpMap(
    map: IDMap,
    listing_raw: Reddit.Post,
    options: ThreadOpts,
    parent_permalink: SortedPermalink,
    refs: {parent: string | null, replies: string[] | null},
): void {
    options.force_expand ??= "closed";

    const prev_value = map.get(listing_raw.data.name);
    if(prev_value) {
        if(prev_value.listing_raw !== listing_raw) {
            throw new Error("TODO it already exists "+listing_raw.data.name+" but it's different");
        }
        throw new Error("TODO it already exists "+listing_raw.data.name);
    }

    const res_parent = refs.parent;
    const res_replies = refs.replies;

    if(listing_raw.kind === "t1") {
        const listing = listing_raw.data;

        //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if(listing.replies) {
            for(const reply of listing.replies.data.children) {
                setUpMap(map, reply, options, sortWrap(parent_permalink, listing.permalink), {
                    parent: listing.name,
                    replies: null,
                });
            }
        }
    }else if(listing_raw.kind === "t3") {
        const listing = listing_raw.data;
        if(listing.crosspost_parent_list) {
            for(const xpost_parent of listing.crosspost_parent_list) {
                setUpMap(map, {
                    kind: "t3",
                    data: xpost_parent,
                }, options, sortWrap(parent_permalink, xpost_parent.permalink), {
                    parent: null,
                    replies: null,
                });
            }
        }
    }else if(listing_raw.kind === "more") {
        // nothing to add.
    }else {
        console.log("TODO setUpMap "+listing_raw.kind);
    }

    map.set(listing_raw.data.name, {
        kind: "unprocessed",
        link: createLink(),

        listing_raw,
        options,
        parent_permalink,

        refs: {parent: res_parent, replies: res_replies},
    });
}

// returns a pointer to the PostData
// TODO support load more in both parents and replies
export function getPostData(map: IDMap, key: string): Generic.Link<Generic.PostData> {
    const value = map.get(key);
    if(!value) {
        // TODO determine which load more to use
        return {ref: undefined, err: "post was not found in tree (TODO load more) ("+key+")"};
    }
    if(value.kind === "unprocessed") {
        value.kind = "processing";

        const res = postDataFromListingMayError(map, value, value.listing_raw, value.options, value.parent_permalink);
        [value.link.ref, value.link.err] = [res, undefined];

        value.kind = "processed";

        return value.link;
    }else if(value.kind === "processing" || value.kind === "processed") {
        return value.link;
    }else assertNever(value.kind);
}

function getPostInfo(listing: Reddit.PostOrComment): Generic.PostInfo {
    return {
        creation_date: listing.created_utc * 1000,
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        edited: listing.edited ? {date: listing.edited * 1000} : undefined,
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        pinned: listing.pinned || listing.stickied || false,
    };
}

function postDataFromListingMayError(
    map: IDMap,
    entry: IDMapEntry,
    listing_raw: Reddit.Post,
    options: ThreadOpts,
    parent_permalink: SortedPermalink,
): Generic.PostData {
    options.force_expand ??= "closed";
    if(listing_raw.kind === "t1") {
        const listing = listing_raw.data;

        const replies: Generic.ListingData = {
            sort: null,
            reply: replyButton(listing.name),
            locked: listing.locked,
            items: [],
        };
        //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if(listing.replies) {
            for(const reply of listing.replies.data.children) {
                replies.items.push({
                    kind: "post",
                    post: getPostData(map, reply.data.name),
                });
            }
        }

        return {
            kind: "post",
            url: updateQuery(listing.permalink, {context: "3", sort: parent_permalink.sort}),

            // need to get the parent post here
            parent: entry.refs.parent != null ? getPostData(map, entry.refs.parent) : null,
            replies,

            content: {
                kind: "post",
                title: null,
                author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])) ?? null,
                body: getCommentBody(listing),
                info: getPostInfo(listing),
                show_replies_when_below_pivot: {default_collapsed: listing.collapsed ?? false},
                actions: {
                    vote: parent_permalink.is_chat
                        ? undefined
                        : getPointsOn(listing)
                    ,
                    other: [
                        deleteButton(listing.name),
                        saveButton(listing.name, listing.saved),
                        reportButton(listing.name, listing.subreddit),
                        getCodeButton(listing.body),
                    ],
                },
            },
            internal_data: listing_raw,
            display_style: "centered",
        };
    }else if(listing_raw.kind === "t3") {
        const listing = listing_raw.data;

        return {
            kind: "post",
            url: updateQuery(listing.permalink, {context: "3", sort: parent_permalink.sort}),

            parent: getPostData(map, listing.subreddit_id),
            replies: entry.refs.replies ? {
                sort: null,
                reply: replyButton(listing.name),
                locked: listing.locked,
                items: entry.refs.replies.map(reply_id => {
                    return {
                        kind: "post",
                        post: getPostData(map, reply_id),
                    };
                }),
            } : null,

            content: {
                kind: "post",
                title: null,
                author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])) ?? null,
                body: getPostBody(listing, parent_permalink),
                info: getPostInfo(listing),
                show_replies_when_below_pivot: false,
            },
            internal_data: listing_raw,
            display_style: "centered",
        };
    }else{
        return {
            kind: "post",
            url: null,
            parent: {ref: {kind: "vloader", parent: null, replies: null}, err: undefined},
            replies: null,
            internal_data: listing_raw,
            display_style: "centered",

            content: {
                kind: "post",
                title: {text: "Error! TODO "+listing_raw.kind, body_collapsible: null},
                body: {kind: "richtext", content: [
                    rt.p(rt.error("TODO", listing_raw)),
                ]},
                author: null,
                show_replies_when_below_pivot: false,
            },
        };
    }
}

function createLink<T>(): Generic.Link<T> {
    return {ref: undefined, err: "processing not completed"};
}