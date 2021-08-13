import type * as Reddit from "../../types/api/reddit";
import type * as Generic from "../../types/generic";
import { rt } from "../../types/generic";
import { assertNever } from "../../util";
import {
    authorFromPostOrComment, awardingsToFlair, deleteButton, getCodeButton, getCommentBody,
    getPointsOn, getPostBody, ParsedPath, replyButton, reportButton, saveButton, SubrInfo, urlNotSupportedYet
} from "../reddit";

// in the future this might be changed to hold data. then to insert into
// the id map it'll have to be serialized or something
// that shouldn't be necessary - loaders could be inserted
// during setup and then there would be no issue
export type ID = string;
export type IDMap = Map<ID, IDMapEntry>;

// // needs to be able to tell you if it's a thing or load more or whatever
// // also it should like update in the future
// // idk
type IDMapEntry = {
    kind: "unprocessed" | "processing" | "processed",
    link: Generic.Link<Generic.PostData>,

    data: IDMapData,
};
// we should not need a parent_permalink
// eg a load more may be a parent_permalink style load more
// in which case info can be in {kind: "load_more"} here
// the other thing parent_permalink is used for is to find the
// sort mode but comments have access to the .parent_submission property
type IDMapData = {
    kind: "comment",
    comment: Reddit.Post,

    // comments have a property .link_id
    // I can just get the value out from the id map, no need to save it here.
    parent_submission: "not_loaded" | Reddit.T3,
} | {
    kind: "post",
    post: Reddit.T3,
    replies: "not_loaded" | Reddit.Listing,
} | {
    // when a subreddit is needed but only the replies are known,
    // nothing else about the subreddit. if nothing at all is known,
    // just use the id directly and getPostData will(todo) handle it.
    kind: "subreddit_unloaded",
    listing: Reddit.Listing,
    details: "unknown" | SubrInfo,
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
        const parent_post = page[0].data.children[0]!;
        if(parent_post.kind !== "t3") {
            return unsupportedPage(pathraw, page);
        }

        const link_fullname = parent_post.data.name;
        // const default_sort: Reddit.Sort = parent_post.data.suggested_sort ?? "confidence";
        // const is_contest_mode = firstchild.data.contest_mode;
        // const can_mod_post = firstchild.data.can_mod_post;
        // const permalink: string = parent_post.data.permalink;
        // const is_locked = firstchild.data.locked;
        // const is_chat = parent_post.data.discussion_type === "CHAT";

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

        setUpMap(id_map, {
            kind: "post",
            post: parent_post,
            replies: page[1],
        });
        for(const reply of [...page[1].data.children]) {
            setUpMap(id_map, {
                kind: "comment",
                comment: reply,
                parent_submission: parent_post,
            });
        }

        let focus: string = parent_post.data.name;
        if(path.kind === "comments" && path.focus_comment != null) {
            focus = "t1_"+path.focus_comment.toLowerCase();
            if(!id_map.has(focus)) focus = parent_post.data.name;
        }

        return getPostData(id_map, focus);
    }else if(page.kind === "Listing") {
        const sr_entry: IDMapData = {
            kind: "subreddit_unloaded",
            listing: page,
            details: path.kind === "subreddit" ? path.sub : "unknown",
        };
        const pivot_id = getEntryFullname(sr_entry);
        for(const post of page.data.children) {
            if(post.kind === "t3") {
                setUpMap(id_map, {
                    kind: "post",
                    post: post,
                    replies: "not_loaded",
                });
            }else{
                setUpMap(id_map, {
                    kind: "comment",
                    comment: post,
                    parent_submission: "not_loaded",
                });
            }
        }
        setUpMap(id_map, sr_entry);

        return getPostData(id_map, pivot_id);
    }
    //else {
    //  expectUnsupported(page.kind);

    return unsupportedPage(pathraw, page);
}

function getSrId(sub: SubrInfo): string {
    if(sub.kind === "homepage") {
        return "SR_home";
    }else if(sub.kind === "mod") {
        return "SR_mod";
    }else if(sub.kind === "multireddit") {
        return "SR_multi/u:"+sub.user.toLowerCase()+"/m:"+sub.multireddit.toLowerCase();
    }else if(sub.kind === "userpage") {
        return "SR_user/"+sub.user.toLowerCase();
    }else if(sub.kind === "subreddit") {
        return "SR_sub/"+sub.subreddit.toLowerCase();
    }else assertNever(sub);
}

function unsupportedPage(pathraw: string, page: unknown): Generic.Link<Generic.PostData> {
    return {ref: {
        kind: "post",
        parent: null,
        url: null,
        replies: null,
        content: {
            kind: "post",
            title: {text: "Error!", body_collapsible: false},
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

function getEntryFullname(entry: IDMapData): string {
    if(entry.kind === "comment") {
        return entry.comment.data.name;
    }else if(entry.kind === "post") {
        return entry.post.data.name;
    }else if(entry.kind === "subreddit_unloaded") {
        return entry.details === "unknown" ? "__UNKNOWN_LISTING_ROOT" : getSrId(entry.details);
    }else assertNever(entry);
}

export function setUpMap(
    map: IDMap,
    data: IDMapData,
): void {
    const entry_fullname = getEntryFullname(data);
    const prev_value = map.get(entry_fullname);
    if(prev_value) {
        if(prev_value.data !== data) {
            throw new Error("ERROR it already exists "+entry_fullname+" but it's different");
        }
        throw new Error("ERROR it already exists "+entry_fullname);
    }

    if(data.kind === "comment") {
        const listing_raw = data.comment;
        if(listing_raw.kind === "t1") {
            const listing = listing_raw.data;

            //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if(listing.replies) {
                for(const reply of listing.replies.data.children) {
                    // TODO if it's load more it might need a parent_permalink
                    // pass that in here or something
                    // or make a fn to do this
                    setUpMap(map, {
                        kind: "comment",
                        comment: reply,
                        parent_submission: data.parent_submission,
                    });
                }
            }
        }else if(listing_raw.kind === "more") {
            // TODO this doesn't belong here
            if(listing_raw.data.name === "t1__") return; // depth-based
        }else {
            console.log("TODO setUpMap "+listing_raw.kind);
        }
    }else if(data.kind === "post") {
        const listing = data.post.data;
        if(listing.crosspost_parent_list) {
            for(const xpost_parent of listing.crosspost_parent_list) {
                setUpMap(map, {
                    kind: "post",
                    post: {kind: "t3", data: xpost_parent},
                    replies: "not_loaded",
                });
            }
        }
    }else if(data.kind === "subreddit_unloaded") {
        // nothing to load
    }else assertNever(data);

    map.set(entry_fullname, {
        kind: "unprocessed",
        link: createLink(),
        data,
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

        const res = postDataFromListingMayError(map, value);
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
): Generic.PostData {
    if(entry.data.kind === "comment") {
        if(entry.data.comment.kind !== "t1") {
            return {
                kind: "post",
                url: null,
                parent: {ref: {kind: "vloader", parent: null, replies: null}, err: undefined},
                replies: null,
                internal_data: entry.data,
                display_style: "centered",

                content: {
                    kind: "post",
                    title: {text: "Error! TODO "+entry.data.comment.kind, body_collapsible: false},
                    body: {kind: "richtext", content: [
                        rt.p(rt.error("TODO", entry.data)),
                    ]},
                    show_replies_when_below_pivot: false,
                },
            };
        }
        const listing = entry.data.comment.data;

        const replies: Generic.ListingData = {
            sort: null,
            reply: replyButton(listing.name),
            locked: listing.locked, // || parent_post.locked? not sure
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

        const parent_post = entry.data.parent_submission === "not_loaded" ? null : entry.data.parent_submission;

        return {
            kind: "post",
            // url: updateQuery(listing.permalink, {context: "3", sort: parent_permalink.sort}),
            url: null, // TODO pass in sort

            parent: getPostData(map, listing.parent_id),
            replies,

            content: {
                kind: "post",
                title: null,
                author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])),
                body: getCommentBody(listing),
                info: getPostInfo(listing),
                show_replies_when_below_pivot: {default_collapsed: listing.collapsed ?? false},
                actions: {
                    vote: parent_post?.data.discussion_type === "CHAT"
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
            internal_data: entry.data,
            display_style: "centered",
        };
    }else if(entry.data.kind === "post") {
        const listing = entry.data.post.data;

        return {
            kind: "post",
            // url: updateQuery(listing.permalink, {context: "3", sort: parent_permalink.sort}),
            url: null, // TODO pass in sort

            parent: getPostData(map, getSrId({
                kind: "subreddit",
                subreddit: listing.subreddit,
                base: ["r", listing.subreddit],
            })),
            replies: entry.data.replies !== "not_loaded" ? {
                sort: null,
                reply: replyButton(listing.name),
                locked: listing.locked,
                // I don't think before and after are used here
                items: entry.data.replies.data.children.map(reply => {
                    return {
                        kind: "post",
                        post: getPostData(map, reply.data.name),
                    };
                }),
            } : null, // TODO load_more instead of null

            content: {
                kind: "post",
                title: {text: listing.title, body_collapsible: {default_collapsed: true}},
                author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])),
                body: getPostBody(listing),
                info: getPostInfo(listing),
                show_replies_when_below_pivot: false,
            },
            internal_data: entry.data,
            display_style: "centered",
        };
    }else if(entry.data.kind === "subreddit_unloaded") {
        return {
            kind: "post",
            url: null,
            parent: null,
            replies: {
                sort: null,
                reply: null,
                items: [
                    ...entry.data.listing.data.children.map((child): Generic.ListingEntry => {
                        return {kind: "post", post: getPostData(map, child.data.name)};
                    }),
                    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                    ...entry.data.listing.data.after ? [
                        {kind: "post" as const, post: getPostData(map, "TODO next")},
                    ] : [],
                ],
            },
            content: {
                kind: "post",
                title: {text: getEntryFullname(entry.data), body_collapsible: false},
                body: {kind: "none"},
                show_replies_when_below_pivot: false,
            },
            internal_data: entry.data,
            display_style: "fullscreen",
        };
    } else assertNever(entry.data);
}

function createLink<T>(): Generic.Link<T> {
    return {ref: undefined, err: "processing not completed"};
}