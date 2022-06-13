import * as Generic from "api-types-generic";
import { p2, rt } from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import { encoderGenerator } from "threadclient-client-base";
import { assertNever, encodeQuery, switchKind } from "tmeta-util";
import {
    authorFromPostOrComment, authorFromT2, awardingsToFlair, client, deleteButton, editButton,
    expectUnsupported, getCodeButton, getCommentBody,
    getPointsOn, getPostBody, getPostFlair, getPostThumbnail, ParsedPath, parseLink, redditRequest,
    replyButton, reportButton, saveButton, SubrInfo, updateQuery, urlNotSupportedYet
} from "./reddit";
import { getSidebar } from "./sidebars";

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

    const start_time = Date.now();

    const content: Generic.Page2Content = {};

    try {
        const [parsed, pathraw] = parseLink(pathraw_in);

        console.log("PARSED URL:", parsed);

        if(parsed.kind === "link_out") {
            return {
                content,
                pivot: p2.createSymbolLinkToValue<Generic.Post>(content, {
                    kind: "post",
                    client_id: client.id,
                    content: {
                        kind: "post",
                        title: {text: "Not Supported"},
                        body: {kind: "richtext", content: [
                            rt.h1(rt.link(client, "raw!"+parsed.out, {}, rt.txt("View on reddit.com"))),
                            rt.p(rt.txt("ThreadClient does not support this URL")),
                        ]},
                        collapsible: false,
                    },
                    parent: null,
                    replies: null,
                    url: null,
                    internal_data: parsed,
                }),
            };
        }else if(parsed.kind === "todo") {
            return {
                content,
                pivot: p2.createSymbolLinkToValue<Generic.Post>(content, {
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
                        collapsible: false,
                    },
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
                pivot: p2.createSymbolLinkToValue<Generic.Post>(content, {
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
                        collapsible: false,
                    },
                    parent: null,
                    replies: null,
                    url: null,
                    internal_data: parsed,
                }),
            };
        }else if(parsed.kind === "subreddit_sidebar") {
            const sb_content = await getSidebar(content, parsed.sub);
            return {
                content,
                pivot: p2.createSymbolLinkToValue<Generic.Post>(content, {
                    kind: "post",
                    client_id: client.id,
                    content: {
                        kind: "post",
                        title: {text: "Sidebar"},
                        body: {kind: "none"},
                        collapsible: false,
                    },
                    parent: null,
                    replies: {
                        display: "tree",
                        loader: p2.prefilledHorizontalLoader(
                            content,
                            subredditSidebarUnloadedID(parsed.sub),
                            sb_content,
                        ),
                    },
                    url: "/"+[...parsed.sub.base, "@sidebar"].join("/"),
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
            subreddits: () => pathraw,
        });

        const page = await redditRequest(link as "/__any_page", {method: "GET"});

        return {
            content,
            pivot: page2FromListing(content, pathraw, parsed, page),
        };
    }catch(e) {
        const err = e as Error;
        console.log(err);
        const is_networkerror = err.toString().includes("NetworkError");
        const error_was_instant = start_time > Date.now() - 50;
        const browser_is_firefox = navigator.userAgent.includes("Firefox");

        if(is_networkerror) return {
            content,
            pivot: p2.createSymbolLinkToValue<Generic.Post>(content, {
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
                                rt.txt("If your browser has tracking protection, try disabling it. Tracking prevention "
                                +"often blocks requests to social media sites, such as Reddit."),
                            ),
                        ),
                    ]},
                    collapsible: false,
                },
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


export type ID = string & {__is_id: true}; // TODO string & {__is_id: true}

// 'missing_replies' says that the provided replies should not be trusted and should be replaced with a loader
// instead. eg: if you look at a single coment thread, all the parents will be listed as "missing_replies" because
// the full reply list isn't known.
type IDMapData = {
    kind: "comment",
    comment: Reddit.T1,
    missing_replies?: undefined | true,
    // vv TODO: i don't think we need this anymore
    // - morechildren just needs the link id which is not the parent_fullname
    // - checking if we're missing a parent is no longer something we have to handle in the post
    parent_fullname: Reddit.Fullname,
} | {
    kind: "post",
    post: Reddit.T3,
    replies: "not_loaded" | Reddit.Listing,
    missing_replies?: undefined | true,
} | {
    // when a subreddit is needed but only the replies are known,
    // nothing else about the subreddit. if nothing at all is known,
    // just use the id directly and getPostData will(todo) handle it.
    kind: "subreddit_unloaded",
    listing: Reddit.Listing,
    // pathraw: string, // not sure if this is good to have. i'm using it to copy the path and put ?after=… on it but
    // // maybe we should use /...details.base?after=… ← yeah we should use details to get the url
    details: SubrInfo,
    missing_replies?: undefined | true,
} | {
    kind: "depth_more",
    // a Reddit.More with 0 children
    item: Reddit.More,
    parent_fullname: string,
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
            // this says that there will be a vertical loader
            // we don't care about that here though, that's handled by the comment. it makes its own
            // vertical loader when the parent it was rendered from is not the same as its actual parent
        }

        const focus_comment = path.kind === "comments" ? path.focus_comment : null;

        const sr_entry: IDMapData = {
            kind: "subreddit_unloaded",
            listing: {
                kind: "Listing",
                data: {
                    before: null,
                    children: [],
                    after: null,
                },
            },
            details: path.kind === "comments" ? path.sub : {kind: "error", base: [pathraw], pathraw},
            missing_replies: true,
            // the reason there are two seperate calls are because that way we can
            // easily get the id of the focused post
            //
            // why can't we just put the child in the subreddit_unloaded and specify the id of the item?
            // - because then the post doesn't have replies
            // hmm
        };
        postDataFromListingMayError(content, sr_entry);

        let focus = postDataFromListingMayError(content, {
            kind: "post",
            post: parent_post,
            replies: page[1],
            // @TODO!! (this is how you fix the bug that parent comments know their replies when they shouldn't)
            // - i think we can support passing missing_replies - we say missing_replies: Fullname | null
            //   and then once the post is found that has that fullname, it turns missing_replies off but until then
            //   every comment is treated as missing_replies
            // - the issue with that is if the focused comment isn't found in the tree, it messes up
            // - but that's probably acceptable
            missing_replies: focus_comment != null ? true : undefined,
        });

        if(focus_comment != null) {
            const new_focus = fullnameID(`t1_${focus_comment.toLowerCase()}`);
            if(content[new_focus]) focus = new_focus;
            else warn("focused comment not found in tree `"+new_focus.toString()+"`", focus, content);
        }

        return focus;
    }else if(page.kind === "Listing") {
        const sr_entry: IDMapData = {
            kind: "subreddit_unloaded",
            listing: page,
            details: path.kind === "subreddit" ? path.sub : {kind: "error", pathraw, base: [pathraw]},
        };
        return postDataFromListingMayError(content, sr_entry);
    }else if(page.kind === "wikipage") {
        const sr_entry: IDMapData = {
            kind: "wikipage",
            listing: page,
            pathraw,
            // TODO it should have a subreddit header
        };
        return postDataFromListingMayError(content, sr_entry);
    }else if(page.kind === "t5") {
        warn("TODO t5");
    }else if(page.kind === "UserList") {
        warn("TODO userlist");
    } else {
        expectUnsupported(page.kind);
    }

    return unsupportedPage(content, pathraw, page);
}

// ! string is for pathraw
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
    }else if(sub.kind === "error") {
        return "SR_eunsupported/"+sub.pathraw as ID;
    }else assertNever(sub);
}

function unsupportedPage(
    content: Generic.Page2Content, pathraw: string, page: unknown,
): Generic.Link<Generic.Post> {
    return p2.createSymbolLinkToValue<Generic.Post>(content, {
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
        },
        internal_data: null,
    });
}

// we will have to redo this id systm
// function getPostFullname(post: Reddit.Post, opts: {parent_fullname: string}): Generic.Link<Generic.Post> {
//     const value = commentOrUnmountedData(post, {parent_fullname: opts.parent_fullname});
//     if(!value) return p2.stringLink("__ERROR_FULLNAME__");
//     return getEntryFullname(value);
// }
function fullnameID(fullname: Reddit.Fullname): Generic.Link<Generic.Post> {
    return p2.stringLink("OBJECT_"+fullname);
}
function fullnameRepliesID(fullname: Reddit.Fullname): Generic.Link<Generic.HorizontalLoaded> {
    return p2.stringLink("OBJECT-REPLIES_"+fullname);
}
function fullnameDepthLoaderID(parent_fullname: Reddit.Fullname): Generic.Link<Generic.Opaque<"loader">> {
    return p2.stringLink("OBJECT-DEPTH-LOADER_"+parent_fullname);
}
function fullnameContextLoaderID(center_fullname: Reddit.Fullname): Generic.Link<Generic.Opaque<"loader">> {
    return p2.stringLink("OBJECT-CONTEXT-LOADER_"+center_fullname);
}
function subredditUnloadedID(sr_id: SubrInfo): Generic.Link<Generic.Post> {
    return p2.stringLink("SUBREDDIT_"+getSrId(sr_id));
}
function subredditPostsID(sr_id: SubrInfo): Generic.Link<Generic.HorizontalLoaded> {
    return p2.stringLink("SUBREDDIT-POSTS_"+getSrId(sr_id));
}
function subredditLoadPostsID(sr_id: SubrInfo): Generic.Link<Generic.Opaque<"loader">> {
    return p2.stringLink("SUBREDDIT-LOAD-POSTS_"+getSrId(sr_id));
}
function subredditNextPageContentID(sr_id: SubrInfo, after: string): Generic.Link<Generic.HorizontalLoaded> {
    return p2.stringLink("SUBREDDIT-NEXTPAGE-CONTENT_["+getSrId(sr_id)+"]_"+after);
}
function subredditNextPageRequestID(sr_id: SubrInfo, after: string): Generic.Link<Generic.Opaque<"loader">> {
    return p2.stringLink("SUBREDDIT-NEXTPAGE-REQUEST["+getSrId(sr_id)+"]_"+after);
}
// [!] depth mores do not have an id; instead, the parent should report not knowing if it has comments
//  -   interestingly, it doesn't really matter if we display it as a loader as long as the comments for the post
//      get replaced
// function moreID(children: string[]): Generic.Link<Generic.HorizontalLoader> {
//     return p2.stringLink("MORE_"+children.join(","));
// }
function wikipageID(pathraw: string): Generic.Link<Generic.Post> {
    return p2.stringLink("WIKIPAGE_"+pathraw);
}
function subredditSidebarUnloadedID(sr_id: SubrInfo): Generic.Link<Generic.HorizontalLoaded> {
    return p2.stringLink("SIDEBAR_"+getSrId(sr_id));
}
function subredditSidebarLoaderID(sr_id: SubrInfo): Generic.Link<Generic.Opaque<"loader">> {
    return p2.stringLink("SIDEBAR-LOADER_"+getSrId(sr_id));
}

function commentOrUnmountedData(item: Reddit.Post, opts: {parent_fullname: Reddit.Fullname}): IDMapData | undefined {
    if(item.kind === "t1") {
        return {
            kind: "comment",
            comment: item,
            parent_fullname: opts.parent_fullname,
        };
    }else if(item.kind === "t3") {
        return {
            kind: "post",
            post: item,
            replies: "not_loaded",
        };
    }else if(item.kind === "more") {
        if(item.data.children.length === 0) {
            return {
                kind: "depth_more",
                item,
                parent_fullname: opts.parent_fullname,
            };
        }else{
            return {
                kind: "more",
                item,
            };
        }
    }else{
        if(item.kind !== "t5") expectUnsupported(item.kind);
        warn("TODO setUpCommentOrUnmounted", item.kind, item);
        return undefined;
    }
}

function renderCommentOrUnmounted(
    content: Generic.Page2Content,
    item: Reddit.Post,
    opts: {parent_fullname: Reddit.Fullname},
): Generic.Link<Generic.Post> {
    const data = commentOrUnmountedData(item, {parent_fullname: opts.parent_fullname});
    if(data == null) return p2.createSymbolLinkToError(content, "eunsupported", item);
    return postDataFromListingMayError(content, data);
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
    id_map_data: IDMapData,
): Generic.Link<Generic.Post> {
    const entry = {data: id_map_data};
    if(entry.data.kind === "comment") {
        const listing_raw = entry.data.comment;
        const listing = listing_raw.data;

        const replies_id = fullnameRepliesID(listing.name);
        const load_request_id = fullnameDepthLoaderID(listing.name);
        p2.fillLinkOnce(content, load_request_id, () => loader_enc.encode({
            kind: "parent_permalink",
            post_id: listing.link_id.replace("t3_", ""),
            parent_id: listing.id,
        }));
        const replies: Generic.PostReplies = {
            display: "tree",
            reply: {action: replyButton(listing.name), locked: listing.locked},
            loader: {
                kind: "horizontal_loader",
                key: replies_id,

                load_count: null, // unknown
                request: load_request_id,
                client_id: client.id,
                autoload: true, // TODO it should be false for real load objectss. we can fix this
                // by making reddit's depth loaders real rather than simulating them in the top
                // level vertical loader
            },
        };

        const should_fill_replies = ((): boolean => {
            //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if(!listing.replies) return true; // there are no replies. no point having a loader to 0 items.

            const lreplies = listing.replies.data.children;
            if(entry.data.missing_replies ?? false) {
                if(lreplies.length > 0) {
                    return false;
                }
                return true; // we should fill replies even though the post is marked as "missing_replies"
                // because there are no replies. no point in having a loader to 0 items.
            }
            if(lreplies.length === 1) {
                const rply0 = lreplies[0]!;
                if(rply0.kind === "more" && rply0.data.name === "t1__") {
                    // depth-based loadmore. do not fill replies because we'll display one automatically
                    return false;
                }
            }
            return true;
        })();
        // replies should be generated regardless of if they will be filled.
        const filled_replies = ((): Generic.HorizontalLoaded => {
            //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if(!listing.replies) return [];
            return listing.replies.data.children.map((reply): Generic.Link<Generic.Post> => {
                return renderCommentOrUnmounted(content, reply, {parent_fullname: listing.name});
                // TODO: support 'more' here
            });
        })();
        if(should_fill_replies) {
            p2.fillLink(content, replies_id, filled_replies);
        }

        // const link_info = map.get(listing.link_id as ID);

        // note: it would be preferable to have something similar to twitter "hidden" functionality
        //       where the post is displayed but it's just a box saying "this post is hidden because
        //       (reason)" and have a button click to show it. and also if you click one show button
        //       it should reveal all others of the same type (eg if you're looking at a bot's
        //       profile page)
        const automatic_collapse = (
            // collapsed because threadclient provides its own functionality for this
            listing.author === "FatFingerHelperBot"
        );

        const load_parent_id = fullnameContextLoaderID(listing.name);
        p2.fillLinkOnce(content, load_parent_id, () => loader_enc.encode({
            kind: "vertical",
            bottom_post: listing.name,
            top_post: listing.link_id,
        }));
        const parent: Generic.PostParent = {
            loader: {
                kind: "vertical_loader",
                key: fullnameID(listing.parent_id),
                temp_parent: fullnameID(listing.link_id),
                request: load_parent_id,
                load_count: listing.depth, // this might be off by one or smth
                client_id: client.id,
                autoload: false,
            },
        };

        const our_id = fullnameID(listing.name);
        p2.fillLinkOnce(content, our_id, (): Generic.Post => ({
            kind: "post",
            client_id: client.id,
            url: updateQuery(listing.permalink, {context: "3"}),

            parent,
            replies,

            content: {
                kind: "post",
                title: null,
                author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])),
                body: getCommentBody(listing),
                info: getPostInfo(listing_raw),
                collapsible: {default_collapsed: (automatic_collapse) || (listing.collapsed ?? false)},
                actions: {
                    vote: getPointsOn(listing),
                    // TODO: pass down info about the post
                    // vote: link_info?.data.kind === "post" && link_info.data.post.data.discussion_type === "CHAT"
                    //     ? undefined
                    //     : getPointsOn(listing)
                    // ,
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
        }));
        return our_id;
    }else if(entry.data.kind === "post") {
        const listing_raw = entry.data.post;
        const listing = listing_raw.data;

        const replies_data = fullnameRepliesID(listing.name);
        const replies_loader_data = fullnameDepthLoaderID(listing.name);
        p2.fillLinkOnce(content, replies_loader_data, (): Generic.Opaque<"loader"> => {
            return loader_enc.encode({
                kind:"parent_permalink",
                post_id: listing.id,
                parent_id: null,
            });
        });

        const replies: Generic.PostReplies = {
            display: "tree",
            reply: {
                action: replyButton(listing.name),
                locked: listing.locked,
            },
            loader: {
                kind: "horizontal_loader",
                key: replies_data,
                load_count: listing.num_comments,
                client_id: client.id,
                request: replies_loader_data,
                autoload: true,
            },
        };

        const filled_replies = ((): Generic.HorizontalLoaded => {
            if(entry.data.replies === "not_loaded") return [];
            const postreplies = entry.data.replies.data.children;
            return postreplies.map((reply): Generic.Link<Generic.Post> => {
                return renderCommentOrUnmounted(content, reply, {parent_fullname: listing.name});
                // TODO: support 'more' here
            });
        })();
        if(entry.data.missing_replies !== true && entry.data.replies !== "not_loaded") {
            p2.fillLink(content, replies_data, filled_replies);
        }

        const our_id = fullnameID(listing.name);
        p2.fillLinkOnce(content, our_id, (): Generic.Post => ({
            kind: "post",
            client_id: client.id,
            url: listing.permalink,

            parent: {loader: p2.prefilledVerticalLoader(content, postDataFromListingMayError(content, {
                kind: "subreddit_unloaded",
                missing_replies: true,
                listing: {kind: "Listing", data: {before: null, after: null, children: []}},
                details: {
                    kind: "subreddit",
                    subreddit: listing.subreddit,
                    base: ["r", listing.subreddit],
                },
            }), undefined)},
            replies,

            content: {
                kind: "post",
                title: {text: listing.title},
                collapsible: {default_collapsed: true},
                flair: getPostFlair(listing),
                author: authorFromPostOrComment(listing),
                body: getPostBody(listing),
                thumbnail: getPostThumbnail(listing, "open"),
                info: getPostInfo(listing_raw),

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
                            url: "/duplicates/"+listing.id,
                            text: "Duplicates"
                        }, reportButton(listing.name, listing.subreddit),
                        editButton(listing.name),
                    ],
                },
            },
            internal_data: entry.data,
        }));
        return our_id;
    }else if(entry.data.kind === "subreddit_unloaded") {
        const data = entry.data;
        const listing = data.listing;

        const sub_content = subredditPostsID(entry.data.details);
        const sub_content_request = subredditLoadPostsID(entry.data.details);
        p2.fillLinkOnce(content, sub_content_request, () => loader_enc.encode({
            kind: "link_replies",
            url: updateQuery("/"+data.details.base.join("/"), {before: undefined, after: undefined}),
        }));

        // url: updateQuery("/"+data.details.base.join("/"), {before: undefined, after: listing.data.after!}),

        const replies: Generic.PostReplies = {
            display: "repivot_list",

            loader: {
                kind: "horizontal_loader",
                key: sub_content,
                load_count: null,
                request: sub_content_request,
                client_id: client.id,
                autoload: true,
            },
        };

        if(!entry.data.missing_replies && (listing.data.children.length > 0 || listing.data.after != null)) {
            const posts: Generic.HorizontalLoaded = [];

            for(const child of listing.data.children) {
                posts.push(renderCommentOrUnmounted(content, child, {parent_fullname: "@E_SUBREDDIT"}));
            }
            if(listing.data.after != null) {
                const nextid = subredditNextPageContentID(entry.data.details, listing.data.after);
                const nextrequest = subredditNextPageRequestID(entry.data.details, listing.data.after);

                // whoops, we can't quite do this
                // this loader will rewrite all the replies when it should really just be filling the 'nextid' item
                // p2.fillLink(content, nextrequest, loader_enc.encode({
                //     kind: "link_replies",
                //     url: updateQuery("/"+data.details.base.join("/"), {before: undefined, after: listing.data.after}),
                // }));

                posts.push({
                    kind: "horizontal_loader",
                    key: nextid,
                    load_count: null,
                    request: nextrequest,
                    client_id: client.id,
                    autoload: false,
                });
            }

            p2.fillLink(content, sub_content, posts);
        }

        const self_id = subredditUnloadedID(entry.data.details);
        p2.fillLinkOnce(content, self_id, (): Generic.Post => ({
            kind: "post",
            client_id: client.id,
            url: "/"+data.details.base.join("/"),
            parent: null,
            replies,
            content: {
                kind: "page",
                title: JSON.stringify(id_map_data),
                wrap_page: {
                    sidebar: {
                        display: "tree",
                        // return a loader with load_on_view: true
                        // also use load_on_view for any loader that should not be seen by default but
                        // might be seen on a repivot

                        loader: {
                            kind: "horizontal_loader",
                            key: subredditSidebarUnloadedID(data.details),
                            load_count: null,
                            request: p2.fillLinkOnce(content, subredditSidebarLoaderID(data.details), () => (
                                loader_enc.encode({
                                    kind: "sidebar",
                                    sub: data.details,
                                })
                            )),
                            client_id: client.id,
                            autoload: true,
                        },
                    },
                    // v TODO: this should be a loader but [!] it is linked to the loader above.
                    //   only one at a time should load and loading one should fill in both.
                    // also for now we can keep using page1 bios but eventually we'll want to
                    // redo bios
                    header: {
                        // TODO load this stuff but only when the banner needs to be displayed, not before
                        kind: "bio",
                        banner: null,
                        icon: null,
                        name: {
                            display: JSON.stringify(id_map_data).toString(),
                            link_name: JSON.stringify(id_map_data).toString(),
                        },
                        body: null,
                        menu: null,
                        raw_value: entry,
                    },
                },
            },
            internal_data: entry.data,
        }));
        return self_id;
    }else if(entry.data.kind === "depth_more") {
        // actually we're handling it by skipping the replies right now but reply iterators would also work
        // fine for solving this one
        return p2.createSymbolLinkToError(content,
            "ERROR; 'depth_more' be handled seperately by reply iterators",
        entry);
    }else if(entry.data.kind === "more") {
        return p2.createSymbolLinkToError(content, "ERROR; 'more' be handled seperately by reply iterators", entry);
    }else if(entry.data.kind === "wikipage") {
        const data = entry.data;
        const listing = data.listing;
        const title = data.pathraw.substring(data.pathraw.lastIndexOf("/") + 1);
        const self_id = wikipageID(data.pathraw);
        p2.fillLinkOnce(content, self_id, (): Generic.Post => ({
            kind: "post",
            client_id: client.id,
            url: data.pathraw,
            parent: null, // TODO subreddit (this should also add `| SubName`) in the page title
            // simple; just add subrinfo into wikipage
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
        }));
        return self_id;
    } else assertNever(entry.data);
}

type LoaderData = {
    kind: "more",
    data: Reddit.PostMore,
} | {
    kind: "parent_permalink",
    post_id: string,
    parent_id: string | null,
    // loads /comments/{post_id}/comment/{parent_id}?context=0
} | {
    kind: "link_replies",
    url: string,
} | {
    kind: "vertical",
    bottom_post: string,
    top_post: string, // does not affect the url that gets fetched
    // fetches ?context=9&limit=9
} | {
    kind: "sidebar",
    sub: SubrInfo,
};

const loader_enc = encoderGenerator<LoaderData, "loader">("loader");

// Two examples of load more:
// - /comments/omvrb7 - a horizontal loader is needed for the pinned post
// - /comments/omvrb7/a/h6yus3q/?context=3 - a vertical loader is needed above the highest post
// TO FIND:
// - a depth-based horizontal loader

export async function loadPage2(
    lreq: Generic.Opaque<"loader">,
): Promise<Generic.LoaderResult> {
    await new Promise(r => setTimeout(r, 1000));
    let data = loader_enc.decode(lreq);
    if(data.kind === "parent_permalink") data = {
        kind: "link_replies",
        url: `/comments/${data.post_id}/comment/${data.parent_id ?? ""}?context=0`,
    };
    if(data.kind === "sidebar") data = {
        kind: "link_replies",
        url: "/"+[...data.sub.base, "@sidebar"].join("/"),
    };

    if(data.kind === "link_replies") {
        const res = await getPage(data.url);
        return {content: res.content};
    }else if(data.kind === "more") {
        throw new Error("TODO more");
    }else if(data.kind === "vertical") {
        // ?context=9&limit=9 - this will load more than necessary most of the time but it's the best we
        // can do i think
        throw new Error("TODO vertical");
    }else assertNever(data);
}