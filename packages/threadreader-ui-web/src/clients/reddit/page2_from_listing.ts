import type * as Reddit from "api-types-reddit";
import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { assertNever } from "tmeta-util";
import {
    authorFromPostOrComment, awardingsToFlair, deleteButton, getCodeButton, getCommentBody,
    getPointsOn, getPostBody, ParsedPath, replyButton, reportButton, saveButton, SubrInfo,
    getPostThumbnail, urlNotSupportedYet, getPostFlair, updateQuery, expectUnsupported
} from "../reddit";

function warn(...message: unknown[]) {
    console.log(...message);
    // TODO display this visually somewhere if dev mode is enabled
}

export type ID = string; // TODO string & {__is_id: true}
export type IDMap = Map<ID, IDMapEntry>;
// // needs to be able to tell you if it's a thing or load more or whatever
// // also it should like update in the future
// // idk
type IDMapEntry = {
    kind: "unprocessed" | "processing" | "processed",
    link: Generic.Link<Generic.Post>,

    data: IDMapData,
};
// we should not need a parent_permalink
// eg a load more may be a parent_permalink style load more
// in which case info can be in {kind: "load_more"} here
// the other thing parent_permalink is used for is to find the
// sort mode but comments have access to the .parent_submission property
type IDMapData = {
    kind: "comment",
    comment: Reddit.T1,
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
} | {
    kind: "depth_more",
    // a Reddit.More with 0 children
    item: Reddit.More,
    parent_permalink: string,
} | {
    kind: "more",
    item: Reddit.More,
};

export function page2FromListing(
    id_map: IDMap,
    pathraw: string,
    path: ParsedPath,
    page: Reddit.AnyResult,
): Generic.Link<Generic.Post> {
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
        setUpMap(id_map, sr_entry);

        const pivot_id = getEntryFullname(sr_entry);

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
            title: {text: "Error!"},
            collapsible: false,
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
    }else if(entry.kind === "depth_more") {
        return "DEPTH_MORE_"+entry.parent_permalink;
    }else if(entry.kind === "more") {
        return "MORE_"+entry.item.data.children.join(",");
    }else assertNever(entry);
}

function setUpCommentOrUnmounted(map: IDMap, item: Reddit.Post, parent_permalink: string | undefined): void {
    if(item.kind === "t1") {
        setUpMap(map, {
            kind: "comment",
            comment: item,
        });
    }else if(item.kind === "t3") {
        setUpMap(map, {
            kind: "post",
            post: item,
            replies: "not_loaded",
        });
    }else if(item.kind === "more") {
        if(item.data.children.length === 0) {
            if(parent_permalink == null) {
                warn(
                    "TODO setUpCommentOrUnmounted was called with not loaded parent but req. parent submission",
                );
                return; // TODO add an error node?
            }
            setUpMap(map, {
                kind: "depth_more",
                item,
                parent_permalink,
            });
        }else{
            setUpMap(map, {
                kind: "more",
                item,
            });
        }
    }else{
        expectUnsupported(item.kind);
        warn("TODO setUpCommentOrUnmounted", item.kind, item);
    }
}

export function setUpMap(
    map: IDMap,
    data: IDMapData,
): void {
    const entry_fullname = getEntryFullname(data);
    const prev_value = map.get(entry_fullname);
    if(prev_value) {
        console.log("Note: Two objects with the same id were created. ID: `"+entry_fullname+"`");
        // Note: In the future, consider reconciling both into one data entry that has data from both.
        return;

        // there are many reasons two things with the same id might get added
        // eg: adding a post and then a crosspost of that post, both on the same listing
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
                    setUpCommentOrUnmounted(map, reply, listing.permalink);
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
        if(data.replies !== "not_loaded") for(const reply of data.replies.data.children) {
            setUpCommentOrUnmounted(map, reply, listing.permalink);
        }
    }else if(data.kind === "subreddit_unloaded") {
        for(const post of data.listing.data.children) {
            setUpCommentOrUnmounted(map, post, "not_loaded");
        }
    }else if(data.kind === "more") {
        // nothing to do
    }else if(data.kind === "depth_more") {
        // nothing to do
    }else assertNever(data);

    map.set(entry_fullname, {
        kind: "unprocessed",
        link: createLink(),
        data,
    });
}

// returns a pointer to the PostData
// TODO support load more in both parents and replies
export function getPostData(map: IDMap, key: string): Generic.Link<Generic.Post> {
    const value = map.get(key);
    if(!value) {
        // TODO determine which load more to use
        return {ref: undefined, err: "post was not found in tree (TODO load more) ("+key+")"};
    }
    if(value.kind === "unprocessed") {
        value.kind = "processing";

        const res = postDataFromListingMayError(map, value); // uuh… this is mayerror… should handle errors here
        [value.link.ref, value.link.err] = [res, undefined];

        value.kind = "processed";

        return value.link;
    }else if(value.kind === "processing" || value.kind === "processed") {
        return value.link;
    }else assertNever(value.kind);
}

function getPostInfo(listing_raw: Reddit.T1 | Reddit.T3): Generic.PostInfo {
    const listing = listing_raw.data;
    return {
        creation_date: listing.created_utc * 1000,
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        edited: listing.edited ? {date: listing.edited * 1000} : undefined,
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        pinned: listing.pinned || listing.stickied || false,

        in: listing_raw.kind === "t3" ? {
            name: listing.subreddit_name_prefixed,
            link: "/"+listing.subreddit_name_prefixed,
        } : undefined, // don't show on comments

        comments: listing_raw.kind === "t3" ? listing_raw.data.num_comments : undefined,
    };
}

function postDataFromListingMayError(
    map: IDMap,
    entry: IDMapEntry,
): Generic.Post {
    if(entry.data.kind === "comment") {
        const listing_raw = entry.data.comment;
        const listing = listing_raw.data;

        const replies: Generic.ListingData = {
            reply: {action: replyButton(listing.name), locked: listing.locked},
            items: [],
        };
        //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if(listing.replies) {
            for(const reply of listing.replies.data.children) {
                replies.items.push(getPostData(map, reply.data.name));
            }
        }

        const parent_post = map.get(listing.link_id);

        return {
            kind: "post",
            url: updateQuery(listing.permalink, {context: "3"}),

            parent: getPostData(map, listing.parent_id),
            replies,

            content: {
                kind: "post",
                title: null,
                author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])),
                body: getCommentBody(listing),
                info: getPostInfo(listing_raw),
                collapsible: {default_collapsed: listing.collapsed ?? false},
                show_replies_when_below_pivot: true,
                actions: {
                    vote: parent_post?.data.kind === "post" && parent_post.data.post.data.discussion_type === "CHAT"
                        ? undefined
                        : getPointsOn(listing)
                    ,
                    code: getCodeButton(listing.body),
                    other: [
                        deleteButton(listing.name),
                        saveButton(listing.name, listing.saved),
                        reportButton(listing.name, listing.subreddit),
                    ],
                },
            },
            internal_data: entry.data,
            display_style: "centered",
        };
    }else if(entry.data.kind === "post") {
        const listing_raw = entry.data.post;
        const listing = listing_raw.data;

        return {
            kind: "post",
            url: listing.permalink,

            parent: getPostData(map, getSrId({
                kind: "subreddit",
                subreddit: listing.subreddit,
                base: ["r", listing.subreddit],
            })),
            replies: entry.data.replies !== "not_loaded" ? {
                reply: {
                    action: replyButton(listing.name),
                    locked: listing.locked,
                },
                // I don't think before and after are used here
                items: entry.data.replies.data.children.map(reply => (
                    getPostData(map, reply.data.name)
                )),
            } : null, // TODO load_more instead of null

            content: {
                kind: "post",
                title: {text: listing.title},
                collapsible: {default_collapsed: true},
                flair: getPostFlair(listing),
                author: authorFromPostOrComment(listing),
                body: getPostBody(listing),
                thumbnail: getPostThumbnail(listing, "open"),
                info: getPostInfo(listing_raw),
                show_replies_when_below_pivot: false,

                actions: {
                    vote: getPointsOn(listing),
                    code: getCodeButton(listing.is_self ? listing.selftext : listing.url),
                    other: [
                        {
                            kind: "link",
                            url: "/domain/"+listing.domain,
                            text: listing.domain,
                        }, deleteButton(listing.name), saveButton(listing.name, listing.saved), {
                            kind: "link",
                            url: listing.permalink.replace("/comments/", "/duplicates/"),
                            text: "Duplicates"
                        }, reportButton(listing.name, listing.subreddit),
                    ],
                },
            },
            internal_data: entry.data,
            display_style: "centered",
        };
    }else if(entry.data.kind === "subreddit_unloaded") {
        const replies: Generic.Link<Generic.Post>[] = [];

        for(const child of entry.data.listing.data.children) {
            replies.push(getPostData(map, child.data.name));
        }
        if(entry.data.listing.data.after != null) {
            replies.push(getPostData(map, "TODO next"));
        }

        return {
            kind: "post",
            url: null,
            parent: null,
            replies: {
                items: replies,
            },
            content: {
                kind: "post",
                title: {text: getEntryFullname(entry.data)},
                collapsible: false,
                body: {kind: "none"},
                show_replies_when_below_pivot: false,
            },
            internal_data: entry.data,
            display_style: "fullscreen",
        };
    }else if(entry.data.kind === "depth_more") {
        const listing = entry.data.item.data;
        return {
            kind: "loader",
            parent: getPostData(map, listing.parent_id),
            replies: null,
            url: null,
        };
    }else if(entry.data.kind === "more") {
        const listing = entry.data.item.data;
        return {
            kind: "loader",
            parent: getPostData(map, listing.parent_id),
            replies: null,
            url: null,
        };
    } else assertNever(entry.data);
}

// Two examples of load more:
// - /comments/omvrb7 - a horizontal loader is needed for the pinned post
// - /comments/omvrb7/a/h6yus3q/?context=3 - a vertical loader is needed above the highest post
// TO FIND:
// - a depth-based horizontal loader

function createLink<T>(): Generic.Link<T> {
    return {ref: undefined, err: "processing not completed"};
}