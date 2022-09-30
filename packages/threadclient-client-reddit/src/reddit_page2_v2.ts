import * as Generic from "api-types-generic";
import { p2, rt } from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import { encoderGenerator } from "threadclient-client-base";
import { updateQuery } from "tmeta-util";
import { getPostInfo, rawlinkButton } from "./page2_from_listing";
import { authorFromPostOrComment, client_id, createSubscribeAction, deleteButton, ec, editButton, expectUnsupported, flairToGenericFlair, getCodeButton, getNavbar, getPointsOn, getPostBody, getPostFlair, getPostThumbnail, parseLink, PostSort, redditRequest, reportButton, saveButton, subredditHeaderExists, SubSort } from "./reddit";

const debug_mode = true;

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

    if(parsed.kind === "subreddit") {
        if(parsed.sub.kind === "subreddit") {
            const link = base_subreddit.post(content, {
                subreddit: asLowercaseString(parsed.sub.subreddit),
                sort: parsed.current_sort, // ← this is weird. it should be "default" when not specified.
            });
            return {content, pivot_loader: p2.prefilledOneLoader(content, link, undefined)};
        }
    }
    if(parsed.kind === "comments") {
        const post_base: BasePostT3 = {
            fullname: `t3_${parsed.post_id_unprefixed}`,
            on_subreddit: asLowercaseString(
                parsed.sub.kind === "subreddit" ? parsed.sub.subreddit :
                parsed.sub.kind === "userpage" ? "u_"+parsed.sub.user :
                "ERROR_subredditkind:"+parsed.sub.kind
            ),
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
    sort: PostSort | "default",
};
type FullPostT3 = {
    post: BasePostT3,
    data: Reddit.T3,
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
    replies_valid: true | string,
    // :: true if the object is below the focused comment
    // :: string containing the focused comment id if the object is above or at the focused comment
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
function autoFill<Base, ResTy>(
    getLink: (base: Base) => Generic.NullableLink<ResTy>,
    getContent: (content: Generic.Page2Content, base: Base) => ResTy,
): (content: Generic.Page2Content, base: Base) => Generic.Link<ResTy> {
    return (content: Generic.Page2Content, base: Base): Generic.Link<ResTy> => {
        const link = getLink(base);
        return Generic.p2.fillLinkOnce(content, link, () => {
            const resv = getContent(content, base);
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
export const full_subreddit = {
    fillContent: autoFill(
        (full: FullSubredditContent) => base_subreddit.repliesIdFilled(full.subreddit),
        (content, full): Generic.HorizontalLoaded => {
            const res: Generic.HorizontalLoaded = [];
            // if full listing data before
            // TODO: - we need, in addition to sort, a before param for subs
            // - then, we can add a loader for the ?before thing
            for(const item of full.listing.data.children) {
                res.push(linkToAndFillListingChild(content, item));
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

// * you will only be able to get a link to a post by using the full_post fn
// * you can get a base_post 'as_parent' but no other way
export const base_post = {
    postLink: (base: BasePostT3) => autoLinkgen<Generic.Post>("postT3→post", base),
    repliesLink: (base: BasePostT3) => autoLinkgen<Generic.HorizontalLoaded>("postT3→replies", base),

    replies: (content: Generic.Page2Content, base: BasePostT3): Generic.PostReplies => {
        const id_loader = Generic.p2.fillLinkOnce(content, (
            autoLinkgen<Generic.Opaque<"loader">>("postT3→replies_loader", base)
        ), () => {
            return opaque_loader.encode({
                kind: "view_post",
                post: base,
                focus_comment_id: null,
            });
        });
        const id_filled = base_post.repliesLink(base);
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
};
export const full_post = {
    // note: you need a full post to get a url to it. this is to include the title in the url.
    url: (post: FullPostT3): string => {
        return updateQuery(post.data.data.permalink, post.post.sort !== "default" ? {
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
                        url: "/duplicates/"+listing.id,
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
};

const base_comment = {
    commentLink: (base: BaseCommentT1) => autoLinkgen<Generic.Post>("commentT1→post", base),
};

// [!] TODO: stuff about comments
function linkToAndFillListingChild(content: Generic.Page2Content, post: Reddit.Post): Generic.Link<Generic.Post> {
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
        const target_url = "/" + [].join("/");
        const postid = data.post.fullname.substring(3);
        const post_value = await redditRequest(`/comments/${ec(postid)}`, {
            method: "GET",
            query: {
                sort: data.post.sort === "default" ? null : data.post.sort.v,
                comment: data.focus_comment_id,
                context: "3", // use a higher context value for vertical loaders
            },
        });

        throw new Error("ncjdakcndjklscnjk");

        // /r/[subreddit]/comments/[postid]/_/[focuscommentid]?sort=[v]
        // [!] for view_post, if the comment isn't found, error:
        // - this would mean:
        //   in the loader, after filling, p2.fillLinkOnce(pivoted comment, [gen error comment])
    }else throw new Error("todo support loader kind: ["+data.kind+"]");
    return {content};
}
