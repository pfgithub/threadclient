import * as Generic from "api-types-generic";
import { autoFill, autoLinkgen, autoOutline, p2, rt, validatePost } from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import { encoderGenerator, ObservableMap, Stringified, stringify } from "threadclient-client-base";
import { assertNever, assertUnreachable, expectUnsupported, result, updateQuery } from "tmeta-util";
import { getPostInfo, rawlinkButton, submit_encoder } from "./page2_from_listing";
import { authorFromPostOrComment, awardingsToFlair, client_id, createSubscribeAction, deleteButton, ec, editButton, flairToGenericFlair, flair_oc, flair_over18, flair_spoiler, getCodeButton, getCommentBody, getNavbar, getPointsOn, getPostBody, getPostFlair, getPostThumbnail, InboxTab, jstrOf, ParsedPath, parseLink, PostSort, redditRequest, replyButton, reportButton, saveButton, subredditHeaderExists, SubrInfo, SubSort, resolveSLink, RedditClient, userIdentityCard } from "./reddit";

/*
Required checklist for feature parity (then we can make page2 default)
- [ ] report button has to work
- [ ] listing before and after links
- [ ] reply to posts
- [ ] submit link on subreddits
- [ ] on firefox, NetworkError should display the enhanced tracker protection info
- [ ] delete action (it says 'TODO make the thing that tracks requests so we can use it here')
- [ ] swipe right shouldn't be to save. we should remove it for now. or it could be repivot or something.
- [ ] notifications page. different inboxes & view notifications

Optional checklist for feature parity:
- [ ] on a user page, comments should show what post they are on
- [ ] user moderated_subreddits needs to display after it loads
- [ ] code links to display the raw markdown of the post

Nice to have, not related to feature parity:
- [ ] page2 report screens (OneLoader<Link<ReportScreen>>, Opaque<ReportData>), report(Opaque<ReportReason>, Opaque<ReportData>, text?: string)
- [ ] fix the sort button dropdown menus to actually be dropdowns
- [ ] page2 logins
- [ ] threadclient-ui-web handles 'op' display instead of user
- [ ] unified identity cards
- [ ] url -> Link<string>
- [ ] url is the external link, not the threadclient link. ui adds 'View on reddit.com' action automatically instead of us adding it.
- [ ] page2 notifications (in client, there is a notifications thing. and other stuff)
- [ ] user settings
  - https://www.reddit.com/dev/api/oauth/#GET_api_v1_me_prefs
  - consider instead of passing tokens, we can pass settings which would include tokens? I think that makes sense.
    - the client would have to manage multiaccount but that's fine. that's probably for the best?
- [ ] mysubreddits
- [ ] flair: https://www.reddit.com/dev/api/oauth/#scope_flair
  - flairselector, selectflair, setflairenabled, user_flair, user_flair_v2. link_flair is implemented.
- [ ] modposts: https://www.reddit.com/dev/api/oauth/#scope_modposts
- [ ] wikiread:
  - https://www.reddit.com/dev/api/oauth/#GET_wiki_discussions_{page}
  - revision history & compare
  - recent changes for the whole wiki
- [ ] modwiki: https://www.reddit.com/dev/api/oauth/#scope_modwiki
- [ ] announcements: https://www.reddit.com/dev/api/oauth/#scope_announcements
- [ ] moderator:
  - modposts, modwiki, modnote, modothers, modmail, modlog, modconfig, livemanage, 
- ... lots of stuff, mainly write/mod things we are missing https://www.reddit.com/dev/api/oauth
*/

export type UTLRes = {
    content: Generic.Page2Content,
    pivot_loader: null | Generic.OneLoader<Generic.Post>,
};
export async function getPagev2(content: Generic.Page2Content, pathraw_in: string): Promise<Generic.VerticalLoader> {
    const [parsed, pathraw] = parseLink(pathraw_in);

    if (parsed.kind === "s") {
        const r = await resolveSLink(pathraw);
        if (typeof r === "object") throw new Error(r.error);
        const u = new URL(r);
        console.log("sl-resp", {r, u});
        return await getPagev2(content, u.pathname + u.search + u.hash);
    }

    return urlToOneLoaderFromParsed(content, parsed);
}
async function urlToOneLoaderFromParsed(content: Generic.Page2Content, parsed: ParsedPath): Promise<Generic.VerticalLoader> {
    const client = RedditClient.fromContent(content);
    const subval = (sub: SubrInfo): BaseSubreddit | null => {
        if(sub.kind === "subreddit") return {sr_name: asLowercaseString(sub.subreddit)};
        if(sub.kind === "userpage") return {sr_name: asLowercaseString("u_"+sub.user)};
        if(sub.kind === "homepage") return {sr_name: null};
        return null;
    };
    // * TODO FIX:
    // url '/comments/xl9dsh' doesn't work because it doesn't know the sub
    // urlToOneLoader should be async to fetch any of that needed info probably
    // we'll end up double-fetching the post but it will probably be /api/info?ids=… the first time at least

    const fixsubv = async (parsed: {sub: SubrInfo}, postid: string, subv: BaseSubreddit | null): Promise<Generic.VerticalLoader> => {
        if(parsed.sub.kind === "homepage") {
            const resv = await redditRequest(`/api/info?id=t3_${postid}` as "/__any_listing", {
                method: "GET",
            });
            if(resv.data.children.length !== 1) throw new Error("post may not exist?");
            const rvc = resv.data.children[0];
            if(!rvc || rvc.kind !== "t3") throw new Error("post not t3?");
            const sub = rvc.data.subreddit;
            const wq: {sub: SubrInfo} = {...parsed, sub: {kind: "subreddit", base: ["r", sub], subreddit: sub}};
            return await urlToOneLoaderFromParsed(content, wq as unknown as ParsedPath);
        }
        throw new Error("TODO support comments on sub kind: ["+parsed.sub.kind+"]");
    };

    if(parsed.kind === "subreddit") {
        const subv = subval(parsed.sub);
        if(subv == null) {
            throw new Error("TODO support listing kind: ["+parsed.sub.kind+"]")
        }
        client.addDirty(client.data.subreddit_sorts.setAndList(stringify(subv), parsed.current_sort));
        const link = client.getLink("subreddit", subv);
        return p2.prefilledVerticalLoader(content, link, undefined);
    }
    if(parsed.kind === "comments") {
        const subv = subval(parsed.sub);
        if(subv == null || subv.sr_name == null) {
            return fixsubv(parsed, parsed.post_id_unprefixed, subv);
        }

        const post_fullname = `t3_${parsed.post_id_unprefixed}`;
        const comment_fullname = parsed.focus_comment != null ? `t1_${parsed.focus_comment}` : null;

        if (parsed.sort_override != null) {
            client.addDirty(client.data.post_sorts.setAndList(stringify({fullname: post_fullname}), {v: parsed.sort_override}));
        }
        const key = client.getLink("item", {fullname: comment_fullname ?? post_fullname});
        const request = client.getLink("item_replies_request", {
            post_fullname,
            comment_fullname,
            subreddit: subv.sr_name,
        });
        return {
            kind: "vertical_loader",
            unfilled_parent: client.getLink("client", {}),
            key,
            request,
            client_id,
        };
    }
    if(parsed.kind === "duplicates") {
        const subv = subval(parsed.sub);
        if(subv == null || subv.sr_name == null) {
            return fixsubv(parsed, parsed.post_id_unprefixed, subv);
        }

        const sort: Sortv = {m: "duplicates", v: parsed.sort ?? "num_comments", crossposts_only: parsed.crossposts_only};
        const post_base: BasePostT3 = {
            fullname: `t3_${parsed.post_id_unprefixed}`,
            on_subreddit: subv.sr_name,
            sort,
        };
        client.addDirty(client.data.post_sorts.setAndList(stringify({fullname: post_base.fullname}), sort));
        return {
            kind: "vertical_loader",
            unfilled_parent: client.getLink("client", {}),
            key: client.getLink("item", {fullname: post_base.fullname}),
            request: p2.createSymbolLinkToValue<Generic.Opaque<"loader">>(content, opaque_loader.encode({
                kind: "view_post",
                focus_comment_id: null,
                post: post_base,
                context: "3",
            })),
            client_id,
        };
    }
    if(parsed.kind === "submit") {
        const subv = subval(parsed.sub);
        if(subv == null || subv.sr_name == null) {
            throw new Error("TODO support submit on sub kind: ["+parsed.sub.kind+"]")
        }

        const submit_base: BaseSubmitPage = {
            on_subreddit: subv.sr_name,
        };
        return {
            kind: "vertical_loader",
            unfilled_parent: client.getLink("client", {}),
            key: base_submit.objectLink(submit_base),
            request: p2.createSymbolLinkToValue<Generic.Opaque<"loader">>(content, opaque_loader.encode({
                kind: "submit_page",
                base: submit_base,
            })),
            client_id,
        };
    }
    if (parsed.kind === "user") {
        const base: BaseUser = {username: asLowercaseString(parsed.username)};
        client.addDirty(client.data.user_sorts.setAndList(stringify(base), parsed.current));
        return p2.prefilledVerticalLoader(content, client.getLink("user", base), undefined);
    }
    if (parsed.kind === "wiki") {
        const subv = subval(parsed.sub);
        if(subv == null || subv.sr_name == null) {
            throw new Error("TODO support wiki on sub kind: ["+parsed.sub.kind+"]")
        }
        const {canonical} = await fetchWikipage(client, {
            page: {
                subreddit: subv,
                canonical_path: parsed.path.join("/"),
            },
            v: parsed.query["v"],
            v2: parsed.query["v2"],
        }, {canonicalize: true});
        return p2.prefilledVerticalLoader(content, client.getLink("wikipage", canonical), undefined);
    }
    // if(parsed.kind === "inbox") {
    //     const base: BaseInbox = {};
    //     if(parsed.current.tab === "compose") {
    //         const compose_base: SortedComposeInbox = {on_base: base};
    //         return p2.prefilledVerticalLoader(content, sorted_compose_inbox.menubar(content, compose_base), undefined);
    //     }else if(parsed.current.tab === "inbox") {
    //         const inbox_base: SortedInbox = {on_base: base, tab: parsed.current.inbox_tab};
    //         return p2.prefilledVerticalLoader(content, sorted_inbox.menubar(content, inbox_base), undefined);
    //     }else if(parsed.current.tab === "sent" || parsed.current.tab === "mod") {
    //         const inbox_base: SortedInbox = {on_base: base, tab: parsed.current.tab};
    //         return p2.prefilledVerticalLoader(content, sorted_inbox.menubar(content, inbox_base), undefined);
    //     }else if(parsed.current.tab === "message") {
    //         throw new Error("*TODO* view inbox message ["+parsed.current.msgid+"]");
    //     }else assertNever(parsed.current);
    // }
    throw new Error("Enotsupported: " + JSON.stringify(parsed)); // TODO
}

type LowercaseString = string & {__is_ascii_lowercase: true};
export function asLowercaseString(str: string): LowercaseString {
    return str.toLowerCase() as LowercaseString;
}

// Base is the minimum content required to create a filled link to a Generic.Post
type BaseClient = {
    _?: undefined,
};
type UnsortedSubreddit = LowercaseString;
type BasePostT3 = {
    fullname: `t3_${string}`,
    on_subreddit: UnsortedSubreddit,
    // * we are requiring a subreddit on posts *
    // - this means: "/comments/[id]" will require loading content in order to get the object. we
    //   can't get the wrapper from the url alone.
    // - the reason for this is i forgot
    //   - probably to make sure that an unfilled post can have a parent but we have decided to not
    //     use unfilled posts and instead require all posts to be filled.
    sort: Sortv | "infer",
};
type FullPostT3 = {
    post: BasePostT3,
    data: Reddit.T3,
};
// here's something fun
// we don't have to do the page1 mess with /api/moredata results
// we can just iterate over all the comments and use 'after_id: "#INVALID"' and it will fill itself out
type CommentRepliesValid = {after_id: string} | true; // note: for 'false', use {after_id: "#INVALID"}
type FullPostReplies = {
    on_post: BasePostT3,
    data: Reddit.Listing,
    comment_replies_valid: CommentRepliesValid,
};
type BaseOldSidebar = {
    subreddit: UnsortedSubreddit,
};
type FullOldSidebar = {
    on_base: BaseOldSidebar,
    t5: Reddit.T5,
    has_structuredstyles_widgets: boolean,
    // ^ if false, have open by default
};
type BaseSidebarWidget = {
    id: `widget_${string}`,
    subreddit: UnsortedSubreddit,
};
type FullSidebarWidget = {
    on_base: BaseSidebarWidget,
    widget: Reddit.Widget, // bridges
};
type BaseCommentT1 = {
    fullname: `t1_${string}`,
    on_post: BasePostT3,
    // sort is the same as the post's sort
};
type FullCommentT1 = {
    on_base: BaseCommentT1,
    t1: Reddit.T1,
    comment_replies_valid: CommentRepliesValid,
};
type BaseUser = {
    username: LowercaseString,
    // note: the fullname is not known here
};
type BasePrivateMessageT4 = {
    fullname: `t4_${string}`,
};
type BaseSubmitPage = {
    on_subreddit: UnsortedSubreddit,
};
/*
we want a tabbed ui
page2 does not support this yet
*/
/*
here's a possability for tabbed ui. this would also replace how sorting works right now:
- sort no longer is part of a post's base
- there is one new post content kind:
  - a 'sort menu'
the 'sort menu' is the pivoted post. it determines the url of the page, and it has links to other
'sort menus' (sort modes for the post, containing a parent loader and replies loader)

here's the trouble:
- the sort menu is the pivoted object, but not from the user's point of view.

oh solution

'sort menu' contains:
- sortable_object: Link<PostContent>
- replies (as normal)
- parent (as normal)
when displaying a 'sort menu', display its sortable object and put the sort menu below

still trouble. a subreddit is sortable, but getting a subreddit asParent should give a subreddit with
no (default) sort method specified and should not show a menu
- no trouble here. that should work

ok the plan:
PostContent
- kind: "sort_menu",
  options: (page1 menu for now, but eventually we'll switch it to be links to other sort menus so we don't have
   to reload the post/subreddit/… when switching sorts)

display:
- the sortable_object is displayed. the sortable_object would be eg the post content.

changes to code here:
- 'post' will be changed to return a content kind sortable object. same with 'subreddit' and 'content'
- there will be BasePost and BaseSortedPost, BaseSubreddit, BaseSortedSubreddit, …

trouble!
comments:
- if you sort a comment, the sorts of all the parents should change
solution:
- the sortable object parent will change to a differently sorted comment
- it won't even have to reload any of the comment contents

ok this should* work

*/
type BaseInbox = {
    // note BaseInbox is only for the content. SortedInbox has the url and post and other stuff
    _?: undefined,
};
// something's weird here isn't it. 'SortedInbox' and 'SortedComposeInbox' are both tabs of the same
// thing. that's okay I think though.
type SortedInbox = {
    on_base: BaseInbox,
    tab: "inbox" | "unread" | "messages" | "comments" | "selfreply" | "mentions" | "sent" | "mod"
};
type SortedComposeInbox = {
    on_base: BaseInbox,
};
type FilledInbox = {
    for_sorted: SortedInbox,
    content: Reddit.Listing,
};
type BaseInboxCompose = {
    // it's a Post containing a submit object who's parent is BaseInbox (tab: 'compose')
    for_inbox: SortedComposeInbox, // ← this is always 'on_base: {}, tab: {kind: "compose"}
};
type BasePrivateMessage = {
    // it's a Post who's parent is BaseInbox (tab: 'messages')
    for_inbox: SortedInbox, // this is always 'on_base: {}, tab: {kind: "inbox", subtab: "messages"}
    id: string,
    kind: "t1" | "t4", // t1s are not normal comments, they are this weird inbox message structured object.
    // we'll mark them as not pivotable and set the link to the actual comment. while it'd be nice if we could
    // repivot to them without a page reload, we can't because they're missing lots of stuff. they don't even
    // have rtjson.
};
type FullPrivateMessage = {
    on_base: BasePrivateMessage,
    value: Reddit.InboxMsg,
};
type FullSubmitPage = {
    on_base: BaseSubmitPage,
    about: Reddit.T5, // we're potentially fetching this information twice
    // as it might already be available from the sub header
    linkflair: Reddit.ApiLinkFlair | null, // only if about.data.link_flair_enabled
};


export const base_client = {
    asParent: (content: Generic.Page2Content, base: BaseClient): Generic.PostParent => {
        return {
            loader: Generic.p2.prefilledVerticalLoader(content, RedditClient.fromContent(content).getLink("client", {}), undefined),
        };
    },
};

// class Subreddit extends Base<BaseSubredditT5> implements asPost, getReplies
export const base_subreddit = {
    url: (base: BaseSubreddit, sort: SubSort): "/__any_listing" => {
        return updateQuery(
            (base.sr_name != null ? `/r/${base.sr_name}` : ``) + ("/" + sort.v),
            {t: sort.t},
            // TODO: we will make URLs a Link<string> and then they will change based on the sort
        ) as "/__any_listing";
    },
    asParent: (content: Generic.Page2Content, base: BaseSubreddit): Generic.PostParent => {
        const client = RedditClient.fromContent(content);
        return {loader: Generic.p2.prefilledVerticalLoader(
            content, client.getLink("subreddit", base), undefined,
        )};
    },
};

function simplifySort(sort: SubSort): SubSort {
    if (sort.v === "controversial" || sort.v === "top") return {v: sort.v, t: sort.t};
    return {v: sort.v, t: "all"};
}

export function subDefaultSort(base: BaseSubreddit): SubSort {
    // specify manual overrides for subreddits which request different default sorts
    if(base.sr_name === "teenagersnew" || base.sr_name === "adultsnew") return {v: "new", t: "all"};
    return {v: "hot", t: "all"};
}
export function commentDefaultCollapsed(author_name: string): boolean {
    // specify manual overrides for comments which should be automatically collapsed
    return author_name === "FatFingerHelperBot";
}

const base_oldsidebar_widget = {
    url: (base: BaseSubreddit) => "/r/"+(base.sr_name ?? assertUnreachable(0 as never))+"/about/sidebar",
};

type DuplicaesSortV = {m: "duplicates", v: Reddit.DuplicatesSort, crossposts_only: boolean};
type Sortv = PostSort | DuplicaesSortV; // TODO: remove "default" sort
function isDuplicates(sort: Sortv | "infer") : sort is DuplicaesSortV {
    return typeof sort === "object" && sort != null && 'm' in sort && sort.m === "duplicates";
}

// * you will only be able to get a link to a post by using the full_post fn
// * you can get a base_post 'as_parent' but no other way

// TODO: we should make ObservableDb<...> that automatically generates all this. so we don't need to manually add every key.
export type RedditClientData = {
    
    // we should be able to have this not include sort and instead have comment replies be per-sort. but for now it will include it.
    // currently, this maps from JSON.stringify(BaseComment) to FullCommentT1
    // but instead we should split this up:
    items: ObservableMap<Stringified<BaseItem>, Reddit.Item, Generic.Link<unknown>>,
    listings: ObservableMap<Stringified<SortedObjectID>, Reddit.Listing | "", Generic.Link<unknown>>,
    mores: ObservableMap<Stringified<BaseMore2>, Reddit.More, Generic.Link<unknown>>,
    widgets: ObservableMap<Stringified<BaseSubreddit>, Reddit.ApiWidgets, Generic.Link<unknown>>,
    widget: ObservableMap<Stringified<BaseWidget>, Reddit.Widget, Generic.Link<unknown>>,
    subreddit_t5s: ObservableMap<Stringified<BaseSubreddit>, Reddit.T5, Generic.Link<unknown>>, // we could use items but it expects a fullname, while we typically have a lowercasestring from a URL
    user_abouts: ObservableMap<Stringified<BaseUser>, Reddit.T2, Generic.Link<unknown>>, // we could use items but it expects a fullname, while we typically have a lowercasestring from a URL
    user_trophies: ObservableMap<Stringified<BaseTrophy>, Reddit.T6, Generic.Link<unknown>>, // we could use items but it expects a fullname, while we typically have a lowercasestring from a URL
    user_trophy_lists: ObservableMap<Stringified<BaseUser>, Reddit.TrophyList, Generic.Link<unknown>>, // we could use items but it expects a fullname, while we typically have a lowercasestring from a URL
    user_moderated_subreddits: ObservableMap<Stringified<BaseUser>, Reddit.ModeratedList, Generic.Link<unknown>>,
    wikipages: ObservableMap<Stringified<BaseRevisedWikipage>, Reddit.WikiPage, Generic.Link<unknown>>,
    subreddit_all_wikipages: ObservableMap<Stringified<BaseSubreddit>, Reddit.WikipageListing, Generic.Link<unknown>>,
    
    user_sorts: ObservableMap<Stringified<BaseUser>, UserSort, Generic.Link<unknown>>,
    post_sorts: ObservableMap<Stringified<BaseItem>, Sortv, Generic.Link<unknown>>,
    subreddit_sorts: ObservableMap<Stringified<BaseSubreddit>, SubSort, Generic.Link<unknown>>,
};
type BaseTrophy = {
    user: BaseUser,
    label: string,
};
type BaseWidget = {
    subreddit: BaseSubreddit,
    widget: string,
};
export function initRedditClientData(prev?: RedditClientData): RedditClientData {
    return {
        items: new ObservableMap(prev?.items),
        listings: new ObservableMap(prev?.listings),
        mores: new ObservableMap(prev?.mores),
        widgets: new ObservableMap(prev?.widgets),
        widget: new ObservableMap(prev?.widget),
        subreddit_t5s: new ObservableMap(prev?.subreddit_t5s),
        user_abouts: new ObservableMap(prev?.user_abouts),
        user_trophies: new ObservableMap(prev?.user_trophies),
        user_trophy_lists: new ObservableMap(prev?.user_trophy_lists),
        user_moderated_subreddits: new ObservableMap(prev?.user_moderated_subreddits),
        wikipages: new ObservableMap(prev?.wikipages),
        subreddit_all_wikipages: new ObservableMap(prev?.subreddit_all_wikipages),

        user_sorts: new ObservableMap(prev?.user_sorts),
        post_sorts: new ObservableMap(prev?.post_sorts),
        subreddit_sorts: new ObservableMap(prev?.subreddit_sorts),
    };
}
export function trackRedditClientData(data: RedditClientData, link: Generic.Link<unknown>): void {
    data.items.beginTracking(link);
    data.listings.beginTracking(link);
    data.mores.beginTracking(link);
    data.widgets.beginTracking(link);
    data.widget.beginTracking(link);
    data.subreddit_t5s.beginTracking(link);
    data.user_abouts.beginTracking(link);
    data.user_trophies.beginTracking(link);
    data.user_trophy_lists.beginTracking(link);
    data.user_moderated_subreddits.beginTracking(link);
    data.wikipages.beginTracking(link);
    data.subreddit_all_wikipages.beginTracking(link);

    data.user_sorts.beginTracking(link);
    data.post_sorts.beginTracking(link);
    data.subreddit_sorts.beginTracking(link);
}
export function untrackRedditClientData(data: RedditClientData): void {
    data.items.endTracking();
    data.listings.endTracking();
    data.mores.endTracking();
    data.widgets.endTracking();
    data.widget.endTracking();
    data.subreddit_t5s.endTracking();
    data.user_abouts.endTracking();
    data.user_trophies.endTracking();
    data.user_trophy_lists.endTracking();
    data.user_moderated_subreddits.endTracking();
    data.wikipages.endTracking();
    data.subreddit_all_wikipages.endTracking();

    data.user_sorts.endTracking();
    data.post_sorts.endTracking();
    data.subreddit_sorts.endTracking();
}

type BaseWikipage = {
    subreddit: BaseSubreddit,
    canonical_path: string, // note that after fetching a wikipage, response.url can be used to find out the true path
};
type BaseRevisedWikipage = {
    page: BaseWikipage,
    v?: string,
    v2?: string,
};
type BaseItem = {fullname: string};
type BaseSubreddit = {
    /** null indicates homepage */
    sr_name: null | LowercaseString,
};
type BaseMore2 = {parent_fullname: string, first_child_id: string | null, sort: PostSort};
export type RedditLinkDescriptors = {
    // TODO: most of these should not need a sort method! sort should only be for replies, where the client chooses which one to use
    client: {
        data: {_?: undefined},
        content: Generic.Post,
    },
    item: {
        data: BaseItem, // we might be able to remove the on_post on this? sort will be a problem that we will have to solve
        content: Generic.Post,
    },
    comment_sort_menu: {
        data: {_?: undefined},
        content: Generic.SortMenu,
    },
    comment_sort: {
        data: BaseItem,
        content: Generic.SortGroup,
    },
    comment_parent_request: {
        data: {subreddit: LowercaseString, post_fullname: string, parent_comment_fullname: string | null},
        content: Generic.Opaque<"loader">,
    },
    item_replies_request: {
        data: {subreddit: LowercaseString, post_fullname: string, comment_fullname: string | null},
        content: Generic.Opaque<"loader">,
    },
    replies: {
        data: ObjectID,
        content: Generic.HorizontalLoaded,
    },
    loadmore_request: {
        data: {base: BaseMore2, sort: Sortv | "infer", post_fullname: string},
        content: Generic.Opaque<"loader">,
    },
    subreddit: {
        data: BaseSubreddit,
        content: Generic.Post,
    },
    subreddit_replies_request: {
        data: BaseSubreddit,
        content: Generic.Opaque<"loader">,
    },
    subreddit_card: {
        data: BaseSubreddit,
        content: Generic.FilledIdentityCard,
    },
    subreddit_widgets: {
        data: BaseSubreddit,
        content: Generic.HorizontalLoaded,
    },
    subreddit_identity_request: {
        data: BaseSubreddit,
        content: Generic.Opaque<"loader">,
    },
    subreddit_oldsidebar_widget: {
        data: BaseSubreddit,
        content: Generic.Post,
    },
    subreddit_sort_menu: {
        data: {_?: undefined},
        content: Generic.SortMenu,
    },
    subreddit_sort: {
        data: BaseSubreddit,
        content: Generic.SortGroup,
    },
    widget: {
        data: BaseWidget,
        content: Generic.Post,
    },
    user: {
        data: BaseUser,
        content: Generic.Post,
    },
    user_card: {
        data: BaseUser,
        content: Generic.FilledIdentityCard,
    },
    user_about: {
        data: BaseUser,
        content: Generic.Post,
    },
    user_sidebar: {
        data: BaseUser,
        content: Generic.HorizontalLoaded,
    },
    user_identity_request: {
        data: BaseUser,
        content: Generic.Opaque<"loader">,
    },
    user_trophies_request: {
        data: BaseUser,
        content: Generic.Opaque<"loader">,
    },
    user_trophies: {
        data: BaseUser,
        content: Generic.HorizontalLoaded,
    },
    user_trophy: {
        data: BaseTrophy,
        content: Generic.Post,
    },
    user_moderated_subreddits_request: {
        data: BaseUser,
        content: Generic.Opaque<"loader">,
    },
    user_replies_request: {
        data: BaseUser,
        content: Generic.Opaque<"loader">,
    },
    user_sort_group: {
        data: BaseUser,
        content: Generic.SortGroup,
    },
    user_sort_menu: {
        data: {_?: undefined},
        content: Generic.SortMenu,
    },
    wiki: {
        data: BaseSubreddit,
        content: Generic.Post,
    },
    wikipage: {
        data: BaseRevisedWikipage,
        content: Generic.Post,
    },
    wikipage_request: {
        data: BaseRevisedWikipage,
        content: Generic.Opaque<"loader">,
    },
};

function moreBase(more: Reddit.More, sort: PostSort): BaseMore2 {
    return {parent_fullname: more.data.parent_id, first_child_id: more.data.children[0] ?? null, sort};
}

function userSortMethod(client: RedditClient, base: BaseUser): UserSort {
    return client.data.user_sorts.get(stringify(base)) ?? {kind: "sorted-tab", tab: "overview", sort: {sort: "new", t: "all"}};
}
function subSortMethod(client: RedditClient, base: BaseSubreddit): SubSort {
    return client.data.subreddit_sorts.get(stringify(base)) ?? subDefaultSort(base);
}
function postSortMethod(client: RedditClient, base: BaseItem): Sortv {
    const post = client.data.items.get(stringify(base));
    if (post?.kind === "t1") return postSortMethod(client, {fullname: post.data.link_id});
    const override = client.data.post_sorts.get(stringify(base));
    if (override) return override;
    if (post?.kind === "t3") {
        if (post.data.suggested_sort != null) {
            return {v: post.data.suggested_sort};
        }
    }
    return {v: "confidence"};
}

export const resolvers: {
    // TODO: eventually once all are migrated and we have upgraded loaders, this can return just T instead of ReadLinkResult<T>
    [key in keyof RedditLinkDescriptors]: (client: RedditClient, base: RedditLinkDescriptors[key]["data"]) => Generic.ReadLinkResult<RedditLinkDescriptors[key]["content"]> | null
} = {
    user(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        const content = client.dirty_content;
        return {error: null, value: {
            kind: "post",
            content: {
                kind: "page",
                wrap_page: {
                    header: {
                        temp_title: `u/${base.username}`,
                        filled: {
                            kind: "one_loader",
                            key: client.getLink("user_card", base),
                            request: client.getLink("user_identity_request", base),
                            client_id,
                        },
                    },
                    sidebar: {
                        display: "tree",
                        loader: {
                            kind: "horizontal_loader",
                            key: client.getLink("user_sidebar", base),
                            request: p2.createSymbolLinkToError(content, "preload", base),
                            client_id,
                        },
                    },
                },
            },
            internal_data: base,
            parent: base_client.asParent(content, {}),
            replies: {
                display: "repivot_list",
                loader: {
                    kind: "horizontal_loader",
                    key: client.getLink("replies", {kind: "user", user: base}),
                    request: client.getLink("user_replies_request", base),
                    client_id,
                },
                sort_group: client.getLink("user_sort_group", base),
                sort_menu: client.getLink("user_sort_menu", {}),
            }, // TODO
            url: `/u/${base.username}`,
            client_id,
        }};
    },
    user_sort_group(client, base): Generic.ReadLinkResult<Generic.SortGroup> {
        const sort = userSortMethod(client, base);
        return {error: null, value: {
            selected: {
                key: stringify(sort),
            },
            group: opaque_sort_group.encode({kind: "user", user: base}),
        }};
    },
    user_sort_menu(client, base): Generic.ReadLinkResult<Generic.SortMenu> {
        const single = (label: string, value: UserSort): Generic.SortOption => ({
            label,
            value: {
                kind: "single",
                key: stringify(value),
                request: opaque_sort_option.encode({kind: "user", sort: value}),
            },
        });
        const sortedTab = (label: string, tab: "comments" | "overview" | "submitted"): Generic.SortOption => {
            return {label, value: {kind: "list", items: [
                single("Hot", {kind: "sorted-tab", tab, sort: {sort: "hot", t: "all"}}),
                single("New", {kind: "sorted-tab", tab, sort: {sort: "new", t: "all"}}),
                {label: "Top", value: {kind: "list", items: [
                    single("Hour", {kind: "sorted-tab", tab, sort: {sort: "top", t: "hour"}}),
                    single("Day", {kind: "sorted-tab", tab, sort: {sort: "top", t: "day"}}),
                    single("Week", {kind: "sorted-tab", tab, sort: {sort: "top", t: "week"}}),
                    single("Month", {kind: "sorted-tab", tab, sort: {sort: "top", t: "month"}}),
                    single("Year", {kind: "sorted-tab", tab, sort: {sort: "top", t: "year"}}),
                    single("All", {kind: "sorted-tab", tab, sort: {sort: "top", t: "all"}}),
                ]}},
                {label: "Controversial", value: {kind: "list", items: [
                    single("Hour", {kind: "sorted-tab", tab, sort: {sort: "controversial", t: "hour"}}),
                    single("Day", {kind: "sorted-tab", tab, sort: {sort: "controversial", t: "day"}}),
                    single("Week", {kind: "sorted-tab", tab, sort: {sort: "controversial", t: "week"}}),
                    single("Month", {kind: "sorted-tab", tab, sort: {sort: "controversial", t: "month"}}),
                    single("Year", {kind: "sorted-tab", tab, sort: {sort: "controversial", t: "year"}}),
                    single("All", {kind: "sorted-tab", tab, sort: {sort: "controversial", t: "all"}}),
                ]}},
            ]}};
        };
        return {error: null, value: {
            options: [
                sortedTab("Overview", "overview"),
                sortedTab("Comments", "comments"),
                sortedTab("Submitted", "submitted"),
                single("Upvoted", {kind: "unsorted-tab", tab: "upvoted"}),
                single("Downvoted", {kind: "unsorted-tab", tab: "downvoted"}),

                // TODO: only show these ones on your profile
                single("Hidden", {kind: "unsorted-tab", tab: "hidden"}),
                single("Saved", {kind: "unsorted-tab", tab: "saved"}),
            ],
        }};
    },
    user_identity_request(client, base) {
        return {error: null, value: opaque_loader.encode({kind: "user_identity", user: base})};
    },
    user_trophies_request(client, base) {
        return {error: null, value: opaque_loader.encode({
            kind: "fetch_trophies",
            username: base.username,
        })};
    },
    user_moderated_subreddits_request(client, base) {
        return {error: null, value: opaque_loader.encode({kind: "user_moderated_subreddits", user: base})};
    },
    user_card(client, base): Generic.ReadLinkResult<Generic.FilledIdentityCard> | null {
        const user = client.data.user_abouts.get(stringify(base));
        if (user == null) return null;

        return {error: null, value: userIdentityCard(user.data)};
    },
    user_about(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        const user = client.data.user_abouts.get(stringify(base));
        if (user == null) return null;
        const content = client.dirty_content;

        return {error: null, value: {
            kind: "post",
            content: {
                kind: "post",
                title: {text: "About"},
                body: {kind: "richtext", content: [
                    rt.h1(rt.link(client, "/u/"+user.data.name, {is_user_link: user.data.name}, rt.txt(user.data.name))),
                    rt.p(rt.txt(user.data.link_karma + " post karma")),
                    rt.p(rt.txt(user.data.comment_karma + " comment karma")),
                    rt.p(rt.txt("Account created "), rt.timeAgo(user.data.created_utc * 1000)),
                    // this stuff should probably go in custom fields in the user identity card?
                ]},
                collapsible: {default_collapsed: false},
            },
            internal_data: user,
            parent: {loader: p2.prefilledVerticalLoader(content, client.getLink("user", base), undefined)},
            replies: null,
            url: null,
            client_id,
        }};
    },
    user_trophies(client, base): Generic.ReadLinkResult<Generic.HorizontalLoaded> | null {
        const trophies = client.data.user_trophy_lists.get(stringify(base));
        if (trophies == null) return null;
        return {error: null, value: [
            ...trophies.data.trophies.map((trophy): Generic.HorizontalLoadedItem => {
                return client.getLink("user_trophy", {label: trophy.data.name, user: base});
            }),
        ]};
    },
    user_trophy(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        const trophy = client.data.user_trophies.get(stringify(base));
        if (trophy == null) return null;
        const body: Generic.Body[] = [];
        return {error: null, value: {
            kind: "post",
            content: {
                kind: "post",
                title: {text: trophy.data.name},
                thumbnail: {
                    kind: "image",
                    url: trophy.data.icon_70,
                },
                info: {
                    creation_date: trophy.data.granted_at != null ? trophy.data.granted_at * 1000 : undefined,
                },
                body: {
                    kind: "captioned_image",
                    url: trophy.data.icon_70,
                    w: 70,
                    h: 70,
                    caption: trophy.data.description ?? undefined, // interestingly, caption seems to have dates for some trophies, ie 2020-02-06
                },
                collapsible: {default_collapsed: true},
            },
            internal_data: {},
            parent: {loader: p2.prefilledVerticalLoader(client.dirty_content, client.getLink("user", base.user), undefined)}, // TODO user_trophy_case
            replies: null,
            url: null,
            client_id,
        }};
    },
    user_replies_request(client, base) {
        const sort: UserSort = userSortMethod(client, base);
        const path = [];
        const query: Record<string, string> = {};
        if (sort.kind === "sorted-tab") {
            if (sort.tab !== "overview") path.push(sort.tab);
            query["sort"] = sort.sort.sort; // sort = sort.sort.sort
            query["t"] = sort.sort.t;
        } else if (sort.kind === "unsorted-tab") {
            path.push(sort.tab);
        } else throw new Error("bad sort tab?");
        return {error: null, value: opaque_loader.encode({
            kind: "fetch_listing",
            url: updateQuery(`/user/${base.username}${path.map(t => `/${t}`).join("")}`, query) as `/__any_listing`,
            parent: {kind: "user", user: base, sort},
            allow_replies: true, // because parent is kind user, this is fine. it won't add the replies for the comments
        })};
    },
    user_sidebar(client, base): Generic.ReadLinkResult<Generic.HorizontalLoaded> | null {
        const identity = client.data.user_abouts.get(stringify(base));
        const moderated = client.data.user_moderated_subreddits.get(stringify(base));
        return {error: null, value: [
            ...identity != null ? [client.getLink("user_about", base)] : [{
                kind: "horizontal_loader",
                key: "#none" as Generic.Link<Generic.HorizontalLoaded>,
                request: client.getLink("user_identity_request", base),
                client_id,
            }] satisfies Generic.HorizontalLoadedItem[],
            {
                kind: "horizontal_loader",
                key: client.getLink("user_trophies", base),
                request: client.getLink("user_trophies_request", base),
                client_id,
            },
            ...moderated != null ? [] : [{
                kind: "horizontal_loader",
                key: "#none" as Generic.Link<Generic.HorizontalLoaded>,
                request: client.getLink("user_moderated_subreddits_request", base),
                client_id,
            }] satisfies Generic.HorizontalLoadedItem[],
        ]};
    },

    client(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        return {error: null, value: {
            kind: "post",
            content: {
                kind: "client",
                navbar: getNavbar(null),
            },
            internal_data: 0,
            parent: null,
            replies: null,
            url: null,
            client_id,
        }};
    },
    subreddit(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        const content = client.dirty_content;
        return {error: null, value: {
            kind: "post",
            content: {
                kind: "page",
                wrap_page: {
                    header: {
                        temp_title: base.sr_name != null ? "r/" + base.sr_name : `Home`,
                        filled: {
                            kind: "one_loader",
                            key: client.getLink("subreddit_card", base),
                            load_count: null,
                            request: client.getLink("subreddit_identity_request", base),
                            client_id,
                            autoload: true,
                        },
                    },
                    sidebar: {
                        display: "tree",
                        loader: {
                            kind: "horizontal_loader",
                            key: client.getLink("subreddit_widgets", base),
                            request: client.getLink("subreddit_identity_request", base),
                            load_count: null,
                            autoload: false,
                            client_id,
                        },
                    },
                },
            },
            internal_data: base,
            parent: base_client.asParent(content, {}),
            replies: {
                display: "repivot_list",
                loader: {
                    kind: "horizontal_loader",
                    key: client.getLink("replies", {kind: "subreddit", sub: base}),
                    request: client.getLink("subreddit_replies_request", base),
                    client_id,
                },

                sort_menu: client.getLink("subreddit_sort_menu", {}),
                sort_group: client.getLink("subreddit_sort", base),
            },
            url: base_subreddit.url(base, subDefaultSort(base)), // TODO: url should be a Link<string> and we will use the actual sort instead of the default sort
            client_id,
        }};
    },
    subreddit_sort_menu(client, base): Generic.ReadLinkResult<Generic.SortMenu> | null {
        const single = (label: string, sub: SubSort): Generic.SortOption => ({label, value: {
            kind: "single",
            key: stringify(sub),
            request: opaque_sort_option.encode({kind: "sub", sort: sub}),
        }});
            const multi = (label: string, v: Reddit.SubSortMode): Generic.SortOption => ({label, value: {
            kind: "list", items: ([
                ["hour", "Hour"],
                ["day", "Day"],
                ["week", "Week"],
                ["month", "Month"],
                ["year", "Year"],
                ["all", "All"],
            ] satisfies [key: Reddit.SubSortTime, name: string][]).map(([t, label]): Generic.SortOption => single(label, {v, t})),
        }});
        return {error: null, value: {options: [
            single("Hot", {v: "hot", t: "all"}),
            single("Best", {v: "best", t: "all"}),
            single("New", {v: "new", t: "all"}),
            single("Rising", {v: "rising", t: "all"}),
            multi("Top", "top"),
            multi("Controversial", "controversial"),
        ]}};
    },
    subreddit_sort(client, base): Generic.ReadLinkResult<Generic.SortGroup> {
        const method = subSortMethod(client, base);
        return {error: null, value: {
            group: opaque_sort_group.encode({kind: "sub", sub: base}),
            selected: {
                key: stringify(method),
            },
        }};
    },
    subreddit_replies_request(client, base) {
        const sort = subSortMethod(client, base);
        return {error: null, value: opaque_loader.encode({
            kind: "fetch_listing",
            url: base_subreddit.url(base, sort),
            parent: {kind: "subreddit", sub: base, sort: sort},
            allow_replies: true,
        })};
    },
    subreddit_identity_request(client, base) {
        return {error: null, value: opaque_loader.encode({
            kind: "subreddit_identity_and_sidebar",
            sub: base.sr_name ?? assertNever(0 as never),
        })};
    },
    subreddit_card(client, base): Generic.ReadLinkResult<Generic.FilledIdentityCard> | null {
        // arguably these should not use subreddit_card
        if (base.sr_name == null) {
            return {error: null, value: {
                names: {display: "Home", raw: "/"},
                pfp: null,
                theme: {banner: null},
                description: {kind: "richtext", content: [{kind: "paragraph", children: [{kind: "text", text: "Posts from your subscribed subreddits", styles: {}}]}]},
                actions: {main_counter: null},
                menu: null,
                raw_value: null,
            }};
        }else if (base.sr_name === "all") {
            return {error: null, value: {
                names: {display: "All", raw: "r/all"},
                pfp: null,
                theme: {banner: null},
                description: {kind: "richtext", content: [{kind: "paragraph", children: [{kind: "text", text: "All posts from all subreddits", styles: {}}]}]},
                actions: {main_counter: null},
                menu: null,
                raw_value: null,
            }};
        } else if (base.sr_name === "popular") {
            return {error: null, value: {
                names: {display: "Popular", raw: "r/popular"},
                pfp: null,
                theme: {banner: null},
                description: {kind: "richtext", content: [{kind: "paragraph", children: [{kind: "text", text: "Filtered posts from all subreddits", styles: {}}]}]},
                actions: {main_counter: null},
                menu: null,
                raw_value: null,
            }};
        }

        const widgets = client.data.widgets.get(stringify(base));
        const t5 = client.data.subreddit_t5s.get(stringify(base));
        console.log("subreddit_card", base, widgets, t5);
        if (widgets == null || t5 == null || t5.kind !== "t5") return null;
        return {error: null, value: subredditHeaderExists({
            subreddit: t5.data.display_name,
            widgets: widgets,
            sub_t5: t5,
        })};
    },
    subreddit_widgets(client, base): Generic.ReadLinkResult<Generic.HorizontalLoaded> | null {
        if (base.sr_name == null || base.sr_name === "all" || base.sr_name === "popular") return {error: null, value: []};

        const widgets = client.data.widgets.get(stringify(base));
        const t5 = client.data.subreddit_t5s.get(stringify(base));
        if (widgets == null || t5 == null || t5.kind !== "t5") return null;

        return {error: null, value:[
            // v default collapsed
            client.getLink("subreddit_oldsidebar_widget", base),

            // skipping id card widget as we already provide that with the header
            // ...full.widgets.layout.topbar.order.map(id => base_sidebar_widget.link(basev(id))), // this is for the dropdown menu? TODO
            ...widgets.layout.sidebar.order.map(id => (
                client.getLink("widget", {subreddit: base, widget: id})
            )),
            client.getLink("widget", {subreddit: base, widget: widgets.layout.moderatorWidget}),
        ]};
    },
    subreddit_oldsidebar_widget(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        const content = client.dirty_content;
        const t5 = client.data.subreddit_t5s.get(stringify(base));
        if (t5 == null || t5.kind !== "t5") return null;
        return {error: null, value: {
            kind: "post",
            content: {
                kind: "post",
        
                title: {text: "old.reddit sidebar"},
                body: {
                    kind: "text",
                    client_id,
                    markdown_format: "reddit_html",
                    content: t5.data.description_html,
                },
        
                collapsible: {default_collapsed: true},
            },
            internal_data: t5,
            parent: base_subreddit.asParent(content, base),
            replies: null,
            url: base_oldsidebar_widget.url(base),
            client_id,
        }};
    },
    widget(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        const widget = client.data.widget.get(stringify(base));
        if (!widget) return null;
        const content = client.dirty_content;
        
        let postcontent: Generic.PostContent;
        let replies: null | Generic.PostReplies;
        if(widget.kind === "moderators") {
            // consider making this into a list of identity cards
            // maybe we consider going back to the page1 style of having custom widgets rather than
            // making widgets out of posts
            postcontent = {
                kind: "post",
                title: {text: "Moderators"},
                body: {kind: "richtext", content: [
                    rt.p(
                        rt.link({id: client_id}, "/message/compose?to=/r/"+base.subreddit.sr_name,
                            {style: "pill-empty"},
                            rt.txt("Message the mods"),
                        ),
                    ),
                    rt.ul(...widget.mods.map(mod => rt.li(rt.p(
                        rt.link({id: client_id}, "/u/"+mod.name, {is_user_link: mod.name}, rt.txt("u/"+mod.name)),
                        ...flairToGenericFlair({
                            type: mod.authorFlairType, text: mod.authorFlairText, text_color: mod.authorFlairTextColor,
                            background_color: mod.authorFlairBackgroundColor, richtext: mod.authorFlairRichText,
                        }).flatMap(flair => [rt.txt(" "), rt.flair(flair)]),
                    )))),
                    rt.p(
                        rt.link({id: client_id}, "/r/"+base.subreddit.sr_name+"/about/moderators", {}, rt.txt("View All Moderators")),
                    ),
                ]},
                collapsible: false,
            };
            replies = null;
        }else if(widget.kind === "subreddit-rules") {
            postcontent = {
                kind: "post",
    
                title: {text: widget.shortName},
                body: {kind: "none"},
                collapsible: false,
            };
            replies = {display: "tree", loader: p2.prefilledHorizontalLoader(content, p2.symbolLink("r"), widget.data.map((itm, i) => {
                return p2.createSymbolLinkToValue<Generic.Post>(content, {
                    kind: "post",
                    content: {
                        kind: "post",
    
                        title: {text: (i + 1)+". " + itm.shortName},
                        body: {
                            kind: "text",
                            content: itm.descriptionHtml,
                            markdown_format: "reddit_html", client_id,
                        },
                        collapsible: {default_collapsed: true},
                    },
                    internal_data: itm,
                    parent: {loader: p2.prefilledVerticalLoader(content, client.getLink("widget", base), undefined)},
                    replies: null,

                    url: null,
                    client_id,
                });
            }))};
        }else if(widget.kind === "post-flair") {
            // this isn't implemented well. it's heavily dependent on how posts display.
            // it should have a custom display probably.
            postcontent = {
                kind: "post",
                title: {text: widget.shortName},
                body: {kind: "none"},
                collapsible: false,
            };
            replies = {display: "repivot_list", loader: p2.prefilledHorizontalLoader(content, p2.symbolLink("r"), widget.order.map(id => {
                const val = widget.templates[id]!;
                const flair = flairToGenericFlair({
                    type: val.type, text: val.text, text_color: val.textColor,
                    background_color: val.backgroundColor, richtext: val.richtext,
                });
                return p2.createSymbolLinkToValue<Generic.Post>(content, {
                    kind: "post",
                    content: {
                        kind: "post",
                        title: null,
                        flair,
                        body: {kind: "none"},
                        collapsible: false,
                    },
                    internal_data: val,
                    parent: {loader: p2.prefilledVerticalLoader(content, client.getLink("widget", base), undefined)},
                    replies: null,

                    url: "/r/"+base.subreddit.sr_name+"/search?q=flair:\""+encodeURIComponent(val.text!)+"\"&restrict_sr=1",
                    client_id,
                });
            }))};
        }else if(widget.kind === "textarea") {
            postcontent = {
                kind: "post",
                title: {text: widget.shortName},
                body: {kind: "text", content: widget.textHtml, markdown_format: "reddit_html", client_id},
                collapsible: false,
            };
            replies = null;
        }else if(widget.kind === "button") {
            // doesn't support image buttons yet. not that the old version really did either
            // image buttons are basically supposed to be pill links but with an image in the background that
            // is object-fit:cover
            // the button is usually 286x32
            postcontent = {
                kind: "post",
                title: {text: widget.shortName},
                body: {
                    kind: "richtext",
                    content: widget.buttons.map(button => {
                        if(button.kind === "text") {
                            return rt.p(rt.link({id: client_id}, button.url, {style: "pill-empty"}, rt.txt(button.text)));
                        }else if(button.kind === "image") {
                            return rt.p(rt.link({id: client_id}, button.linkUrl, {style: "pill-empty"}, rt.txt("[image] "+button.text)));
                        }else{
                            return rt.p(rt.error("TODO support button kind: ["+button.kind+"]", button));
                        }
                    }),
                },
                collapsible: false,
            };
            replies = null;
        }else if(widget.kind === "community-list") {
            postcontent = {
                kind: "post",
                title: {text: widget.shortName},
                body: {kind: "none"},
                collapsible: false,
            };
            replies = {display: "repivot_list", loader: p2.prefilledHorizontalLoader(content, p2.symbolLink("r"), widget.data.map(community => {
                if(community.type === "subreddit") {
                    // return base_subreddit.post(content, {
                    //     subreddit: asLowercaseString(community.name),
                    //     sort: "default",
                    //     // ! community.communityIcon || community.iconUrl
                    //     // ! community.name, community.subscribers, community.isSubscribed
                    //     // we need to pass this data in
                    // });
                    const sub_name = asLowercaseString(community.name);
                    const sub_base: BaseSubreddit = {
                        sr_name: sub_name,
                    };
                    return p2.createSymbolLinkToValue<Generic.Post>(content, {
                        kind: "post",
                        content: {
                            kind: "nonpivoted_identity_card", // TODO: eliminate nonpivoted_identity_card, we can use regular identity cards instead
                            container: RedditClient.fromContent(content).getLink("subreddit", sub_base),
                            card: {
                                name_raw: "r/"+community.name,
                                pfp: {url: community.communityIcon || community.iconUrl},
                                main_counter: createSubscribeAction(
                                    sub_name, community.subscribers, community.isSubscribed,
                                ),
                                url: "/r/"+community.name,
                                client_id,
                                raw_value: community,
                            },
                        },

                        internal_data: community,
                        parent: {loader: p2.prefilledVerticalLoader(content, client.getLink("widget", base), undefined)},
                        replies: null,

                        url: base_subreddit.url(sub_base, subSortMethod(client, sub_base)),
                        client_id,
                    });
                }else{
                    return p2.createSymbolLinkToError(content, "TODO community type: "+community.type, community);
                }
            }))};
        }else if(widget.kind === "calendar") {
            postcontent = {
                kind: "post",
                title: {text: widget.shortName},
                body: {kind: "none"},
                collapsible: false,
            };
            replies = {display: "tree", loader: p2.prefilledHorizontalLoader(content, p2.symbolLink("r"), widget.data.map(item => {
                return p2.createSymbolLinkToValue<Generic.Post>(content, {
                    kind: "post",
                    content: {
                        kind: "post",
                        title: {text: item.title},
                        body: {kind: "array", body: [
                            {
                                kind: "richtext",
                                content: [rt.p(
                                    rt.txt("From "),
                                    // vv todo: use a date formatter instead of timeAgo
                                    rt.timeAgo(item.startTime * 1000),
                                    rt.txt(", to "),
                                    rt.timeAgo(item.endTime * 1000),
                                )]
                            },
                            ...item.locationHtml != null ? [{
                                kind: "text" as const,
                                client_id,
                                content: item.locationHtml,
                                markdown_format: "reddit_html" as const,
                            }] : [],
                            ...item.descriptionHtml != null ? [{
                                kind: "text" as const,
                                client_id,
                                content: item.descriptionHtml,
                                markdown_format: "reddit_html" as const,
                            }] : [],
                        ]},
                        collapsible: {default_collapsed: true},
                    },
                    internal_data: item,
                    parent: {loader: p2.prefilledVerticalLoader(content, client.getLink("widget", base), undefined)},
                    replies: null,

                    url: null,
                    client_id,
                });
            }))};
        }else if(widget.kind === "image") {
            const imgdata = widget.data[widget.data.length - 1]!; // highest quality probably. TODO don't always
            // use the highest quality image.
            postcontent = {
                kind: "special",
                // why not tag_uuid: "FullscreenBody" and then just have it display the body?
                // oh because we need the link too
                tag_uuid: "FullscreenImage@-N0D1IW1oTVxv8LLf7Ed",
                not_typesafe_data: {
                    url: imgdata.url,
                    link_url: imgdata.linkUrl ?? null,
                    w: imgdata.width,
                    h: imgdata.height,
                },
                fallback: ({
                    kind: "post",
                    title: {text: widget.shortName},
                    body: {
                        kind: "richtext",
                        content: [
                            {kind: "body", body: {
                                kind: "captioned_image",
                                url: imgdata.url,
                                w: imgdata.width,
                                h: imgdata.height,
                            }},
                            ...imgdata.linkUrl != null ? [
                                rt.p(rt.link({id: client_id}, imgdata.linkUrl, {}, rt.txt(imgdata.linkUrl))),
                            ] : [],
                        ],
                    },
                    collapsible: false,
                }),
            };
            replies = null;
        }else if(widget.kind === "custom") {
            const body: Generic.Body = {
                kind: "iframe_srcdoc",
                srcdoc: `
                    <head>
                        <link rel="stylesheet" href="${widget.stylesheetUrl}">
                        <base target="_blank">
                    </head>
                    <body>${widget.textHtml}</body>
                `,
                height_estimate: widget.height,
            };
            postcontent = {
                kind: "special",
                tag_uuid: "FullscreenEmbed@-N0D96jIL-HGWHWbWKn1",
                not_typesafe_data: body,
                fallback: ({
                    kind: "post",
                    title: {text: widget.shortName},
                    body,
                    collapsible: false,
                }),
            };
            replies = null;
        }else{
            if(widget.kind !== "id-card" && widget.kind !== "menu") expectUnsupported(widget.kind);
            postcontent = {
                kind: "post",
                title: {text: "TODO: "+widget.id},
                body: {
                    kind: "text",
                    content: JSON.stringify(widget),
                    markdown_format: "none",
                    client_id,
                },
                collapsible: false,
            };
            replies = null;
        }
        return {error: null, value: {
            kind: "post",
            content: postcontent,
            internal_data: widget,
            parent: base_subreddit.asParent(content, base.subreddit),
            replies,
            url: null,
            client_id,
        }};
    },
    replies(client, base): Generic.ReadLinkResult<Generic.HorizontalLoaded> | null {
        const content = client.dirty_content;
        let sorted: SortedObjectID;
        if (base.kind === "item") {
            sorted = {kind: "item", item: base.item, sort: postSortMethod(client, base.item)};
        } else if (base.kind === "subreddit") {
            sorted = {kind: "subreddit", sub: base.sub, sort: subSortMethod(client, base.sub)};
        } else if (base.kind === "user") {
            sorted = {kind: "user", user: base.user, sort: userSortMethod(client, base.user)};
        } else {
            throw new Error("todo support base kind: " + stringify(base));
        }
        const full = client.data.listings.get(stringify(sorted));
        if (full == null) return result(null);
        if (full === "") return {error: null, value: []};
        return {error: null, value: [
            ...full.data.before ? [p2.createSymbolLinkToError(content, "TODO impl before", full.data.before)] : [],
            ...full.data.children.map((ch): Generic.HorizontalLoadedItem => {
                // implement special 'more' handling
                if (ch.kind === "more") {
                    if (sorted.kind !== "item") return p2.createSymbolLinkToError(content, "more without sort", ch);
                    const sort: Sortv = sorted.sort;
                    if (isDuplicates(sort)) return p2.createSymbolLinkToError(content, "more link with 'duplicates' sort", ch);
                    const parent_content = client.data.items.get(stringify({fullname: ch.data.parent_id}));
                    if (!parent_content) return p2.createSymbolLinkToError(content, "more is missing parent item", ch);
                    let post_fullname: string;
                    let subreddit_name: LowercaseString;
                    if (parent_content.kind === "t1") {
                        post_fullname = parent_content.data.link_id;
                        subreddit_name = asLowercaseString(parent_content.data.subreddit);
                    } else if (parent_content.kind === "t3") {
                        post_fullname = parent_content.data.name;
                        subreddit_name = asLowercaseString(parent_content.data.subreddit);
                    } else {
                        return p2.createSymbolLinkToError(content, "more parent is not t1 or t3", ch);
                    }
                    return handleMore(client, ch, sort, post_fullname, subreddit_name);
                }
                return client.getLink("item", {fullname: ch.data.name});
            }),
            ...full.data.after ? [p2.createSymbolLinkToError(content, "TODO impl after", full.data.after)] : [],
        ]};
    },
    comment_sort_menu(client, base): Generic.ReadLinkResult<Generic.SortMenu> | null {
        const opt = (l: string, v: Sortv): Generic.SortOption => ({label: l, value: {
            kind: "single",
            key: stringify(v),
            request: opaque_sort_option.encode({kind: "item", sort: v}),
        }});
        return {error: null, value: {
            options: [
                opt("Best", {v: "confidence"}),
                opt("Top", {v: "top"}),
                opt("New", {v: "new"}),
                opt("Controversial", {v: "controversial"}),
                opt("Old", {v: "old"}),
                opt("Random", {v: "random"}),
                opt("Q&A", {v: "qa"}),
                opt("Live", {v: "live"}),
                {label: "Duplicates", value: {kind: "list", items: [
                    opt("Comments", {m: "duplicates", v: "num_comments", crossposts_only: false}),
                    opt("New", {m: "duplicates", v: "new", crossposts_only: false}),
                ]}},
                {label: "Crossposts", value: {kind: "list", items: [
                    opt("Comments", {m: "duplicates", v: "num_comments", crossposts_only: false}),
                    opt("New", {m: "duplicates", v: "new", crossposts_only: false}),
                ]}},
            ],
        }};
    },
    comment_sort(client, base): Generic.ReadLinkResult<Generic.SortGroup> | null {
        return {error: null, value: {
            selected: {
                key: stringify(postSortMethod(client, base)),
            },
            group: opaque_sort_group.encode({kind: "item", item: base}),
        }};
    },
    comment_parent_request(client, base): Generic.ReadLinkResult<Generic.Opaque<"loader">> | null {
        return {error: null, value: opaque_loader.encode({
            kind: "view_post",
            post: {fullname: base.post_fullname as `t3_`, on_subreddit: base.subreddit, sort: postSortMethod(client, {fullname: base.post_fullname})},
            focus_comment_id: base.parent_comment_fullname,
            context: "9", // max
        })};
    },
    item_replies_request(client, base) {
        const sort = client.data.post_sorts.get(stringify({fullname: base.post_fullname}));
        return {error: null, value: opaque_loader.encode({
            kind: "view_post",
            post: {fullname: base.post_fullname as `t3_`, on_subreddit: base.subreddit, sort: sort ?? "infer"},
            focus_comment_id: base.comment_fullname,
            context: "0", // min (or is it 1?)
            // TODO: set to 3 if the parent is not known?
        })};
    },

    item(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        const full = client.data.items.get(stringify(base));
        if (!full) return result(null);
        if (full.kind === "t1") {
            return {error: null, value: resolveT1(client, base, full)};
        } else if (full.kind === "t3") {
            return {error: null, value: resolveT3(client, base, full)};
        }
        return {error: "TODO: impl support for item kind: "+full.kind + ` (id ${full.data.name})`, value: null};
    },

    loadmore_request(client, base): Generic.ReadLinkResult<Generic.Opaque<"loader">> | null {
        const full = client.data.mores.get(stringify(base.base));
        if (full == null || full.kind !== "more" || full.data.children.length === 0) return {error: "loadmore issue", value: null};
        return {error: null, value: opaque_loader.encode({
            kind: "morechildren",
            base: base.base,
            more: full,
            post_fullname: base.post_fullname,
        })};
    },

    wiki(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        const content = client.data.subreddit_all_wikipages.get(stringify(base));
        if (!content) return null;
        return null; // TODO
    },
    wikipage(client, base): Generic.ReadLinkResult<Generic.Post> | null {
        const content = client.data.wikipages.get(stringify(base));
        if (!content) return null;
        return {error: null, value: {
            kind: "post",
            content: {
                kind: "post",
                title: {text: base.page.canonical_path},
                info: {
                    edited: {date: content.data.revision_date * 1000},
                    // TODO: we can add revision history with diff support as a fancy version of 'edited'
                    // and maybe we'll want to make it like sort, changing the content of the post instead of returning a new link to a different post
                    // unclear
                    // and that can include an edited_by where we will use the content.data.author
                },
                body: {kind: "text", content: content.data.content_html, markdown_format: "reddit_html", client_id},
                collapsible: {default_collapsed: true},
            },
            internal_data: content,
            parent: {loader: p2.prefilledVerticalLoader(client.dirty_content, client.getLink("wiki", base.page.subreddit), undefined)},
            replies: null,
            url: `/r/${base.page.subreddit.sr_name ?? "TODO"}/wiki/${base.page.canonical_path}`,
            client_id,
        }};
    },
    wikipage_request(client, base) {
        return {error: null, value: opaque_loader.encode({kind: "wikipage", page: base})};
    },
};

function itemReplies(client: RedditClient, base: BaseItem, full: Reddit.T1 | Reddit.T3): {replies: Generic.PostReplies} {
    return {
        replies: {
            display: "tree",
            loader: {
                kind: "horizontal_loader",
                key: client.getLink("replies", {kind: "item", item: {fullname: full.data.name}}),
                request: client.getLink("item_replies_request", {
                    subreddit: asLowercaseString(full.data.subreddit),
                    post_fullname: full.kind === "t1" ? full.data.link_id : full.data.name,
                    comment_fullname: full.kind === "t1" ? full.data.id : null,
                }),
                client_id,
            },
            sort_menu: client.getLink("comment_sort_menu", {}),
            sort_group: client.getLink("comment_sort", {fullname: full.kind === "t1" ? full.data.link_id : full.data.name}),
        },
    };
}

function resolveT3(client: RedditClient, base: BaseItem, full: Reddit.T3): Generic.Post {
    const sort = ("infer" satisfies Sortv | "infer") as (Sortv | "infer");
    const url = isDuplicates(sort) ? updateQuery(
        "/r/"+full.data.subreddit+"/duplicates/"+full.data.id, {
            sort: sort.v,
            crossposts_only: "" + sort.crossposts_only,
        }
    ) : updateQuery(full.data.permalink, sort !== "infer" ? {
        sort: sort.v,
    } : {});
    const listing = full.data;
    const {replies} = itemReplies(client, base, full);
    const sr_name = asLowercaseString(full.data.subreddit);
    return {
        kind: "post",
        client_id,
        url,

        parent: base_subreddit.asParent(client.dirty_content, {sr_name: asLowercaseString(full.data.subreddit)}),
        replies,

        content: {
            kind: "post",
            title: {text: listing.title},
            collapsible: {default_collapsed: true},
            flair: getPostFlair(listing),
            author: authorFromPostOrComment(listing),
            body: getPostBody(listing),
            thumbnail: getPostThumbnail(listing, "open"),
            info: getPostInfo(full),

            actions: {
                vote: getPointsOn(listing),
                code: getCodeButton(listing.is_self ? listing.selftext : listing.url),
                other: [
                    {
                        kind: "link",
                        client_id,
                        url: "/domain/"+listing.domain,
                        text: listing.domain,
                    }, deleteButton(listing.name), saveButton(listing.name, listing.saved), reportButton(listing.name, listing.subreddit),
                    editButton(listing.name),
                    rawlinkButton(url),
                ],
            },
        },
        internal_data: full,
    };
}

function resolveT1(client: RedditClient, base: BaseItem, full: Reddit.T1): Generic.Post {
    const url = updateQuery(full.data.permalink, {context: "3"});

    const listing = full.data;

    const parent_unfilled_link = client.getLink("item", {fullname: full.data.parent_id});
    const load_parent_request = client.getLink("comment_parent_request", {subreddit: asLowercaseString(full.data.subreddit), post_fullname: full.data.link_id, parent_comment_fullname: full.data.parent_id.startsWith("t1_") ? full.data.parent_id : null});

    const {replies} = itemReplies(client, base, full);

    return {
        kind: "post",
        content: {
            kind: "post",
            title: null,
            author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])),
            body: getCommentBody(listing),
            info: getPostInfo(full),
            collapsible: {default_collapsed: commentDefaultCollapsed(listing.author) || (listing.collapsed ?? false)},
            actions: {
                // NOTE:
                // if the post's discussion_type === "CHAT", don't display vote buttons
                // * how do we do this?
                //    - what if a chat comment gets returned without information about the post it's on?
                //    - for instance: on a user page (do they show there?) or on an /api/info page
                // we can implement this now: add a new map of post_to_is_chat, then check that here. that way we won't cause item
                // to rerender unnecesarily.
                vote: getPointsOn(listing),
                code: getCodeButton(listing.body),
                other: [
                    editButton(listing.name),
                    deleteButton(listing.name),
                    saveButton(listing.name, listing.saved),
                    reportButton(listing.name, listing.subreddit),
                    rawlinkButton(url),
                ],
            },
        },
        internal_data: full,
        parent: {
            loader: {
                kind: "vertical_loader",
                unfilled_parent: client.getLink("item", {fullname: full.data.link_id}),
                key: parent_unfilled_link,
                client_id,
                request: load_parent_request,
            },
        },
        replies,
        url,
        client_id,
    };
}

/*
base_submit.objectLink(submit_base)
*/
export const base_submit = {
    url: (base: BaseSubmitPage) => "/r/"+base.on_subreddit+"/submit",
    objectLink: (base: BaseSubmitPage) => autoLinkgen<Generic.Post>("submit→post", base),
};
export const full_submit = {
    // const linkout = "raw!https://www.reddit.com/" + [...sub.base, "submit"].join("/");
    fill: autoFill((full: FullSubmitPage) => base_submit.objectLink(full.on_base), (content, full): Generic.Post => {
        const linkout = "raw!https://www.reddit.com"+base_submit.url(full.on_base);
        const about = full.about;
        const flairinfo = full.linkflair;
        // TODO: type safety for the returned value. I think I had a plan for this.
        return {
            kind: "post",
            content: {
                kind: "submit",
                submission_data: {
                    send_name: "Post",
                    client_id,
                    submit_key: submit_encoder.encode({
                        kind: "newpost",
                        sub: full.on_base.on_subreddit,
                    }),
                    title: "Submitting to "+full.about.data.display_name_prefixed,
                    fields: [
                        {kind: "title", id: "_title"},
                        {kind: "content", id: "_content", default_id: "_textpost", content_types: [
                            {kind: "none", id: "_nothing", disabled: null},
                            {kind: "text", mode: "reddit", id: "_textpost",
                                disabled: null, client_id,
                            },
                            {kind: "todo", title: "Images & Video", linkout, id: "_imagepost",
                                reason: "Uploading images with threadclient is not supported yet",
                                linkout_label: "Submit on reddit.com",
                                client_id,
                                disabled: about.data.submission_type !== "self" && about.data.allow_images ? null : "Image posts are not allowed on this subreddit",
                            },
                            {kind: "link", id: "_linkpost",
                                disabled: about.data.submission_type !== "self" ? null : "Talk posts are not allowed on this subreddit",
                            },
                            {kind: "todo", title: "Poll", linkout, id: "_pollpost",
                                reason: "Creating polls with threadclient is not supported yet",
                                linkout_label: "Submit on reddit.com",
                                client_id,
                                /*
                                https://oauth.reddit.com/api/submit_poll_post.json?resubmit=true&rtj=both&raw_json=1&gilding_detail=1
                                */
                            disabled: about.data.submission_type !== "self" && about.data.allow_polls ? null : "Polls are not allowed on this subredit",
                            },
                            {kind: "todo", title: "Talk", linkout, id: "_talkpost",
                                reason: "Creating talk posts with threadclient is not supported.",
                                linkout_label: "Submit on reddit.com",
                                client_id,
                                disabled: about.data.submission_type !== "self" && about.data.allow_talks ? null : "Talk posts are not allowed on this subreddit",
                            },
                        ]},
                        {kind: "flair_one", id: "_postflair", flairs: (flairinfo ?? []).map((flair): Generic.Submit.FlairChoice => ({
                            id: flair.id,
                            flairs: flairToGenericFlair(flair),
                        }))},
                        {kind: "flair_many", id: "_postopts", flairs: [
                            {id: "_OC", flairs: [flair_oc], disabled: about.data.original_content_tag_enabled ? null : "OC tag not allowed on this sub"},
                            {id: "_OVER18", flairs: [flair_over18]},
                            {id: "_SPOILER", flairs: [flair_spoiler]},
                            {id: "_LIVECHAT", flairs: [{elems: [{kind: "text", text: "Live Chat", styles: {}}], content_warning: false}],
                                disabled: about.data.is_chat_post_feature_enabled && about.data.allow_chat_post_creation ? null : "Live chat posts are not allowed on this sub",
                            },
                            {id: "_EVENT", flairs: [{elems: [{kind: "text", text: "Event", styles: {}}], content_warning: false}],
                                disabled: "ThreadClient does not yet support creating event posts",
                            },
                        ]},
                    ],
                },
            },
            internal_data: {about, flairinfo},
            parent: base_subreddit.asParent(content, {sr_name: full.on_base.on_subreddit}),
            replies: null,
            url: base_submit.url(full.on_base),
            client_id,
        };
    }),
};

const base_inbox = {
    // consistentData: autoOutline("base_inbox→sort_options", (content, base: BaseInbox): Generic.ConsistentSortData => {
    //     const res: Generic.SortOptions = [];
    //     for(const [tag, name] of [["compose", "Compose"] as const]) {
    //         res.push({
    //             name,
    //             tag,
    //             object: sorted_compose_inbox.menubar(content, {
    //                 on_base: base,
    //             }),
    //         });
    //     }
    //     for(const [tag, name] of [
    //         ["inbox", "All"],
    //         ["unread", "Unread"],
    //         ["messages", "Messages"],
    //         ["comments", "Comment Replies"],
    //         ["selfreply", "Post Replies"],
    //         ["mentions", "Username Mentions"],
    //         ["sent", "Sent"],
    //         ["mod", "Legacy Modmail"],
    //     ] as const) {
    //         res.push({
    //             name,
    //             tag,
    //             object: sorted_inbox.menubar(content, {
    //                 tab: tag,
    //                 on_base: base,
    //             }),
    //         });
    //     }
    //     return {
    //         sort_options: res,
    //         display_object: {kind: "todo", message: "Inbox. Put some fancy design here or something."},
    //     };
    // }),
    selfParent: (content: Generic.Page2Content, base: BaseInbox): Generic.PostParent => {
        return base_client.asParent(content, base);
    },
};
const sorted_inbox = {
    url: (base: SortedInbox): string => {
        return "/message/"+base.tab;
    },
    contentLink: (base: SortedInbox) => autoLinkgen<Generic.HorizontalLoaded>("sorted_inbox→content", base),
    // menubar: autoOutline("sorted_inbox→menubar", (content, base: SortedInbox): Generic.Post => {
    //     return {
    //         kind: "post",
    //         internal_data: base,
    //         client_id,
    //         url: sorted_inbox.url(base),
    //         parent: base_inbox.selfParent(content, base.on_base),
    //         content: {
    //             kind: "sort_wrapper",
    //             consistent: base_inbox.consistentData(content, base.on_base),
    //             selected_option_tag: base.tab,
    //         },
    //         replies: {
    //             display: "repivot_list",
    //             loader: {
    //                 kind: "horizontal_loader",
    //                 key: sorted_inbox.contentLink(base),
    //                 request: p2.fillLink(content, autoLinkgen<Generic.Opaque<"loader">>("sorted_inbox→content_loader", base), opaque_loader.encode({
    //                     kind: "inbox",
    //                     base,
    //                 })),
    //                 client_id,
    //             },
    //         },
    //     };
    // }),
};
const sorted_compose_inbox = {
    url: (base: SortedComposeInbox): string => "/message/compose",
    // menubar: autoOutline("sorted_compose_inbox→menubar", (content, base: SortedComposeInbox): Generic.Post => {
    //     return {
    //         kind: "post",
    //         internal_data: base,
    //         client_id,
    //         url: sorted_compose_inbox.url(base),
    //         parent: base_inbox.selfParent(content, base.on_base),
    //         content: {
    //             kind: "sort_wrapper",
    //             consistent: base_inbox.consistentData(content, base.on_base),
    //             selected_option_tag: "compose",
    //         },
    //         replies: todoReplies(content),
    //     };
    // }),
};

function handleMore(client: RedditClient, full: Reddit.More, sort: PostSort, post_fullname: string, subreddit: LowercaseString): Generic.HorizontalLoadedItem {
    if (full.data.children.length === 0) {
        // depth-based
        return {
            kind: "horizontal_loader",
            key: "#none" as Generic.NullableLink<Generic.HorizontalLoaded>,
            request: client.getLink("item_replies_request", {
                post_fullname,
                comment_fullname: full.data.parent_id,
                subreddit,
            }),
            load_count: full.data.count,
            client_id,
        };
    }

    // morechildren-based
    return {
        kind: "horizontal_loader",
        key: client.getLink("replies", {kind: "item", item: {fullname: stringify<BaseMore2>(moreBase(full, sort))}}),
        request: client.getLink("loadmore_request", {base: moreBase(full, sort), sort, post_fullname}), // the id of a 'more' is the id of its first child, so we need to differentiate
        load_count: full.data.count,
        client_id,
    };
}

function todoReplies(content: Generic.Page2Content): Generic.PostReplies {
    return {
        display: "repivot_list",
        loader: Generic.p2.prefilledHorizontalLoader(content,
            Generic.p2.createSymbolLinkToError(content, "TODO replies", ""),
        undefined),
    };
}


/*
import * as Generic from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import { getSrId, subUrl } from "./page2_from_listing";
import { client, SubrInfo, SubSort } from "./reddit";

links
in
page2







getobject(ObjKind, obj_base, obj_full)

there are two types of objects

take eg:

- a subreddit object
  - this always exists and doesn't have to load
- a comment object
  - this has to load

here's a question: why is the subreddit object different than the comment object
- because it's the pivot, and we decided that the pivot doesn't have to load
but that's not a good reason

ok so what about::
our previous psys attempt used:
- the subreddit would have fill data of: its listing content
the new thing would be:
- the subreddit has fill data of its Reddit.T5Data

so here's the question:
- what do you do when you fetch a page?

ok here a post has this info:
```
export type Post = {
    kind: "post",

    content: PostContent, // content should always be in a PostData. eg: crossposts that are embedded in a body also need parent, replies.
    internal_data: unknown,

    parent: null | PostParent,
    replies: null | PostReplies,
    
    url: string | null, // if a thing does not have a url, it cannot be the pivot
    client_id: string,
};
```

in order for the pivot to be a post, wew would need:
- content should be a loader
- url needs to be determinable from the object's basic
  - we can include a 'vanity' url inside the object's content. ie: a post's root url
    would be `/r/[subreddit]/comments/[postid]/0` but we would prefer the url
    `/r/[subreddit]/comments/[postid]/[postname]`

ok this is how objects work

given the basic, I can create any post

what about nullable contents?

- oh—given the basic, can I create the loader?
  - yes
  - we'll have to make exceptions for any linked loaders

*/


type LoaderData = {
    kind: "todo",
} | {
    kind: "subreddit_identity_and_sidebar",
    sub: LowercaseString,
} | {
    kind: "view_post",
    post: BasePostT3,
    focus_comment_id: null | string,
    context: null | string,
} | {
    kind: "submit_page",
    base: BaseSubmitPage,
} | {
    kind: "inbox",
    base: SortedInbox,
} | {
    kind: "morechildren",
    base: BaseMore2,
    more: Reddit.More,
    post_fullname: string,
} | {
    kind: "user_identity",
    user: BaseUser,   
} | {
    kind: "user_moderated_subreddits",
    user: BaseUser,   
} | {
    kind: "fetch_listing",
    url: "/__any_listing", // this should be keys of Requests that satisfy {response: Listing}
    parent: SortedObjectID,
    allow_replies: AllowReplies;
} | {
    kind: "fetch_trophies",
    username: LowercaseString,
} | {
    kind: "wikipage",
    page: BaseRevisedWikipage,
};
const opaque_loader = encoderGenerator<LoaderData, "loader">("loader");
const opaque_sort_option = encoderGenerator<SortOptionKind, "sort_option">("sort_option");
const opaque_sort_group = encoderGenerator<SortGroupKind, "sort_group">("sort_group");
type SortOptionKind = {
    kind: "sub",
    sort: SubSort,
} | {
    kind: "item",
    sort: Sortv,   
} | {
    kind: "user",
    sort: UserSort,   
};
type SortGroupKind = {
    kind: "sub",
    sub: BaseSubreddit,
} | {
    kind: "item",
    item: BaseItem,   
} | {
    kind: "user",
    user: BaseUser,   
};

type AllowReplies = true | {after_id: string};

function addItem(client: RedditClient, item: Reddit.Item, allow_replies: AllowReplies, parent: SortedObjectID | {kind: "none"}): void {
    if (item.kind === "more") {
        if (parent.kind !== "item") return; // need sort for morechildren
        if (isDuplicates(parent.sort)) return; // duplicates doesn't have 'morechildren', it has 'after'
        client.addDirty(client.data.mores.setAndList(stringify(moreBase(item, parent.sort)), item));
        return;
    }
    if (item.kind === "t6") {
        if (parent.kind !== "user_trophies") return; // need user_trophies for trophy
        // t6 (trophies) don't have usable names. instead we need to map them as (label,user)
        client.addDirty(client.data.user_trophies.setAndList(stringify({label: item.data.name, user: parent.user}), item)); 
        return;
    }

    // TODO: note that if item.kind is more and it is a depth-based loader, then the item.data.name will be bad.
    client.addDirty(client.data.items.setAndList(stringify({fullname: item.data.name}), item));

    if (item.kind === "t1") {
        // TODO: we can probably use item.data.subreddit_id,item.data.link_id & sort
        // instead of that method for on_post
        if (parent.kind === "item") {
            addListing(client, {kind: "item", item: {fullname: item.data.name}, sort: parent.sort}, item.data.replies, allow_replies === true ? true : item.data.id === allow_replies.after_id ? true : allow_replies);
        }
    }
}

type UserSort = {
    kind: "sorted-tab",
    tab: "overview" | "comments" | "submitted",
    sort: {sort: Reddit.SubSortMode | "unsupported", t: Reddit.SubSortTime},
    // overview defaults ?sort=new
    // comments defaults ?sort=new
    // submitted defaults ?sort=hot
} | {
    kind: "unsorted-tab",
    tab: "upvoted" | "downvoted" | "hidden" | "saved",
};

type SortedObjectID = {kind: "item", item: BaseItem, sort: Sortv} | {kind: "subreddit", sub: BaseSubreddit, sort: SubSort} | {kind: "user_trophies", user: BaseUser} | {kind: "user", user: BaseUser, sort: UserSort} | {kind: "wikipage_revisions", page: BaseWikipage}; // TODO: subreddits have T5s and it should be possible to use them?
type ObjectID = {kind: "item", item: BaseItem} | {kind: "subreddit", sub: BaseSubreddit} | {kind: "user_trophies", user: BaseUser} | {kind: "user", user: BaseUser} | {kind: "wikipage_revisions", page: BaseWikipage}; // TODO: subreddits & users have T5s and it should be possible to use them?

function addListing(client: RedditClient, parent: SortedObjectID | {kind: "none"}, listing: Reddit.Listing | "", allow_replies: true | {after_id: string}): void {
    // if we have a 'after' link, then that means to add a load more after us
    // if we have a 'before' link, same but before us
    console.log("addListing", parent, listing, allow_replies);
    if (parent.kind !== "none" && allow_replies === true) {
        // TODO:
        // - if there is already a listing
        // - if there are multiple listings
        // - if ...
        client.addDirty(client.data.listings.setAndList(stringify(parent), listing));
    }
    if (listing !== "") {
        for (const ch of listing.data.children) addItem(client, ch, allow_replies, parent);
    }
}
function addT2(client: RedditClient, t2: Reddit.T2): void {
    const username = asLowercaseString(t2.data.name);
    client.addDirty(client.data.user_abouts.setAndList(stringify({username}), t2));
    client.addDirty(client.data.subreddit_t5s.setAndList(stringify({sr_name: asLowercaseString(`u_${username}`)}), {kind: "t5", data: t2.data.subreddit}));
}

export async function loadPage2v2(
    content: Generic.Page2Content,
    lreq: Generic.Opaque<"loader">,
): Promise<void> {
    const data = opaque_loader.decode(lreq);
    const client = RedditClient.fromContent(content);
    console.log("loadpage2v2", data);
    (window as any).__last_loaded = client;
    if(data.kind === "fetch_listing") {
        // fetch the subreddit listing
        const listing = await redditRequest(data.url, {method: "GET"});
        const client = RedditClient.fromContent(content);
        addListing(client, data.parent, listing, data.allow_replies);
    }else if(data.kind === "subreddit_identity_and_sidebar") {
        const subreddit = data.sub;
        const [widgets, about] = await Promise.all([
            redditRequest(`/r/${ec(subreddit)}/api/widgets`, {method: "GET"}),
            redditRequest(`/r/${ec(subreddit)}/about`, {method: "GET"}),
        ]);
        client.addDirty(client.data.subreddit_t5s.setAndList(stringify({sr_name: subreddit}), about));
        client.addDirty(client.data.widgets.setAndList(stringify({sr_name: subreddit}), widgets));
        for (const [key, widget] of Object.entries(widgets.items)) {
            client.addDirty(client.data.widget.setAndList(stringify({subreddit: {sr_name: subreddit}, widget: key}), widget));
        }
    }else if(data.kind === "view_post") {
        // *! on /duplicates, it probably uses a "?after=" url. TODO support that.
        const postid = data.post.fullname.substring(3);
        const post_value = isDuplicates(data.post.sort) ? await redditRequest(`/duplicates/${ec(postid)}`, {
            method: "GET",
            query: {
                sort: data.post.sort.v,
                before: null,
                after: null, // TODO**
                crossposts_only: jstrOf(data.post.sort.crossposts_only),
            },
        }) : await redditRequest(`/comments/${ec(postid)}`, {
            method: "GET",
            query: {
                sort: data.post.sort === "infer" ? null : data.post.sort.v,
                comment: data.focus_comment_id,
                context: data.context ?? "3", // use a higher context value for vertical loaders
            },
        });
        const top_half = post_value[0];
        const top_post = top_half.data.children[0]!;
        const bottom_half = post_value[1];
        addListing(client, {kind: "none"}, top_half, true);

        let sort: Sortv;
        if (data.post.sort !== "infer") {
            sort = data.post.sort;
        } else if (top_post.kind === "t3" && top_post.data.suggested_sort != null) {
            sort = {v: top_post.data.suggested_sort};
        } else {
            sort = {v: "confidence"}; // hopefully right
        }

        addListing(client, {kind: "item", item: {fullname: top_half.data.children[0]!.data.name}, sort}, bottom_half, data.focus_comment_id != null ? {after_id: data.focus_comment_id} : true);

        if(data.focus_comment_id != null) {
            if (!client.data.items.has(stringify({fullname: `t1_${data.focus_comment_id}`}))) {
                console.warn("TODO: mark comment as 'Comment not found (maybe it was deleted?)");
            }
        }

        // done.
    }else if(data.kind === "submit_page") {
        const about = await (
            redditRequest(`/r/${ec(data.base.on_subreddit)}/about`, {method: "GET", cache: true})
        );
        const linkflair: Reddit.ApiLinkFlair = about.data.link_flair_enabled && about.data.can_assign_link_flair ? await (
            redditRequest(`/r/${ec(data.base.on_subreddit)}/api/link_flair_v2`, {method: "GET", cache: true, onerror: e => []})
        ) : [];
        full_submit.fill(content, {
            on_base: data.base,
            about,
            linkflair,
        });
    }else if(data.kind === "morechildren") {
        const remaining = [...data.more.data.children];
        const batch = remaining.splice(0, 100);

        const resp = await redditRequest("/api/morechildren", {
            method: "GET",
            query: {
                api_type: "json",
                limit_children: "false",
                children: batch.join(","),
                link_id: data.post_fullname as `t3_${string}`,
                sort: data.base.sort.v,
            },
        });

        const reparenting: Reddit.PostCommentLike[] = [];
        const id_map = new Map<string, Reddit.PostCommentLike>();

        for(const item of resp.json.data.things) {
            id_map.set(item.data.name, item);
            const parent_comment = id_map.get(item.data.parent_id);
            if(parent_comment) {
                if(parent_comment.kind !== "t1") {
                    throw new Error("expected t1 here");
                }
                // ||= because replies might be "" if it's empty
                parent_comment.data.replies ||= {kind: "Listing", data: {before: null, children: [], after: null}};
                parent_comment.data.replies.data.children.push(item);
            }else {
                reparenting.push(item);
            }
        }
        let rem_disp = data.more.data.count - resp.json.data.things.length;
        if (rem_disp < remaining.length) rem_disp = remaining.length; // in case we loaded more than expected, which is common on active threads

        if (remaining.length > 0) {
            const prev = reparenting[reparenting.length - 1];
            if (prev?.kind === "more") {
                prev.data.count += rem_disp;
                prev.data.children = [...remaining, ...prev.data.children];
                // these are unnecessary, we ignore id/name values on morechildren
                prev.data.id = prev.data.children[0] ?? "_";
                prev.data.name = `t1_${prev.data.id}`;
            } else {
                reparenting.push({
                    kind: "more",
                    data: {
                        count: rem_disp, // good enough for now. alternatively we could use the base count - resp.json.data.things.length and fall back to remaining.length if that is 
                        depth: data.more.data.depth,
                        id: remaining[0] ?? "_",
                        name: `t1_${remaining[0] ?? "_"}`,
                        parent_id: data.more.data.parent_id,
                        children: remaining,
                    },
                });
            }
        }
        addListing(client, {
            kind: "item",
            item: {
                fullname: stringify(data.base), // it's kind of a hack to overload data.listings to contain morechildren. we should probably make a seperate data.morechildren instead.
            },
            sort: data.base.sort,
        }, {
            kind: "Listing",
            data: {
                before: null,
                children: reparenting,
                after: null,
            },
        }, true);
    } else if (data.kind === "user_identity") {
        const info = await redditRequest(`/user/${ec(data.user.username)}/about`, {method: "GET"});
        addT2(client, info);
    } else if (data.kind === "user_moderated_subreddits") {
        const info = await redditRequest(`/user/${ec(data.user.username)}/moderated_subreddits`, {method: "GET"});
        client.addDirty(client.data.user_moderated_subreddits.setAndList(stringify(data.user), info));
    } else if (data.kind === "wikipage") {
        await fetchWikipage(client, data.page);
    }else if (data.kind === "fetch_trophies") {
        const trophies = await redditRequest(`/api/v1/user/${ec(data.username)}/trophies`, {method: "GET"});
        client.addDirty(client.data.user_trophy_lists.setAndList(stringify({username: data.username}), trophies));
        for (const item of trophies.data.trophies) {
            addItem(client, item, true, {kind: "user_trophies", user: {username: data.username}});
        }
    }else throw new Error("todo support loader kind: ["+data.kind+"]");
}
async function fetchWikipage(client: RedditClient, page: BaseRevisedWikipage, opt?: {canonicalize?: boolean}): Promise<{canonical: BaseRevisedWikipage}> {
    let result_url: string = "";
    const info = await redditRequest(`/r/${ec(page.page.subreddit.sr_name ?? "todo")}/wiki/${ec(page.page.canonical_path)}`, {method: "GET", viewresponse(resp) {
        result_url = resp.url;
    }});
    const ruparsed = new URL(result_url);
    const rumatch = ruparsed.pathname.match(/^\/r\/[^/]*\/wiki\/(.+)\.json$/);
    let canonical_path = page.page.canonical_path;
    if (rumatch) {
        canonical_path = rumatch[1]!;
    } else {
        console.warn("fetchWikipage norumatch", {result_url, ruparsed, rumatch, canonical_path});
    }
    client.addDirty(client.data.wikipages.setAndList(stringify(page), info));
    addT2(client, info.data.revision_by);
    if (opt?.canonicalize && page.page.canonical_path !== canonical_path) {
        throw new Error(`canonical path mismatch: ${JSON.stringify([page.page.canonical_path, canonical_path])}`);
    }
    return {canonical: {page: {subreddit: page.page.subreddit, canonical_path}, v: page.v, v2: page.v2}};
}

export async function sortPage2(client: RedditClient, group: Generic.Opaque<"sort_group">, option: Generic.Opaque<"sort_option">): Promise<void> {
    const group_dec = opaque_sort_group.decode(group);
    const option_dec = opaque_sort_option.decode(option);
    if (group_dec.kind === "sub") {
        if (option_dec.kind !== "sub") throw new Error("sort sub on non-sub: " + option_dec.kind);
        client.addDirty(client.data.subreddit_sorts.setAndList(stringify(group_dec.sub), option_dec.sort));
    } else if (group_dec.kind === "item") {
        if (option_dec.kind !== "item") throw new Error("sort item on non-item: " + option_dec.kind);
        client.addDirty(client.data.post_sorts.setAndList(stringify(group_dec.item), option_dec.sort));
    } else if (group_dec.kind === "user") {
        if (option_dec.kind !== "user") throw new Error("sort user on non-user: " + option_dec.kind);
        client.addDirty(client.data.user_sorts.setAndList(stringify(group_dec.user), option_dec.sort));
    } else {
        throw new Error("todo sort: " + stringify(group_dec));
    }
}
