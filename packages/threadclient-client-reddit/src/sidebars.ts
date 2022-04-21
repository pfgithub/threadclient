import * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import * as Reddit from "api-types-reddit";
import { createSymbolLinkToError, createSymbolLinkToValue } from "./page2_from_listing";
import {
    client, createSubscribeAction, ec, expectUnsupported,
    flairToGenericFlair, redditRequest, SubInfo, SubrInfo,
} from "./reddit";

// ![!] once we're at sidebar parity, we can switch page1 to use the new page2 sidebar.
// will
// - faster pageloads (load the sidebar after loading the page)
// - look nicer

export async function getSidebar(content: Generic.Page2Content, sub: SubrInfo): Promise<Generic.ListingData> {
    if(sub.kind === "subreddit") {
        const onerror = () => undefined;
        const [widgets, about] = await Promise.all([
            redditRequest(`/r/${ec(sub.subreddit)}/api/widgets`, {method: "GET", onerror, cache: true}),
            redditRequest(`/r/${ec(sub.subreddit)}/about`, {method: "GET", onerror, cache: true}),
        ]);
        const subinfo: SubInfo = {subreddit: sub.subreddit, sub_t5: about ?? null, widgets: widgets ?? null};

        return sidebarFromWidgets(content, subinfo);
    }else{
        throw new Error("TODO sidebar for "+sub.kind);
    }
}

function sidebarFromWidgets(content: Generic.Page2Content, subinfo: SubInfo): Generic.ListingData {
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
    const res: Generic.Link<Generic.Post>[] = [
        // ...widgets ? widgets.layout.topbar.order.map(id => wrap(getItem(id))) : [],
        // ...widgets ? [wrap(getItem(widgets.layout.idCardWidget))] : [],
        ...subinfo.sub_t5 ? [customIDCardWidget(content, subinfo.sub_t5, subinfo.subreddit)] : [],
        ...subinfo.sub_t5 ? [
            oldSidebarWidget(content, subinfo.sub_t5, subinfo.subreddit, {collapsed: widgets ? true : false}),
        ] : [],
        ...widgets ? widgets.layout.sidebar.order.map(id => wrap(getItem(id))) : [],
        ...widgets ? [wrap(getItem(widgets.layout.moderatorWidget))] : [],
    ];
    if(res.length === 0) {
        res.push(createSymbolLinkToError(content, "Failed to fetch sidebar for this page :(", {content, subinfo}));
    }
    return {display: "tree", items: res};
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
        return createSymbolLinkToError(content, "Widget errored: "+e.toString(), {widget, e});
    }
}

function unpivotablePostBelowPivot(
    content: Generic.Page2Content,
    value: Generic.PostContent,
    opts: {
        internal_data: unknown,
        replies?: undefined | Generic.ListingData,
        link_to?: undefined | string,
    },
): Generic.Link<Generic.Post> {
    return createSymbolLinkToValue<Generic.Post>(content, {
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
        display_style: "centered",
    });
}

function unpivotableBelowPivotBody(
    content: Generic.Page2Content,
    title: string,
    body: Generic.Body,
    internal_data: unknown,
): Generic.Link<Generic.Post> {
    return unpivotablePostBelowPivot(content, {
        kind: "post",

        title: {text: title},
        body,
        collapsible: false,
    }, {
        internal_data,
    });
}

function sidebarWidgetToGenericWidgetTry(
    content: Generic.Page2Content,
    widget: Reddit.Widget,
    subinfo: SubInfo,
): Generic.Link<Generic.Post> {
    if(widget.kind === "moderators") {
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
        return unpivotablePostBelowPivot(content, {
            kind: "post",

            title: {text: widget.shortName},
            body: {kind: "none"},
            collapsible: false,
        }, {
            internal_data: {widget, subinfo},
            replies: {display: "tree", items: widget.data.map((itm, i) => {
                return unpivotablePostBelowPivot(content, {
                    kind: "post",

                    title: {text: (i + 1)+". " + itm.shortName},
                    body: {
                        kind: "text",
                        content: itm.descriptionHtml,
                        markdown_format: "reddit_html", client_id: client.id,
                    },
                    collapsible: {default_collapsed: true},
                }, {
                    internal_data: itm,
                });
            })},
        });
    }else if(widget.kind === "post-flair") {
        return unpivotablePostBelowPivot(content, {
            kind: "post",
            title: {text: widget.shortName},
            body: {kind: "none"},
            collapsible: false,
        }, {
            internal_data: {widget, subinfo},
            replies: {display: "repivot_list", items: widget.order.map(id => {
                const val = widget.templates[id]!;
                const flair = flairToGenericFlair({
                    type: val.type, text: val.text, text_color: val.textColor,
                    background_color: val.backgroundColor, richtext: val.richtext,
                });
                return unpivotablePostBelowPivot(content, {
                    // TODO this has to be pivotable
                    // or maybe somehow define a link but no content
                    kind: "post",
                    title: null,
                    flair,
                    body: {kind: "none"},
                    collapsible: false,
                }, {
                    internal_data: val,
                    link_to: "/r/"+subinfo.subreddit
                    +"/search?q=flair:\""+encodeURIComponent(val.text!)+"\"&restrict_sr=1",
                });
            })},
        });
    }else if(widget.kind === "textarea") {
        return unpivotablePostBelowPivot(content, {
            kind: "post",
            title: {text: widget.shortName},
            body: {kind: "text", content: widget.textHtml, markdown_format: "reddit_html", client_id: client.id},
            collapsible: false,
        }, {internal_data: widget});
    }else if(widget.kind === "button") {
        // doesn't support image buttons yet. not that the old version really did either
        // image buttons are basically supposed to be pill links but with an image in the background that
        // is object-fit:cover
        // the button is usually 286x32
        return unpivotablePostBelowPivot(content, {
            kind: "post",
            title: {text: widget.shortName},
            body: {
                kind: "text",
                content: widget.descriptionHtml,
                markdown_format: "reddit_html",
                client_id: client.id
            },
            collapsible: false,
        }, {
            internal_data: widget,
            replies: {display: "repivot_list", items: widget.buttons.map(button => unpivotablePostBelowPivot(content, {
                kind: "post",
                title: {text: button.kind === "text" ? button.text : "TODO SUPPORT BUTTON KIND "+button.kind},
                body: {kind: "none"},
                collapsible: false,
            }, {
                internal_data: button,
                link_to: (button.kind === "image" ? button.linkUrl : button.kind === "text" ? button.url : undefined),
            }))},
        });
    }else if(widget.kind === "community-list") {
        return unpivotablePostBelowPivot(content, {
            kind: "post",
            title: {text: widget.shortName},
            body: {kind: "none"},
            collapsible: false,
        }, {
            internal_data: widget,
            // TODO: if we can make real `subreddit_unloaded` objects here that would be fun
            replies: {display: "repivot_list", items: widget.data.map(community => (
                community.type === "subreddit"
            ) ? unpivotablePostBelowPivot(content, {
                kind: "post",
                title: {text: "r/"+community.name},
                thumbnail: {
                    kind: "image",
                    url: community.communityIcon,
                },
                body: {kind: "none"},
                collapsible: {default_collapsed: true},
                actions: {
                    vote: createSubscribeAction(community.name, community.subscribers, community.isSubscribed),
                },
            }, {
                internal_data: community,
                link_to: "/r/"+community.name,
            }) : (
                expectUnsupported(community.type),
                createSymbolLinkToError(content, "unsupported community type: "+community.type, community)
            ))},
        });
    }else throw new Error("TODO support sidebar of type: "+widget.kind);
}

function customIDCardWidget(
    content: Generic.Page2Content,
    t5: Reddit.T5,
    subreddit: string,
): Generic.Link<Generic.Post> {
    return unpivotablePostBelowPivot(content, {
        kind: "post",
        title: {text: t5.data.title},
        body: {
            kind: "text",
            content: t5.data.public_description_html,
            markdown_format: "reddit_html",
            client_id: client.id,
        },
        actions: {
            vote: createSubscribeAction(subreddit, t5.data.subscribers, t5.data.user_is_subscriber ?? false),
        },
        collapsible: false,

    }, {
        internal_data: {content, t5, subreddit},
    });
}
function oldSidebarWidget(
    content: Generic.Page2Content,
    t5: Reddit.T5,
    subreddit: string,
    {collapsed}: {collapsed: boolean},
): Generic.Link<Generic.Post> {
    // we can make this pivotable:
    // `/r/subreddit/about/sidebar`
    return unpivotablePostBelowPivot(content, {
        kind: "post",

        title: {text: "old.reddit sidebar"},
        body: {
            kind: "text",
            client_id: client.id,
            markdown_format: "reddit_html",
            content: t5.data.description_html,
        },

        collapsible: {default_collapsed: collapsed},
    }, {internal_data: {t5, subreddit}});
}
