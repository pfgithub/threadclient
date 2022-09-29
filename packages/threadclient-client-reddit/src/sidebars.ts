import * as Generic from "api-types-generic";
import { p2, rt } from "api-types-generic";
import * as Reddit from "api-types-reddit";
import {
    client, createSubscribeAction, ec, expectUnsupported,
    flairToGenericFlair, redditRequest, SubInfo, subredditHeaderExists as subredditHeaderExists, SubrInfo,
} from "./reddit";

// ![!] once we're at sidebar parity, we can switch page1 to use the new page2 sidebar.
// will
// - faster pageloads (load the sidebar after loading the page)
// - look nicer
//   ^ we're not there yet. fixing id cards is a step but stil it looks bad

export async function getSidebar(content: Generic.Page2Content, sub: SubrInfo): Promise<{
    sidebar: Generic.HorizontalLoaded,
    bio: Generic.FilledIdentityCard,
}> {
    if(sub.kind === "subreddit") {
        const onerror = () => undefined;
        const [widgets, about] = await Promise.all([
            redditRequest(`/r/${ec(sub.subreddit)}/api/widgets`, {method: "GET", onerror, cache: true}),
            redditRequest(`/r/${ec(sub.subreddit)}/about`, {method: "GET", onerror, cache: true}),
        ]);
        const subinfo: SubInfo = {subreddit: sub.subreddit, sub_t5: about ?? null, widgets: widgets ?? null};

        // TODO: sidebar should not include an identity card, that should be part of bio
        // identity cards should be shared between users and subreddits and should appear
        // as the header if pivoted or the sidebar if not
        return {
            sidebar: sidebarFromWidgets(content, subinfo),
            bio: subredditHeaderExists(subinfo),
        };
    }else if(sub.kind === "homepage") {
        // [!] we shouldn't have to load anything to display this
        // currently, a sidebar contains a loader
        // but if we know the content, there's no reason for a loader
        // maybe we should rewrite how sidebars work
        // - maybe this is exactly what we were trying to solve with psys 
        //   - we need psys to work
        return {
            sidebar: homepageSidebar(content),
            bio: homepageIdentity(),
        };
    }else{
        throw new Error("TODO sidebar for "+sub.kind);
    }
}

function homepageIdentity(): Generic.FilledIdentityCard {
    return {
        names: {
            display: "Home",
            raw: "/",
        },
        pfp: null,
        theme: {
            banner: null,
        },
        description: null,
        actions: {
            main_counter: null,
        },
        menu: null, // maybe have a menu for navigating these
        raw_value: null,
    };
}
function homepageSidebar(content: Generic.Page2Content): Generic.HorizontalLoaded {
    const home_mysubs_card: Generic.Post = {
        kind: "post",
        content: ({
            kind: "post",
            title: {text: "TODO mysubs"},
            collapsible: false,
            body: {kind: "none"},
        }),
        internal_data: 0,
        disallow_pivot: false,
        parent: null,
        replies: null,
        url: null,
        client_id: client.id,
        // literally just put /reddit/subreddits/mine here
    };
    const res: Generic.HorizontalLoaded = [
        p2.createSymbolLinkToValue(content, home_mysubs_card),
    ];
    return res;
}

function sidebarFromWidgets(content: Generic.Page2Content, subinfo: SubInfo): Generic.HorizontalLoaded {
    const widgets = subinfo.widgets;

    const getItem = (id: string): Reddit.Widget => {
        const resv = widgets!.items[id];
        if(!resv) throw new Error("bad widget "+id);
        return resv;
    };

    const wrap = (data: Reddit.Widget): Generic.Link<Generic.Post> => {
        return sidebarWidgetToGenericWidget(content, data, subinfo);
    };
    
    // TODO moderator widget
    const res: Generic.HorizontalLoaded = [
        // ...widgets ? widgets.layout.topbar.order.map(id => wrap(getItem(id))) : [],
        // ...widgets ? [wrap(getItem(widgets.layout.idCardWidget))] : [],
        ...subinfo.sub_t5 ? [
            oldSidebarWidget(content, subinfo.sub_t5, subinfo.subreddit, {collapsed: widgets ? true : false}),
        ] : [],
        ...widgets ? widgets.layout.sidebar.order.map(id => wrap(getItem(id))) : [],
        ...widgets ? [wrap(getItem(widgets.layout.moderatorWidget))] : [],
    ];
    if(res.length === 0) {
        res.push(p2.createSymbolLinkToError(content, "Failed to fetch sidebar for this page :(", {content, subinfo}));
    }
    return res;
}

function sidebarWidgetToGenericWidget(
    content: Generic.Page2Content,
    widget: Reddit.Widget,
    subinfo: SubInfo,
): Generic.Link<Generic.Post> {
    try {
        return sidebarWidgetToGenericWidgetTry(content, widget, subinfo);
    } catch(er) {
        const e = er as Error;
        return p2.createSymbolLinkToError(content, "Widget errored: "+e.toString(), {widget, e});
    }
}

function unpivotablePostBelowPivot(
    content: Generic.Page2Content,
    value: Generic.PostContent,
    opts: {
        internal_data: unknown,
        replies?: undefined | Generic.PostReplies,
        link_to?: undefined | string,
    },
): Generic.Link<Generic.Post> {
    return p2.createSymbolLinkToValue<Generic.Post>(content, {
        url: opts.link_to ?? null,
        disallow_pivot: true,
        parent: null, // always below the pivot, doesn't matter.
        // ^ not true - top level posts below the pivot might show their parents. so we should be able to
        // pass something in here
        replies: opts.replies ?? null,
        client_id: client.id,

        kind: "post",
        content: value,
        internal_data: opts.internal_data,
    });
}
function horizontal(
    content: Generic.Page2Content,
    value: Generic.HorizontalLoaded,
): Generic.HorizontalLoader {
    const ksym = p2.createSymbolLinkToValue(content, value);
    return p2.prefilledHorizontalLoader(content, ksym, value);
}

function unpivotableBelowPivotBody(
    content: Generic.Page2Content,
    title: string,
    body: Generic.Body,
    internal_data: unknown,
): Generic.Link<Generic.Post> {
    return unpivotablePostBelowPivot(content, ({
        kind: "post",

        title: {text: title},
        body,
        collapsible: false,
    }), {
        internal_data,
    });
}

function sidebarWidgetToGenericWidgetTry(
    content: Generic.Page2Content,
    widget: Reddit.Widget,
    subinfo: SubInfo,
): Generic.Link<Generic.Post> {
    if(widget.kind === "moderators") {
        // TODO:
        // - when you're logged out, moderators returns an empty array
        // - if logged out, show a notice "you can't view moderators when logged out"
        return unpivotableBelowPivotBody(content, "Moderators", {kind: "richtext", content: [
            rt.p(
                rt.link(client, "/message/compose?to=/r/"+subinfo.subreddit,
                    {style: "pill-empty"},
                    rt.txt("Message the mods"),
                ),
            ),
            rt.ul(...widget.mods.map(mod => rt.li(rt.p(
                rt.link(client, "/u/"+mod.name, {is_user_link: mod.name}, rt.txt("u/"+mod.name)),
                ...flairToGenericFlair({
                    type: mod.authorFlairType, text: mod.authorFlairText, text_color: mod.authorFlairTextColor,
                    background_color: mod.authorFlairBackgroundColor, richtext: mod.authorFlairRichText,
                }).flatMap(flair => [rt.txt(" "), rt.flair(flair)]),
            )))),
            rt.p(
                rt.link(client, "/r/"+subinfo.subreddit+"/about/moderators", {}, rt.txt("View All Moderators")),
            ),
        ]}, {
            internal_data: {widget, subinfo},
        });
    }else if(widget.kind === "subreddit-rules") {
        return unpivotablePostBelowPivot(content, ({
            kind: "post",

            title: {text: widget.shortName},
            body: {kind: "none"},
            collapsible: false,
        }), {
            internal_data: {widget, subinfo},
            replies: {display: "tree", loader: horizontal(content, widget.data.map((itm, i) => {
                return unpivotablePostBelowPivot(content, ({
                    kind: "post",

                    title: {text: (i + 1)+". " + itm.shortName},
                    body: {
                        kind: "text",
                        content: itm.descriptionHtml,
                        markdown_format: "reddit_html", client_id: client.id,
                    },
                    collapsible: {default_collapsed: true},
                }), {
                    internal_data: itm,
                });
            }))},
        });
    }else if(widget.kind === "post-flair") {
        return unpivotablePostBelowPivot(content, ({
            kind: "post",
            title: {text: widget.shortName},
            body: {kind: "none"},
            collapsible: false,
        }), {
            internal_data: {widget, subinfo},
            replies: {display: "repivot_list", loader: horizontal(content, widget.order.map(id => {
                const val = widget.templates[id]!;
                const flair = flairToGenericFlair({
                    type: val.type, text: val.text, text_color: val.textColor,
                    background_color: val.backgroundColor, richtext: val.richtext,
                });
                return unpivotablePostBelowPivot(content, ({
                    // TODO this has to be pivotable
                    // or maybe somehow define a link but no content
                    kind: "post",
                    title: null,
                    flair,
                    body: {kind: "none"},
                    collapsible: false,
                }), {
                    internal_data: val,
                    link_to: "/r/"+subinfo.subreddit
                    +"/search?q=flair:\""+encodeURIComponent(val.text!)+"\"&restrict_sr=1",
                });
            }))},
        });
    }else if(widget.kind === "textarea") {
        return unpivotablePostBelowPivot(content, ({
            kind: "post",
            title: {text: widget.shortName},
            body: {kind: "text", content: widget.textHtml, markdown_format: "reddit_html", client_id: client.id},
            collapsible: false,
        }), {internal_data: widget});
    }else if(widget.kind === "button") {
        // doesn't support image buttons yet. not that the old version really did either
        // image buttons are basically supposed to be pill links but with an image in the background that
        // is object-fit:cover
        // the button is usually 286x32
        return unpivotablePostBelowPivot(content, ({
            kind: "post",
            title: {text: widget.shortName},
            body: {
                kind: "text",
                content: widget.descriptionHtml,
                markdown_format: "reddit_html",
                client_id: client.id
            },
            collapsible: false,
        }), {
            internal_data: widget,
            replies: {display: "repivot_list", loader: horizontal(content, widget.buttons.map(button => (
                unpivotablePostBelowPivot(content, ({
                    kind: "post",
                    title: {text: button.kind === "text" ? button.text : "TODO SUPPORT BUTTON KIND "+button.kind},
                    body: {kind: "none"},
                    collapsible: false,
                }), {
                    internal_data: button,
                    link_to: (
                        button.kind === "image" ? button.linkUrl : button.kind === "text" ? button.url : undefined
                    ),
                })
            )))},
        });
    }else if(widget.kind === "community-list") {
        return unpivotablePostBelowPivot(content, ({
            kind: "post",
            title: {text: widget.shortName},
            body: {kind: "none"},
            collapsible: false,
        }), {
            internal_data: widget,
            // TODO: if we can make real `subreddit_unloaded` objects here that would be fun
            replies: {display: "repivot_list", loader: horizontal(content, widget.data.map(community => (
                community.type === "subreddit"
            ) ? unpivotablePostBelowPivot(content, ({
                kind: "post",
                title: {text: "r/"+community.name},
                thumbnail: {
                    kind: "image",
                    url: community.communityIcon || community.iconUrl,
                },
                body: {kind: "none"},
                collapsible: {default_collapsed: true},
                actions: {
                    vote: createSubscribeAction(community.name, community.subscribers, community.isSubscribed),
                },
            }), {
                internal_data: community,
                link_to: "/r/"+community.name,
            }) : (
                expectUnsupported(community.type),
                p2.createSymbolLinkToError(content, "unsupported community type: "+community.type, community)
            )))},
        });
    }else if(widget.kind === "calendar") {
        return unpivotablePostBelowPivot(content, ({
            kind: "post",
            title: {text: widget.shortName},
            // this could be displayed using children but I don't have a widget to test on so I don't want to
            // risk messing it up. TODO: update this to use children.
            body: {kind: "none"},
            collapsible: false,
        }), {
            internal_data: widget,
            replies: {display: "tree", loader: horizontal(content, widget.data.map((item) => {
                return unpivotablePostBelowPivot(content, ({
                    kind: "post",
                    title: {text: item.title},
                    // info: {
                    //     creation_date: item.startTime * 1000,
                    // },
                    // we need to specify a time to show
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
                            client_id: client.id,
                            content: item.locationHtml,
                            markdown_format: "reddit_html" as const,
                        }] : [],
                        ...item.descriptionHtml != null ? [{
                            kind: "text" as const,
                            client_id: client.id,
                            content: item.descriptionHtml,
                            markdown_format: "reddit_html" as const,
                        }] : [],
                    ]},
                    collapsible: {default_collapsed: true},
                }), {internal_data: item});
            }))},
        });
    }else if(widget.kind === "image") {
        const imgdata = widget.data[widget.data.length - 1]!; // highest quality probably. TODO don't always
        // use the highest quality image.
        return unpivotablePostBelowPivot(content, {
            kind: "special",
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
                            rt.p(rt.link({id: client.id}, imgdata.linkUrl, {}, rt.txt(imgdata.linkUrl))),
                        ] : [],
                    ],
                },
                collapsible: false,
            }),
        }, {internal_data: widget});
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
        return unpivotablePostBelowPivot(content, {
            kind: "special",
            tag_uuid: "FullscreenEmbed@-N0D96jIL-HGWHWbWKn1",
            not_typesafe_data: body,
            fallback: ({
                kind: "post",
                title: {text: widget.shortName},
                body,
                collapsible: false,
            }),
        }, {internal_data: widget});
    }else if(widget.kind === "id-card" || widget.kind === "menu") {
        throw new Error("TODO support widget of known type: "+widget.kind);
    }else {
        expectUnsupported(widget.kind);
        throw new Error("TODO support widget of type: "+widget.kind);
    }
}

function oldSidebarWidget(
    content: Generic.Page2Content,
    t5: Reddit.T5,
    subreddit: string,
    {collapsed}: {collapsed: boolean},
): Generic.Link<Generic.Post> {
    // we can make this pivotable:
    // `/r/subreddit/about/sidebar`
    return unpivotablePostBelowPivot(content, ({
        kind: "post",

        title: {text: "old.reddit sidebar"},
        body: {
            kind: "text",
            client_id: client.id,
            markdown_format: "reddit_html",
            content: t5.data.description_html,
        },

        collapsible: {default_collapsed: collapsed},
    }), {internal_data: {t5, subreddit}});
}
