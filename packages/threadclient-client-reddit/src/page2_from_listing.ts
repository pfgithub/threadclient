import type * as Reddit from "api-types-reddit";
import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { assertNever, encodeQuery, switchKind } from "tmeta-util";
import {
    authorFromPostOrComment, awardingsToFlair, deleteButton, getCodeButton, getCommentBody,
    getPointsOn, getPostBody, ParsedPath, replyButton, reportButton, saveButton, SubrInfo,
    getPostThumbnail, urlNotSupportedYet, getPostFlair, updateQuery,
    expectUnsupported, parseLink, redditRequest, authorFromT2, client, editButton
} from "./reddit";
import { encoderGenerator } from "threadclient-client-base";

function warn(...message: unknown[]) {
    console.log(...message);
    // TODO display this visually somewhere if dev mode is enabled
}


export async function getPage(pathraw_in: string): Promise<Generic.Page2> {
    // TODO: api requests should be seperate from the api result -> page2 stuff.
    // also authentication should be handled better.

    // unrelated:
    // the plan is a getSkeleton() that suggests what should be loaded immediately
    // and what should be loaded as needed
    //
    // this will eg:
    // - loading a user requires:
    //   - the user page itself
    //   - the about widget
    //   - the trophies widget
    //   - the moderated subreddits widget
    // - that can't all be represented in one link
    // - but, this method could return an empty skeleton without even loading anything
    //   that has some loaders with all the links it needs
    // - the issue is when eg: sidebar widget and header banner both rely on the same
    //   web request. how is that represented? is it?

    const id_map: IDMap = new Map();

    const start_time = Date.now();

    const content: Generic.Page2Content = {};

    try {
        const [parsed, pathraw] = parseLink(pathraw_in);

        console.log("PARSED URL:", parsed);

        if(parsed.kind === "link_out") {
            return {
                content,
                pivot: createSymbolLinkToValue<Generic.Post>(content, {
                    kind: "post",
                    client_id: client.id,
                    content: {
                        kind: "post",
                        title: {text: "Not Supported"},
                        body: {kind: "richtext", content: [
                            rt.h1(rt.link(client, "raw!"+parsed.out, {}, rt.txt("View on reddit.com"))),
                            rt.p(rt.txt("ThreadClient does not support this URL")),
                        ]},
                        show_replies_when_below_pivot: false,
                        collapsible: false,
                    },
                    display_style: "centered",
                    parent: null,
                    replies: null,
                    url: null,
                    internal_data: parsed,
                }),
            };
        }else if(parsed.kind === "todo") {
            return {
                content,
                pivot: createSymbolLinkToValue<Generic.Post>(content, {
                    kind: "post",
                    client_id: client.id,
                    content: {
                        kind: "post",
                        title: {text: "Not Supported"},
                        body: {kind: "richtext", content: [
                            rt.h1(rt.link(client, "raw!https://www.reddit.com"+parsed.path, {},
                                rt.txt("View on reddit.com"),
                            )),
                            rt.p(rt.txt("ThreadClient does not yet support this URL")),
                            rt.p(rt.txt(parsed.msg)),
                        ]},
                        show_replies_when_below_pivot: false,
                        collapsible: false,
                    },
                    display_style: "centered",
                    parent: null,
                    replies: null,
                    url: null,
                    internal_data: parsed,
                }),
            };
        }else if(parsed.kind === "raw") {
            const resj = await redditRequest(parsed.path as "/__unknown", {method: "GET"});
            return {
                content,
                pivot: unsupportedPage(content, pathraw, resj),
            };
        }else if(parsed.kind === "redirect") {
            return {
                content,
                pivot: createSymbolLinkToValue<Generic.Post>(content, {
                    kind: "post",
                    client_id: client.id,
                    content: {
                        kind: "post",
                        title: {text: "Not Supported"},
                        body: {kind: "richtext", content: [
                            rt.h1(rt.link(client, "raw!https://www.reddit.com"+pathraw, {},
                                rt.txt("View on reddit.com"),
                            )),
                            rt.p(rt.txt("Error! Redirect Loop. ThreadClient tried to redirect more than 100 times.")),
                        ]},
                        show_replies_when_below_pivot: false,
                        collapsible: false,
                    },
                    display_style: "centered",
                    parent: null,
                    replies: null,
                    url: null,
                    internal_data: parsed,
                }),
            };
        }

        const link: string = switchKind(parsed, {
            comments: val => "/comments/"+val.post_id_unprefixed+"?"+encodeQuery({
                sort: val.sort_override, comment: val.focus_comment, context: val.context,
            }),
            duplicates: val => "/duplicates/"+val.post_id_unprefixed+"?"+encodeQuery({
                after: val.after, before: val.before, sort: val.sort, crossposts_only: "" + val.crossposts_only,
            }),
            subreddit: val => (
                "/"+[...val.sub.base, val.current_sort.v].join("/")
                +"?"+encodeQuery({t: val.current_sort.t, before: val.before, after: val.after})
            ),
            wiki: val => "/"+[...val.sub.base, "wiki", ...val.path].join("/") + "?" + encodeQuery(val.query),
            user: () => pathraw,
            inbox: () => pathraw,
        });

        const page = await redditRequest(link as "/__any_page", {method: "GET"});

        return {
            content,
            pivot: page2FromListing(content, id_map, pathraw, parsed, page),
        };
    }catch(e) {
        const err = e as Error;
        console.log(err);
        const is_networkerror = err.toString().includes("NetworkError");
        const error_was_instant = start_time > Date.now() - 50;
        const browser_is_firefox = navigator.userAgent.includes("Firefox");

        if(is_networkerror) return {
            content,
            pivot: createSymbolLinkToValue<Generic.Post>(content, {
                kind: "post",
                client_id: client.id,
                content: {
                    kind: "post",
                    title: {text: "Error Loading Page"},
                    body: {kind: "richtext", content: [
                        ...error_was_instant && browser_is_firefox ? [
                            rt.h1(rt.txt("Firefox Enhanced Tracking Protection may be active")),
                            rt.p(rt.txt("Try disabling Enhanced Tracking Protection for this site.")),
                            rt.ul(
                                rt.ili(rt.txt("Look at the left side of the URL bar for a shield icon")),
                                rt.ili(rt.txt("Click it")),
                                rt.ili(rt.txt("Flip the switch to turn Enhanced Tracking Protection off")),
                            ),
                            rt.p(rt.txt(""
                                +"Enhanced Tracking Protection blocks ThreadClient from sending requests to Reddit,"
                                +" which prevents ThreadClient from functioning.",
                            )),
                            rt.h2(rt.txt("Other things to check:")),
                        ] : [
                            rt.h1(rt.txt("There was a network error loading this page")),
                            rt.h2(rt.txt("Things to check:")),
                        ],
                        rt.ul(
                            rt.ili(rt.txt("Make sure your internet is working")),
                            rt.ili(
                                rt.txt("Make sure "),
                                rt.link(client, "https://www.redditstatus.com/", {}, rt.txt("Reddit is working")),
                            ),
                            rt.ili(
                                rt.txt("If your browser has tracking protection, try disabling it."),
                            ),
                        ),
                    ]},
                    show_replies_when_below_pivot: false,
                    collapsible: false,
                },
                display_style: "centered",
                parent: null,
                replies: null,
                url: null,
                internal_data: [
                    pathraw_in,
                    err,
                    {is_networkerror, error_was_instant, browser_is_firefox},
                ],
            }),
        };

        throw err;
    }
}

function createSymbolLinkToValue<T>(content: Generic.Page2Content, value: T): Generic.Link<T> {
    const link = createLink<T>("immediate value");
    content[link] = {data: value};
    return link;
}


export type ID = string & {__is_id: true}; // TODO string & {__is_id: true}
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
} | {
    kind: "wikipage",
    listing: Reddit.WikiPage,
    pathraw: string,
};

export function page2FromListing(
    content: Generic.Page2Content,
    id_map: IDMap,
    pathraw: string,
    path: ParsedPath,
    page: Reddit.AnyResult,
): Generic.Link<Generic.Post> {
    if(Array.isArray(page)) {
        if(page[0].data.children.length !== 1) {
            return unsupportedPage(content, pathraw, page);
        }
        const parent_post = page[0].data.children[0]!;
        if(parent_post.kind !== "t3") {
            return unsupportedPage(content, pathraw, page);
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

        let focus = setUpMap(id_map, {
            kind: "post",
            post: parent_post,
            replies: page[1],
        });

        if(path.kind === "comments" && path.focus_comment != null) {
            const new_focus = "t1_"+path.focus_comment.toLowerCase() as ID;
            if(id_map.has(new_focus)) focus = new_focus;
            else warn("focused comment not found in tree `"+new_focus+"`");
        }

        return getPostData(content, id_map, focus);
    }else if(page.kind === "Listing") {
        const sr_entry: IDMapData = {
            kind: "subreddit_unloaded",
            listing: page,
            details: path.kind === "subreddit" ? path.sub : "unknown",
        };
        setUpMap(id_map, sr_entry);

        const pivot_id = getEntryFullname(sr_entry);

        return getPostData(content, id_map, pivot_id);
    }else if(page.kind === "wikipage") {
        const sr_entry: IDMapData = {
            kind: "wikipage",
            listing: page,
            pathraw,
            // TODO it should have a subreddit header
        };
        setUpMap(id_map, sr_entry);

        const pivot_id = getEntryFullname(sr_entry);

        return getPostData(content, id_map, pivot_id);
    }else if(page.kind === "t5") {
        warn("TODO t5");
    }else if(page.kind === "UserList") {
        warn("TODO userlist");
    } else {
        expectUnsupported(page.kind);
    }

    return unsupportedPage(content, pathraw, page);
}

function getSrId(sub: SubrInfo): ID {
    if(sub.kind === "homepage") {
        return "SR_home" as ID;
    }else if(sub.kind === "mod") {
        return "SR_mod" as ID;
    }else if(sub.kind === "multireddit") {
        return "SR_multi/u:"+sub.user.toLowerCase()+"/m:"+sub.multireddit.toLowerCase() as ID;
    }else if(sub.kind === "userpage") {
        return "SR_user/"+sub.user.toLowerCase() as ID;
    }else if(sub.kind === "subreddit") {
        return "SR_sub/"+sub.subreddit.toLowerCase() as ID;
    }else assertNever(sub);
}

function unsupportedPage(content: Generic.Page2Content, pathraw: string, page: unknown): Generic.Link<Generic.PostData> {
    return createSymbolLinkToValue<Generic.PostData>(content, {
        kind: "post",
        client_id: client.id,
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
    });
}

function getPostFullname(post: Reddit.Post): ID {
    const value = commentOrUnmountedData(post, undefined);
    if(!value) return "__ERROR_FULLNAME__" as ID;
    return getEntryFullname(value);
}
function getEntryFullname(entry: IDMapData): ID {
    if(entry.kind === "comment") {
        return entry.comment.data.name as ID;
    }else if(entry.kind === "post") {
        return entry.post.data.name as ID;
    }else if(entry.kind === "subreddit_unloaded") {
        return (entry.details === "unknown" ? "__UNKNOWN_LISTING_ROOT" as ID : getSrId(entry.details));
    }else if(entry.kind === "depth_more") {
        return "DEPTH_MORE_"+entry.parent_permalink as ID;
    }else if(entry.kind === "more") {
        return "MORE_"+entry.item.data.children.join(",") as ID;
    }else if(entry.kind === "wikipage") {
        return "WIKIPAGE_there_should_only_be_one" as ID;
    }else assertNever(entry);
}

function commentOrUnmountedData(item: Reddit.Post, parent_permalink: string | undefined): IDMapData | undefined {
    if(item.kind === "t1") {
        return {
            kind: "comment",
            comment: item,
        };
    }else if(item.kind === "t3") {
        return {
            kind: "post",
            post: item,
            replies: "not_loaded",
        };
    }else if(item.kind === "more") {
        if(item.data.children.length === 0) {
            if(parent_permalink == null) {
                warn(
                    "TODO setUpCommentOrUnmounted was called with not loaded parent but req. parent submission",
                );
                return undefined;
            }
            return {
                kind: "depth_more",
                item,
                parent_permalink,
            };
        }else{
            return {
                kind: "more",
                item,
            };
        }
    }else{
        expectUnsupported(item.kind);
        warn("TODO setUpCommentOrUnmounted", item.kind, item);
        return undefined;
    }
}

function setUpCommentOrUnmounted(map: IDMap, item: Reddit.Post, parent_permalink: string | undefined): void {
    const data = commentOrUnmountedData(item, parent_permalink);
    if(data == null) return;
    setUpMap(map, data);
}

export function setUpMap(
    map: IDMap,
    data: IDMapData,
): ID {
    const entry_fullname = getEntryFullname(data);
    const prev_value = map.get(entry_fullname);
    if(prev_value) {
        console.log("Note: Two objects with the same id were created. ID: `"+entry_fullname+"`");
        // Note: In the future, consider reconciling both into one data entry that has data from both.
        return entry_fullname;

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
            if(listing_raw.data.name === "t1__") return entry_fullname; // depth-based
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
    }else if(data.kind === "wikipage") {
        // nothing to do
    }else assertNever(data);

    map.set(entry_fullname, {
        kind: "unprocessed",
        link: createLink("id: "+entry_fullname),
        data,
    });

    return entry_fullname;
}

function createSymbolLinkToError(content: Generic.Page2Content, emsg: string): Generic.Link<any> {
    const link = createLink<any>("immediate error value");
    content[link] = {error: emsg};
    return link;
}

// returns a pointer to the PostData
// TODO support load more in both parents and replies
export function getPostData(content: Generic.Page2Content, map: IDMap, key: ID): Generic.Link<Generic.Post> {
    const value = map.get(key);
    if(!value) {
        // TODO determine which load more to use
        return createSymbolLinkToError(content, "post was not found in tree (TODO load more) ("+key+")");
    }
    if(value.kind === "unprocessed") {
        value.kind = "processing";

        const res = postDataFromListingMayError(content, map, value); // uuh… this is mayerror… should handle errors here

        content[value.link] = {data: res};

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
            client_id: client.id,
        } : undefined, // don't show on comments

        comments: listing_raw.kind === "t3" ? listing_raw.data.num_comments : undefined,
    };
}

function postDataFromListingMayError(
    content: Generic.Page2Content,
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
                replies.items.push(getPostData(content, map, getPostFullname(reply)));
            }
        }

        const parent_post = map.get(listing.parent_id as ID);

        // note: it would be preferable to have something similar to twitter "hidden" functionality
        //       where the post is displayed but it's just a box saying "this post is hidden because
        //       (reason)" and have a button click to show it. and also if you click one show button
        //       it should reveal all others of the same type (eg if you're looking at a bot's
        //       profile page)
        const automatic_collapse = (
            // collapsed because threadclient provides its own functionality for this
            listing.author === "FatFingerHelperBot"
        );

        return {
            kind: "post",
            client_id: client.id,
            url: updateQuery(listing.permalink, {context: "3"}),

            parent: getPostData(content, map, listing.parent_id as ID),
            replies,

            content: {
                kind: "post",
                title: null,
                author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])),
                body: getCommentBody(listing),
                info: getPostInfo(listing_raw),
                collapsible: {default_collapsed: (automatic_collapse) || (listing.collapsed ?? false)},
                show_replies_when_below_pivot: true,
                actions: {
                    vote: parent_post?.data.kind === "post" && parent_post.data.post.data.discussion_type === "CHAT"
                        ? undefined
                        : getPointsOn(listing)
                    ,
                    code: getCodeButton(listing.body),
                    other: [
                        editButton(listing.name),
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
            client_id: client.id,
            url: listing.permalink,

            parent: getPostData(content, map, getSrId({
                kind: "subreddit",
                subreddit: listing.subreddit,
                base: ["r", listing.subreddit],
            })),
            replies: {
                reply: {
                    action: replyButton(listing.name),
                    locked: listing.locked,
                },
                // I don't think before and after are used here
                items: entry.data.replies !== "not_loaded" ? entry.data.replies.data.children.map((reply
                ): Generic.Link<Generic.Post> => (
                    getPostData(content, map, getPostFullname(reply))
                )) : [createSymbolLinkToValue(content, {
                    kind: "loader",
                    key: loader.encode({
                        kind: "comments",
                        post: listing.id,
                    }),

                    parent: entry.link,
                    replies: null,
                    client_id: client.id,
                    url: null,
                    load_count: null,
                })],
            },

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
                            client_id: client.id,
                            url: "/domain/"+listing.domain,
                            text: listing.domain,
                        }, deleteButton(listing.name), saveButton(listing.name, listing.saved), {
                            kind: "link",
                            client_id: client.id,
                            url: listing.permalink.replace("/comments/", "/duplicates/"),
                            text: "Duplicates"
                        }, reportButton(listing.name, listing.subreddit),
                        editButton(listing.name),
                    ],
                },
            },
            internal_data: entry.data,
            display_style: "centered",
        };
    }else if(entry.data.kind === "subreddit_unloaded") {
        const replies: Generic.Link<Generic.Post>[] = [];

        for(const child of entry.data.listing.data.children) {
            replies.push(getPostData(content, map, getPostFullname(child)));
        }
        if(entry.data.listing.data.after != null) {
            replies.push(getPostData(content, map, "TODO next" as ID));
        }

        return {
            kind: "post",
            client_id: client.id,
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
            client_id: client.id,
            parent: getPostData(content, map, listing.parent_id as ID),
            replies: null,
            url: null,
            load_count: null,

            key: loader.encode({
                kind: "depth",
                data: listing,
            }),
        };
    }else if(entry.data.kind === "more") {
        const listing = entry.data.item.data;
        return {
            kind: "loader",
            client_id: client.id,
            parent: getPostData(content, map, listing.parent_id as ID),
            replies: null,
            url: null,
            load_count: listing.children.length,

            key: loader.encode({
                kind: "more",
                data: listing,
            }),
        };
    }else if(entry.data.kind === "wikipage") {
        const listing = entry.data.listing;
        const title = entry.data.pathraw.substr(entry.data.pathraw.lastIndexOf("/") + 1);
        return {
            kind: "post",
            client_id: client.id,
            url: entry.data.pathraw,
            parent: null, // TODO subreddit (this should also add `| SubName`) in the page title
            replies: null,
            content: {
                kind: "post",
                title: {text: title},
                collapsible: false,
                body: {kind: "text",
                    content: listing.data.content_html,
                    client_id: client.id,
                    markdown_format: "reddit_html",
                },
                show_replies_when_below_pivot: false,

                info: {
                    // TODO a fancy system could have an array like
                    // - [at: time, by: user]
                    // - [at: time, by: user]
                    // - load more
                    // eg for a wiki it would be
                    // - load more
                    // - [at: time, by: user]
                    // and then it would just show "edited at ... by ..."
                    // but you could click it to get more info
                    // and now a difference can be made between
                    // "no edits" and "not sure if edited":
                    // no edits is [at: time, by: user]
                    // not sure if edited is [at: time, by: user], [...unknown]
                    // and if there are any load mores in the list, the edit
                    // text can have a link to "show history"
                    edited: {date: listing.data.revision_date * 1000},
                },
                author: authorFromT2(listing.data.revision_by),
                actions: {
                    other: listing.data.may_revise ? [
                        {kind: "link", client_id: client.id, text: "Edit", url: "TODO edit wiki page"}
                    ] : [],
                },
            },
            internal_data: entry.data,
            display_style: "centered",
        };
    } else assertNever(entry.data);
}

type LoaderData = {
    kind: "more",
    data: Reddit.PostMore,
} | {
    kind: "depth",
    data: Reddit.PostMore,
} | {
    kind: "comments",
    post: string,
};

const loader = encoderGenerator<LoaderData, "loader">("loader");

// Two examples of load more:
// - /comments/omvrb7 - a horizontal loader is needed for the pinned post
// - /comments/omvrb7/a/h6yus3q/?context=3 - a vertical loader is needed above the highest post
// TO FIND:
// - a depth-based horizontal loader

function createLink<T>(debug_msg: string): Generic.Link<T> {
    const value = Symbol(debug_msg) as Generic.Link<T>;
    return value;
}