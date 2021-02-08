import * as Reddit from "../types/api/reddit";
import * as Generic from "../types/generic";
import {encoderGenerator, ThreadClient} from "./base";
import { encodeQuery, encodeURL } from "../app";

const client_id = "biw1k0YZmDUrjg";
const redirect_uri = "https://thread.pfg.pw/login/reddit";

function flairToGenericFlair(type: "text" | "richtext" | "unsupported", text: string,
    text_color: "light" | "dark", background_color: string, flair: Reddit.RichtextFlair | undefined,
): Generic.Flair[] {
    if(type == null) return []; // deleted comments
    if(type === "text" && !text) return [];
    const elems: Generic.RichTextItem[] = type === "richtext" ? (flair ?? []).map(v => {
        if(v.e === "text") {
            return {type: "text", text: v.t};
        }else if(v.e === "emoji") {
            return {type: "emoji", url: v.u, name: v.a};
        }
        expectUnsupported(v.e);
        return {type: "text", text: "#TODO("+v.e+")"};
    }) : type === "text" ? [{type: "text", text}] : [{type: "text", text: "TODO: "+type}];
    const flair_text = elems.map(v => v.type === "text" ? v.text : "").join("");
    return [{
        color: background_color,
        fg_color: text_color === "light" ? "light" : "dark",
        elems,
        content_warning: flair_text.toLowerCase().startsWith("cw:") || flair_text.toLowerCase().startsWith("tw:")
    }];
}

function awardingsToFlair(awardings: Reddit.Award[]): Generic.Flair[] {
    const resitems: Generic.RichTextItem[] = [];
    for(const awarding of awardings.sort((a1, a2) => a2.count - a1.count)) {
        if(resitems.length > 0) resitems.push({type: "text", text: " "});
        resitems.push({type: "emoji", url: awarding.static_icon_url, name: awarding.name});
        if(awarding.count > 1) resitems.push({type: "text", text: "×" + awarding.count});
    }
    if(resitems.length === 0) return [];
    return [{elems: resitems, content_warning: false, color: "transparent"}];
}

type Action =
    | {kind: "vote", query: Reddit.VoteBody}
    | {kind: "delete", fullname: string}
    | {kind: "save", fullname: string, direction: "" | "un"}
    | {kind: "subscribe", subreddit: string, direction: "sub" | "unsub"};

function encodeVoteAction(query: Reddit.VoteBody): Generic.Opaque<"act"> {return act_encoder.encode({kind: "vote", query})}
function encodeDeleteAction(fullname: string): Generic.Opaque<"act"> {return act_encoder.encode({kind: "delete", fullname})}

const act_encoder = encoderGenerator<Action, "act">("act");

type RichtextFormattingOptions = {
    media_metadata: Reddit.MediaMetadata,
};
function richtextDocument(rtd: Reddit.Richtext.Document, opt: RichtextFormattingOptions): Generic.Richtext.Paragraph[] {
    try {
        return richtextParagraphArray(rtd.document, opt);
    }catch(e) {
        console.log("Error parsing richtext:", e);
        return [{kind: "paragraph", children: [{kind: "text", styles: {error: "thrown error"}, text: "Error parsing richtext: "+e}]}];
    }
}
function richtextParagraphArray(rtd: Reddit.Richtext.Paragraph[], opt: RichtextFormattingOptions): Generic.Richtext.Paragraph[] {
    return rtd.map(v => richtextParagraph(v, opt));
}
function expectUnsupported(text: "unsupported"): void {/*no runtime error!*/}

// TODO use this for galleries and gifs? make it return Generic.GalleryItem? idk only image has a thumbnail
function mediaMetaToBody(media_meta: Reddit.Media, caption?: string): Generic.Body {
    if(media_meta.e === "Image") return {
        kind: "captioned_image",
        url: media_meta.s.u,
        w: media_meta.s.x,
        h: media_meta.s.y,
        caption: caption,
    };
    if(media_meta.e === "AnimatedImage") return {
        kind: "video",
        url: media_meta.s.mp4,
        url_backup_image: media_meta.s.gif,
        w: media_meta.s.x,
        h: media_meta.s.y,
        gifv: true,
        caption: caption,
    };
    if(media_meta.e === "RedditVideo") return {
        kind: "vreddit_video",
        id: media_meta.id,
        w: media_meta.x,
        h: media_meta.y,
        gifv: media_meta.isGif ?? false,
        caption: caption,
    };
    expectUnsupported(media_meta.e);
    return {
        kind: "richtext",
        content: [richtextErrorP("TODO "+media_meta.e, JSON.stringify(media_meta))],
    };
}
function richtextParagraph(rtd: Reddit.Richtext.Paragraph, opt: RichtextFormattingOptions): Generic.Richtext.Paragraph {
    switch(rtd.e) {
        case "par": return {
            kind: "paragraph",
            children: richtextSpanArray(rtd.c, opt),
        };
        case "img": case "video": case "gif": {
            const data = opt.media_metadata[rtd.id];
            if(!data) return richtextErrorP("unknown id "+rtd.id, JSON.stringify(opt));
            return {
                kind: "body",
                body: mediaMetaToBody(data, rtd.c),
            };
        }
        case "h": return {
            kind: "heading",
            level: rtd.l,
            children: richtextSpanArray(rtd.c, opt),
        };
        case "hr": return {
            kind: "horizontal_line"
        };
        case "blockquote": return {
            kind: "blockquote",
            children: richtextParagraphArray(rtd.c, opt),
        };
        case "list": return {
            kind: "list",
            ordered: rtd.o,
            children: richtextParagraphArray(rtd.c, opt),
        };
        case "li": return {
            kind: "list_item",
            children: richtextParagraphArray(rtd.c, opt),
        };
        case "code": return {
            kind: "code_block",
            text: rtd.c.map(v => {
                switch(v.e) {
                    case "raw": return v.t;
                    case "unsupported": return "Err «"+JSON.stringify(v)+"»";
                }
            }).join("\n"),
        };
        case "table": return {
            kind: "table",
            headings: rtd.h.map(h => richtextTableHeading(h, opt)),
            children: rtd.c.map(c => c.map(q => richtextTableItem(q, opt))),
        };
    }
    expectUnsupported(rtd.e);
    return {
        kind: "paragraph",
        children: [{kind: "text", text: "TODO "+rtd.e, styles: {error: "TODO «"+JSON.stringify(rtd)+"»"}}],
    };
}
function richtextTableHeading(tbh: Reddit.Richtext.TableHeading, opt: RichtextFormattingOptions): Generic.Richtext.TableHeading {
    return {
        align: tbh.a != null ? ({'L': "left", 'C': "center", 'R': "right"} as const)[tbh.a] : undefined,
        children: richtextSpanArray(tbh.c, opt),
    };
}
function richtextTableItem(tbh: Reddit.Richtext.TableItem, opt: RichtextFormattingOptions): Generic.Richtext.TableItem {
    console.log(tbh);
    return {
        children: richtextSpanArray(tbh.c, opt),
    };
}
function richtextFormattedText(text: string, format: Reddit.Richtext.FormatRange[], opt: RichtextFormattingOptions): Generic.Richtext.Span[] {
    if(format.length === 0) {
        const is_braille = [...text].every(char => {
            const codepoint = char.codePointAt(0)!;
            if(codepoint >= 0x2800 && codepoint <= 0x28FF) return true;
            if(codepoint === 32) return true;
            return false;
        });
        if(is_braille) {
            // // not necessary with white-space: pre
            // const braille_blocks = text.split(" ");
            // const len = braille_blocks.length - 1;
            // return braille_blocks.flatMap((bblk, i) => {
            //     const segment: Generic.Richtext.Span = {kind: "text", text: bblk, styles: {}};
            //     if(i == len) return [segment];
            //     return [segment, {kind: "br"}]
            // });
            return [{kind: "text", text: text.split(" ").join("\n"), styles: {}}];
        }
        return [{kind: "text", text: text, styles: {}}];
    }
    const resitems: Generic.Richtext.Span[] = [];
    let previdx = 0;
    const commit = (endv: number) => {
        const nofmt = text.substring(previdx, endv);
        if(nofmt.length > 0) resitems.push({kind: "text", text: nofmt, styles: {}});
    };
    format.forEach(([fmtid, start, length]) => {
        commit(start);
        previdx = start + length;
        const fmt = text.substr(start, length);
        resitems.push({kind: "text", text: fmt, styles: richtextStyle(fmtid)});
    });
    commit(text.length);
    return resitems;
}
function richtextSpan(rtd: Reddit.Richtext.Span, opt: RichtextFormattingOptions): Generic.Richtext.Span[] {
    switch(rtd.e) {
        case "text": return richtextFormattedText(rtd.t, rtd.f ?? [], opt);
        case "r/": case "u/": return [{
            kind: "link",
            url: "/"+rtd.e+rtd.t,
            children: [{kind: "text", text: (rtd.l ? "/" : "") + rtd.e + rtd.t, styles: {}}],
        }];
        case "link": return [{
            kind: "link",
            url: rtd.u,
            title: rtd.a,
            children: richtextFormattedText(rtd.t, rtd.f ?? [], opt),
        }];
        case "br": return [{kind: "br"}];
        case "spoilertext": return [{kind: "spoiler", children: richtextSpanArray(rtd.c, opt)}];
        case "raw": return [{kind: "text", text: rtd.t, styles: {}}];
        case "gif": {
            const meta = opt.media_metadata[rtd.id];
            if(!meta) return richtextError("Missing media id "+rtd.id, JSON.stringify(meta));
            if(meta.e !== "AnimatedImage") return richtextError("Unsupported "+meta.e, JSON.stringify(meta));
            if(meta.status !== "valid") return richtextError("Bad status "+meta.status, JSON.stringify(meta));
            return [
                {kind: "link", url: meta.s.mp4 ?? meta.s.gif,
                    children: [{kind: "text", text: "[embedded "+rtd.id.split("|")[0]+"]", styles: {}}],
                }
            ];
        }
    }
    expectUnsupported(rtd.e);
    return [{kind: "text", text: "TODO "+rtd.e, styles: {error: "TODO «"+JSON.stringify(rtd)+"»"}}];
}
function richtextError(text: string, hover: string): Generic.Richtext.Span[] {
    return [{kind: "text", text: text, styles: {error: hover}}];
}
function richtextErrorP(text: string, hover: string): Generic.Richtext.Paragraph {
    return {
        kind: "paragraph",
        children: richtextError(text, hover),
    };
}
function richtextSpanArray(rtsa: Reddit.Richtext.Span[], opt: RichtextFormattingOptions): Generic.Richtext.Span[] {
    return (rtsa ?? []).flatMap(v => richtextSpan(v, opt));
}
function richtextStyle(style: number): Generic.Richtext.Style {
    return {
        strong: !!(style & 1),
        emphasis: !!(style & 2),
        strikethrough: !!(style & 8),
        superscript: !!(style & 32),
        code: !!(style & 64),
        error: style & ~0b1101011 ? "unsupported style "+style.toString(2) : undefined,
    };
}

const isLoggedIn = (): boolean => {
    const item = localStorage.getItem("reddit-secret");
    if(item == null || item === "") return false;
    return true;
};

const baseURL = () => {
    const base = isLoggedIn() ? "oauth.reddit.com" : "www.reddit.com";
    return "https://"+base;
};
const pathURL = (path: string) => {
    const [pathname, query] = splitURL(path);
    if(!pathname.startsWith("/")) {
        throw new Error("path didn't start with `/` : `"+path+"`");
    }
    query.set("raw_json", "1");
    query.set("rtj", "yes"); // undefined | "yes" | "only" but it turns out in listings eg /r/subreddit.json rtj=only cuts off after like 10 paragraphs but rtj=yes doesn't weird
    query.set("emotes_as_images", "true"); // enables sending {t: "gif"} span elements in richtext rather than sending a link
    query.set("gilding_detail", "1"); // not sure what this does but new.reddit sends it in an oauth.reddit.com request so it sounds good
    return baseURL()+pathname+".json?"+query.toString();
};

// ok so the idea::
// reddit listings are [pageinfo], [comments]
// so::
// if this is the outermost listing, the pageinfo is needed to display info about the current page
// so like
// when we return a result from getThread it can be like this
// {
//     parent: Post
//     children: Post[]
// }
// and then also the client viewer thing can update the parent post if eg you load the comments
// ok part 2:: there are different types of posts

const getAccessToken = async () => {
    const data = localStorage.getItem("reddit-secret");
    if(data === "" || data == null) return null;
    const json = JSON.parse(data) as {
        access_token: string,
        expires: number,
        refresh_token: string,
        scope: string,
    };
    console.log(json.expires, Date.now());
    // TODO rather than relying on the system clock, update the token if a request returns a old token error
    if(json.expires < Date.now()) {
        // refresh token
        console.log("Token expired, refreshing…");
        const [status, v] = await fetch("https://www.reddit.com/api/v1/access_token", {
            method: "POST", mode: "cors", credentials: "omit",
            headers: {
                'Authorization': "Basic "+btoa(client_id+":"),
                'Content-Type': "application/x-www-form-urlencoded",
            },
            body: encodeURL`grant_type=refresh_token&refresh_token=${json.refresh_token}`,
        }).then(async (res) => {
            return [res.status, await res.json() as {
                access_token: string,
                refresh_token?: string,
                expires_in: number,
                scope: string,
            } | {error: string}] as const;
        });
        if(status !== 200) {
            console.log("Error! got", v, "with status code", status);
            throw new Error("Status code "+status);
        }
        if('error' in v) {
            console.log("refresh attempt: ", v, json);
            throw new Error("Got error while refreshing token: "+v.error);
        }
        const res_data = {
            access_token: v.access_token,
            refresh_token: v.refresh_token ?? json.refresh_token,
            expires: Date.now() + (v.expires_in * 1000),
            scope: v.scope,
        };
        console.log("Refresh info:", v, res_data);
        localStorage.setItem("reddit-secret", JSON.stringify(res_data));
        console.log("Refreshed √");
        return res_data.access_token;
    }
    return json.access_token;
};

const getAuthorization = async () => {
    const access_token = await getAccessToken();
    if(access_token == null) return "";
    return "Bearer "+access_token;
};

const splitURL = (path: string): [string, URLSearchParams] => {
    const [pathname, ...query] = path.split("?");
    return [pathname ?? "", new URLSearchParams(query.join("?"))];
};
const updateQuery = (path: string, update: {[key: string]: string | undefined}) => {
    const [pathname, query] = splitURL(path);
    for(const [k, v] of Object.entries(update)) {
        if(v != null) query.set(k, v);
        else query.delete(k);
    }
    return pathname + "?" + query.toString();
};

function createSubscribeAction(subreddit: string, subscribers: number, you_subbed: boolean): Generic.Action {
    return {
        kind: "counter",

        label: "Subscribe",
        incremented_label: "Subscribed",

        count_excl_you: you_subbed ? subscribers - 1 : subscribers,
        you: you_subbed ? "increment" : undefined,

        actions: {
            increment: act_encoder.encode({kind: "subscribe", subreddit, direction: "sub"}),
            reset: act_encoder.encode({kind: "subscribe", subreddit, direction: "unsub"}),
        },
    };
}
const sidebarWidgetToGenericWidget = (data: Reddit.Widget, subreddit: string): Generic.ContentNode => {
    try {
        return sidebarWidgetToGenericWidgetTry(data, subreddit);
    }catch(e) {
        console.log("widget error", e);
        return {
            kind: "widget",
            title: "Error!",
            raw_value: data,
            widget_content: {kind: "body", body: {kind: "richtext", content: [richtextErrorP("Uh oh! Error "+e.toString(), JSON.stringify(data))]}},
        };
    }
};
const sidebarWidgetToGenericWidgetTry = (data: Reddit.Widget, subreddit: string): Generic.ContentNode => {
    if(data.kind === "moderators") return {
        kind: "widget",
        title: "Moderators",
        raw_value: data,
        widget_content: {
            kind: "list",
            items: data.mods.map(moderator => ({
                name: {kind: "username", username: moderator.name},
                click: {kind: "link", url: "/u/"+moderator.name},
            })),
        },
        actions_top: [{
            kind: "link",
            url: "/message/compose?to="+subreddit,
            text: "Message the mods",
        }],
        actions_bottom: [{
            kind: "link",
            url: "/r/"+subreddit+"/about/moderators",
            text: "View All Moderators",
        }],
    }; else if(data.kind === "community-list") return {
        kind: "widget",
        title: data.shortName,
        raw_value: data,
        widget_content: {
            kind: "list",
            items: data.data.map(sub => {
                if(sub.type === "subreddit") return {
                    icon: sub.communityIcon || undefined,
                    name: {kind: "text", text: "r/"+sub.name},
                    click: {kind: "link", url: "/r/"+sub.name},
                    action: createSubscribeAction(sub.name, sub.subscribers, sub.isSubscribed),
                };
                expectUnsupported(sub.type);
                return {
                    name: {kind: "text", text: "ERROR UNSUPPORTED" + sub.type},
                    click: {kind: "body", body: {kind: "richtext", content: [{kind: "code_block", text: JSON.stringify(sub, null, "\t")}]}},
                };
            }),
        },
        actions_top: [{
            kind: "link",
            url: "/message/compose?to="+subreddit,
            text: "Message the mods",
        }],
        actions_bottom: [{
            kind: "link",
            url: "/r/"+subreddit+"/about/moderators",
            text: "View All Moderators",
        }],
    }; else if(data.kind === "id-card") return {
        kind: "widget",
        title: "Error!",
        raw_value: data,
        widget_content: {kind: "body", body: {kind: "richtext", content: [richtextErrorP("Not supported "+data.kind, JSON.stringify(data))]}},
    }; else if(data.kind === "menu") return {
        kind: "widget",
        title: "Error!",
        raw_value: data,
        widget_content: {kind: "body", body: {kind: "richtext", content: [richtextErrorP("Uh oh! TODO widget "+data.kind, JSON.stringify(data))]}},
    }; else if(data.kind === "textarea") return {
        kind: "widget",
        title: data.shortName,
        raw_value: data,
        widget_content: {kind: "body", body: {kind: "text", content: data.text, markdown_format: "reddit"}},
    }; else if(data.kind === "subreddit-rules") return {
        kind: "widget",
        title: data.shortName,
        raw_value: data,
        widget_content: {kind: "list", items: data.data.map((rule, i) => ({
            name: {kind: "text", text: "" + (i + 1) + ". " + rule.shortName},
            click: {kind: "body", body: {kind: "text", content: rule.description, markdown_format: "reddit"}},
        }))},
    }; else if(data.kind === "image") return {
        kind: "widget",
        title: data.shortName,
        raw_value: data,
        widget_content: {kind: "image",
            src: data.data[data.data.length - 1]!.url,
            link_url: data.data[data.data.length - 1]!.linkUrl,
            width: data.data[data.data.length - 1]!.width,
            height: data.data[data.data.length - 1]!.height,
        },
    }; else if(data.kind === "post-flair") return {
        kind: "widget",
        // /r/…/?f=flair_name:"…"
        title: data.shortName,
        raw_value: data,
        widget_content: {kind: "list", items: data.order.map((id) => {
            const val = data.templates[id]!;
            const flairv = flairToGenericFlair(val.type, val.text, val.textColor, val.backgroundColor, val.richtext);
            if(flairv.length !== 1) throw new Error("bad flair");
            return {
                name: {kind: "flair", flair: flairv[0]!},
                click: {kind: "link", url: "/r/"+subreddit+"/?f=flair_name:\""+encodeURIComponent(val.text)+"\""}
            };
        })}
    }; else if(data.kind === "custom") return {
        kind: "widget",
        title: data.shortName,
        raw_value: data,
        widget_content: {kind: "iframe", height: "" + data.height, srcdoc: `
            <head>
                <link rel="stylesheet" href="${data.stylesheetUrl}">
                <base target="_blank">
            </head>
            <body>${data.textHtml}</body>
        `},
    }; else if(data.kind === "button") return {
        kind: "widget",
        title: "Error!",
        raw_value: data,
        widget_content: {kind: "body", body: {kind: "richtext", content: [richtextErrorP("TODO button widget", JSON.stringify(data))]}},
    };
    expectUnsupported(data.kind);
    return {
        kind: "widget",
        title: "Error!",
        raw_value: data,
        widget_content: {kind: "body", body: {kind: "richtext", content: [richtextErrorP("Uh oh! Unsupported widget "+data.kind, JSON.stringify(data))]}},
    };
};
function customIDCardWidget(t5: Reddit.T5, subreddit: string): Generic.ContentNode {
    return {
        kind: "widget",
        title: t5.data.title,
        raw_value: t5,
        widget_content: {
            kind: "community-details",
            description: t5.data.public_description,
        },
        actions_bottom: [
            createSubscribeAction(subreddit, t5.data.subscribers, t5.data.user_is_subscriber ?? false),
        ],
    };
}
function oldSidebarWidget(t5: Reddit.T5, subreddit: string, {collapsed}: {collapsed: boolean}): Generic.ContentNode {
    return {
        kind: "thread",
        raw_value: t5,
        body: {kind: "text", markdown_format: "reddit", content: t5.data.description},
        display_mode: {body: collapsed ? "collapsed" : "visible", comments: "visible"},
        link: "/r/"+subreddit+"/about",
        layout: "reddit-post",
        title: {text: "old.reddit sidebar"},
        actions: [],
        default_collapsed: false,
    };
    // return {
    //     kind: "widget",
    //     title: "Old Sidebar",
    //     raw_value: t5,
    //     widget_content: {
    //         kind: "body",
    //         body: {
    //             kind: "text",
    //             markdown_format: "reddit",
    //             content: t5.data.description,
    //         },
    //     },
    // };
}
function sidebarFromWidgets(subinfo: SubInfo, mode_raw: "both" | "header" | "sidebar"): Generic.ContentNode[] {
    const widgets = subinfo.widgets;

    const mode: {header: boolean, sidebar: boolean} = {header: mode_raw === "header" || mode_raw === "both", sidebar: mode_raw === "sidebar" || mode_raw === "both"};
    const getItem = (id: string): Reddit.Widget => {
        const resv = widgets!.items[id];
        if(!resv) throw new Error("bad widget "+id);
        return resv;
    };

    const wrap = (data: Reddit.Widget): Generic.ContentNode => sidebarWidgetToGenericWidget(data, subinfo.subreddit);
    
    // TODO moderator widget
    return [
        ...mode.header && widgets ? widgets.layout.topbar.order.map(id => wrap(getItem(id))) : [],
        // ...mode.sidebar && widgets ? [wrap(getItem(widgets.layout.idCardWidget))] : [],
        ...mode.sidebar && subinfo.sub_t5 ? [customIDCardWidget(subinfo.sub_t5, subinfo.subreddit)] : [],
        ...mode.sidebar && subinfo.sub_t5 ? [oldSidebarWidget(subinfo.sub_t5, subinfo.subreddit, {collapsed: widgets ? true : false})] : [],
        ...mode.sidebar && widgets ? widgets.layout.sidebar.order.map(id => wrap(getItem(id))) : [],
        ...mode.sidebar && widgets ? [wrap(getItem(widgets.layout.moderatorWidget))] : [],
    ];
}

type SubInfo = {
    subreddit: string,
    widgets?: Reddit.ApiWidgets,
    sub_t5?: Reddit.T5,
};
type PageExtra = {subinfo?: SubInfo};
function makeSidebar(extra: PageExtra, mode_raw: "both" | "header" | "sidebar"): {sidebar: Generic.ContentNode[]} | null {
    if(extra.subinfo) {
        return {sidebar: sidebarFromWidgets(extra.subinfo, mode_raw)};
    }
    return null;
}
const pageFromListing = (path: string, listing: Reddit.AnyResult, extra: PageExtra): Generic.Page => {
    if(Array.isArray(listing)) {
        let link_fullname: string | undefined;
        const firstchild = listing[0].data.children[0]!;
        if(firstchild.kind === "t3") {
            link_fullname = firstchild.data.name;
        }
        return {
            title: firstchild.kind === "t3" ? firstchild.data.title : "ERR top not t3",
            header: threadFromListing(firstchild, {force_expand: "open", show_post_reply_button: true}, path) as Generic.Thread,
            replies: listing[1].data.children.map(child => threadFromListing(child, {link_fullname}, path)),
            ...makeSidebar(extra, "both"),
            display_style: "comments-view",
        };
    }
    if('json' in listing) {
        if(listing.json.errors.length > 0) {
            console.log(listing.json.errors);
            alert("errors, check console");
        }

        // reparent comments because morechildren returns a flat array of comments rather than a tree
        const reparenting: Reddit.PostCommentLike[] = [];
        const id_map = new Map<string, Reddit.PostCommentLike>();
        for(const item of listing.json.data.things) {
            id_map.set(item.data.name, item);
            const parent_comment = id_map.get(item.data.parent_id);
            if(parent_comment) {
                if(parent_comment.kind !== "t1") {
                    throw new Error("expected t1 here");
                }
                // ||= because replies might be "" if it's empty
                parent_comment.data.replies ||= {kind: "Listing", data: {before: null, children: [], after: null}};
                parent_comment.data.replies.data.children.push(item);
            }else{
                reparenting.push(item);
            }
        }
        const [, query] = splitURL(path);

        return {
            title: "MoreChildren",
            header: {
                kind: "thread",
                title: {text: "MoreChildren"},
                body: {kind: "text", content: "MoreChildren", markdown_format: "none"},
                display_mode: {body: "collapsed", comments: "collapsed"},
                link: "TODO no link",
                layout: "error",
                actions: [],
                default_collapsed: false,
                raw_value: {},
            },
            replies: reparenting.map(child => threadFromListing(child, {link_fullname: query.get("link_id") ?? undefined}, path)),
            ...makeSidebar(extra, "both"),
            display_style: "comments-view",
        };
    }
    if(listing.kind === "wikipage") {
        return {
            title: path + " | Wiki",
            header: {
                kind: "thread",
                raw_value: listing,
                body: {kind: "text", markdown_format: "reddit_html", content: listing.data.content_html},
                display_mode: {body: "visible", comments: "visible"},
                link: path,
                layout: "error",
                actions: [],
                default_collapsed: false,
            },
            ...makeSidebar(extra, "both"),
            display_style: "comments-view",
        };
    }
    if(!('data' in listing) || listing.kind !== "Listing") {
        return {
            title: path + " | Error View",
            header: {
                kind: "thread",
                raw_value: listing,
                body: {kind: "richtext", content: [{kind: "code_block", text: JSON.stringify(listing, null, "\t")}]},
                display_mode: {body: "visible", comments: "visible"},
                link: path,
                layout: "error",
                actions: [],
                default_collapsed: false,
            },
            ...makeSidebar(extra, "both"),
            display_style: "comments-view",
        };
    }

    const replies = listing.data.children.map(child => threadFromListing(child, undefined, path));
    if(listing.data.before != null) {
        // TODO?
    }
    if(listing.data.after != null) {
        const next_path = updateQuery(path, {before: undefined, after: listing.data.after});
        replies.push({kind: "load_more", load_more: next_path, count: undefined, raw_value: listing});
    }

    return {
        title: path,
        header: extra.subinfo  && extra.subinfo.widgets
            ? {
                kind: "hlist",
                items: sidebarFromWidgets(extra.subinfo, "header"),
            }
            : {
                kind: "thread",
                title: {text: "Listing"},
                body: {kind: "text", content: "Listing", markdown_format: "none"},
                display_mode: {body: "collapsed", comments: "collapsed"},
                link: "TODO no link",
                layout: "error",
                actions: [],
                default_collapsed: false,
                raw_value: listing,
            }
        ,
        replies,
        ...makeSidebar(extra, "sidebar"),
        display_style: "fullscreen-view",
    };
};
const getPointsOn = (listing: Reddit.PostComment | Reddit.PostSubmission): Generic.Action => {
    // not sure what rank is for
    const vote_data = {id: listing.name, rank: "2"};
    return {
        kind: "counter",
        special: "reddit-points",

        label: "Vote",
        incremented_label: "Voted",
        decremented_label: "Voted",

        count_excl_you: listing.score_hidden ? "hidden" : listing.score + (listing.likes === true ? -1 : listing.likes === false ? 1 : 0),
        you: listing.likes === true ? "increment" : listing.likes === false ? "decrement" : undefined,

        percent: listing.upvote_ratio,
        actions: listing.archived ?? false ? {error: "archived <6mo"} : isLoggedIn() ? {
            increment: encodeVoteAction({...vote_data, dir: "1"}),
            decrement: encodeVoteAction({...vote_data, dir: "-1"}),
            reset: encodeVoteAction({...vote_data, dir: "0"}),
        } : {error: "not logged in"},
    };
};
const threadFromListing = (listing_raw: Reddit.Post, options: ThreadOpts = {}, parent_permalink: string): Generic.Node => {
    try {
        const res = threadFromListingMayError(listing_raw, options, parent_permalink);
        if(listing_raw.kind === "t1" && 'link_title' in listing_raw.data) {
            return {
                kind: "thread",
                title: {text: listing_raw.data.link_title},
                info: {
                    time: false,
                    edited: false,
                    in: {
                        name: listing_raw.data.subreddit_name_prefixed,
                        link: "/"+listing_raw.data.subreddit_name_prefixed,
                    },
                    author: {
                        name: listing_raw.data.link_author,
                        link: "/u/"+listing_raw.data.link_author,
                    },
                    pinned: false,
                },
                body: listing_raw.data.parent_id === listing_raw.data.link_id ? {kind: "none"} : {kind: "text", content: "…", markdown_format: "none"},
                display_mode: {body: "visible", comments: "collapsed"},
                link: listing_raw.data.link_permalink,
                layout: "reddit-post",
                default_collapsed: false,
                actions: [{kind: "link", url: listing_raw.data.link_permalink, text: "Permalink"}],
                raw_value: listing_raw,
                replies: [res],
            };
        }
        return res;
    }catch(e) {
        console.log(e);
        return {
            kind: "thread",
            body: {kind: "richtext", content: [richtextErrorP("Error! "+e.toString(), e.stack)]},
            display_mode: {body: "visible", comments: "visible"},
            raw_value: {error: e, listing: listing_raw},
            link: "Error!",
            layout: "error",
            actions: [],
            default_collapsed: false,
        };
    }
};
const deleteButton = (fullname: string): Generic.Action => {
    return {
        kind: "delete",
        data: encodeDeleteAction(fullname),
    };
};
type ReportInfo = {
    subreddit: string,
    fullname: string,
};
const report_encoder = encoderGenerator<ReportInfo, "report">("report");
const reportButton = (fullname: string, subreddit: string): Generic.Action => {
    return {
        kind: "report",
        data: report_encoder.encode({subreddit, fullname}),
    };
};
const replyButton = (fullname: string): Generic.Action => {
    return {
        kind: "reply",
        text: "Reply",
        reply_info: reply_encoder.encode({parent_id: fullname}),
    };
};
const saveButton = (fullname: string, saved: boolean): Generic.Action => {
    return {
        kind: "counter",
        
        label: "Save",
        incremented_label: "Unsave",

        count_excl_you: "none",
        you: saved ? "increment" : undefined,
        actions: {
            increment: act_encoder.encode({kind: "save", fullname,  direction: ""}),
            reset: act_encoder.encode({kind: "save", fullname, direction: "un"}),
        },
    };
};

const fetch_path = encoderGenerator<{path: string}, "fetch_removed_path">("fetch_removed_path");

const as = <T>(a: T): T => a;
type ThreadOpts = {force_expand?: "open" | "crosspost" | "closed", link_fullname?: string, show_post_reply_button?: boolean};
const threadFromListingMayError = (listing_raw: Reddit.Post, options: ThreadOpts = {}, parent_permalink: string): Generic.Node => {
    options.force_expand ??= "closed";
    if(listing_raw.kind === "t1") {
        // Comment
        const listing = listing_raw.data;

        let is_deleted: undefined | "author" | "moderator";
        if(listing.author === "[deleted]") {
            if(JSON.stringify(listing.rtjson) === JSON.stringify({document: [{c: [{e: "text", t: "[deleted]"}], e: "par"}]})) {
                is_deleted = "author";
            }else if(JSON.stringify(listing.rtjson) === JSON.stringify({document: [{c: [{e: "text", t: "[removed]"}], e: "par"}]})) {
                is_deleted = "moderator";
            }
        }
        const post_id_no_pfx = listing.name.substring(3);

        const body_content: Generic.Body = {
            kind: "richtext", content: richtextDocument(listing.rtjson, {media_metadata: listing.media_metadata ?? {}})
        };

        const result: Generic.Node = {
            kind: "thread",
            body: is_deleted != null
                ? {kind: "removed", by: is_deleted,
                    fetch_path: fetch_path.encode({path: "https://api.pushshift.io/reddit/comment/search?ids="+post_id_no_pfx}),
                    body: body_content,
                } : body_content,
            display_mode: {body: "visible", comments: "visible"},
            raw_value: listing_raw,
            link: listing.permalink,
            layout: "reddit-comment",
            info: {
                time: listing.created_utc * 1000,
                edited: listing.edited === false ? false : listing.edited * 1000,
                author: {
                    name: listing.author,
                    link: "/u/"+listing.author,
                    flair: [
                        ...flairToGenericFlair(listing.author_flair_type, listing.author_flair_text,
                            listing.author_flair_text_color, listing.author_flair_background_color,
                            listing.author_flair_richtext
                        ),
                        ...awardingsToFlair(listing.all_awardings ?? []),
                    ],
                },
                pinned: listing.stickied,
            },
            actions: [
                replyButton(listing.name), {
                    kind: "link",
                    text: "Permalink",
                    url: listing.permalink ?? "Error no permalink",
                },
                deleteButton(listing.name),
                saveButton(listing.name, listing.saved),
                reportButton(listing.name, listing.subreddit),
                getPointsOn(listing)
            ],
            default_collapsed: listing.collapsed,
        };
        if(listing.replies) {
            result.replies = listing.replies.data.children.map(v => threadFromListing(v, options, listing.permalink));
        }
        return result;
    }else if(listing_raw.kind === "t3") {
        const listing = listing_raw.data;
        // if((listing as any).preview) console.log((listing as any).preview);

        let is_deleted: undefined | "author" | "moderator" | "anti_evil_ops" | "error";
        if(listing.removed_by_category != null) {
            if(listing.removed_by_category === "moderator") is_deleted = "moderator";
            else if(listing.removed_by_category === "deleted") is_deleted = "author";
            else if(listing.removed_by_category === "anti_evil_ops") is_deleted = "anti_evil_ops";
            else{expectUnsupported(listing.removed_by_category); is_deleted = "error"}
        }
        const post_id_no_pfx = listing.name.substring(3);

        const extra_flairs: Generic.Flair[] = [];
        if(listing.spoiler) extra_flairs.push({elems: [{type: "text", text: "Spoiler"}], content_warning: true});
        if(listing.over_18) extra_flairs.push({elems: [{type: "text", text: "NSFW"}], content_warning: true});
        if(listing.is_original_content) extra_flairs.push({elems: [{type: "text", text: "OC"}], content_warning: false});

        const body_content: Generic.Body = listing.crosspost_parent_list && listing.crosspost_parent_list.length === 1
            ? {kind: "crosspost", source:
                threadFromListing({kind: "t3", data: listing.crosspost_parent_list[0]!}, {force_expand: "crosspost"}, listing.permalink) as Generic.Thread
            }
            : listing.is_self
            ? {kind: "array",
                body: [
                    listing.rtjson.document.length
                        ? {kind: "richtext", content: richtextDocument(listing.rtjson, {media_metadata: listing.media_metadata ?? {}})}
                        : listing.url === "https://www.reddit.com" + listing.permalink
                        ? {kind: "none"}
                        : {kind: "link", url: listing.url, embed_html: listing.media_embed?.content},
                    listing.poll_data
                    ? {kind: "poll",
                        votable: "Cannot vote",
                        total_votes: listing.poll_data.total_vote_count,
                        choices: listing.poll_data.options.map(choice => ({
                            name: choice.text,
                            votes: choice.vote_count ?? "hidden",
                            id: choice.id,
                        })),
                        vote_data: "",
                        select_many: false,
                        your_votes: listing.poll_data.user_selection != null ? [{id: listing.poll_data.user_selection}] : [],
                        close_time: listing.poll_data.voting_end_timestamp,
                    } : undefined,
                ],
            }
            : listing.gallery_data
            ? {kind: "gallery", images: listing.gallery_data.items.map(gd => {
                if(!listing.media_metadata) throw new Error("missing media metadata");
                const moreinfo = listing.media_metadata[gd.media_id];
                if(!moreinfo) throw new Error("missing mediameta for "+gd.media_id);
                if(moreinfo.status !== "valid") throw new Error("unsupported status in gallery "+gd.media_id);
                if(moreinfo.e === "Image") {
                    const res: Generic.GalleryItem = {
                        thumb: moreinfo.p[0]!.u ?? "error",
                        w: moreinfo.p[0]!.x,
                        h: moreinfo.p[0]!.y,
                        body: {
                            kind: "captioned_image",
                            url: moreinfo.s.u ?? "error",
                            w: moreinfo.s.x,
                            h: moreinfo.s.y,
                            caption: gd.caption,
                        }
                    };
                    return res;
                }
                if(moreinfo.e === "AnimatedImage") {
                    const res: Generic.GalleryItem = {
                        thumb: moreinfo.p![0]!.u ?? "error",
                        w: moreinfo.p![0]!.x,
                        h: moreinfo.p![0]!.y,
                        body: {
                            kind: "video",
                            url: moreinfo.s.mp4 ?? moreinfo.s.gif,
                            w: moreinfo.s.x,
                            h: moreinfo.s.y,
                            caption: gd.caption,
                            gifv: true,
                        }
                    };
                    return res;
                }
                if(moreinfo.e === "RedditVideo") {
                    throw new Error("TODO gallery item moreinfo video");
                }
                expectUnsupported(moreinfo.e);
                throw new Error("TODO gallery item "+moreinfo.e);
            })}
            : {kind: "link", url: listing.url, embed_html: listing.media_embed?.content}
        ;

        const result: Generic.Node = {
            kind: "thread",
            title: {
                text: listing.title,
            },
            flair: [
                ...flairToGenericFlair(listing.link_flair_type, listing.link_flair_text, listing.link_flair_text_color,
                    listing.link_flair_background_color, listing.link_flair_richtext
                ),
                ...extra_flairs,
                ...awardingsToFlair(listing.all_awardings ?? []),
            ],
            body: is_deleted != null
                ? {kind: "removed", by: is_deleted,
                    fetch_path: fetch_path.encode({path: "https://api.pushshift.io/reddit/submission/search?ids="+post_id_no_pfx}),
                    body: body_content,
                }
                : body_content
            ,
            display_mode: options.force_expand === "crosspost"
                ? {body: "visible", comments: "collapsed"}
                : {body: "collapsed", body_default: options.force_expand, comments: "collapsed"}
            ,
            raw_value: listing_raw,
            link: listing.permalink,
            thumbnail: options.force_expand === "crosspost"
                ? undefined
                : listing.preview?.images?.[0]?.resolutions?.[0]?.url != null
                ? {kind: "image", url: listing.preview.images[0].resolutions[0].url}
                : listing.thumbnail == null
                ? undefined
                : listing.thumbnail.includes("/")
                ? {kind: "image", url: listing.thumbnail}
                // : listing.gallery_data // new.reddit has this but old.reddit doesn't
                // ? {kind: "default", thumb: "gallery"}
                : listing.thumbnail == null || listing.thumbnail === ""
                ? undefined
                : {kind: "default", thumb: (as<{[key: string]: Generic.ThumbType}>({
                    self: "self", default: "default", image: "image",
                    spoiler: "spoiler", nsfw: "nsfw", account: "account",
                }))[listing.thumbnail] ?? "error"}
            ,
            layout: "reddit-post",
            info: {
                time: listing.created_utc * 1000,
                edited: listing.edited === false ? false : listing.edited * 1000,
                author: {
                    name: listing.author,
                    link: "/u/"+listing.author,
                    flair: flairToGenericFlair(listing.author_flair_type, listing.author_flair_text, listing.author_flair_text_color, listing.author_flair_background_color, listing.author_flair_richtext),
                },
                in: {
                    link: "/"+listing.subreddit_name_prefixed,
                    name: listing.subreddit_name_prefixed,
                },
                pinned: listing.stickied,
            },
            actions: [options.show_post_reply_button ?? false ? replyButton(listing.name) : {
                kind: "link",
                url: listing.permalink,
                text: listing.num_comments + " comment"+(listing.num_comments === 1 ? "" : "s"),
            }, {
                kind: "link",
                url: "/domain/"+listing.domain,
                text: listing.domain,
            }, deleteButton(listing.name), saveButton(listing.name, listing.saved), getPointsOn(listing), {
                kind: "link",
                url: listing.permalink.replace("/comments/", "/duplicates/"),
                text: "Duplicates"
            }, reportButton(listing.name, listing.subreddit)],
            default_collapsed: false,
            replies: options.show_post_reply_button ?? false ? undefined : [{
                kind: "load_more",
                raw_value: undefined,
                load_more: listing.permalink,
                count: listing.num_comments,
            }],
        };
        return result;
    }else if(listing_raw.kind === "more") {
        const listing = listing_raw.data;

        if(listing.children.length === 0) {
            return {
                kind: "load_more",
                load_more: parent_permalink,
                count: undefined,
                raw_value: listing_raw,
                includes_parent: true,
            };
        }

        const batches: string[][] = [];
        let current_batch: string[] = [];
        for(const itm of listing.children) {
            current_batch.push(itm);
            if(current_batch.length === 100) {
                batches.push(current_batch);
                current_batch = [];
            }
        }
        batches.push(current_batch);
        let root: Generic.LoadMore | undefined;
        let current = root;
        for(const batch of batches) {
            const envy: Generic.LoadMore = {
                kind: "load_more",
                load_more: options.link_fullname != null
                    ? "/api/morechildren?api_type=json&limit_children=false&children="+batch.join(",")+"&link_id="+options.link_fullname
                    : "Error: No link fullname provided."
                ,
                count: listing.count,
                raw_value: listing_raw,
            };
            if(!current) {
                root = envy;
                current = root;
            }else{
                current.next = envy;
                current = envy;
            }
        }
        if(!root) throw new Error("this should never happen");
        return root;
    }else{ //eslint-disable-line no-else-return
        return {
            kind: "thread",
            title: {text: "unsupported listing kind "+listing_raw.kind},
            body: {kind: "text", content: "unsupported", markdown_format: "none"},
            display_mode: {body: "collapsed", comments: "collapsed"},
            raw_value: listing_raw,
            link: "TODO no link",
            layout: "error",
            actions: [],
            default_collapsed: false,
        };
    }
    // console.log("Post: ",listing);
    
};

const getLoginURL = () => {
    const state = location.host;
    // https://www.reddit.com/api/v1/scopes.json → {[key: string]: {description: string, id: string, name: string}}
    // except "modtraffic" isn't a thing, why is it listed there?
    const scope = [
        "account", "creddits", "edit", "flair", "history", "identity",
        "livemanage", "modconfig", "modcontributors", "modflair", "modlog",
        "modmail", "modothers", "modposts", "modself", "modwiki",
        "mysubreddits", "privatemessages", "read", "report", "save",
        "structuredstyles", "submit", "subscribe", "vote", "wikiedit",
        "wikiread"
    ].join(" ");

    const url = `https://www.reddit.com/api/v1/authorize?` +
        encodeQuery({client_id, response_type: "code", state, redirect_uri, duration: "permanent", scope})
    ;
    return url;
};

export const client: ThreadClient = {
    id: "reddit",
    links: () => [
        ["Home", () => "/"],
        ["r/test", () => "/r/test"],
        ["Notifications", () => "/message/inbox"],
    ],
    isLoggedIn,
    loginURL: getLoginURL(),
    async getThread(pathraw, from): Promise<Generic.Page> {
        const [pathrawpath, pathrawquery] = splitURL(pathraw);
        const pathsplit = pathrawpath.split("/");
        if(pathsplit[1] === "u") pathsplit[1] = "user";

        const is_subreddit: string | undefined = pathsplit[1] === "r" ? pathsplit[2] ?? undefined : undefined;

        const path = pathsplit.join("/") + "?" + pathrawquery.toString();

        try {
            const [listing, widgets, sub_t5] = await Promise.all([
                redditRequest<Reddit.Page | Reddit.Listing | Reddit.MoreChildren>(path, {
                    method: "GET",
                }),
                is_subreddit != null && from === "pageload"
                    ? redditRequest<Reddit.ApiWidgets | undefined>("/r/"+is_subreddit+"/api/widgets", {method: "GET", onerror: e => undefined, cache: true})
                    : undefined
                ,
                is_subreddit != null && from === "pageload"
                    ? redditRequest<Reddit.T5 | undefined>("/r/"+is_subreddit+"/about", {method: "GET", onerror: e => undefined, cache: true})
                    : undefined
                ,
            ]);

            return pageFromListing(path, listing, {...is_subreddit != null ? {subinfo: {
                widgets,
                subreddit: is_subreddit,
                sub_t5,
            }} : null});
        }catch(err_raw) {
            const e = err_raw as Error;
            console.log(e);
            const is_networkerror = e.toString().includes("NetworkError");
            
            return {
                title: "Error",
                header: {
                    kind: "thread",
                    title: {text: "Error"},
                    body: {
                        kind: "text",
                        content: `Error ${e.toString()}`+ (is_networkerror
                            ? `. If using Firefox, try disabling 'Enhanced Tracker Protection' ${""
                            } for this site. Enhanced tracker protection indiscriminately blocks all ${""
                            } requests to social media sites, including Reddit.`
                            : `.`
                        ),
                        markdown_format: "none",
                    },
                    display_mode: {
                        body: "visible",
                        comments: "collapsed",
                    },
                    link: path,
                    layout: "error",
                    actions: [],
                    default_collapsed: false,
                    raw_value: {},
                },
                display_style: "comments-view",
            };
        }
    },
    async login(path, query_param) {
        const code = query_param.get("code");
        const state = query_param.get("state");

        if(code == null || state == null) {
            throw new Error("No login requested");
        }
        if(state !== location.host) {
            throw new Error("Login was for "+state);
        }

        const v: Reddit.AccessToken = await fetch("https://www.reddit.com/api/v1/access_token", {
            method: "POST", mode: "cors", credentials: "omit",
            headers: {
                'Authorization': "Basic "+btoa(client_id+":"),
                'Content-Type': "application/x-www-form-urlencoded",
            },
            body: encodeQuery({grant_type: "authorization_code", code, redirect_uri}),
        }).then(res => res.json());
    
        if(v.error) {
            console.log(v.error);
            throw new Error("error "+v.error);
        }

        const res_data = {
            access_token: v.access_token,
            refresh_token: v.refresh_token,
            expires: Date.now() + (v.expires_in * 1000),
            scope: v.scope,
        };

        console.log(v, res_data);

        localStorage.setItem("reddit-secret", JSON.stringify(res_data));
    },
    async fetchRemoved(frmlink_raw: Generic.Opaque<"fetch_removed_path">): Promise<Generic.Body> {
        const frmlink = fetch_path.decode(frmlink_raw);
        type PushshiftResult = {data: {selftext?: string, body?: string}[]};
        const [status, restext] = await fetch(frmlink.path).then(async (v) => {
            return [v.status, await v.text()] as const;
        });
        const res = JSON.parse(restext.split("&lt;").join("<").split("&gt;").join(">").split("&amp;").join("&")) as PushshiftResult;
        if(status !== 200) {
            console.log(status, res);
            throw new Error("Got status "+status);
        }
        if(res.data.length === 0) {
            console.log(status, res);
            throw new Error("Post was deleted before it could be saved:.");
        }
        const item = res.data[0]!;
        if(item.selftext === "[deleted]"
            || item.selftext === "[removed]"
            || item.body === "[deleted]"
            || item.body === "[removed]"
        ) {
            throw new Error("Post was deleted before it could be saved.");
        }
        //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if(item.selftext) {
            return {
                kind: "text",
                content: item.selftext,
                markdown_format: "reddit",
            };
        }
        //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if(item.body) {
            return {
                kind: "text",
                content: item.body,
                markdown_format: "reddit",
            };
        }
        throw new Error("no selftext or body");
    },
    async act(action_raw: Generic.Opaque<"act">): Promise<void> {
        const act = act_encoder.decode(action_raw);
        if(act.kind === "vote") {
            type VoteResult = {__nothing: unknown};
            const res = await redditRequest<VoteResult>("/api/vote", {
                method: "POST",
                mode: "urlencoded",
                body: act.query,
            });
            console.log(res);
        }else if(act.kind === "delete") {
            type DeleteResult = {__nothing: unknown};
            const res = await redditRequest<DeleteResult>("/api/del", {
                method: "POST",
                mode: "urlencoded",
                body: {id: act.fullname},
            });
            console.log(res);
        }else if(act.kind === "save") {
            type DeleteResult = {__nothing: unknown};
            const res = await redditRequest<DeleteResult>("/api/" + act.direction + "save", {
                method: "POST",
                mode: "urlencoded",
                body: {id: act.fullname},
            });
            console.log(res);
        }else if(act.kind === "subscribe") {
            type DeleteResult = {__nothing: unknown};
            const res = await redditRequest<DeleteResult>("/api/subscribe", {
                method: "POST",
                mode: "urlencoded",
                body: {
                    action: act.direction,
                    sr_name: act.subreddit,
                },
            });
            console.log(res);
        }else assertUnreachable(act);
    },
    previewReply(md: string, data: Generic.Opaque<"reply">): Generic.Thread {
        //eslint-disable-next-line @typescript-eslint/no-unused-vars
        const reply_info = reply_encoder.decode(data);
        return {
            kind: "thread",
            body: {kind: "text", content: md, markdown_format: "reddit"},
            display_mode: {body: "visible", comments: "visible"},
            raw_value: [md, data],
            link: "no link",
            layout: "reddit-comment",
            info: {
                time: Date.now(),
                edited: false,
                author: {
                    name: "u/TODO You",
                    link: "/u/TODO You",
                    // flair: …
                },
                pinned: false,
            },
            actions: [{
                kind: "counter",
                special: "reddit-points",

                label: "Vote",
                incremented_label: "Voted",
                decremented_label: "Voted",

                count_excl_you: 0,
                you: "increment",

                percent: 1,
                actions: {error: "reply not posted"},
            }],
            default_collapsed: false,
        };
    },
    async sendReply(md: string, data_raw: Generic.Opaque<"reply">): Promise<Generic.Node> {
        const reply_info = reply_encoder.decode(data_raw);
        const paragraphs: Reddit.Richtext.Paragraph[] = [];
        // huh, if you pass a format 1<<2 it puts tildes around the range and then removes the format item, weird
        for(let i = 0; i <= 7; i++) {
            if(i === 4) continue;
            if(i === 7) continue;
            const textv = "Testing 1<<"+i;
            paragraphs.push({e: "par", c: [
                {e: "text", t: textv, f: [
                    [1 << i, 0, 7],
                    [64, 8, textv.length],
                ]}
            ]});
        }
        // const richtext_json: Reddit.Richtext.Document = {
        //     document: [{e: "par", c: [
        //         {e: "text", t: "Gif: "},
        //         {e: "gif", id: "giphy|YBmxhCXlyhCr1EOSCY"},
        //     ]}],
        // };
        const richtext_json: Reddit.Richtext.Document = {
            document: paragraphs,
        };
        const body: {
            api_type: "json",
            thing_id: string,
            return_rtjson?: "true" | "false",
            richtext_json?: string,//Reddit.Richtext.Document,
            text?: string,
        } = {
            api_type: "json",
            thing_id: reply_info.parent_id,
            return_rtjson: "true",
            ...md === "richtext_demo"
                ? {richtext_json: JSON.stringify(richtext_json)}
                : {text: md}
            ,
        };
        const reply = await redditRequest<Reddit.PostComment | {json: {errors: [id: string, desc: string, other: string][]}}>("/api/comment", {
            method: "POST",
            mode: "urlencoded",
            body,
        });
        if('json' in reply) {
            const errortxt = reply.json.errors.map(err => "[" + err[0] + "]" + ": " + err[1] + " (in "+err[2]+")").join("\n");
            console.log(errortxt, reply);
            throw new Error(errortxt);
        }
        console.log(reply);
        // the reply also has a "rte_mode": "markdown" | "unsupported"
        return threadFromListing({kind: "t1", data: reply}, {}, "TODO");
    },
    async fetchReportScreen(data_raw) {
        const data = report_encoder.decode(data_raw);
        const [sub_rules, sub_about] = await Promise.all([
            await redditRequest<Reddit.Rules>("/r/"+data.subreddit+"/about/rules", {method: "GET", cache: true}),
            await redditRequest<Reddit.T5>("/r/"+data.subreddit+"/about", {method: "GET", cache: true}),
        ]);

        const result: Generic.ReportScreen[] = [];

        const sub_rules_out: Generic.ReportScreen[] = [];
        for(const sub_rule of sub_rules.rules) {
            sub_rules_out.push({
                title: sub_rule.violation_reason,
                description: {kind: "text", content: sub_rule.description, markdown_format: "reddit"},
                report: {
                    kind: "submit",
                    data: report_action_encoder.encode({
                        fullname: data.fullname,
                        subreddit: data.subreddit,
                        reason: {kind: "sub", id: sub_rule.short_name},
                    }),
                },
            });
        }
        if(sub_about.data.free_form_reports) {
            const char_limit = 100;
            sub_rules_out.push({
                title: "Custom Reason",
                report: {
                    kind: "textarea",
                    input_title: "Custom Reason",
                    char_limit,
                    data: report_action_encoder.encode({
                        fullname: data.fullname,
                        subreddit: data.subreddit,
                        reason: {kind: "sub_other"},
                        text_max: char_limit,
                    }),
                },
            });
        }
        result.push({
            title: "r/"+data.subreddit+"'s rules",
            report: {kind: "more", screens: sub_rules_out},
        });

        for(const site_rule of sub_rules.site_rules_flow) {
            result.push(siteRuleToReportScreen(data, site_rule));   
        }

        return result;
    },
    async sendReport(action, text): Promise<Generic.SentReport> {
        const report = report_action_encoder.decode(action);
        console.log(report, text);

        if(report.text_max == null) {
            if(text != null) throw new Error("never. got text in non-textual entry?");
        }else{
            if(text == null) throw new Error("never. missing text");
            if(text.length > report.text_max) throw new Error("report text too long (max "+report.text_max+")");
        }
        if(report.reason.kind === "sub_other") {
            if(text == null) throw new Error("never. missing text on sub_other");
        }

        const response = await redditRequest<Reddit.ReportResponse>("/api/report", {
            method: "POST",
            mode: "urlencoded",
            body: {
                sr_name: report.subreddit,
                thing_id: report.fullname,
                ...report.reason.kind === "sub"
                    ? {rule_reason: report.reason.id}
                    : report.reason.kind === "site"
                    ? {site_reason: report.reason.id, custom_text: text == null ? undefined : text} // assuming this is right, can't test it
                    : report.reason.kind === "sub_other"
                    ? {reason: text!}
                    : assertNever(report.reason)
                ,
            },
        });
        console.log("GOT Response:", response);
        if(response.success !== true) {
            // huh I tried sending a report "nope".repeat(100) and it said it was success but didn't actually send the report
            console.log(response);
            throw new Error("Got error response, check console");
        }

        return {
            title: report.reason.kind === "sub_other" ? "Report Sent!" : report.reason.id,
            body: text != null ? {kind: "text", content: text, markdown_format: "none"} : {kind: "none"},
        };
    },
};
const assertNever = (v: never): never => {
    console.log("not never", v);
    throw new Error("Expected never");
};
const siteRuleToReportScreen = (data: ReportInfo, site_rule: Reddit.FlowRule): Generic.ReportScreen => {
    let action: Generic.ReportAction;
    if('nextStepReasons' in site_rule) {
        action = {
            kind: "more",
            screens: site_rule.nextStepReasons.map(reason => siteRuleToReportScreen(data, reason)),
        };
    }else if('fileComplaint' in site_rule && site_rule.fileComplaint === true) {
        const updated_url = site_rule.complaintUrl.replace("%25%28thing%29", encodeURIComponent(data.fullname)); // %(thing)
        action = {
            kind: "more",
            screens: [{
                title: site_rule.complaintPageTitle,
                description: {kind: "text", content: site_rule.complaintPrompt, markdown_format: "none"},
                report: {
                    kind: "link",
                    url: "raw!"+updated_url,
                    text: site_rule.complaintButtonText,
                },
            }],
        };
    }else if('canWriteNotes' in site_rule && site_rule.canWriteNotes === true) {
        const char_limit = site_rule.isAbuseOfReportButton ?? false ? 250 : 2000;
        action = {
            kind: "textarea",
            input_title: site_rule.notesInputTitle,
            char_limit: char_limit,
            data: report_action_encoder.encode({
                fullname: data.fullname,
                subreddit: data.subreddit,
                text_max: char_limit,
                reason: {kind: "site", id: site_rule.reasonText},
            }),
        };
    }else if('canSpecifyUsernames' in site_rule && site_rule.canSpecifyUsernames === true) {
        action = {
            kind: "link",
            url: "raw!https://reddit.com/report",
            text: "Open Reddit",
        };
    }else{
        action = {
            kind: "submit",
            data: report_action_encoder.encode({
                fullname: data.fullname,
                subreddit: data.subreddit,
                reason: {kind: "site", id: site_rule.reasonText},
            }),
        };
    }
    return {
        title: site_rule.reasonTextToShow,
        report: action,
    };
};

type ReportAction = {
    fullname: string,
    subreddit: string,
    text_max?: number,
    reason: {kind: "sub", id: string} | {kind: "site", id: string} | {kind: "sub_other"},
};
// note: sub_other should pass the text through the other_reason field when reporting
const report_action_encoder = encoderGenerator<ReportAction, "send_report">("send_report");

type RequestOpts<ResponseType> = (
    | {method: "GET"}
    | {method: "POST", mode: "urlencoded", body: {[key: string]: string | undefined}}
    | {method: "POST", mode: "json", body: unknown}
) & {
    onerror?: (e: Error) => ResponseType,
    onstatus?: (status: number, res: ResponseType) => ResponseType,
    cache?: boolean,
};
// note: TODO reset caches on a few occasions
// : if you send any requests to edit the subreddit about text or anything like that, clear all caches containing /r/:subname/ or ending with /r/:subname
// : if you click the refresh button at the top of the page, clear caches maybe
const request_cache = new Map<string, unknown>();
async function redditRequest<ResponseType>(path: string, opts: RequestOpts<ResponseType>): Promise<ResponseType> {
    try {
        const full_url = pathURL(path);
        const fetchopts: RequestInit = {
            method: opts.method, mode: "cors", credentials: "omit",
            headers: {
                ...isLoggedIn() ? {'Authorization': await getAuthorization()} : {},
                ...opts.method === "POST" ? {'Content-Type': {json: "application/json", urlencoded: "application/x-www-form-urlencoded"}[opts.mode]} : {},
            },
            ...opts.method === "POST" ? {
                body: opts.mode === "json"
                    ? JSON.stringify(opts.body)
                    : opts.mode === "urlencoded"
                    ? Object.entries(opts.body).flatMap(([a, b]) => b == null ? [] : [encodeURIComponent(a) + "=" + encodeURIComponent(b)]).join("&")
                    : assertUnreachable(opts)
                ,
            } : {},
        };
        const cache_text = JSON.stringify([full_url, fetchopts]);
        const prev_cache = request_cache.get(cache_text);
        if(prev_cache != null && (opts.cache ?? false)) return prev_cache as ResponseType;
        const [status, res] = await fetch(full_url, fetchopts).then(async (v) => {
            return [v.status, await v.json() as ResponseType] as const;
        });
        if(status !== 200) {
            if(opts.onstatus) return opts.onstatus(status, res);
            console.log(status, res);
            throw new Error("got status "+status);
        }
        if(opts.cache ?? false) request_cache.set(cache_text, res);
        return res;
    }catch(e) {
        console.log("Got error", e);
        if(opts.onerror) return opts.onerror(e);
        throw e;
    }
}

// POST /api/comment {api_type: json, return_rtjson: true, richtext_json: JSON, text: string, thing_id: parent_thing_id}
type ReplyInfo = {parent_id: string};
const reply_encoder = encoderGenerator<ReplyInfo, "reply">("reply");

function assertUnreachable(v: never): never {
    console.log(v);
    throw new Error("not unreachable");
}