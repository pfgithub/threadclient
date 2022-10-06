import * as Generic from "api-types-generic";
import { p2, rt } from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import { encoderGenerator } from "threadclient-client-base";
import { updateQuery } from "tmeta-util";
import { getPostInfo, rawlinkButton, submit_encoder } from "./page2_from_listing";
import { authorFromPostOrComment, awardingsToFlair, client_id, createSubscribeAction, deleteButton, ec, editButton, expectUnsupported, flairToGenericFlair, flair_oc, flair_over18, flair_spoiler, getCodeButton, getCommentBody, getNavbar, getPointsOn, getPostBody, getPostFlair, getPostThumbnail, jstrOf, parseLink, PostSort, redditRequest, replyButton, reportButton, saveButton, subredditHeaderExists, SubrInfo, SubSort } from "./reddit";

const debug_mode = true;

// * todo fix - we use JSON.stringify right now, but that keeps property order. eventually, that's going to become
// a problem - two things with the same base are not going to have the same id because of property order.

// implementing this well should free us to make less things require loaders:
// - PostReplies would directly contain the posts and put a loader if it doesn't.
//   if the base is enough to describe the replies, we can put them in directly,
//   otherwise we need to link.

// a safety check we can do is:
// - after generating any Generic.Post:
//   - check that parsing the url creates the same base as the url was made from
// how to implement this: @@@@@@@@@@@@@@@@@@@@@@@@@ do this @@@@@@@@@@@
// - add a method: getPivotLink(url) that returns a OneLoader<Post> from a given url
// - for every post, verify that if(post.url) |url| getPivotLink(url) === loader.key.

/*
report screens in page2
- the report button links to a special @report page including a link to the object being reported
- the report page is a post that shows the object being reported and shows the report options
  - or it shows it as a reply with the report as a pivot. doesn't matter
*/

// here's something interesting
// what if we're loading a post and we say 'this is the pivot link'
// and then the pivot link is unfilled (ie the comment with the specified id is missing in the tree)
// - we need to somehow say "repivot to <this link> in case of an error"
export function urlToOneLoader(pathraw_in: string): {
    content: Generic.Page2Content,
    pivot_loader: null | Generic.OneLoader<Generic.Post>,
} {
    const content: Generic.Page2Content = {};

    const [parsed, pathraw] = parseLink(pathraw_in);

    const subToLcs = (sub: SubrInfo): LowercaseString => asLowercaseString(
        sub.kind === "subreddit" ? sub.subreddit :
        sub.kind === "userpage" ? "u_"+sub.user :
        "ERROR_subredditkind:"+sub.kind
    );
    // * TODO FIX:
    // url '/comments/xl9dsh' doesn't work because it doesn't know the sub
    // urlToOneLoader should be async to fetch any of that needed info probably
    // we'll end up double-fetching the post but it will probably be /api/info?ids=… the first time at least

    if(parsed.kind === "subreddit") {
        if(parsed.sub.kind === "subreddit") {
            const link = base_subreddit.post(content, {
                subreddit: asLowercaseString(parsed.sub.subreddit),
                sort: parsed.current_sort,
            });
            return {content, pivot_loader: p2.prefilledOneLoader(content, link, undefined)};
        }
    }
    if(parsed.kind === "comments") {
        const post_base: BasePostT3 = {
            fullname: `t3_${parsed.post_id_unprefixed}`,
            on_subreddit: subToLcs(parsed.sub),
            sort: parsed.sort_override != null ? {v: parsed.sort_override} : "default"
        };
        const comment_base: BaseCommentT1 | null = parsed.focus_comment != null ? {
            fullname: `t1_${parsed.focus_comment}`,
            on_post: post_base,
        } : null;
        return {content, pivot_loader: {
            kind: "one_loader",
            key: comment_base != null ? base_comment.commentLink(comment_base) : base_post.postLink(post_base),
            request: p2.createSymbolLinkToValue<Generic.Opaque<"loader">>(content, opaque_loader.encode({
                kind: "view_post",
                focus_comment_id: parsed.focus_comment,
                post: post_base,
                context: parsed.context ?? "3",
            })),
            client_id,
        }};
    }
    if(parsed.kind === "duplicates") {
        // [!] does not yet support without a sub in the url ++ TODO
        const post_base: BasePostT3 = {
            fullname: `t3_${parsed.post_id_unprefixed}`,
            on_subreddit: subToLcs(parsed.sub),
            sort: {m: "duplicates", v: "num_comments", crossposts_only: parsed.crossposts_only},
        };
        return {content, pivot_loader: {
            kind: "one_loader",
            key: base_post.postLink(post_base),
            request: p2.createSymbolLinkToValue<Generic.Opaque<"loader">>(content, opaque_loader.encode({
                kind: "view_post",
                focus_comment_id: null,
                post: post_base,
                context: "3",
            })),
            client_id,
        }};
    }
    if(parsed.kind === "submit") {
        const submit_base: BaseSubmitPage = {
            on_subreddit: subToLcs(parsed.sub),
        };
        return {content, pivot_loader: {
            kind: "one_loader",
            key: base_submit.objectLink(submit_base),
            request: p2.createSymbolLinkToValue<Generic.Opaque<"loader">>(content, opaque_loader.encode({
                kind: "submit_page",
                base: submit_base,
            })),
            client_id,
        }};
    }
    return {content, pivot_loader: null};
}

type LowercaseString = string & {__is_ascii_lowercase: true};
export function asLowercaseString(str: string): LowercaseString {
    return str.toLowerCase() as LowercaseString;
}

let is_validating = false;
function validatePost<T>(link: Generic.Link<T>, res: T): T {
    if(is_validating) return res;
    is_validating = true;
    try {
        if(debug_mode) {
            // heuristic to see if it looks like res looks like a generic.post
            if(res != null && typeof res === "object" && 'kind' in res && (res as {'kind': unknown})["kind"] === "post" && 'url' in res) {
                const resurl = (res as {'url': unknown}).url;
                if(typeof resurl === "string") {
                    if((res as {'disallow_pivot': undefined | boolean}).disallow_pivot ?? false) {
                        // pass; the object cannot be pivoted and clicking it will redirect to its url rather than repivoting
                    }else{
                        // parse the url
                        const upres = urlToOneLoader(resurl);
                        if(upres.pivot_loader == null) {
                            console.warn("*[ValidatePost]* NOT YET SUPPORTED URL:", resurl, link);
                        }else if(upres.pivot_loader.key !== link){
                            console.error("*[ValidatePost]* URL PRODUCES DIFFERENT KEY:", resurl, "\n→", link, "\n←", upres.pivot_loader.key);
                        }else{
                            // passsed
                        }
                    }
                }else{
                    // pass. null or undefined or some other type.
                }
            }
        }
        return res;
    } finally {
        is_validating = false;
    }
}

// Base is the minimum content required to create a filled link to a Generic.Post
type BaseClient = {
    _?: undefined,
};
type UnsortedSubreddit = LowercaseString;
type BaseSubredditT5 = {
    subreddit: LowercaseString, // u_ for user subreddits
    // note: the fullname is not known here
    sort: SubSort,
    // note: sort handling isn't quite right. posts will always set their parent to an unsorted subreddit.
    // - this means that if we show little parent trees like we want to on mastodon, in user pages,
    //   in inbox notifications, and on the homepage, we will accidentally show them any time the subreddit
    //   is sorted. we will have to solve this.
};
type FullSubredditContent = {
    subreddit: BaseSubredditT5,
    listing: Reddit.Listing,
};
type BaseSubredditSidebar = {
    for_sub: UnsortedSubreddit,
};
type FullSubredditSidebar = {
    on_base: BaseSubredditSidebar,

    widgets: Reddit.ApiWidgets,
    sub_t5: Reddit.T5,
};
type BasePostT3 = {
    fullname: `t3_${string}`,
    on_subreddit: UnsortedSubreddit,
    // * we are requiring a subreddit on posts *
    // - this means: "/comments/[id]" will require loading content in order to get the object. we
    //   can't get the wrapper from the url alone.
    // - the reason for this is i forgot
    //   - probably to make sure that an unfilled post can have a parent but we have decided to not
    //     use unfilled posts and instead require all posts to be filled.
    sort: Sortv,
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
type BaseUserT2 = {
    username: LowercaseString,
    // note: the fullname is not known here
};
type BasePrivateMessageT4 = {
    fullname: `t4_${string}`,
};
type BaseWikipage = {
    kind: "wikipage",
    in_subreddit: BaseSubredditT5 | null, // there is a root wiki with no subreddit
    aftersub_path: string,
};
type BaseSubmitPage = {
    on_subreddit: UnsortedSubreddit,
};
type FullSubmitPage = {
    on_base: BaseSubmitPage,
    about: Reddit.T5, // we're potentially fetching this information twice
    // as it might already be available from the sub header
    linkflair: Reddit.ApiLinkFlair | null, // only if about.data.link_flair_enabled
};

// consider using the base .id() fn instead of json.stringify [!] not url
// - turn base into a class that BaseClient/BaseSubredditT5/… extend
// !!!! TODO: autoLinkgen will not last. we have to replace it with individual things.
//
// tid: ResTy extends … ? "p:" : ResTy extends … ? "c:" : …
// or define different ones for different ResTys
function autoLinkgen<ResTy>(cid: string, base: unknown): Generic.NullableLink<ResTy> {
    return Generic.p2.stringLink(cid + ":" + JSON.stringify(base));
}
type AORes<Base, ResTy> = (content: Generic.Page2Content, base: Base) => Generic.Link<ResTy>;
function autoOutline<Base, ResTy>(
    unique_consistent_id: string,
    getContent: (content: Generic.Page2Content, base: Base, link: Generic.Link<ResTy>) => ResTy,
): AORes<Base, ResTy> & {link: (base: Base) => Generic.Link<ResTy>} {
    const getlink = (base: Base) => autoLinkgen<ResTy>(unique_consistent_id, base);
    const res: AORes<Base, ResTy> = (content: Generic.Page2Content, base: Base): Generic.Link<ResTy> => {
        const link = getlink(base);
        return Generic.p2.fillLinkOnce(content, link, () => {
            const resv = getContent(content, base, link);
            validatePost(link, resv);
            return resv;
        });
    };
    return Object.assign(res, {link: getlink});
}
function autoFill<Full, ResTy>(
    getLink: (full: Full) => Generic.NullableLink<ResTy>,
    getContent: (content: Generic.Page2Content, full: Full) => ResTy,
): (content: Generic.Page2Content, full: Full) => Generic.Link<ResTy> {
    return (content: Generic.Page2Content, full: Full): Generic.Link<ResTy> => {
        const link = getLink(full);
        return Generic.p2.fillLinkOnce(content, link, () => {
            const resv = getContent(content, full);
            validatePost(link, resv);
            return resv;
        });
    };
}
// possibly we make a seperate fn for fillds

export const base_client = {
    url: (base: BaseClient): string | null => null,
    post: autoOutline("client→post", (content, base: BaseClient): Generic.Post => {
        return {
            kind: "post",
            content: {
                kind: "client",
                navbar: getNavbar(null),
            },
            internal_data: 0,
            parent: null,
            replies: null,
            url: base_client.url(base),
            client_id,
        };
    }),
    asParent: (content: Generic.Page2Content, base: BaseClient): Generic.PostParent => {
        return {
            loader: Generic.p2.prefilledVerticalLoader(content, base_client.post(content, base), undefined),
        };
    },
};

// class Subreddit extends Base<BaseSubredditT5> implements asPost, getReplies
export const base_subreddit = {
    url: (base: BaseSubredditT5): "/__any_listing" => {
        return updateQuery(
            "/r/" + base.subreddit + ("/" + base.sort.v),
            {t: base.sort.t},
        ) as "/__any_listing";
    },
    // ie: /r/somesub | /r/u_someusersub | /r/t5:dnjakcns
    post: autoOutline("subreddit→post", (content, base: BaseSubredditT5): Generic.Post => {
        return {
            kind: "post",
            content: {
                kind: "page",
                wrap_page: {
                    header: base_subreddit_sidebar.identity(content, {for_sub: base.subreddit}),
                    sidebar: base_subreddit_sidebar.replies(content, {for_sub: base.subreddit}),
                },
            },
            internal_data: base,
            parent: base_client.asParent(content, {}),
            replies: base_subreddit.replies(content, base),
            url: base_subreddit.url(base),
            client_id,
        };
    }),
    repliesIdFilled: (base: BaseSubredditT5): Generic.NullableLink<Generic.HorizontalLoaded> => {
        return autoLinkgen<Generic.HorizontalLoaded>("subreddit→replies", base);
    },
    replies: (content: Generic.Page2Content, base: BaseSubredditT5): Generic.PostReplies => {
        const id_loader = Generic.p2.fillLinkOnce(content, (
            autoLinkgen<Generic.Opaque<"loader">>("subreddit→replies_loader", base)
        ), () => {
            return opaque_loader.encode({
                kind: "subreddit_posts",
                subreddit: base,
            });
        });
        const id_filled = base_subreddit.repliesIdFilled(base);
        return {
            display: "repivot_list",
            loader: {
                kind: "horizontal_loader",
                key: id_filled,
                request: id_loader,

                load_count: null,
                autoload: false,
                client_id,
            },
        };
    },
    asParent: (content: Generic.Page2Content, base: UnsortedSubreddit): Generic.PostParent => {
        return {loader: Generic.p2.prefilledVerticalLoader(
            content, base_subreddit.post(content, {subreddit: base, sort: subDefaultSort(base)}), undefined,
        )};
    },
};
export function subDefaultSort(base: UnsortedSubreddit): SubSort {
    // specify manual overrides for subreddits which request different default sorts
    if(base === "teenagersnew" || base === "adultsnew") return {v: "new", t: "all"};
    return {v: "hot", t: "all"};
}
export function commentDefaultCollapsed(author_name: string): boolean {
    // specify manual overrides for comments which should be automatically collapsed
    return author_name === "FatFingerHelperBot";
}
export const full_subreddit = {
    fillContent: autoFill(
        (full: FullSubredditContent) => base_subreddit.repliesIdFilled(full.subreddit),
        (content, full): Generic.HorizontalLoaded => {
            const res: Generic.HorizontalLoaded = [];
            // if full listing data before
            // TODO: - we need, in addition to sort, a before param for subs
            // - then, we can add a loader for the ?before thing
            for(const item of full.listing.data.children) {
                res.push(linkToAndFillListingChild(content, item, null));
            }
            if(full.listing.data.after != null) {
                res.push({
                    kind: "horizontal_loader",
                    key: Generic.p2.symbolLink("todo"),
                    request: Generic.p2.createSymbolLinkToError(content, "todo", 0),
                    client_id,
                });
            }
            return res;
        },
    ),
    fill: (content: Generic.Page2Content, full: FullSubredditContent): void => {
        full_subreddit.fillContent(content, full);
    },
};

export const base_subreddit_sidebar = {
    identityAndSidebarLoader: (content: Generic.Page2Content, base: BaseSubredditSidebar): Generic.Link<Generic.Opaque<"loader">> => {
        return Generic.p2.fillLinkOnce(content, (
            autoLinkgen<Generic.Opaque<"loader">>("subreddit_id_sidebar→loader", base)
        ), () => {
            return opaque_loader.encode({
                kind: "subreddit_identity_and_sidebar",
                sub: base,
            });
        });
    },
    filledIdentityCardLink: (base: BaseSubredditSidebar): Generic.NullableLink<Generic.FilledIdentityCard> => {
        return autoLinkgen<Generic.FilledIdentityCard>("subreddit_identity→card", base);
    },
    identity: (content: Generic.Page2Content, base: BaseSubredditSidebar): Generic.PageIdentityCard => {
        const id_loader = base_subreddit_sidebar.identityAndSidebarLoader(content, base);

        // right, we'll need to figure out the proper place to put this id.
        // - the filled object will make bad ids because the ids depend on the filled content
        // - ids should not depend on filled content
        const id_filled = base_subreddit_sidebar.filledIdentityCardLink(base);
        return {
            temp_title: "r/" + base.for_sub,
            filled: {
                kind: "one_loader",
                key: id_filled,
                load_count: null,
                request: id_loader,
                client_id,
                autoload: false,
            },
        };
    },
    filledWidgetsLink: (base: BaseSubredditSidebar): Generic.NullableLink<Generic.HorizontalLoaded> => {
        return autoLinkgen<Generic.HorizontalLoaded>("subreddit_sidebar→replies", base);
    },
    replies: (content: Generic.Page2Content, base: BaseSubredditSidebar): Generic.PostReplies => {
        const id_loader = base_subreddit_sidebar.identityAndSidebarLoader(content, base);
        const id_filled = base_subreddit_sidebar.filledWidgetsLink(base);
        return {
            display: "tree",
            loader: {
                kind: "horizontal_loader",
                key: id_filled,
                request: id_loader,

                load_count: null,
                autoload: false,
                client_id,
            },
        };
    },
};

export const full_subreddit_sidebar = {
    // FullSubredditSidebar
    filledIdentity: autoFill((
        (full: FullSubredditSidebar) => base_subreddit_sidebar.filledIdentityCardLink(full.on_base)
    ), (content: Generic.Page2Content, full: FullSubredditSidebar): Generic.FilledIdentityCard => {
        return subredditHeaderExists({
            subreddit: full.on_base.for_sub,
            widgets: full.widgets,
            sub_t5: full.sub_t5,
        });
    }),

    filledWidgets: autoFill((
        (full: FullSubredditSidebar) => base_subreddit_sidebar.filledWidgetsLink(full.on_base)
    ), (content, full): Generic.HorizontalLoaded => {
        const basev = (id: `widget_${string}`): BaseSidebarWidget => {
            return {id, subreddit: full.on_base.for_sub};
        };
        for(const [widget_key, widget_value] of Object.entries(full.widgets.items)) {
            full_sidebar_widget.filledValue(content, {
                on_base: basev(widget_value.id),
                widget: widget_value,
            });
        }
        return [
            // it's impossible to load an individual widget. we'll just end up with a bad link if one of these is unfilled.
            // if it were possible, we would use base_sidebar_widget.asSelfHorizontalLoader() rather than .link()
    
            // v default collapsed
            full_oldsidebar_widget.filledValue(content, {
                on_base: {subreddit: full.on_base.for_sub},
                t5: full.sub_t5,
                has_structuredstyles_widgets: true,
            }),

            // skipping id card widget as we already provide that with the header
            // ...full.widgets.layout.topbar.order.map(id => base_sidebar_widget.link(basev(id))), // ? what is this
            ...full.widgets.layout.sidebar.order.map(id => base_sidebar_widget.link(basev(id))),
            base_sidebar_widget.link(basev(full.widgets.layout.moderatorWidget)),
            /*
            ...subinfo.sub_t5 ? [
                oldSidebarWidget(content, subinfo.sub_t5, subinfo.subreddit, {collapsed: widgets ? true : false}),
            ] : [],
            ...widgets ? widgets.layout.sidebar.order.map(id => wrap(getItem(id))) : [],
            ...widgets ? [wrap(getItem(widgets.layout.moderatorWidget))] : [],
            */
        ];
    }),

    fill: (content: Generic.Page2Content, full: FullSubredditSidebar): void => {
        full_subreddit_sidebar.filledIdentity(content, full);
        full_subreddit_sidebar.filledWidgets(content, full);
    },
};

const base_oldsidebar_widget = {
    url: (base: BaseOldSidebar) => "/r/"+base.subreddit+"/about/sidebar",
    link: (base: BaseOldSidebar) => autoLinkgen<Generic.Post>("oldsidebar_value→post", base),
};
const full_oldsidebar_widget = {
    filledValue: autoFill((
        (full: FullOldSidebar) => base_oldsidebar_widget.link(full.on_base)
    ), (content, full): Generic.Post => {
        return {
            kind: "post",
            content: {
                kind: "post",
        
                title: {text: "old.reddit sidebar"},
                body: {
                    kind: "text",
                    client_id,
                    markdown_format: "reddit_html",
                    content: full.t5.data.description_html,
                },
        
                collapsible: {default_collapsed: full.has_structuredstyles_widgets},
            },
            internal_data: full,
            parent: base_subreddit.asParent(content, full.on_base.subreddit),
            replies: null,
            url: base_oldsidebar_widget.url(full.on_base),
            client_id,
        };
    }),
};

const base_sidebar_widget = {
    url: (base: BaseSidebarWidget) => null, // "/r/"+base.subreddit+"/api/sidebar?tcr-pivot="+encodeURIComponent(base.id)
    link: (base: BaseSidebarWidget) => autoLinkgen<Generic.Post>("sidebar_widget→post", base),

    //! sidebar widgets can't be loaded right now so this just returns the link. hope it exists.
    asParent: (content: Generic.Page2Content, base: BaseSidebarWidget): Generic.PostParent => {
        return {
            loader: p2.prefilledVerticalLoader(content, base_sidebar_widget.link(base), undefined),
        };
    },
};
const full_sidebar_widget = {
    filledValue: autoFill((
        (full: FullSidebarWidget) => base_sidebar_widget.link(full.on_base)
    ), (content, full): Generic.Post => {
        const widget = full.widget;
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
                        rt.link({id: client_id}, "/message/compose?to=/r/"+full.on_base.subreddit,
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
                        rt.link({id: client_id}, "/r/"+full.on_base.subreddit+"/about/moderators", {}, rt.txt("View All Moderators")),
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
                    parent: base_sidebar_widget.asParent(content, full.on_base),
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
                    parent: base_sidebar_widget.asParent(content, full.on_base),
                    replies: null,

                    url: "/r/"+full.on_base.subreddit+"/search?q=flair:\""+encodeURIComponent(val.text!)+"\"&restrict_sr=1",
                    disallow_pivot: true,
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
                    const sub_base: BaseSubredditT5 = {
                        subreddit: sub_name,
                        sort: subDefaultSort(sub_name),
                    };
                    return p2.createSymbolLinkToValue<Generic.Post>(content, {
                        kind: "post",
                        content: {
                            kind: "nonpivoted_identity_card",
                            container: base_subreddit.post(content, sub_base),
                            card: {
                                name_raw: "r/"+community.name,
                                pfp: {url: community.communityIcon || community.iconUrl},
                                main_counter: createSubscribeAction(
                                    sub_base.subreddit, community.subscribers, community.isSubscribed,
                                ),
                                raw_value: community,
                            },
                        },

                        internal_data: community,
                        parent: base_sidebar_widget.asParent(content, full.on_base),
                        replies: null,

                        url: base_subreddit.url(sub_base),
                        disallow_pivot: true,
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
                    parent: base_sidebar_widget.asParent(content, full.on_base),
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
        return {
            kind: "post",
            content: postcontent,
            internal_data: full,
            parent: base_subreddit.asParent(content, full.on_base.subreddit),
            replies,
            url: base_sidebar_widget.url(full.on_base),
            client_id,
        };
    }),
};

type DuplicaesSortV = {m: "duplicates", v: Reddit.DuplicatesSort, crossposts_only: boolean};
type Sortv = PostSort | DuplicaesSortV | "default";
function hasm(sort: Sortv): sort is DuplicaesSortV {
    return typeof sort === "object" && sort != null && 'm' in sort && sort.m === "duplicates";
}

// * you will only be able to get a link to a post by using the full_post fn
// * you can get a base_post 'as_parent' but no other way
export const base_post = {
    postLink: (base: BasePostT3) => autoLinkgen<Generic.Post>("postT3→post", base),
    repliesLink: (base: BasePostT3) => autoLinkgen<Generic.HorizontalLoaded>("postT3→replies", base),

    asParent: (content: Generic.Page2Content, base: BasePostT3): Generic.PostParent => {
        const id_loader = Generic.p2.fillLinkOnce(content, (
            autoLinkgen<Generic.Opaque<"loader">>("postT3→as_parent_loader", base)
        ), () => {
            return opaque_loader.encode({
                kind: "view_post",
                post: base,
                focus_comment_id: null,
                context: "3", // doesn't matter here
            });
        });
        const id_filled = base_post.postLink(base);
        const onsub = base.on_subreddit;
        return {
            loader: {
                kind: "vertical_loader",
                key: id_filled,
                request: id_loader,
                temp_parents: [base_subreddit.post(content, {subreddit: onsub, sort: subDefaultSort(onsub)})],

                load_count: null, autoload: false, client_id,
            },
        };
    },
    replies: (content: Generic.Page2Content, base: BasePostT3): Generic.PostReplies => {
        const id_loader = Generic.p2.fillLinkOnce(content, (
            autoLinkgen<Generic.Opaque<"loader">>("postT3→replies_loader", base)
        ), () => {
            return opaque_loader.encode({
                kind: "view_post",
                post: base,
                focus_comment_id: null,
                context: "3", // doesn't matter here
            });
        });
        const id_filled = base_post.repliesLink(base);
        return {
            display: "tree",
            loader: {
                kind: "horizontal_loader",
                key: id_filled,
                request: id_loader,

                load_count: null,
                autoload: false,
                client_id,
            },
        };
    },
};
export const full_post = {
    // note: you need a full post to get a url to it. this is to include the title in the url.
    url: (post: FullPostT3): string => {
        return hasm(post.post.sort) ? (
            "/r/"+post.post.on_subreddit+"/duplicates/"+post.post.fullname.substring(3)
        ) : updateQuery(post.data.data.permalink, post.post.sort !== "default" ? {
            sort: post.post.sort.v,
        } : {});
    },
    content: (content: Generic.Page2Content, full: FullPostT3): Generic.PostContentPost => {
        const listing = full.data.data;
        return {
            kind: "post",
            title: {text: listing.title},
            collapsible: {default_collapsed: true},
            flair: getPostFlair(listing),
            author: authorFromPostOrComment(listing),
            body: getPostBody(listing),
            thumbnail: getPostThumbnail(listing, "open"),
            info: getPostInfo(full.data),

            actions: {
                vote: getPointsOn(listing),
                code: getCodeButton(listing.is_self ? listing.selftext : listing.url),
                other: [
                    {
                        kind: "link",
                        client_id,
                        url: "/domain/"+listing.domain,
                        text: listing.domain,
                    }, deleteButton(listing.name), saveButton(listing.name, listing.saved), {
                        kind: "link",
                        client_id,
                        url: "/r/"+listing.subreddit+"/duplicates/"+listing.id,
                        text: "Duplicates"
                    }, reportButton(listing.name, listing.subreddit),
                    editButton(listing.name),
                    rawlinkButton(full_post.url(full)),
                ],
            },
        };
    },
    fill: autoFill((full: FullPostT3) => base_post.postLink(full.post), (content, full): Generic.Post => {
        return {
            kind: "post",
            client_id,
            url: full_post.url(full),

            parent: base_subreddit.asParent(content, full.post.on_subreddit),
            replies: base_post.replies(content, full.post),

            content: full_post.content(content, full),
            internal_data: full,
        };
    }),
    fillReplies: (content: Generic.Page2Content, full: FullPostReplies): Generic.Link<Generic.HorizontalLoaded> => {
        const link = base_post.repliesLink(full.on_post);
        const replies_valid = full.comment_replies_valid === true;
        // note: .before and .after are ignored on comments
        const res_replies: Generic.HorizontalLoaded = [];
        for(const reply of full.data.data.children) {
            res_replies.push(linkToAndFillListingChild(content, reply, {
                on_post: full.on_post,
                comment_replies_valid: full.comment_replies_valid,
            }));
        }
        if(replies_valid) Generic.p2.fillLinkOnce(content, link, () => res_replies);
        return link;
    },
};

export const base_comment = {
    commentLink: (base: BaseCommentT1) => autoLinkgen<Generic.Post>("commentT1→post", base),
    selfParentLink: (base: BaseCommentT1) => autoLinkgen<Generic.Opaque<"loader">>("commentT1→parent_loader", base),
    selfRepliesLoaderLink: (base: BaseCommentT1) => autoLinkgen<Generic.Opaque<"loader">>("commentT1→replies_loader", base),
    selfRepliesLink: (base: BaseCommentT1) => autoLinkgen<Generic.HorizontalLoaded>("commentT1→replies_value", base),
};
export const full_comment = {
    url: (full: FullCommentT1) => updateQuery(full.t1.data.permalink, {context: "3"}),
    fillContent: (content: Generic.Page2Content, full: FullCommentT1): Generic.PostContent => {
        const listing = full.t1.data;
        const our_link = full_comment.url(full);
        return {
            kind: "post",
            title: null,
            author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])),
            body: getCommentBody(listing),
            info: getPostInfo(full.t1),
            collapsible: {default_collapsed: commentDefaultCollapsed(listing.author) || (listing.collapsed ?? false)},
            actions: {
                // NOTE:
                // if the post's discussion_type === "CHAT", don't display vote buttons
                // * how do we do this?
                //    - what if a chat comment gets returned without information about the post it's on?
                //    - for instance: on a user page (do they show there?) or on an /api/info page
                vote: getPointsOn(listing),
                code: getCodeButton(listing.body),
                other: [
                    editButton(listing.name),
                    deleteButton(listing.name),
                    saveButton(listing.name, listing.saved),
                    reportButton(listing.name, listing.subreddit),
                    rawlinkButton(our_link),
                ],
            },
        };
    },
    fill: autoFill((full: FullCommentT1) => base_comment.commentLink(full.on_base), (content, full): Generic.Post => {
        const replies_valid = full.comment_replies_valid === true || (
            full.t1.data.id === full.comment_replies_valid.after_id
        );
        const parent_id = full.t1.data.parent_id;
        let parent_unfilled_link: Generic.Link<Generic.Post>;
        let focus_comment_id: null | string;
        if(parent_id.startsWith("t1_")) {
            parent_unfilled_link = base_comment.commentLink({
                fullname: parent_id as "t1_string",
                on_post: full.on_base.on_post,
            });
            focus_comment_id = parent_id;
        }else if(parent_id.startsWith("t3_")) {
            parent_unfilled_link = base_post.postLink(full.on_base.on_post);
            focus_comment_id = null;
        }else{
            // ???
            parent_unfilled_link = p2.createSymbolLinkToError(content, "? parent id is: "+parent_id, full);
            focus_comment_id = null;
        }
        const load_parent_request: Generic.Link<Generic.Opaque<"loader">> = p2.fillLinkOnce(content, 
            base_comment.selfParentLink(full.on_base), (): Generic.Opaque<"loader"> => {
                return opaque_loader.encode({
                    kind: "view_post",
                    post: full.on_base.on_post,
                    focus_comment_id,
                    context: "9", // max
                });
            },
        );
        const load_replies_request: Generic.Link<Generic.Opaque<"loader">> = p2.fillLinkOnce(content, (
            base_comment.selfRepliesLoaderLink(full.on_base)
        ), () => {
            return opaque_loader.encode({
                kind: "view_post",
                post: full.on_base.on_post,
                focus_comment_id: full.on_base.fullname.substring(3),
                context: "1", // min
            });
        });
        const fill_replies_link = base_comment.selfRepliesLink(full.on_base);
        const res: Generic.HorizontalLoaded = [];
        // v: replies is an empty string when it's empty
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        for(const reply of (full.t1.data.replies || null)?.data.children ?? []) { //*note: 'before'/'after' are not used in comment replies
            res.push(linkToAndFillListingChild(content, reply, {
                on_post: full.on_base.on_post,
                comment_replies_valid: replies_valid ? true : full.comment_replies_valid,
            }));
        }
        if(replies_valid) p2.fillLinkOnce(content, fill_replies_link, () => res);
        return {
            kind: "post",
            content: full_comment.fillContent(content, full),
            internal_data: full,
            parent: {
                loader: {
                    kind: "vertical_loader",
                    temp_parents: [
                        // post
                        base_post.postLink(full.on_base.on_post),
                        // sub
                        base_subreddit.post(content, {
                            subreddit: full.on_base.on_post.on_subreddit,
                            sort: subDefaultSort(full.on_base.on_post.on_subreddit),
                        }),
                        // client
                        base_client.post(content, {}),
                    ],
                    key: parent_unfilled_link,
                    client_id,
                    request: load_parent_request,
                },
            },
            replies: {
                display: "tree",
                loader: {
                    kind: "horizontal_loader",
                    key: fill_replies_link,
                    request: load_replies_request,
                    client_id,
                },
            },
            url: full_comment.url(full),
            client_id,
        };
    }),
};

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
            parent: base_subreddit.asParent(content, full.on_base.on_subreddit),
            replies: null,
            url: base_submit.url(full.on_base),
            client_id,
        };
    }),
};

type CommentExtra = {
    on_post: BasePostT3,
    comment_replies_valid: CommentRepliesValid,
};

// [!] * does not fill replies *
function linkToAndFillListingChild(
    content: Generic.Page2Content,
    post: Reddit.Post,
    extra: CommentExtra | null,
): Generic.Link<Generic.Post> {
    if(post.kind === "t3") {
        const post_base: BasePostT3 = {
            fullname: post.data.name as "t3_string",
            on_subreddit: asLowercaseString(post.data.subreddit),
            sort: "default",
        };
        return full_post.fill(content, {
            post: post_base,
            data: post,
        });
    }else if(post.kind === "t1") {
        const comment_base: BaseCommentT1 = {
            fullname: post.data.name as "t1_string",
            on_post: extra?.on_post ?? {
                fullname: post.data.link_id,
                on_subreddit: asLowercaseString(post.data.subreddit),
                sort: "default",
            },
        };
        return full_comment.fill(content, {
            on_base: comment_base,
            t1: post,
            comment_replies_valid: extra?.comment_replies_valid ?? {after_id: "#INVALID"},
        });
    }
    return Generic.p2.createSymbolLinkToError(content, "todo: post.kind: "+post.kind, post);
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

    disallow_pivot?: undefined | boolean,
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
    kind: "subreddit_posts",
    subreddit: BaseSubredditT5,
} | {
    kind: "subreddit_identity_and_sidebar",
    sub: BaseSubredditSidebar,
} | {
    kind: "view_post",
    post: BasePostT3,
    focus_comment_id: null | string,
    context: null | string,
} | {
    kind: "submit_page",
    base: BaseSubmitPage,
};
const opaque_loader = encoderGenerator<LoaderData, "loader">("loader");

export async function loadPage2v2(
    lreq: Generic.Opaque<"loader">,
): Promise<Generic.LoaderResult> {
    const content: Generic.Page2Content = {};
    const data = opaque_loader.decode(lreq);
    if(data.kind === "subreddit_posts") {
        // fetch the subreddit listing
        const sub_listing = await redditRequest(base_subreddit.url(data.subreddit), {method: "GET"});
        full_subreddit.fill(content, {subreddit: data.subreddit, listing: sub_listing});
    }else if(data.kind === "subreddit_identity_and_sidebar") {
        const subreddit = data.sub.for_sub;
        const [widgets, about] = await Promise.all([
            redditRequest(`/r/${ec(subreddit)}/api/widgets`, {method: "GET", query: {}}),
            redditRequest(`/r/${ec(subreddit)}/about`, {method: "GET"}),
        ]);
        const full: FullSubredditSidebar = {
            on_base: data.sub,
            widgets,
            sub_t5: about,
        };
        full_subreddit_sidebar.fill(content, full);
    }else if(data.kind === "view_post") {
        // *! on /duplicates, it probably uses a "?after=" url. TODO support that.
        const target_url = "/" + [].join("/");
        const postid = data.post.fullname.substring(3);
        const post_value = hasm(data.post.sort) ? await redditRequest(`/duplicates/${ec(postid)}`, {
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
                sort: data.post.sort === "default" ? null : data.post.sort.v,
                comment: data.focus_comment_id,
                context: data.context ?? "3", // use a higher context value for vertical loaders
            },
        });

        const on_post: BasePostT3 = data.post;

        const qpost = post_value[0].data.children;
        if(qpost.length !== 1) throw new Error("Expected qpost len 1; missing post? gotlen "+qpost.length);
        const parentpostdata = qpost[0]!;
        if(parentpostdata.kind !== "t3") throw new Error("expected t3 in qpost[0]; ?? got "+parentpostdata.kind);
        full_post.fill(content, {
            post: on_post,
            data: parentpostdata,
        });
        
        // note: data.before/data.after are not used for post comments but *are* used for /duplicates
        full_post.fillReplies(content, {
            on_post,
            data: post_value[1],
            comment_replies_valid: data.focus_comment_id != null ? {after_id: data.focus_comment_id} : true,
        });

        // when a comment with a specific id is requested, if that id has been deleted, I think reddit
        // will return a listing like | parent |- reply |- reply |- (deleted comment but it doesn't show it in the listing)
        // so in most cases if the focus id doesn't match anything on the page, we want the parent to be the latest
        // comment in the list.
        let latest_comment: Generic.Link<Generic.Post> | null = null;
        // *TODO!*
        // -one way to do this is in fn fillReplies if the comment has no replies but 'replies_valid' is after an id other
        // than the current one, generate the fake reply there?
        () => latest_comment = 0 as unknown as Generic.Link<Generic.Post>;

        if(data.focus_comment_id != null) {
            const target_link = base_comment.commentLink({
                fullname: `t1_${data.focus_comment_id}`,
                on_post,
            });
            p2.fillLinkOnce(content, target_link, () => {
                // pivot not found; display an error
                // (alternatively we could display a loader but it would just error again)
                return validatePost(target_link, {kind: "post",
                    content: {
                        kind: "error",
                        message: "Comment not found (maybe it was deleted?) [" + target_link.toString() + "]",
                    },
                    internal_data: data,
                    client_id,
                    parent: latest_comment != null
                        ? {loader: p2.prefilledVerticalLoader(content, latest_comment, undefined)}
                        : base_post.asParent(content, on_post)
                    ,
                    replies: null,
                    url: null, // it technically has a url but no thanks
                });
            });
        }

        // done.
    }else if(data.kind === "submit_page") {
        const about = await (
            redditRequest(`/r/${ec(data.base.on_subreddit)}/about`, {method: "GET", cache: true})
        );
        const linkflair: Reddit.ApiLinkFlair = about.data.link_flair_enabled ? await (
            redditRequest(`/r/${ec(data.base.on_subreddit)}/api/link_flair_v2`, {method: "GET", cache: true})
        ) : [];
        full_submit.fill(content, {
            on_base: data.base,
            about,
            linkflair,
        });
    }else throw new Error("todo support loader kind: ["+data.kind+"]");
    return {content};
}
