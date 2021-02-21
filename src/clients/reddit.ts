import * as Reddit from "../types/api/reddit";
import * as Generic from "../types/generic";
import {encoderGenerator, ThreadClient} from "./base";
import { encodeQuery, encodeURL } from "../util";
import { rt } from "../types/generic";

const client_id = "biw1k0YZmDUrjg";
const redirect_uri = "https://thread.pfg.pw/login/reddit";

function flairToGenericFlair(
    opts: {
        type: Reddit.FlairBits.Type,
        text: Reddit.FlairBits.Text,
        text_color: Reddit.FlairBits.TextColor,
        background_color: Reddit.FlairBits.BackgroundColor,
        richtext: Reddit.FlairBits.Richtext,
    },
): Generic.Flair[] {
    if(opts.type == null) return []; // deleted comments
    if(opts.type === "text" && (opts.text == null || opts.text === "")) return [];
    const elems: Generic.RichTextItem[] = opts.type === "richtext" ? (opts.richtext ?? []).map(v => {
        if(v.e === "text") {
            return {type: "text", text: v.t};
        }else if(v.e === "emoji") {
            return {type: "emoji", url: v.u, name: v.a, w: 16, h: 16}; // only aspect is known uuh
        }
        expectUnsupported(v.e);
        return {type: "text", text: "#TODO("+v.e+")"};
    }) : opts.type === "text" ? [{type: "text", text: opts.text!}] : [{type: "text", text: "TODO: "+opts.type}];
    const flair_text = elems.map(v => v.type === "text" ? v.text : "").join("");
    return [{
        color: opts.background_color ?? undefined,
        fg_color: opts.text_color === "light" ? "light" : "dark",
        elems,
        content_warning: flair_text.toLowerCase().startsWith("cw:") || flair_text.toLowerCase().startsWith("tw:")
    }];
}

function awardingsToFlair(awardings: Reddit.Award[]): Generic.Flair[] {
    const resitems: Generic.RichTextItem[] = [];
    for(const awarding of awardings.sort((a1, a2) => a2.count - a1.count)) {
        if(resitems.length > 0) resitems.push({type: "text", text: " "});
        const icon = awarding.resized_static_icons[0]!;
        resitems.push({type: "emoji", url: icon.url, w: icon.width, h: icon.height, name: awarding.name});
        if(awarding.count > 1) resitems.push({type: "text", text: "×" + awarding.count});
    }
    if(resitems.length === 0) return [];
    return [{elems: resitems, content_warning: false, color: "transparent"}];
}

type Action =
    | {kind: "vote", query: Reddit.VoteBody}
    | {kind: "delete", fullname: string}
    | {kind: "save", fullname: string, direction: "" | "un"}
    | {kind: "subscribe", subreddit: string, direction: "sub" | "unsub"}
    | {kind: "log_out"}
;

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
    if(media_meta.status !== "valid") {
        return {
            kind: "richtext",
            content: [richtextErrorP("Bad Status "+media_meta.status, JSON.stringify(media_meta))],
        };
    }
    if(media_meta.e === "Image") return {
        kind: "captioned_image",
        url: media_meta.s.u,
        w: media_meta.s.x,
        h: media_meta.s.y,
        caption: caption,
    };
    if(media_meta.e === "AnimatedImage") return {
        kind: "video",
        source: media_meta.s.mp4 != null
            ? {kind: "video", sources: [{url: media_meta.s.mp4}]}
            : {kind: "img", url: media_meta.s.gif}
        ,
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
    return {
        children: richtextSpanArray(tbh.c, opt),
    };
}
function richtextFormattedText(text: string, format: Reddit.Richtext.FormatRange[], opt: RichtextFormattingOptions): Generic.Richtext.Span[] {
    if(format.length === 0) {
        let braille_character_count = 0;
        const is_braille = [...text].every(char => {
            if(!char.trim()) return true;
            if(char === "v" || char === "V") return true;
            const codepoint = char.codePointAt(0)!;
            if(codepoint >= 0x2800 && codepoint <= 0x28FF) {
                braille_character_count++;
            }
            if(codepoint === 12644) return true; // TODO allow all forms of invisible characters
            return false;
        });
        if(is_braille && braille_character_count > 10) {
            // // not necessary with white-space: pre
            // const braille_blocks = text.split(" ");
            // const len = braille_blocks.length - 1;
            // return braille_blocks.flatMap((bblk, i) => {
            //     const segment: Generic.Richtext.Span = {kind: "text", text: bblk, styles: {}};
            //     if(i == len) return [segment];
            //     return [segment, {kind: "br"}]
            // });
            return [{kind: "text", text: text.split(" ").filter(v => v.trim().length > 3).join("\n"), styles: {}}];
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
            is_user_link: rtd.e === "u/" ? rtd.t : undefined,
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
            if(meta.status !== "valid") return richtextError("Bad status "+meta.status, JSON.stringify(meta));
            if(meta.e !== "AnimatedImage") return richtextError("Unsupported "+meta.e, JSON.stringify(meta));
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

        unique_id: "/subscribe/"+subreddit+"/",
        time: Date.now(),

        label: "Subscribe",
        incremented_label: "Subscribed",

        style: "pill-filled",
        incremented_style: "pill-empty",

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
            kind: "body",
            body: {
                kind: "richtext",
                content: [
                    rt.p(rt.link("/message/compose?to=/r/"+subreddit, {style: "pill-empty"}, rt.txt("Message the mods"))),
                    rt.ul(...data.mods.map(mod => rt.li(rt.p(
                        rt.link("/u/"+mod.name, {is_user_link: mod.name}, rt.txt("u/"+mod.name)),
                        ...flairToGenericFlair({
                            type: mod.authorFlairType, text: mod.authorFlairText, text_color: mod.authorFlairTextColor,
                            background_color: mod.authorFlairBackgroundColor, richtext: mod.authorFlairRichText,
                        }).flatMap(flair => [rt.txt(" "), rt.flair(flair)]),
                    )))),
                    rt.p(rt.link("/r/"+subreddit+"/about/moderators", {}, rt.txt("View All Moderators"))),
                ],
            },
        },
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
        title: data.shortName,
        raw_value: data,
        widget_content: {kind: "list", items: data.order.map((id) => {
            const val = data.templates[id]!;
            const flairv = flairToGenericFlair({
                type: val.type, text: val.text, text_color: val.textColor,
                background_color: val.backgroundColor, richtext: val.richtext,
            });
            if(flairv.length !== 1) throw new Error("bad flair");
            return {
                name: {kind: "flair", flair: flairv[0]!},
                click: {kind: "link", url: "/r/"+subreddit+"/search?q=flair:\""+encodeURIComponent(val.text!)+"\"&restrict_sr=1"}
            }; // TODO make flairs a component that can be in richtext and make this return a body component rather than a special thing
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
        title: data.shortName,
        raw_value: data,
        widget_content: {
            kind: "list",
            above_text: {kind: "text", content: data.description, markdown_format: "reddit"},
            items: data.buttons.map((button): Generic.WidgetListItem => {
                if(button.kind === "text") return {
                    name: {kind: "text", text: button.text},
                    click: {kind: "link", url: button.url},
                };
                if(button.kind === "image") return {
                    name: {kind: "image", src: button.url, w: button.width, h: button.height, alt: button.text},
                    click: {kind: "link", url: button.linkUrl},
                };
                expectUnsupported(button.kind);
                return {
                    name: {kind: "text", text: "TODO "+button.kind},
                    click: {kind: "body", body: {kind: "none"}},
                };
            }),
        },
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
        link: "/r/"+subreddit+"/about/sidebar",
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
        // ...mode.header && widgets ? widgets.layout.topbar.order.map(id => wrap(getItem(id))) : [],
        // ...mode.sidebar && widgets ? [wrap(getItem(widgets.layout.idCardWidget))] : [],
        ...mode.sidebar && subinfo.sub_t5 ? [customIDCardWidget(subinfo.sub_t5, subinfo.subreddit)] : [],
        ...mode.sidebar && subinfo.sub_t5 ? [oldSidebarWidget(subinfo.sub_t5, subinfo.subreddit, {collapsed: widgets ? true : false})] : [],
        ...mode.sidebar && widgets ? widgets.layout.sidebar.order.map(id => wrap(getItem(id))) : [],
        ...mode.sidebar && widgets ? [wrap(getItem(widgets.layout.moderatorWidget))] : [],
    ];
}

const nullish = (v: "" | null | undefined | string): v is string => {
    if(v == null) return false;
    if(v === "") return false;
    return true;
};


function subredditHeader(subinfo: SubInfo | undefined): Generic.ContentNode {
    if(!subinfo) return {
        kind: "thread",
        title: {text: "Listing"},
        body: {kind: "text", content: "Listing", markdown_format: "none"},
        display_mode: {body: "collapsed", comments: "collapsed"},
        link: "TODO no link",
        layout: "error",
        actions: [],
        default_collapsed: false,
        raw_value: subinfo,
    };
    // banner image
    // subreddit icon, name, link
    // subscribe button

    const res_menu: Generic.MenuItem[] = [
        {text: "Posts", action: {kind: "link", url: "/r/"+subinfo.subreddit}, selected: true}
    ];

    wdgs: if(subinfo.widgets) {
        const order_len = subinfo.widgets?.layout.topbar.order.length;
        if(order_len === 0) break wdgs;
        if(order_len !== 1) {
            res_menu.push({text: "ERROR Topbar Order", action: {kind: "link", url: "error"}, selected: false});
            break wdgs;
        }
        const menu = subinfo.widgets.items[subinfo.widgets.layout.topbar.order[0]!]!;
        
        if(menu.kind !== "menu") {
            res_menu.push({text: "ERROR Topbar Item", action: {kind: "link", url: "error"}, selected: false});
            break wdgs;
        }

        if(menu.showWiki) {
            res_menu.push(
                {text: "Wiki", action: {kind: "link", url: "/r/"+subinfo.subreddit+"/wiki/index"}, selected: false}, // true if the path looks like /wiki
            );
        }

        const redditMenuToMenu = (data_item: Reddit.TopLevelMenuItem): Generic.MenuItem => {
            if('children' in data_item) return {
                text: data_item.text,
                selected: false,
                action: {kind: "menu", children: data_item.children.map(redditMenuToMenu)},
            }; else if('url' in data_item) return {
                text: data_item.text,
                selected: false,
                action: {kind: "link", url: data_item.url}
            };
            assertNever(data_item); // expectNever could be better
        };

        res_menu.push(...menu.data.map(data_item => ({...redditMenuToMenu(data_item), selected: false})));
    }

    return {
        kind: "reddit-header",
        // huh, r/askreddit does not have banner_background_image but it does have a banner positionedimage in structuredstyles
        // I can't get structuredstyles so I can't use that image
        banner: subinfo.sub_t5 && (subinfo.sub_t5.data.banner_background_image || nullish(subinfo.sub_t5.data.banner_img)) ? {
            desktop: subinfo.sub_t5.data.banner_background_image || subinfo.sub_t5.data.banner_img || "never",
            mobile: subinfo.sub_t5.data.mobile_banner_image || undefined,
        } : undefined,
        icon: subinfo.sub_t5 ? {
            url: subinfo.sub_t5.data.community_icon || subinfo.sub_t5.data.icon_img,
        } : undefined,
        name: {
            display: subinfo.sub_t5?.data.title,
            link_name: subinfo.sub_t5 ? subinfo.sub_t5.data.display_name_prefixed : "r/"+subinfo.subreddit,
        },
        subscribe: subinfo.sub_t5 ? createSubscribeAction(subinfo.subreddit, subinfo.sub_t5.data.subscribers, subinfo.sub_t5.data.user_is_subscriber ?? false) : undefined,
        menu: res_menu.length === 1 ? undefined : res_menu,
        raw_value: subinfo,
    };
}

type SubInfo = {
    subreddit: string,
    widgets?: Reddit.ApiWidgets,
    sub_t5?: Reddit.T5,
};
type PageExtra = {subinfo?: SubInfo, display_mode?: "rendered" | "raw"};
function makeSidebar(extra: PageExtra, mode_raw: "both" | "header" | "sidebar"): {sidebar: Generic.ContentNode[]} | null {
    if(extra.subinfo) {
        return {sidebar: sidebarFromWidgets(extra.subinfo, mode_raw)};
    }
    return null;
}
function getNavbar(): Generic.Action[] {
    const res: Generic.Action[] = [];
    if(isLoggedIn()) res.push(
        {kind: "act", action: act_encoder.encode({kind: "log_out"}), text: "Log Out"},
    );
    else res.push(
        {kind: "link", url: getLoginURL(), text: "Log In"},
        {kind: "link", url: "raw!https://www.reddit.com/register", text: "Sign Up"},
    );
    return res;
}
const pathFromListingRaw = (path: string, listing: Reddit.AnyResult, extra: PageExtra): Generic.Page => {
    const rtitems: Generic.Richtext.Paragraph[] = [];
    const listing_json = listing as unknown as {json: {errors: string[]}};
    if(typeof listing_json === "object" && 'json' in listing_json && typeof listing_json.json === "object"
        && 'errors' in listing_json.json && Array.isArray(listing_json.json.errors)
    ) {
        if(listing_json.json.errors.length > 0) {
            rtitems.push({
                kind: "heading",
                level: 1,
                children: [{kind: "text", text: "Errors:", styles: {}}],
            });
            rtitems.push({
                kind: "list",
                ordered: false,
                children: listing_json.json.errors.map(error => {
                    const res: Generic.Richtext.Paragraph = {kind: "list_item", children: [{kind: "paragraph", children: [{kind: "text", text: error, styles: {}}]}]};
                    return res;
                }),
            });
        }
    }
    return {
        title: path + " | Error View",
        navbar: getNavbar(),
        body: {
            kind: "one",
            item: {
                parents: [{
                    kind: "thread",
                    raw_value: listing,
                    body: {kind: "richtext", content: [...rtitems, {kind: "code_block", text: JSON.stringify(listing, null, "\t")}]},
                    display_mode: {body: "visible", comments: "visible"},
                    link: path,
                    layout: "error",
                    actions: [],
                    default_collapsed: false,
                }],
                replies: [],
            },
        },
        ...makeSidebar(extra, "both"),
        display_style: "comments-view",
    };
};
export const pageFromListing = (path: string, listing: Reddit.AnyResult, extra: PageExtra): Generic.Page => {
    const [path_path, path_query] = splitURL(path);
    if(extra.display_mode === "raw") return pathFromListingRaw(path, listing, extra);
    if(Array.isArray(listing)) {
        const path_sort = path_query.get("sort") as Reddit.Sort | null;
        let link_fullname: string | undefined;
        let default_sort: Reddit.Sort | null | undefined = null;
        let is_contest_mode = false;
        let can_mod_post = false;
        const firstchild = listing[0].data.children[0]!;
        if(firstchild.kind === "t3") {
            link_fullname = firstchild.data.name;
            default_sort = firstchild.data.suggested_sort;
            is_contest_mode = firstchild.data.contest_mode;
            can_mod_post = firstchild.data.can_mod_post;
        }
        const sort_v = path_sort ?? default_sort ?? "confidence";
        
        const children_root = listing[1].data.children;
        const header_children: Generic.Node[] = [];
        const root0 = children_root[0];
        if(root0 && root0.kind === "t1" && root0.data.parent_id !== link_fullname) {
            header_children.push(loadMoreContextNode(root0.data.subreddit, (link_fullname ?? "").replace("t3_", ""), root0.data.parent_id.replace("t1_", "")));
        }
        let replies = children_root.map(child => threadFromListing(child, {link_fullname}, {permalink: updateQuery(path, {sort: sort_v}), sort: sort_v}));

        // a mess of code:
        // - search for the comment that should be highlighted (for /r/…/comments/…/…/:commentid urls)
        // - unwrap the parent comments and that comment into header_children
        // - update children to contain the replies below that comment
        const getRootReply = (nodes: Generic.Node[]): Generic.Thread | undefined => {
            if(nodes.length !== 1) return undefined;
            const node0 = nodes[0]!;
            if(node0.kind !== "thread") return undefined;
            return node0;
        };
        const getIdFromReply = (node: Generic.Thread): string | undefined => {
            // hack
            const raw_val = node.raw_value as {data: {name: string | null} | null} | null;
            if(typeof raw_val === "object" && raw_val && 'data' in raw_val && typeof raw_val.data === "object"
                && raw_val.data && 'name' in raw_val.data && typeof raw_val.data.name === "string"
            ) {
                const name = raw_val.data.name;
                if(name.startsWith("t1_")) return name.replace("t1_", "");
                return undefined;
            }
            return undefined;
        };
        let root_reply: Generic.Node | undefined = getRootReply(replies);
        let found_reply: Generic.Node | undefined;
        while(root_reply) {
            const val_id = getIdFromReply(root_reply);
            if(val_id != null && (path.includes("/"+val_id) || path.includes("="+val_id))) {
                // found
                found_reply = root_reply;
                break;
            }
            root_reply = getRootReply(root_reply.replies ?? []);
        }
        if(found_reply) {
            root_reply = getRootReply(replies);
            while(root_reply && root_reply !== found_reply) {
                header_children.push(root_reply);
                const children = root_reply.replies;
                root_reply.replies = undefined;
                root_reply = getRootReply(children ?? []);
            }
            if(root_reply) {
                header_children.push(root_reply);
                const children = root_reply.replies;
                root_reply.replies = undefined;
                replies = children ?? [];
            }else{
                replies = [];
            }
        }

        // search down and see if in one-reply comments if a comment with path.includes(comment.id) exists
        // if it does, start reparenting :
        // header_children.push(threadFromListing(parent))
        // children_root = parent.children[0]
        // children_root_permalink = …
        // parent.children = nope

        return {
            title: firstchild.kind === "t3" ? firstchild.data.title : "ERR top not t3",
            navbar: getNavbar(),
            body: {
                kind: "one",
                item: {
                    parents: [
                        threadFromListing(firstchild, {force_expand: "open", show_post_reply_button: true}, {permalink: path, sort: "unsupported"}),
                        ...header_children,
                    ],
                    menu: (is_contest_mode && !can_mod_post) ? [
                        {
                            selected: true,
                            text: "Random",
                            action: {kind: "link", url: updateQuery(path, {sort: "random"})}
                        }
                    ] : ([
                        ["confidence", "Best"], ["top", "Top"], ["new", "New"], ["controversial", "Controversial"],
                        ["old", "Old"], ["random", "Random"], ["qa", "Q&A"], ["live", "Live"],
                    ] as const).map(([sortname, sorttext]): Generic.MenuItem => ({
                        selected: sort_v === sortname,
                        text: sorttext,
                        action: {kind: "link", url: updateQuery(path, {sort: sortname === "confidence" ? undefined : sortname})},
                    })),
                    replies: [...is_contest_mode ? [((): Generic.Thread => ({
                        kind: "thread",
                        body: {
                            kind: "richtext",
                            content: [
                                rt.p(rt.txt("This thread is in contest mode.")),
                                rt.p(rt.txt(can_mod_post
                                    ? "As a mod, you can sort comments however you wish. Regular users have randomized sorting and cannot see scores."
                                    : "Sorting is randomized and scores are hidden."
                                )),
                            ],
                        },
                        display_mode: {body: "visible", comments: "collapsed"},
                        raw_value: is_contest_mode,
                        link: "no",
                        actions: [],
                        default_collapsed: false,
                        layout: "reddit-post",
                    }))()] : [], ...replies],
                },
            },
            ...makeSidebar(extra, "both"),
            display_style: "comments-view",
        };
    }
    if(listing.kind === "wikipage") {
        return {
            title: path + " | Wiki",
            navbar: getNavbar(),
            body: {
                kind: "one",
                item: {
                    parents: [{
                        kind: "thread",
                        raw_value: listing,
                        body: {kind: "text", markdown_format: "reddit_html", content: listing.data.content_html},
                        display_mode: {body: "visible", comments: "visible"},
                        link: path,
                        layout: "error",
                        actions: [],
                        default_collapsed: false,
                    }],
                    replies: [],
                },
            },
            ...makeSidebar(extra, "both"),
            display_style: "comments-view",
        };
    }
    if(listing.kind === "t5") {
        return {
            title: path + " | Sidebar",
            navbar: getNavbar(),
            body: {
                kind: "one",
                item: {parents: [{
                    kind: "thread",
                    raw_value: listing,
                    body: {kind: "text", markdown_format: "reddit", content: listing.data.description},
                    display_mode: {body: "visible", comments: "visible"},
                    link: path,
                    layout: "reddit-post",
                    title: {text: "old.reddit sidebar"},
                    actions: [],
                    default_collapsed: false,
                }], replies: []},
            },
            ...makeSidebar(extra, "both"),
            display_style: "comments-view",
        };
    }
    if(listing.kind === "UserList") {
        return {
            title: path,
            navbar: getNavbar(),
            body: {
                kind: "one",
                item: {
                    parents: [{kind: "thread",
                        body: {kind: "richtext", content: [
                            rt.h1(rt.txt("User List")),
                            rt.table([
                                rt.th("left", rt.txt("Username")),
                                rt.th("left", rt.txt("Added")),
                                rt.th("left", rt.txt("Perms")),
                            ], ...listing.data.children.map(child => [
                                rt.td(rt.link("/u/"+child.name, {is_user_link: child.name}, rt.txt("u/"+child.name))),
                                rt.td(rt.timeAgo(child.date * 1000)),
                                rt.td(...child.mod_permissions.flatMap((modperm, i) => [...i !== 0 ? [rt.txt(", ")] : [], rt.txt(modperm)])),
                            ])),
                        ]},
                        display_mode: {body: "visible", comments: "visible"},
                        raw_value: listing,
                        layout: "reddit-post",
                        link: path,
                        actions: [],
                        default_collapsed: false,
                    }],
                    replies: [],
                },
            },
            ...makeSidebar(extra, "sidebar"),
            display_style: "comments-view",
        };
    }
    if(listing.kind === "Listing") {
        if(listing.data.before != null){
            // TODO
        }
        let next: Generic.LoadMoreUnmounted | undefined;
        if(listing.data.after != null) {
            const next_path = updateQuery(path, {before: undefined, after: listing.data.after});
            next = {kind: "load_more_unmounted", load_more_unmounted: load_more_unmounted_encoder.encode({kind: "listing", url: next_path}), url: next_path, count: undefined, raw_value: listing};
        }

        const pathsplit = path_path.split("/").filter(q => q);
        
        const normal_sorts = ["hot", "new", "rising"] as const;
        const timed_sorts = ["top", "controversial"] as const;

        type SortTimeless = "hot" | "new" | "rising";
        type SortTimed = "top" | "controversial";
        type SortTime = "hour" | "day" | "week" | "month" | "year" | "all" | "unsupported";
        type SubredditMenu = {
            kind: "subreddit",
            base: string[],
            current_sort:
                | {v: SortTimeless}
                | {v: SortTimed, t: SortTime},
            is_user_page: boolean, // /u/…/hot. user subreddit pages must have /hot /new /random otherwise they will display the normal user page
        };
        let page_mut: SubredditMenu | {
            kind: "user",
            base: string[],
            current: {
                tab: "overview" | "comments" | "submitted",
                sort: {sort: SortTimeless | SortTimeless | "unsupported", t: SortTime},
                // overview defaults ?sort=new
                // comments defaults ?sort=new
                // submitted defaults ?sort=hot
            } | {
                tab: "gilded",
                mode: "received" | "given" | "unsupported",
                // /gilded/ : received
                // /gilded/reveived
                // /gilded/given
            } | {
                tab: "upvoted" | "downvoted" | "hidden" | "saved",
            },
        } | {
            kind: "inbox",
            current: {
                tab: "compose",
                // uh oh compose is not a json listing (it's a 404) so this parsing
                // needs to happen above pageFromListingA
                to?: string,
            } | {
                tab: "inbox",
                // selfreply is "post replies". comments is "comment replies"
                inbox_tab: "inbox" | "unread" | "messages" | "comments" | "selfreply" | "mentions",
            } | {
                tab: "sent",
            } | {
                tab: "unknown",
            },
        } | {
            kind: "unknown",
        };

        const inbox_tabs = ["inbox", "unread", "messages", "comments", "selfreply", "mentions"] as const;

        const user_sorted_tabs = ["overview", "comments", "submitted"] as const;
        const user_sortless_tabs = ["upvoted", "downvoted", "hidden", "saved"] as const;
        const user_sorted_tabs_named = [
            ["overview", "Overview"], ["comments", "Comments"], ["submitted", "Submitted"],
            // ["gilded", "Gilded"],
        ] as const;
        const user_sortless_tabs_named = [
            ["upvoted", "Upvoted"], ["downvoted", "Downvoted"], ["hidden", "Hidden"],
            ["saved", "Saved"],
        ] as const;

        // note that different tabs should be shown on a user page rather than showing standard
        // subreddit sort buttons. TODO.
        if(pathsplit[0] === "r" && typeof pathsplit[1] === "string") {
            const base = ["r", pathsplit[1]];
            const path2 = pathsplit[2];

            if(guardIncludes(normal_sorts, path2) && pathsplit.length === 3) {
                page_mut = {
                    kind: "subreddit",
                    base,
                    current_sort: {v: path2},
                    is_user_page: false, 
                };
            }else if(guardIncludes(timed_sorts, path2) && pathsplit.length === 3) {
                const time_t = path_query.get("t") ?? "all";
                page_mut = {
                    kind: "subreddit",
                    base,
                    current_sort: {v: path2, t: time_t as "unsupported"},
                    is_user_page: false,
                };
            }else if(path2 == null) {
                page_mut = {
                    kind: "subreddit",
                    base,
                    current_sort: {v: "hot"},
                    is_user_page: false,
                };
            }else{
                page_mut = {kind: "unknown"};
            }
        }else if(pathsplit[0] === "user" && typeof pathsplit[1] === "string") {
            const path2 = pathsplit[2];
            const base = ["u", pathsplit[1]];

            if(guardIncludes(normal_sorts, path2) && pathsplit.length === 3) {
                page_mut = {
                    kind: "subreddit",
                    base,
                    current_sort: {v: path2},
                    is_user_page: false, 
                };
            }else if(guardIncludes(timed_sorts, path2) && pathsplit.length === 3) {
                const time_t = path_query.get("t") ?? "all";
                page_mut = {
                    kind: "subreddit",
                    base,
                    current_sort: {v: path2, t: time_t as "unsupported"},
                    is_user_page: false,
                };
            }else if(path2 == null) {
                page_mut = {
                    kind: "user",
                    base,
                    current: {tab: "overview", sort: {
                        sort: (path_query.get("sort") ?? "new") as "unsupported",
                        t: (path_query.get("t") ?? "all") as "unsupported",
                    }},
                };
            }else if(guardIncludes(user_sorted_tabs, path2) && pathsplit.length === 3) {
                page_mut = {
                    kind: "user",
                    base,
                    current: {tab: path2, sort: {
                        sort: (path_query.get("sort") ?? (path2 === "submitted" ? "hot" : "new")) as "unsupported",
                        t: (path_query.get("t") ?? "all") as "unsupported",
                    }},
                };
            }else if(guardIncludes(user_sortless_tabs, path2) && pathsplit.length === 3) {
                page_mut = {
                    kind: "user",
                    base,
                    current: {tab: path2},
                };
            }else if(path2 === "gilded" && (pathsplit.length === 3 || pathsplit.length === 4)) {
                page_mut = {
                    kind: "user",
                    base,
                    current: {tab: "gilded", mode: (pathsplit[3] ?? "received") as "unsupported"},
                };
            }else{
                page_mut = {kind: "unknown"};
            }
        }else if(pathsplit[0] === "message") {
            if(guardIncludes(inbox_tabs, pathsplit[1]) && pathsplit.length === 2) {
                page_mut = {
                    kind: "inbox",
                    current: {
                        tab: "inbox",
                        inbox_tab: pathsplit[1],
                    },
                };
            }else if(pathsplit[1] === "compose" && pathsplit.length === 2) {
                page_mut = {
                    kind: "inbox",
                    current: {
                        tab: "compose",  
                    },
                };
            }else if(pathsplit[1] === "sent" && pathsplit.length === 2) {
                page_mut = {
                    kind: "inbox",
                    current: {
                        tab: "sent",
                    },
                };
            }else{
                page_mut = {kind: "inbox", current: {tab: "unknown"}};
            }
        }else{
            const path0 = pathsplit[0];
            const base: string[] = [];
            if(guardIncludes(normal_sorts, path0) && pathsplit.length === 1) {
                page_mut = {
                    kind: "subreddit",
                    base,
                    current_sort: {v: path0},
                    is_user_page: false, 
                };
            }else if(guardIncludes(timed_sorts, path0) && pathsplit.length === 1) {
                const time_t = path_query.get("t") ?? "all";
                page_mut = {
                    kind: "subreddit",
                    base,
                    current_sort: {v: path0, t: time_t as "unsupported"},
                    is_user_page: false,
                };
            }else if(path0 == null) {
                page_mut = {
                    kind: "subreddit",
                    base,
                    current_sort: {v: "hot"},
                    is_user_page: false,
                };
            }else{
                page_mut = {kind: "unknown"};
            }
        }

        const page = page_mut;

        // TODO for /message/messages/…, a "one" should be returned rather than a "listing"
        // - parents: starting message..permalinked message
        // - replies: permalinked message + 1..

        return {
            title: path,
            navbar: getNavbar(),
            body: {
                kind: "listing",
                menu: page.kind === "subreddit" ? [{
                    selected: page.current_sort.v === "hot",
                    text: "Hot",
                    action: {kind: "link", url: "/"+[...page.base, ...page.is_user_page ? ["hot"] : []].join("/")},
                }, {
                    selected: page.current_sort.v === "new",
                    text: "New",
                    action: {kind: "link", url: "/"+[...page.base, "new"].join("/")},
                }, {
                    selected: page.current_sort.v === "rising",
                    text: "Rising",
                    action: {kind: "link", url: "/"+[...page.base, "rising"].join("/")},
                }, ...[["top", "Top"] as const, ["controversial", "Controversial"] as const].map(([url, text]): Generic.MenuItem => ({
                    selected: page.current_sort.v === url,
                    text: page.current_sort.v === url ? (text + " ("+page.current_sort.t+")") : text,
                    action: {kind: "menu", children: ([
                        ["hour", "Hour"], ["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"], ["all", "All Time"]
                    ] as const).map(([time, time_text]): Generic.MenuItem => ({
                        text: time_text,
                        selected: page.current_sort.v === url && page.current_sort.t === time,
                        action: {kind: "link", url: "/"+[...page.base, url].join("/")+"?t="+time},
                    }))},
                }))] : page.kind === "user" ? [...user_sorted_tabs_named.map(([tab, tabname]): Generic.MenuItem => ({
                    // huh this needs two menus
                    selected: page.current.tab === tab,
                    text: tabname,
                    action: {kind: "show-line-two", children: [
                        {
                            selected: page.current.tab === tab && page.current.sort.sort === "hot",
                            text: "Hot",
                            action: {kind: "link", url: updateQuery("/"+[...page.base, tab].join("/"), {sort: "hot"})},
                        },
                        {
                            selected: page.current.tab === tab && page.current.sort.sort === "new",
                            text: "New",
                            action: {kind: "link", url: updateQuery("/"+[...page.base, tab].join("/"), {sort: "new"})},
                        },
                        {
                            selected: page.current.tab === tab && page.current.sort.sort === "rising",
                            text: "Rising",
                            action: {kind: "link", url: updateQuery("/"+[...page.base, tab].join("/"), {sort: "rising"})},
                        },
                    ]}
                    // action: {kind: "link", url: "/"+[...menu_kind.base, ...tab === "overview" ? [] : [tab]].join("/")},
                })), {
                    selected: page.current.tab === "gilded",
                    text: "Gilded",
                    action: {kind: "show-line-two", children: [{
                        selected: page.current.tab === "gilded" && page.current.mode === "received",
                        text: "Received",
                        action: {kind: "link", url: "/"+[...page.base, "gilded"].join("/")}
                    }, {
                        selected: page.current.tab === "gilded" && page.current.mode === "given",
                        text: "Given",
                        action: {kind: "link", url: "/"+[...page.base, "gilded", "given"].join("/")}
                    }]},
                }, ...user_sortless_tabs_named.map(([tab, tabname]): Generic.MenuItem => ({
                    selected: page.current.tab === tab,
                    text: tabname,
                    action: {kind: "link", url: "/"+[...page.base, tabname].join("/")},
                }))]: page.kind === "inbox" ? [{
                    selected: page.current.tab === "compose",
                    text: "Compose",
                    action: {kind: "link", url: "/message/compose"},
                }, {
                    selected: page.current.tab === "inbox",
                    text: "Inbox",
                    action: {kind: "show-line-two", children: ([
                        ["inbox", "All"], ["unread", "Unread"], ["messages", "Messages"],
                        ["comments", "Comment Replies"], ["selfreply", "Post Replies"],
                        ["mentions", "Username Mentions"],
                    ] as const).map(([url, name]): Generic.MenuItem => ({
                        text: name,
                        selected: page.current.tab === "inbox" && page.current.inbox_tab === url,
                        action: {kind: "link", url: "/message/"+url}
                    }))},
                }, {
                    selected: page.current.tab === "sent",
                    text: "Sent",
                    action: {kind: "link", url: "/message/sent"},
                }] : page.kind === "unknown" ? [
                    {text: "Error!", selected: false, action: {kind: "link", url: path}},
                ] : assertNever(page),
                header: subredditHeader(extra.subinfo),
                items: page.kind === "inbox"
                    ? listing.data.children.map(child => topLevelThreadFromInboxMsg(child as unknown as Reddit.InboxMsg))
                    : listing.data.children.map(child => topLevelThreadFromListing(child, undefined, {permalink: path, sort: "unsupported"}))
                ,
                next,
            },
            ...makeSidebar(extra, "sidebar"),
            display_style: "fullscreen-view",
        };
    }
    expectUnsupported(listing.kind);
    return pathFromListingRaw(path, listing, extra);
};

function guardIncludes<Array extends ReadonlyArray<unknown>>(array: Array, search_item: unknown): search_item is Array[number] {
    return array.includes(search_item as unknown as Array[number]);
}

type LoadMoreUnmountedData = {
    kind: "listing",
    url: string,
} | {
    kind: "TODO more",
};
const load_more_unmounted_encoder = encoderGenerator<LoadMoreUnmountedData, "load_more_unmounted">("load_more_unmounted");

type LoadMoreData = {
    kind: "api_loadmore",
    link_fullname: string,
    children: string[],
    parent_permalink: SortedPermalink,
} | {
    kind: "parent_permalink",
    permalink: string,
} | {
    kind: "context",
    subreddit: string,
    link_id: string,
    parent_id: string,
};
const load_more_encoder = encoderGenerator<LoadMoreData, "load_more">("load_more");
const getPointsOn = (listing: {
    name: string,
    score_hidden?: boolean,
    score: number,
    likes: true | false | null,
    upvote_ratio?: number,
    archived?: boolean,
}): Generic.Action => {
    // not sure what rank is for
    const vote_data = {id: listing.name, rank: "2"};
    return {
        kind: "counter",

        unique_id: "/vote/"+listing.name+"/",
        time: Date.now(),

        special: "reddit-points",

        label: "Vote",
        incremented_label: "Voted",
        decremented_label: "Voted",

        count_excl_you: listing.score_hidden ?? false ? "hidden" : listing.score + (listing.likes === true ? -1 : listing.likes === false ? 1 : 0),
        you: listing.likes === true ? "increment" : listing.likes === false ? "decrement" : undefined,

        percent: listing.upvote_ratio,
        actions: listing.archived ?? false ? {error: "archived <6mo"} : {
            increment: encodeVoteAction({...vote_data, dir: "1"}),
            decrement: encodeVoteAction({...vote_data, dir: "-1"}),
            reset: encodeVoteAction({...vote_data, dir: "0"}),
        },
    };
};

function threadFromInboxMsg(inbox_msg: Reddit.InboxMsg): Generic.Node {
    if(inbox_msg.kind === "t1" || inbox_msg.kind === "t4") {
        const msg = inbox_msg.data;
        return {
            kind: "thread",
            info: {
                time: msg.created_utc * 1000,
                edited: false,
                author: {
                    name: "u/"+msg.author,
                    color_hash: msg.author,
                    link: "/u/"+msg.author,
                },
                pinned: false,
            },
            body: {kind: "text", content: msg.body, markdown_format: "reddit"},
            display_mode: {body: "visible", comments: "collapsed"},
            link: msg.context,
            layout: "reddit-comment",
            default_collapsed: false,
            actions: [
                ...inbox_msg.kind === "t1" ? [getPointsOn(msg)] : [],
                ...msg.context ? [{kind: "link", url: msg.context, text: "Context"} as const] : [],
                ...inbox_msg.kind === "t4" ? [{kind: "link", url: "/message/messages/"+msg.id, text: "Permalink"} as const] : [],
                // TODO Full Comments (:num_comments)
                // TODO mark unread
            ],
            raw_value: inbox_msg,
        };
    }
    return {
        kind: "thread",
        body: {kind: "richtext", content: [rt.p(rt.error("Unsupported "+inbox_msg.kind, inbox_msg))]},
        display_mode: {body: "visible", comments: "collapsed"},
        layout: "error",
        default_collapsed: false,
        actions: [],
        raw_value: inbox_msg,
        link: "no",
    };
}

const topLevelThreadFromInboxMsg = (inbox_msg: Reddit.InboxMsg): Generic.UnmountedNode => {
    if(inbox_msg.kind === "t1" || inbox_msg.kind === "t4") {
        const msg = inbox_msg.data;
        return {
            parents: [{
                // I need a new layout kind "info-line" that's for a really short info line like this
                kind: "thread",
                title: {text: msg.subject},
                body: {kind: "none"},
                display_mode: {body: "visible", comments: "collapsed"},
                link: "no",
                layout: "reddit-post",
                default_collapsed: false,
                actions: [],
                raw_value: inbox_msg,
                
                // :: if parent id starts with t1_ && is t1 msg
                // add a load more button in to get the parent
            }, threadFromInboxMsg(inbox_msg)],
            replies: typeof msg.replies === "object"
                ? msg.replies.data.children.map(child => threadFromInboxMsg(child))
                : []
            ,
        };
    }
    return {
        parents: [{
            kind: "thread",
            body: {kind: "richtext", content: [rt.p(rt.error("Unsupported "+inbox_msg.kind, inbox_msg))]},
            display_mode: {body: "visible", comments: "collapsed"},
            layout: "error",
            default_collapsed: false,
            actions: [],
            raw_value: inbox_msg,
            link: "no",
        }],
        replies: [],
    };
};

const topLevelThreadFromListing = (listing_raw: Reddit.Post, options: ThreadOpts = {}, parent_permalink: SortedPermalink): Generic.UnmountedNode => {
    const res = threadFromListingMayError(listing_raw, options, parent_permalink);
    if(listing_raw.kind === "t1" && 'link_title' in listing_raw.data) {
        return {
            parents: [{
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
                        color_hash: listing_raw.data.link_author,
                        name: listing_raw.data.link_author,
                        link: "/u/"+listing_raw.data.link_author,
                    },
                    pinned: false,
                },
                body: {kind: "link", url: listing_raw.data.link_permalink},
                display_mode: {body: "visible", comments: "collapsed"},
                link: listing_raw.data.link_permalink,
                layout: "reddit-post",
                default_collapsed: false,
                actions: [{kind: "link", url: listing_raw.data.link_permalink, text: "Permalink"}],
                raw_value: listing_raw,
                replies: [],
            }, ...listing_raw.data.parent_id === listing_raw.data.link_id
                ? []
                : [loadMoreContextNode(listing_raw.data.subreddit, listing_raw.data.link_id.replace("t3_", ""), listing_raw.data.parent_id.replace("t1_", ""))],
            res],
            replies: [],
        };
    }
    return {
        parents: [res],
        replies: [],
    };
};
function loadMoreContextNode(subreddit: string, link_id: string, parent_id: string): Generic.LoadMore {
    return {
        kind: "load_more",
        load_more: load_more_encoder.encode({kind: "context", subreddit: subreddit, link_id, parent_id}),
        url: "/r/"+subreddit+"/comments/" + link_id + "?comment="+parent_id.replace("t1_", "")+"&context=8",
        raw_value: [subreddit, link_id, parent_id],
    };
}
const threadFromListing = (listing_raw: Reddit.Post, options: ThreadOpts = {}, parent_permalink: SortedPermalink): Generic.Node => {
    try {
        const res = threadFromListingMayError(listing_raw, options, parent_permalink);
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

        unique_id: `/save/${fullname}/`,
        time: Date.now(),
        
        label: "Save",
        incremented_label: "Unsave",

        style: "action-button",
        incremented_style: "save-button-saved",

        count_excl_you: "none",
        you: saved ? "increment" : undefined,
        actions: {
            increment: act_encoder.encode({kind: "save", fullname,  direction: ""}),
            reset: act_encoder.encode({kind: "save", fullname, direction: "un"}),
        },
    };
};

const fetch_path = encoderGenerator<{path: string}, "fetch_removed_path">("fetch_removed_path");

type SortedPermalink = {
    permalink: string, // with sort param
    sort: Reddit.Sort,
};

// TODO instead of this, make a function to get the permalink from a SortedPermalink object
function sortWrap(parent: SortedPermalink, next: string): SortedPermalink {
    return {
        permalink: updateQuery(next, {sort: parent.sort}),
        sort: parent.sort,
    };
}

const as = <T>(a: T): T => a;
type ThreadOpts = {force_expand?: "open" | "crosspost" | "closed", link_fullname?: string, show_post_reply_button?: boolean};
const threadFromListingMayError = (listing_raw: Reddit.Post, options: ThreadOpts = {}, parent_permalink: SortedPermalink): Generic.Node => {
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
                    color_hash: listing.author,
                    name: listing.author,
                    link: "/u/"+listing.author,
                    flair: [
                        ...flairToGenericFlair({
                            type: listing.author_flair_type, text: listing.author_flair_text,
                            text_color: listing.author_flair_text_color,
                            background_color: listing.author_flair_background_color,
                            richtext: listing.author_flair_richtext,
                        }),
                        ...awardingsToFlair(listing.all_awardings ?? []),
                    ],
                },
                pinned: listing.stickied,
            },
            actions: [
                replyButton(listing.name), {
                    kind: "link",
                    text: "Permalink",
                    url: listing.permalink ? updateQuery(listing.permalink, {context: "3", sort: parent_permalink.sort}) : "Error no permalink",
                },
                deleteButton(listing.name),
                saveButton(listing.name, listing.saved),
                reportButton(listing.name, listing.subreddit),
                getPointsOn(listing)
            ],
            default_collapsed: listing.collapsed,
        };
        if(listing.replies) {
            result.replies = listing.replies.data.children.map(v => threadFromListing(v, options, sortWrap(parent_permalink, listing.permalink)));
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
                threadFromListing({kind: "t3", data: listing.crosspost_parent_list[0]!}, {force_expand: "crosspost"}, sortWrap(parent_permalink, listing.permalink)) as Generic.Thread
            }
            : listing.is_self
            ? {kind: "array",
                body: [
                    listing.rtjson.document.length
                        ? {kind: "richtext", content: richtextDocument(listing.rtjson, {media_metadata: listing.media_metadata ?? {}})}
                        : listing.url === "https://www.reddit.com" + listing.permalink // isn't this what is_self is for? why am I doing this check?
                        ? {kind: "none"}
                        : {kind: "link", url: listing.url, embed_html: listing.media_embed?.content}, // does this code path ever get used?
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
                if(moreinfo.status !== "valid") {
                    const res: Generic.GalleryItem = {
                        thumb: "error: "+moreinfo.status,
                        w: 200,
                        h: 200,
                        body: {
                            kind: "richtext",
                            content: [{kind: "paragraph", children: [
                                {kind: "text", text: "bad status: "+moreinfo.status, styles: {error: moreinfo.status}}
                            ]}, {
                                kind: "code_block",
                                text: JSON.stringify(moreinfo, null, "\t"),
                            }],
                        },
                    };
                    return res;
                }
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
                            source: moreinfo.s.mp4 != null
                                ? {kind: "video", sources: [{url: moreinfo.s.mp4}]}
                                : {kind: "img", url: moreinfo.s.gif}
                            ,
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
                const res: Generic.GalleryItem = {
                    thumb: "error: "+moreinfo.e,
                    w: 200,
                    h: 200,
                    body: {
                        kind: "richtext",
                        content: [{kind: "paragraph", children: [
                            {kind: "text", text: "unsupported kind: "+moreinfo.e, styles: {error: moreinfo.e}}
                        ]}, {
                            kind: "code_block",
                            text: JSON.stringify(moreinfo, null, "\t"),
                        }],
                    },
                };
                return res;
            })}
            : listing.rpan_video
            ? {kind: "video", source: {kind: "m3u8", url: listing.rpan_video.hls_url}, gifv: false}
            : {kind: "link", url: listing.url, embed_html: listing.media_embed?.content}
        ;

        const result: Generic.Node = {
            kind: "thread",
            title: {
                text: listing.title,
            },
            flair: [
                ...flairToGenericFlair({
                    type: listing.link_flair_type, text: listing.link_flair_text,
                    text_color: listing.link_flair_text_color,
                    background_color: listing.link_flair_background_color,
                    richtext: listing.link_flair_richtext,
                }),
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
                : listing.rpan_video
                ? {kind: "image", url: listing.rpan_video.scrubber_media_url}
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
                    color_hash: listing.author,
                    link: "/u/"+listing.author,
                    flair: flairToGenericFlair({
                        type: listing.author_flair_type, text: listing.author_flair_text,
                        text_color: listing.author_flair_text_color,
                        background_color: listing.author_flair_background_color,
                        richtext: listing.author_flair_richtext,
                    }),
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
                text: listing.num_comments.toLocaleString() + " comment"+(listing.num_comments === 1 ? "" : "s"),
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
        };
        return result;
    }else if(listing_raw.kind === "more") {
        const listing = listing_raw.data;

        if(listing.children.length === 0) {
            return {
                kind: "load_more",
                load_more: load_more_encoder.encode({kind: "parent_permalink", permalink: parent_permalink.permalink}),
                url: parent_permalink.permalink,
                count: undefined,
                raw_value: listing_raw,
            };
        }

        if(options.link_fullname == null) throw new Error("!options.link_fullname");
        return {
            kind: "load_more",
            load_more: load_more_encoder.encode({
                kind: "api_loadmore",
                link_fullname: options.link_fullname,
                children: listing.children,
                parent_permalink,
            }),
            url: parent_permalink.permalink,
            count: listing.children.length,
            raw_value: listing_raw,
        };
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
    const state = typeof location !== "undefined" ? location.host : "NOSTATE";
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

    const url = `raw!https://www.reddit.com/api/v1/authorize?` +
        encodeQuery({client_id, response_type: "code", state, redirect_uri, duration: "permanent", scope})
    ;
    return url;
};

export const client: ThreadClient = {
    id: "reddit",
    // loginURL: getLoginURL(),
    async getThread(pathraw): Promise<Generic.Page> {
        const [pathrawpath, pathrawquery] = splitURL(pathraw);
        const pathsplit = pathrawpath.split("/");
        if(pathsplit[1] === "u") pathsplit[1] = "user";
        if(pathsplit[1] === "r" && pathsplit[3] === "about" && pathsplit[4] === "sidebar") pathsplit.pop();
        const display_raw_json = pathrawquery.get("tr_display") === "raw";

        const is_subreddit: string | undefined = pathsplit[1] === "r" ? pathsplit[2] ?? undefined : undefined;

        const path = pathsplit.join("/") + "?" + pathrawquery.toString();

        try {
            const [listing, widgets, sub_t5] = await Promise.all([
                redditRequest<Reddit.AnyResult>(path, {
                    method: "GET",
                }),
                is_subreddit != null
                    ? redditRequest<Reddit.ApiWidgets | undefined>("/r/"+is_subreddit+"/api/widgets", {method: "GET", onerror: e => undefined, cache: true})
                    : undefined
                ,
                is_subreddit != null
                    ? redditRequest<Reddit.T5 | undefined>("/r/"+is_subreddit+"/about", {method: "GET", onerror: e => undefined, cache: true})
                    : undefined
                ,
            ]);

            return pageFromListing(path, listing, {...is_subreddit != null ? {subinfo: {
                widgets,
                subreddit: is_subreddit,
                sub_t5,
            }} : null, display_mode: display_raw_json ? "raw" : "rendered"});
        }catch(err_raw) {
            const e = err_raw as Error;
            console.log(e);
            const is_networkerror = e.toString().includes("NetworkError");
            
            return {
                title: "Error",
                navbar: getNavbar(),
                body: {kind: "one", item: {parents: [{
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
                }], replies: []}},
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
        }else if(act.kind === "log_out") {
            localStorage.removeItem("reddit-secret");
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
                    name: "TODO You",
                    color_hash: "TODO You",
                    link: "/u/TODO You",
                    // flair: …
                },
                pinned: false,
            },
            actions: [{
                kind: "counter",
                special: "reddit-points",
                unique_id: null,
                time: Date.now(),

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
        return threadFromListing({kind: "t1", data: reply}, {}, {permalink: "TODO", sort: "unsupported"});
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

    async loadMore(action: Generic.Opaque<"load_more">): Promise<Generic.Node[]> {
        const act = load_more_encoder.decode(action);
        if(act.kind === "api_loadmore") {
            const remaining = act.children;
            const batch = remaining.splice(0, 100);

            const url = "/api/morechildren?api_type=json&limit_children=false&children="+batch.join(",")+"&link_id="+encodeURIComponent(act.link_fullname)+"&sort="+act.parent_permalink.sort;
            const resp = await redditRequest<Reddit.MoreChildren>(url, {
                method: "GET",
            });

            if(resp.json.errors.length > 0) {
                console.log("got errors", resp);
                throw new Error("Got errors: "+resp.json.errors.join(", "));
            }

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

            const res_value = reparenting.map(child => threadFromListing(child, {link_fullname: act.link_fullname}, act.parent_permalink));

            if(remaining.length > 0) {
                const last_res_value = res_value[res_value.length - 1];
                if(last_res_value && last_res_value.kind === "load_more") {
                    const decoded = load_more_encoder.decode(last_res_value.load_more);
                    if(decoded.kind === "api_loadmore") {
                        decoded.children = [...remaining, ...decoded.children];
                        last_res_value.load_more = load_more_encoder.encode(decoded);
                    }else{
                        throw new Error("bad (this is not good)");
                    }
                }else res_value.push({
                    kind: "load_more",
                    load_more: load_more_encoder.encode({kind: "api_loadmore", link_fullname: act.link_fullname, children: remaining, parent_permalink: act.parent_permalink}),
                    url: act.parent_permalink.permalink,
                    raw_value: remaining,
                });
            }

            return res_value;
        }else if(act.kind === "parent_permalink") {
            // TODO: request to skip the parent post
            const resp = await redditRequest<Reddit.Page>(act.permalink, {
                method: "GET",
            });
            const translated_resp = pageFromListing(act.permalink, resp, {});
            if(translated_resp.body.kind === "one") {
                return translated_resp.body.item.replies;
            }
            console.log("Error", translated_resp);
            throw new Error("todo support load more returning other body ("+translated_resp.body.kind+")");
        }else if(act.kind === "context") {
            // TODO /r/:subreddit/comments/:link_id?comment=:parent_id&context=8
            // then split them out and return an array
            throw new Error("TODO load more context");
        }else assertNever(act);
    },
    async loadMoreUnmounted(action: Generic.Opaque<"load_more_unmounted">): Promise<{children: Generic.UnmountedNode[], next?: Generic.LoadMoreUnmounted}> {
        const act = load_more_unmounted_encoder.decode(action);
        if(act.kind === "listing") {
            const resp = await redditRequest<Reddit.Page>(act.url, {
                method: "GET",
            });
            const translated_resp = pageFromListing(act.url, resp, {});
            if(translated_resp.body.kind === "listing") {
                return {children: translated_resp.body.items, next: translated_resp.body.next};
            }
            console.log("Error", translated_resp);
            throw new Error("todo support load more returning other body ("+translated_resp.body.kind+")");
        }else if(act.kind === "TODO more") {
            throw new Error("TODO more");
        }else assertNever(act);
    },
};

// turns out (content: never): never => {} doesn't work properly
// TODO make a util.ts file that has stuff like assertNever, expectUnsupported, …
// or add expectUnsupported to base.ts
function assertNever(content: never): never {
    console.log("not never:", content);
    throw new Error("Expected never");
}
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