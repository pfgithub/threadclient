/* eslint-disable max-len */

import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import { encoderGenerator, ThreadClient } from "threadclient-client-base";
import { encodeQuery, encodeURL, splitURL, updateQuery } from "tmeta-util";
import { getVredditSources } from "threadclient-preview-vreddit";
import { getPage, loadPage2, submitPage2 } from "./page2_from_listing";
import { path_router } from "./routing";

const reddit_app_id = "biw1k0YZmDUrjg";
const redirect_uri = "https://thread.pfg.pw/login/reddit";

type FlairBits = {
    type: Reddit.FlairBits.Type,
    text: Reddit.FlairBits.Text,
    text_color: Reddit.FlairBits.TextColor,
    background_color: Reddit.FlairBits.BackgroundColor,
    richtext: Reddit.FlairBits.Richtext,
};
export function flairToGenericFlair(
    opts: FlairBits,
): Generic.Flair[] {
    if(opts.type == null) return []; // deleted comments
    if(opts.type === "text" && (opts.text == null || opts.text === "")) return [];
    const elems: Generic.Richtext.Span[] = opts.type === "richtext" ? (opts.richtext ?? []).flatMap((v): Generic.Richtext.Span[] => {
        if(v.e === "text") {
            return [{kind: "text", text: v.t, styles: {}}];
        }else if(v.e === "emoji") {
            return [{kind: "emoji", url: v.u, name: v.a}]; // only aspect is known uuh
        }
        expectUnsupported(v.e);
        return [{kind: "error", text: "#TODO("+v.e+")", value: v}];
    }) : opts.type === "text" ? [
        {kind: "text", text: opts.text!, styles: {}},
    ] : [
        {kind: "error", text: "TODO: "+opts.type, value: opts},
    ];
    const flair_text = elems.map(v => v.kind === "text" ? v.text : "").join("");
    return [{
        color: opts.background_color ?? undefined,
        elems,
        content_warning: flair_text.toLowerCase().startsWith("cw:") || flair_text.toLowerCase().startsWith("tw:")
    }];
}

export function awardingsToFlair(awardings: Reddit.Award[]): Generic.Flair[] {
    const resitems: Generic.Richtext.Span[] = [];
    for(const awarding of awardings.sort((a1, a2) => a2.count - a1.count)) {
        if(resitems.length > 0) resitems.push({kind: "text", text: " ", styles: {}});
        const icon = awarding.resized_static_icons[0]!;
        // const hover_icon = awarding.icon_url; // … this is like 2048x2048. nice and high res but that's bigger than most people's screens.
        const hover_icon = awarding.resized_icons[awarding.resized_icons.length - 1]!;
        resitems.push({
            kind: "emoji",
            url: icon.url,
            // w: icon.width, h: icon.height, // 1:1 assumed
            name: awarding.name,
            hover: {
                url: hover_icon.url,
                w: hover_icon.width, h: hover_icon.height,
                description: awarding.description + " (price: "+ awarding.coin_price+")",
            },
        });
        if(awarding.count > 1) resitems.push({kind: "text", text: "×" + awarding.count, styles: {}});
    }
    if(resitems.length === 0) return [];
    return [{elems: resitems, content_warning: false, system: "none"}];
}

type Action =
    | {kind: "vote", query: Reddit.VoteBody}
    | {kind: "delete", fullname: string}
    | {kind: "save", fullname: string, direction: "" | "un"}
    | {kind: "subscribe", subreddit: string, direction: "sub" | "unsub"}
    | {kind: "mark_read", fullname: string, direction: "" | "un"}
    | {kind: "log_out"}
;

function encodeVoteAction(query: Reddit.VoteBody): Generic.Opaque<"act"> {
    return act_encoder.encode({kind: "vote", query});
}
function encodeDeleteAction(fullname: string): Generic.Opaque<"act"> {
    return act_encoder.encode({kind: "delete", fullname});
}

const act_encoder = encoderGenerator<Action, "act">("act");

type RichtextFormattingOptions = {
    media_metadata: Reddit.MediaMetadata,
};
export function richtextDocument(rtd: Reddit.Richtext.Document, opt: RichtextFormattingOptions): Generic.Richtext.Paragraph[] {
    try {
        return richtextParagraphArray(rtd.document, opt);
    }catch(e) {
        console.log("Error parsing richtext:", e);
        return [rt.p(rt.error("Error parsing richtext: "+e, e))];
    }
}
function richtextParagraphArray(
    rtd: Reddit.Richtext.Paragraph[],
    opt: RichtextFormattingOptions,
): Generic.Richtext.Paragraph[] {
    return rtd.map(v => richtextParagraph(v, opt));
}
export function expectUnsupported(text: "unsupported"): void {
    console.log("Expected unsupported", text);
}

function mediaMetaToBody(media_meta: Reddit.Media, caption?: string): Generic.GalleryItem {
    if(media_meta.status !== "valid") {
        return {
            thumb: null,
            aspect: undefined,
            body: {
                kind: "richtext",
                content: [rt.p(rt.error("Bad Status "+media_meta.status+", "+caption, media_meta))],
            },
        };
    }
    if(media_meta.e === "Image") {
        const thumb = media_meta.p?.[0] ?? media_meta.s;
        return {
            thumb: thumb.u ?? "error",
            aspect: thumb.x / thumb.y,
            body: {
                kind: "captioned_image",
                url: media_meta.s.u,
                w: media_meta.s.x,
                h: media_meta.s.y,
                caption: caption,
            }
        };
    }
    if(media_meta.e === "AnimatedImage") {
        const thumb = media_meta.p?.[0];
        return {
            thumb: thumb ? thumb.u : "error",
            aspect: thumb ? thumb.x / thumb.y : undefined,
            body: {
                kind: "video",
                source: media_meta.s.mp4 != null
                    ? {kind: "video", sources: [{url: media_meta.s.mp4, quality: media_meta.s.x + "×" + media_meta.s.y}]}
                    : {kind: "img", url: media_meta.s.gif}
                ,
                // unfortunately, other qualities only contain resized static images so additional
                // qualities or a seekbar track cannot be provided.
                aspect: media_meta.s.x / media_meta.s.y,
                gifv: true,
                caption: caption,
            },
        };
    }
    if(media_meta.e === "RedditVideo") {
        return {
            thumb: null, // I didn't find an example of
            aspect: undefined, // this one so I couldn't check
            // if there was a way to get the thumbnail
            // it's probably for embedded videos in posts.
            body: {
                kind: "video",
                source: getVredditSources(media_meta.id),
                aspect: media_meta.x / media_meta.y,
                gifv: media_meta.isGif ?? false,
                caption: caption,
            },
        };
    }
    expectUnsupported(media_meta.e);
    return {
        thumb: null,
        aspect: undefined,
        body: {
            kind: "richtext",
            content: [rt.p(rt.error("TODO "+media_meta.e+", "+caption, media_meta))],
        },
    };
}
function richtextParagraph(rtd: Reddit.Richtext.Paragraph, opt: RichtextFormattingOptions): Generic.Richtext.Paragraph {
    switch(rtd.e) {
        case "par": if(rtd.c.length === 1 && (rtd.c[0]?.e === "gif" || rtd.c[0]?.e === "img")) {
            const gif = rtd.c[0];
            const meta = opt.media_metadata[gif.id];
            if(!meta) return rt.p(rt.error("Missing media id "+gif.id, meta));
            return rt.kind("body", {
                body: mediaMetaToBody(meta, gif.id.split("|")[0]).body,
            });
        } else if(rtd.c.length === 1 && rtd.c[0]?.e === "text" && rtd.c[0].t.match(/^---+$/)) {
            return rt.hr();
        } else return rt.p(...richtextSpanArray(rtd.c, opt));
        case "img": case "video": case "gif": {
            const data = opt.media_metadata[rtd.id];
            if(!data) return rt.p(rt.error("unknown id "+rtd.id, opt));
            return rt.kind("body", {
                body: mediaMetaToBody(data, rtd.c).body,
            });
        }
        case "h": return rt.hn(rtd.l, ...richtextSpanArray(rtd.c, opt));
        case "hr": return rt.hr();
        case "blockquote": return rt.blockquote(...richtextParagraphArray(rtd.c, opt));
        case "list": return rt.kind("list", {ordered: rtd.o},
            rtd.c.map(itm => rt.li(...richtextParagraphArray(itm.c, opt)))
        );
        case "code": return rt.pre(rtd.c.map(v => {
            switch(v.e) {
                case "raw": return v.t;
                case "unsupported": return "Err «"+JSON.stringify(v)+"»";
            }
        }).join("\n"));
        case "table": return rt.table(
            rtd.h.map(h => richtextTableHeading(h, opt)),
            ...rtd.c.map(c => c.map(q => richtextTableItem(q, opt))),
        );
    }
    expectUnsupported(rtd.e);
    return rt.p(rt.error("TODO "+rtd.e, rtd));
}
function richtextTableHeading(
    tbh: Reddit.Richtext.TableHeading,
    opt: RichtextFormattingOptions,
): Generic.Richtext.TableHeading {
    return rt.th(
        tbh.a != null ? ({'L': "left", 'C': "center", 'R': "right"} as const)[tbh.a] : undefined,
        ...richtextSpanArray(tbh.c ?? [], opt),
    );
}
function richtextTableItem(tbh: Reddit.Richtext.TableItem, opt: RichtextFormattingOptions): Generic.Richtext.TableItem {
    return rt.td(...richtextSpanArray(tbh.c, opt));
}
function isBraille(codepoint: number): boolean {
    return codepoint >= 0x2800 && codepoint <= 0x28FF;
}
function richtextFormattedText(
    text: string,
    format: Reddit.Richtext.FormatRange[],
    opt: RichtextFormattingOptions,
): Generic.Richtext.Span[] {
    if(format.length === 0) {
        text = text.replaceAll("¯_(ツ)_/¯", "¯\\_(ツ)_/¯");
        let braille_character_count = 0;
        let text_len_excl_zwsp = 0;
        [...text].forEach(char => {
            const codepoint = char.codePointAt(0)!;
            if(codepoint !== 0x200E && codepoint !== 0x20) {
                text_len_excl_zwsp += 1;
            }
            if(isBraille(codepoint)) {
                braille_character_count++;
            }
        });

        // at least 10 braille characters & braille characters make up 90% of the textual characters in the text span
        if(braille_character_count > text_len_excl_zwsp * 0.9 && braille_character_count > 10) {
            const res_lines: string[] = [];
            let last_line: string[] = [];
            for(const lsection of text.split(" ")) {
                const section = [...lsection];
                const line_braille_count = section.filter(item => isBraille(item.codePointAt(0)!));
                if(line_braille_count.length > 5) {
                    if(res_lines.length > 0) {
                        if(last_line.length > 0) res_lines[res_lines.length - 1] += " " + last_line.join(" ");
                        last_line = [];
                        res_lines.push(lsection);
                    }else{
                        res_lines.push([...last_line, lsection].join(" "));
                        last_line = [];
                    }
                }else{
                    last_line.push(lsection);
                }
            }
            res_lines.push(...last_line);
            return [rt.txt(res_lines.join("\n"))];
        }
        return [rt.txt(text)];
    }
    const resitems: Generic.Richtext.Span[] = [];
    let filled_idx = 0;
    const fillUnstyledTo = (endv: number) => {
        const nofmt = textsplit.slice(filled_idx, endv).join("");
        if(nofmt.length > 0) resitems.push(rt.txt(nofmt));
    };
    const textsplit = [...text];
    format.forEach(([format_mode, start, length]) => {
        fillUnstyledTo(start);
        filled_idx = start + length;
        const fmt = textsplit.slice(start, start + length).join(""); // .substr cannot be used because start refers to codepoint index and not utf-16 index

        const resstyl = richtextStyle(format_mode);
        if(resstyl.error != null) {
            resitems.push(rt.error(fmt, resstyl.error));
        }else if(resstyl.code) {
            resitems.push(rt.code(fmt));
        }else{
            resitems.push(rt.txt(fmt, {
                strong: resstyl.strong,
                emphasis: resstyl.emphasis,
                strikethrough: resstyl.strike,
                superscript: resstyl.super,
            }));
        }
    });
    fillUnstyledTo(textsplit.length);
    return resitems;
}
function richtextSpan(rtd: Reddit.Richtext.Span, opt: RichtextFormattingOptions): Generic.Richtext.Span[] {
    switch(rtd.e) {
        case "text": return richtextFormattedText(rtd.t, rtd.f ?? [], opt);
        case "r/": case "u/": return [
            rt.link(client, "/"+rtd.e+rtd.t, {
                is_user_link: rtd.e === "u/" ? rtd.t : undefined,
            }, rt.txt((rtd.l ? "/" : "") + rtd.e + rtd.t)),
        ];
        case "link": return [rt.link(client, rtd.u, {title: rtd.a}, ...richtextFormattedText(rtd.t, rtd.f ?? [], opt))];
        case "br": return [rt.br()];
        case "spoilertext": return [rt.spoiler(...richtextSpanArray(rtd.c, opt))];
        case "raw": return [rt.txt(rtd.t)];
        case "gif": case "img": {
            // TODO return a collapsible body segment containing the actual content
            // rather than doing this (excl. for emojis)
            const meta = opt.media_metadata[rtd.id];
            if(!meta) return [rt.error("Missing media id "+rtd.id, meta)];
            if(meta.status !== "valid") return [rt.error("Bad status "+meta.status, meta)];
            if(meta.e === "AnimatedImage") {
                return [
                    rt.link(client, meta.s.mp4 ?? meta.s.gif, {}, rt.txt("[embedded "+rtd.id.split("|")[0]+"]")),
                ];
            }else if(meta.e === "Image") {
                if(meta.t === "emoji") {
                    return [
                        {kind: "emoji", url: meta.s.u, name: ":"+rtd.id.split("|")[2]+":"},
                    ];
                }else {
                    return [
                        rt.link(client, meta.s.u, {}, rt.txt("[embedded "+rtd.id.split("|")[0]+"]")),
                    ];
                }
            }else {
                return [rt.error("Unsupported "+meta.e, meta)];
            }
        }
    }
    expectUnsupported(rtd.e);
    return [rt.error("TODO "+rtd.e, rtd)];
}
function richtextSpanArray(rtsa: Reddit.Richtext.Span[], opt: RichtextFormattingOptions): Generic.Richtext.Span[] {
    return (rtsa ?? []).flatMap(v => richtextSpan(v, opt));
}
type StyleRes = {
    strong: boolean,
    emphasis: boolean,
    strike: boolean,
    super: boolean,
    code: boolean,
    error?: undefined | string,
};
function richtextStyle(style: number): StyleRes {
    return {
        strong: !!(style & 1),
        emphasis: !!(style & 2),
        strike: !!(style & 8),
        super: !!(style & 32),
        code: !!(style & 64),
        error: style & ~0b1101011 ? "unsupported style "+style.toString(2) : undefined,
    };
}

function isLoggedIn(): boolean {
    const item = localStorage.getItem("reddit-secret");
    if(item == null || item === "") return false;
    return true;
}

function proxyURL(url: string): string {
    // warning: this code is copy/pasted in multiple files
    // search and replace all versions
    const use_mock = localStorage.getItem("--use-mock");
    if(url.startsWith("http"/*s?://*/) && use_mock != null) {
        return use_mock + url.replace(":/", "");
    }
    return url;
}
function baseURL(oauth: boolean) {
    const base = oauth ? "oauth.reddit.com" : "www.reddit.com";
    const res = "https://"+base;

    return proxyURL(res);
}
function pathURL(oauth: boolean, path: string, opts: {override?: undefined | boolean}) {
    const [pathname, query, hash] = splitURL(path);
    if(!pathname.startsWith("/")) {
        throw new Error("path didn't start with `/` : `"+path+"`");
    }
    if(opts.override ?? false) return baseURL(oauth) + pathname + query.toString();
    query.set("raw_json", "1");
    query.set("rtj", "yes"); // undefined | "yes" | "only" but it turns out in listings eg /r/subreddit.json rtj=only cuts off after like 10 paragraphs but rtj=yes doesn't weird
    query.set("emotes_as_images", "true"); // enables sending {t: "gif"} span elements in richtext rather than sending a link
    query.set("gilding_detail", "1"); // not sure what this does but new.reddit sends it in an oauth.reddit.com request so it sounds good
    query.set("profile_img", "true"); // profile images
    const res = baseURL(oauth) + pathname + ".json?"+query.toString() + (hash === "" ? "" : "#"+hash);
    return res;
}

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

let running_get_access_token: ((res: string | null) => void)[] = [];

function getAccessToken() {
    return new Promise(r => {
        running_get_access_token.push(r);
        if(running_get_access_token.length === 1) getAccessTokenInternal().then(res => {
            running_get_access_token.forEach(v => v(res));
            running_get_access_token = [];
        }).catch(e => {
            console.log("Get access token error", e);
            
            running_get_access_token.forEach(v => v(null));
            running_get_access_token = [];
        });
    });
}

function generateDeviceID(): string {
    return [...crypto.getRandomValues(new Uint8Array(25))].map(v => v.toString(16).padStart(2, "0")).join("");
}

async function getAccessTokenInternal() {

    const data = localStorage.getItem("reddit-secret");
    if(data === "" || data == null) {
        const app_data = localStorage.getItem("reddit-app-data");

        let device_id: string;

        if(app_data != null) {
            const parsed = JSON.parse(app_data) as {
                access_token: string,
                expires: number,
                scope: string,
                device_id: string,
            };
            if(parsed.expires < Date.now()) {
                device_id = parsed.device_id;
            }else return parsed.access_token;
        }else{
            device_id = generateDeviceID();
        }
        

        const v = await fetch("https://www.reddit.com/api/v1/access_token", {
            method: "POST", mode: "cors", credentials: "omit",
            headers: {
                'Authorization': "Basic "+btoa(reddit_app_id+":"),
                'Content-Type': "application/x-www-form-urlencoded",
            },
            body: encodeQuery({
                grant_type: "https://oauth.reddit.com/grants/installed_client",
                device_id,
                redirect_uri,
            }),
        }).then(r => r.json()) as Reddit.AccessToken;

        if(v.error) {
            console.log(v);
            throw new Error("error: "+JSON.stringify(v));
        }

        const res_data: {
            access_token: string,
            expires: number,
            scope: string,
            device_id: string,
        } = {
            access_token: v.access_token,
            expires: Date.now() + (v.expires_in * 1000),
            scope: v.scope,
            device_id,
        };

        localStorage.setItem("reddit-app-data", JSON.stringify(res_data));

        return res_data.access_token;
    }
    const json = JSON.parse(data) as {
        access_token: string,
        expires: number,
        refresh_token: string,
        scope: string,
    };
    // TODO rather than relying on the system clock, update the token if a request returns a old token error
    if(json.expires < Date.now()) {
        // refresh token
        console.log("Token expired, refreshing…");
        const [status, v] = await fetch("https://www.reddit.com/api/v1/access_token", {
            method: "POST", mode: "cors", credentials: "omit",
            headers: {
                'Authorization': "Basic "+btoa(reddit_app_id+":"),
                'Content-Type': "application/x-www-form-urlencoded",
            },
            body: encodeURL`grant_type=refresh_token&refresh_token=${json.refresh_token}`,
        }).then(async (res) => {
            return [res.status, await res.json() as {
                access_token: string,
                refresh_token?: undefined | string,
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
}

async function getAuthorization() {
    const access_token = await getAccessToken();
    if(access_token == null) return "";
    return "Bearer "+access_token;
}

export function createSubscribeAction(subreddit: string, subscribers: number, you_subbed: boolean): Generic.CounterAction {
    return {
        kind: "counter",
        client_id: client.id,

        increment: {
            icon: "join",
            color: "white",
            label: "Subscribe",
            undo_label: "Unsubscribe",
            // done_label: "Subscribed"
        },
        decrement: null,

        unique_id: "/subscribe/"+subreddit+"/",
        time: Date.now(),

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
function sidebarWidgetToGenericWidget(data: Reddit.Widget, subreddit: string): Generic.ContentNode {
    try {
        return sidebarWidgetToGenericWidgetTry(data, subreddit);
    }catch(e) {
        console.log("widget error", e);
        return {
            kind: "widget",
            title: "Error!",
            raw_value: data,
            widget_content: {kind: "body", body: {
                kind: "richtext",
                content: [rt.p(rt.error("Uh oh! Error "+(e as Error).toString(), data))],
            }},
        };
    }
}

function sidebarWidgetToGenericWidgetTry(data: Reddit.Widget, subreddit: string): Generic.ContentNode {
    if(data.kind === "moderators") return {
        kind: "widget",
        title: "Moderators",
        raw_value: data,
        widget_content: {
            kind: "body",
            body: {
                kind: "richtext",
                content: [
                    rt.p(
                        rt.link(client, "/message/compose?to=/r/"+subreddit,
                            {style: "pill-empty"},
                            rt.txt("Message the mods"),
                        ),
                    ),
                    rt.ul(...data.mods.map(mod => rt.li(rt.p(
                        rt.link(client, "/u/"+mod.name, {is_user_link: mod.name}, rt.txt("u/"+mod.name)),
                        ...flairToGenericFlair({
                            type: mod.authorFlairType, text: mod.authorFlairText, text_color: mod.authorFlairTextColor,
                            background_color: mod.authorFlairBackgroundColor, richtext: mod.authorFlairRichText,
                        }).flatMap(flair => [rt.txt(" "), rt.flair(flair)]),
                    )))),
                    rt.p(rt.link(client, "/r/"+subreddit+"/about/moderators", {}, rt.txt("View All Moderators"))),
                ],
            },
        },
    }; else if(data.kind === "community-list") return {
        kind: "widget",
        title: data.shortName,
        raw_value: data,
        widget_content: {
            kind: "list",
            items: data.data.map((sub): Generic.WidgetListItem => {
                if(sub.type === "subreddit") return {
                    icon: sub.communityIcon || sub.iconUrl || undefined,
                    name: {kind: "text", text: "r/"+sub.name},
                    click: {kind: "link", url: "/r/"+sub.name},
                    action: createSubscribeAction(sub.name, sub.subscribers, sub.isSubscribed),
                };
                expectUnsupported(sub.type);
                return {
                    name: {kind: "text", text: "ERROR UNSUPPORTED" + sub.type},
                    click: {kind: "body", body: {kind: "richtext", content: [
                        rt.pre(JSON.stringify(sub, null, "\t"), "json"),
                    ]}},
                };
            }),
        },
    }; else if(data.kind === "id-card") return {
        kind: "widget",
        title: "Error!",
        raw_value: data,
        widget_content: {kind: "body", body: {
            kind: "richtext",
            content: [rt.p(rt.error("Not supported "+data.kind, data))],
        }},
    }; else if(data.kind === "menu") return {
        kind: "widget",
        title: "Error!",
        raw_value: data,
        widget_content: {kind: "body", body: {
            kind: "richtext",
            content: [rt.p(rt.error("Uh oh! TODO widget "+data.kind, data))],
        }},
    }; else if(data.kind === "textarea") return {
        kind: "widget",
        title: data.shortName,
        raw_value: data,
        widget_content: {kind: "body", body: {kind: "text",
            client_id: client.id, content: data.textHtml, markdown_format: "reddit_html",
        }},
    }; else if(data.kind === "subreddit-rules") return {
        kind: "widget",
        title: data.shortName,
        raw_value: data,
        widget_content: {kind: "list", items: data.data.map((rule, i) => ({
            name: {kind: "text", text: "" + (i + 1) + ". " + rule.shortName},
            click: {kind: "body", body: {kind: "text",
                client_id: client.id, content: rule.descriptionHtml, markdown_format: "reddit_html",
            }},
        }))},
    }; else if(data.kind === "image") return {
        kind: "widget", // TODO seperate fullscreen_widget or not
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
        widget_content: {kind: "list", items: data.order.map((id): Generic.WidgetListItem => {
            const val = data.templates[id]!;
            const flairv = flairToGenericFlair({
                type: val.type, text: val.text, text_color: val.textColor,
                background_color: val.backgroundColor, richtext: val.richtext,
            });
            if(flairv.length !== 1) {
                console.log("bad flair", val, flairv);
                return {
                    name: {kind: "text", text: "error bad flair"},
                    click: {kind: "body", body: {kind: "richtext", content: [
                        rt.p(rt.error("bad flair", [val, flairv])),
                    ]}}
                };
            }
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
            above_text: {
                kind: "text",
                content: data.descriptionHtml,
                client_id: client.id,
                markdown_format: "reddit_html",
            },
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
    }; else if(data.kind === "calendar") return {
        kind: "widget",
        title: data.shortName,
        raw_value: data,
        widget_content: {kind: "body", body: {
            kind: "array",
            body: data.data.flatMap((item, i): Generic.Body[] => {
                return [
                    ...i !== 0 ? [{kind: "richtext", content: [rt.hr()]}] as const : [],
                    {kind: "text", client_id: client.id, content: item.titleHtml, markdown_format: "reddit_html"},
                    {kind: "richtext", content: [rt.p(rt.timeAgo(item.startTime * 1000))]},
                    ...item.locationHtml != null ? [
                        {kind: "text" as const, client_id: client.id, content: item.locationHtml, markdown_format: "reddit_html" as const}
                    ] : [],
                    ...item.descriptionHtml != null ? [
                        {kind: "text" as const, client_id: client.id, content: item.descriptionHtml, markdown_format: "reddit_html" as const}
                    ] : [],
                ];
            }),
        }},
    };
    expectUnsupported(data.kind);
    return {
        kind: "widget",
        title: "Error!",
        raw_value: data,
        widget_content: {kind: "body", body: {kind: "richtext", content: [rt.p(rt.error("Uh oh! Unsupported widget "+data.kind, data))]}},
    };
}
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
            {
                kind: "link",
                url: "/r/"+subreddit+"/submit?--tc-view=page2",
                client_id: client.id,
                text: "Create Post",
                page1_style: "pill-empty",
            },
        ],
    };
}
function oldSidebarWidget(t5: Reddit.T5, subreddit: string, {collapsed}: {collapsed: boolean}): Generic.ContentNode {
    return {
        kind: "thread",
        raw_value: t5,
        body: {kind: "text", client_id: client.id, markdown_format: "reddit_html", content: t5.data.description_html},
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
    //             markdown_format: "reddit_html",
    //             content: t5.data.description_html,
    //         },
    //     },
    // };
}
function sidebarFromWidgets(subinfo: SubInfo): Generic.ContentNode[] {
    const widgets = subinfo.widgets;

    const getItem = (id: string): Reddit.Widget => {
        const resv = widgets!.items[id];
        if(!resv) throw new Error("bad widget "+id);
        return resv;
    };

    const wrap = (data: Reddit.Widget): Generic.ContentNode => sidebarWidgetToGenericWidget(data, subinfo.subreddit);
    
    // TODO moderator widget
    const res: Generic.ContentNode[] = [
        // ...widgets ? widgets.layout.topbar.order.map(id => wrap(getItem(id))) : [],
        // ...widgets ? [wrap(getItem(widgets.layout.idCardWidget))] : [],
        ...subinfo.sub_t5 ? [customIDCardWidget(subinfo.sub_t5, subinfo.subreddit)] : [],
        ...subinfo.sub_t5 ? [oldSidebarWidget(subinfo.sub_t5, subinfo.subreddit, {collapsed: widgets ? true : false})] : [],
        ...widgets ? widgets.layout.sidebar.order.map(id => wrap(getItem(id))) : [],
        ...widgets ? [wrap(getItem(widgets.layout.moderatorWidget))] : [],
    ];
    if(res.length === 0) {
        res.push({
            kind: "widget",
            title: "Error",
            widget_content: {kind: "body", body: {kind: "richtext", content: [
                rt.p(rt.txt("Failed to fetch sidebar for this page :(")),
            ]}},
            raw_value: subinfo,
        });
    }
    return res;
}


function subredditHeader(subinfo: SubInfo | undefined): Generic.ContentNode {
    if(!subinfo) return {
        kind: "thread",
        title: {text: "Listing"},
        body: {kind: "text", client_id: client.id, content: "Listing", markdown_format: "none"},
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
    return {kind: "page2_identity_card", data: subredditHeaderExists(subinfo)};
}
export function subredditHeaderExists(subinfo: SubInfo): Generic.FilledIdentityCard {
    const res_menu: Generic.MenuItem[] = [
        {text: "Posts", action: {kind: "link", client_id: client.id, url: "/r/"+subinfo.subreddit}, selected: true}
    ];

    wdgs: if(subinfo.widgets) {
        const order_len = subinfo.widgets?.layout.topbar.order.length;
        if(order_len === 0) break wdgs;
        if(order_len !== 1) {
            res_menu.push({text: "ERROR Topbar Order", action: {kind: "link", client_id: client.id, url: "error"}, selected: false});
            break wdgs;
        }
        const menu = subinfo.widgets.items[subinfo.widgets.layout.topbar.order[0]!]!;
        
        if(menu.kind !== "menu") {
            res_menu.push({text: "ERROR Topbar Item", action: {kind: "link", client_id: client.id, url: "error"}, selected: false});
            break wdgs;
        }

        if(menu.showWiki) {
            res_menu.push(
                {text: "Wiki", action: {kind: "link", client_id: client.id, url: "/r/"+subinfo.subreddit+"/wiki/index"}, selected: false}, // true if the path looks like /wiki
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
                action: {kind: "link", client_id: client.id, url: data_item.url}
            };
            assertNever(data_item); // expectNever could be better
        };

        res_menu.push(...menu.data.map(data_item => ({...redditMenuToMenu(data_item), selected: false})));
    }

    return {
        names: {
            display: subinfo.sub_t5?.data.title ?? null,
            raw: subinfo.sub_t5 ? subinfo.sub_t5.data.display_name_prefixed : "r/"+subinfo.subreddit,
        },
        pfp: subinfo.sub_t5 != null ? subPfp(subinfo.sub_t5.data) : null,
        theme: {
            banner: subinfo.sub_t5 != null ? subBanner(subinfo.sub_t5.data) : null,
        },
        description: {
            kind: "text",
            markdown_format: "none",
            content: subinfo.sub_t5?.data.public_description ?? "[not loaded?]",
            client_id: client.id,
        },
        actions: {
            main_counter: subinfo.sub_t5 ? createSubscribeAction(subinfo.subreddit, subinfo.sub_t5.data.subscribers, subinfo.sub_t5.data.user_is_subscriber ?? false) : null,
        },
        menu: res_menu.length === 1 ? null : res_menu,
        raw_value: subinfo,
    };
}

type DeferredInbox = {
    kind: "inbox",
} | {
    kind: "modmail",
};
const deferred_inbox = encoderGenerator<DeferredInbox, "deferred_inbox">("deferred_inbox");

export type SubInfo = {
    subreddit: string,
    widgets: Reddit.ApiWidgets | null,
    sub_t5: Reddit.T5 | null,
};
export function rawlink(path: string): string {
    if(path.startsWith("/mod/")) return "raw!https://mod.reddit.com"+path.replace("/mod/", "");
    return "raw!https://www.reddit.com"+path;
}
export function getNavbar(page_url: string | null): Generic.Navbar {
    const always_actions: Generic.Action[] = page_url != null ? [
        {kind: "link", text: "View on reddit.com", url: rawlink(page_url), client_id: client.id},
    ] : [];
    if(isLoggedIn()) return {
        actions: [{kind: "act", client_id: client.id, action: act_encoder.encode({kind: "log_out"}), text: "Log Out"}, ...always_actions],
        inboxes: [
            {
                id: "/messages",
                name: "Messages",
                active_color: "orange",
                hydrate: deferred_inbox.encode({kind: "inbox"}),
                url: "/message/inbox",
            },
            {
                id: "/modmail",
                name: "Modmail",
                active_color: "green",
                hydrate: deferred_inbox.encode({kind: "modmail"}),
                url: "/mod/mail/all",
            },
        ],
        client_id,
    };
    return {
        actions: [
            {kind: "link", client_id: client.id, url: getLoginURL(), text: "Log In", ...always_actions},
            {kind: "link", client_id: client.id, url: "raw!https://www.reddit.com/register", text: "Sign Up"},
            ...always_actions,
        ],
        inboxes: [],
        client_id,
    };
}
function pathFromListingRaw(
    path: string,
    listing: unknown,
    opts: {
        warning?: undefined | Generic.Richtext.Paragraph[],
        sidebar: Generic.ContentNode[] | null,
    },
): Generic.Page {
    const rtitems: Generic.Richtext.Paragraph[] = [];
    if(opts.warning) rtitems.push(...opts.warning);
    return {
        title: "Error View",
        navbar: getNavbar(path),
        body: {
            kind: "one",
            item: {
                parents: [{
                    kind: "thread",
                    raw_value: listing,
                    body: {kind: "richtext", content: [
                        ...rtitems,
                        rt.pre(JSON.stringify(listing, null, "\t"), "json"),
                    ]},
                    display_mode: {body: "visible", comments: "visible"},
                    link: path,
                    layout: "error",
                    actions: [],
                    default_collapsed: false,
                }],
                replies: [],
            },
        },
        sidebar: opts.sidebar ?? undefined,
        display_style: "comments-view",
    };
}

// TODO pass in menu rather than generating it here
export function pageFromListing(
    pathraw: string,
    parsed_path_in: ParsedPath,
    listing: Reddit.AnyResult,
    opts: {
        header?: undefined | Generic.ContentNode,
        sidebar: Generic.ContentNode[] | null,
    },
): Generic.Page {
    const page = parsed_path_in;
    if(Array.isArray(listing)) {
        if(listing[0].data.children.length !== 1) {
            return pathFromListingRaw(pathraw, listing, {sidebar: opts.sidebar, warning: urlNotSupportedYet(pathraw)});
        }
        const firstchild = listing[0].data.children[0]!;
        if(firstchild.kind !== "t3") {
            return pathFromListingRaw(pathraw, listing, {sidebar: opts.sidebar, warning: urlNotSupportedYet(pathraw)});
        }

        const link_fullname = firstchild.data.name as `t3_${string}`;
        const default_sort: Reddit.Sort = firstchild.data.suggested_sort ?? "confidence";
        const is_contest_mode = firstchild.data.contest_mode;
        const can_mod_post = firstchild.data.can_mod_post;
        const permalink: string = firstchild.data.permalink;
        const is_locked = firstchild.data.locked;
        const is_chat = firstchild.data.discussion_type === "CHAT";

        const children_root = listing[1].data.children;
        const header_children: Generic.Node[] = [];
        const root0 = children_root[0];
        if(root0 && root0.kind === "t1" && root0.data.parent_id !== link_fullname) {
            header_children.push(loadMoreContextNode(root0.data.subreddit, (link_fullname ?? "").replace("t3_", ""), root0.data.parent_id.replace("t1_", "")));
        }
        let replies = children_root.map(child => threadFromListing(child, {link_fullname}, {permalink: permalink, sort: default_sort, is_chat}));

        if(page.kind === "comments" && page.focus_comment != null) {
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
                if(val_id === page.focus_comment) {
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
        }
        if(listing[1].data.after != null) {
            replies.push({kind: "load_more", url: "TODO", load_more: load_more_encoder.encode({kind: "duplicates", lmurl: "todo"}), raw_value: listing[1]});
        }

        let menu: Generic.Menu;
        if(page.kind === "comments") {
            if(is_contest_mode && !can_mod_post) {
                menu = [{
                    selected: true,
                    text: "Random",
                    action: {kind: "link", client_id: client.id, url: updateQuery(permalink, {sort: "random"})}
                }];
            }else{
                menu = ([
                    ["confidence", "Best"], ["top", "Top"], ["new", "New"], ["controversial", "Controversial"],
                    ["old", "Old"], ["random", "Random"], ["qa", "Q&A"], ["live", "Live"],
                ] as const).map(([sortname, sorttext]): Generic.MenuItem => ({
                    selected: (page.sort_override ?? default_sort) === sortname,
                    text: sorttext,
                    action: {kind: "link", client_id: client.id, url: updateQuery(permalink, {sort: sortname})},
                }));
            }
        }else if(page.kind === "duplicates") {
            menu = ([
                ["num_comments", "Comments"],
                ["new", "New"],
            ] as const).map(([sortname, sorttext]): Generic.MenuItem => ({
                selected: page.sort === sortname,
                text: sorttext,
                action: {kind: "link", client_id: client.id, url: updateQuery(permalink.replace("/comments", "/duplicates"), {sort: sortname})},
            }));
        }else{
            menu = [{selected: false, text: "error "+page.kind, action: {kind: "link", client_id: client.id, url: "error"}}];
        }

        return {
            title: firstchild.kind === "t3" ? firstchild.data.title : "ERR top not t3",
            navbar: getNavbar(pathraw),
            body: {
                kind: "one",
                item: {
                    parents: [
                        threadFromListing(firstchild, {force_expand: header_children.length > 0 ? "closed" : "open", show_post_reply_button: true}, {permalink, sort: "unsupported", is_chat}),
                        ...is_contest_mode ? [((): Generic.Thread => ({
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
                        }))()] : [], ...is_locked ? [((): Generic.Thread => ({
                            kind: "thread",
                            body: {
                                kind: "richtext",
                                content: [
                                    rt.p(rt.txt("This thread is locked.")),
                                    rt.p(rt.txt(can_mod_post
                                        ? "Only mods like you can comment on this thread."
                                        : "You are not able to comment on this thread."
                                    )),
                                ],
                            },
                            display_mode: {body: "visible", comments: "collapsed"},
                            raw_value: is_locked,
                            link: "no",
                            actions: [],
                            default_collapsed: false,
                            layout: "reddit-post",
                        }))()] : [], 
                        ...header_children,
                    ],
                    menu,
                    replies: replies,
                },
            },
            sidebar: opts.sidebar ?? undefined,
            display_style: "comments-view",
        };
    }
    if(listing.kind === "wikipage") {
        return {
            title: pathraw + " | Wiki",
            navbar: getNavbar(pathraw),
            body: {
                kind: "one",
                item: {
                    parents: [{
                        kind: "thread",
                        raw_value: listing,
                        body: {kind: "text", client_id: client.id, markdown_format: "reddit_html", content: listing.data.content_html},
                        display_mode: {body: "visible", comments: "visible"},
                        link: pathraw,
                        layout: "error",
                        actions: [],
                        default_collapsed: false,
                    }],
                    replies: [],
                },
            },
            sidebar: opts.sidebar ?? undefined,
            display_style: "comments-view",
        };
    }
    if(listing.kind === "t5") {
        return {
            title: pathraw + " | Sidebar",
            navbar: getNavbar(pathraw),
            body: {
                kind: "one",
                item: {parents: [{
                    kind: "thread",
                    raw_value: listing,
                    body: {kind: "text", client_id: client.id, markdown_format: "reddit_html", content: listing.data.description_html},
                    display_mode: {body: "visible", comments: "visible"},
                    link: pathraw,
                    layout: "reddit-post",
                    title: {text: "old.reddit sidebar"},
                    actions: [],
                    default_collapsed: false,
                }], replies: []},
            },
            sidebar: opts.sidebar ?? undefined,
            display_style: "comments-view",
        };
    }
    if(listing.kind === "UserList") {
        return {
            title: pathraw,
            navbar: getNavbar(pathraw),
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
                                rt.td(rt.link(client, "/u/"+child.name, {is_user_link: child.name},
                                    rt.txt("u/"+child.name),
                                )),
                                rt.td(rt.timeAgo(child.date * 1000)),
                                rt.td(...child.mod_permissions.flatMap((modperm, i) => [...i !== 0 ? [rt.txt(", ")] : [], rt.txt(modperm)])),
                            ])),
                        ]},
                        display_mode: {body: "visible", comments: "visible"},
                        raw_value: listing,
                        layout: "reddit-post",
                        link: pathraw,
                        actions: [],
                        default_collapsed: false,
                    }],
                    replies: [],
                },
            },
            sidebar: opts.sidebar ?? undefined,
            display_style: "comments-view",
        };
    }
    if(listing.kind === "Listing") {
        if(listing.data.before != null){
            // TODO
        }
        let next: Generic.LoadMoreUnmounted | undefined;
        if(listing.data.after != null) {
            const next_path = updateQuery(pathraw, {before: undefined, after: listing.data.after});
            next = {kind: "load_more_unmounted", load_more_unmounted: load_more_unmounted_encoder.encode({kind: "listing", url: next_path}), url: next_path, count: undefined, raw_value: listing};
        }
        
        const user_sorted_tabs_named = [
            ["overview", "Overview"], ["comments", "Comments"], ["submitted", "Submitted"],
            // ["gilded", "Gilded"],
        ] as const;
        const user_sortless_tabs_named = [
            ["upvoted", "Upvoted"], ["downvoted", "Downvoted"], ["hidden", "Hidden"],
            ["saved", "Saved"],
        ] as const;

        // TODO for /message/messages/…, a "one" should be returned rather than a "listing"
        // - parents: starting message..permalinked message
        // - replies: permalinked message + 1..

        return {
            title: pathraw,
            navbar: getNavbar(pathraw),
            body: {
                kind: "listing",
                menu: page.kind === "subreddit" ? [{
                    selected: page.current_sort.v === "hot",
                    text: "Hot",
                    action: {kind: "link", client_id: client.id, url: "/"+[...page.sub.base, ...page.is_user_page ? ["hot"] : []].join("/")},
                }, {
                    selected: page.current_sort.v === "best",
                    text: "Best",
                    action: {kind: "link", client_id: client.id, url: "/"+[...page.sub.base, "best"].join("/")},
                }, {
                    selected: page.current_sort.v === "new",
                    text: "New",
                    action: {kind: "link", client_id: client.id, url: "/"+[...page.sub.base, "new"].join("/")},
                }, {
                    selected: page.current_sort.v === "rising",
                    text: "Rising",
                    action: {kind: "link", client_id: client.id, url: "/"+[...page.sub.base, "rising"].join("/")},
                }, ...[["top", "Top"] as const, ["controversial", "Controversial"] as const].map(([url, text]): Generic.MenuItem => ({
                    selected: page.current_sort.v === url,
                    text: page.current_sort.v === url ? (text + " ("+page.current_sort.t+")") : text,
                    action: {kind: "menu", children: ([
                        ["hour", "Hour"], ["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"], ["all", "All Time"]
                    ] as const).map(([time, time_text]): Generic.MenuItem => ({
                        text: time_text,
                        selected: page.current_sort.v === url && page.current_sort.t === time,
                        action: {kind: "link", client_id: client.id, url: "/"+[...page.sub.base, url].join("/")+"?t="+time},
                    }))},
                }))] : page.kind === "user" ? [...user_sorted_tabs_named.map(([tab, tabname]): Generic.MenuItem => ({
                    // huh this needs two menus
                    selected: page.current.tab === tab,
                    text: tabname,
                    action: {kind: "show-line-two", children: [
                        {
                            selected: page.current.tab === tab && page.current.sort.sort === "hot",
                            text: "Hot",
                            action: {kind: "link", client_id: client.id, url: updateQuery("/"+["u", page.username, tab].join("/"), {sort: "hot"})},
                        },
                        {
                            selected: page.current.tab === tab && page.current.sort.sort === "new",
                            text: "New",
                            action: {kind: "link", client_id: client.id, url: updateQuery("/"+["u", page.username, tab].join("/"), {sort: "new"})},
                        },
                        ...[["top", "Top"] as const, ["controversial", "Controversial"] as const].map(([url, text]): Generic.MenuItem => ({
                            selected: page.current.tab === tab && page.current.sort.sort === url,
                            text: page.current.tab === tab && page.current.sort.sort === url ? (text + " ("+page.current.sort.t+")") : text,
                            action: {kind: "menu", children: ([
                                ["hour", "Hour"], ["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"], ["all", "All Time"]
                            ] as const).map(([time, time_text]): Generic.MenuItem => ({
                                text: time_text,
                                selected: page.current.tab === tab && page.current.sort.sort === url && page.current.sort.t === time,
                                action: {kind: "link", client_id: client.id, url: updateQuery("/"+["u", page.username, tab].join("/"), {sort: url, t: time})},
                            }))},
                        }))
                    ]}
                    // action: {kind: "link", client_id: client.id, url: "/"+[...menu_kind.base, ...tab === "overview" ? [] : [tab]].join("/")},
                })), {
                    selected: page.current.tab === "gilded",
                    text: "Gilded",
                    action: {kind: "show-line-two", children: [{
                        selected: page.current.tab === "gilded" && page.current.by === "received",
                        text: "Received",
                        action: {kind: "link", client_id: client.id, url: "/"+["u", page.username, "gilded"].join("/")}
                    }, {
                        selected: page.current.tab === "gilded" && page.current.by === "given",
                        text: "Given",
                        action: {kind: "link", client_id: client.id, url: "/"+["u", page.username, "gilded", "given"].join("/")}
                    }]},
                }, ...user_sortless_tabs_named.map(([tab, tabname]): Generic.MenuItem => ({
                    selected: page.current.tab === tab,
                    text: tabname,
                    action: {kind: "link", client_id: client.id, url: "/"+["u", page.username, tab].join("/")},
                }))] : page.kind === "inbox" ? [{
                    selected: page.current.tab === "compose",
                    text: "Compose",
                    action: {kind: "link", client_id: client.id, url: "/message/compose"},
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
                        action: {kind: "link", client_id: client.id, url: "/message/"+url}
                    }))},
                }, {
                    selected: page.current.tab === "sent",
                    text: "Sent",
                    action: {kind: "link", client_id: client.id, url: "/message/sent"},
                }] : [
                    {text: "Error! "+page.kind, selected: false, action: {kind: "link", client_id: client.id, url: pathraw}},
                ],
                header: opts.header ?? {
                    kind: "thread",
                    title: {text: "Listing"},
                    body: {kind: "text", client_id: client.id, content: "Listing", markdown_format: "none"},
                    display_mode: {body: "collapsed", comments: "collapsed"},
                    link: "TODO no link",
                    layout: "error",
                    actions: [],
                    default_collapsed: false,
                    raw_value: page,
                },
                items: page.kind === "inbox"
                    ? listing.data.children.map(child => topLevelThreadFromInboxMsg(child as unknown as Reddit.InboxMsg))
                    : listing.data.children.map(child => topLevelThreadFromListing(child, undefined, {permalink: pathraw, sort: "unsupported", is_chat: false}))
                ,
                next,
            },
            sidebar: opts.sidebar ?? undefined,
            display_style: "fullscreen-view",
        };
    }
    expectUnsupported(listing.kind);
    return pathFromListingRaw(pathraw, listing, {sidebar: opts.sidebar, warning: urlNotSupportedYet(pathraw)});
}

export function urlNotSupportedYet(pathraw: string): Generic.Richtext.Paragraph[] {
    const ismod = pathraw.startsWith("/mod/") || pathraw.startsWith("/mod?") || pathraw.startsWith("/mod#") || pathraw === "/mod"; // kinda hack
    if(ismod) {
        pathraw = pathraw.replace("/mod", "");
    }
    return [
        rt.h1(rt.txt("This url is not supported yet")),
        ismod ? rt.h2(
            rt.txt("View it on mod.reddit.com: "),
            rt.link(client, "raw!https://mod.reddit.com"+pathraw, {}, rt.txt("mod.reddit.com"+pathraw)),
        ) : rt.h2(
            rt.txt("View it on reddit.com: "),
            rt.link(client, "raw!https://www.reddit.com"+pathraw, {}, rt.txt("reddit.com"+pathraw)),
        ),
        rt.p(
            rt.txt("Submit an issue "),
            rt.link(client, "https://github.com/pfgithub/threadclient/issues", {}, rt.txt("here")),
            rt.txt(" if you would like to see this supported. Mention the url: "),
            rt.code(pathraw),
        ),
    ];
}

export type SubSort = {v: Reddit.SortMode, t: Reddit.SortTime};
export type PostSort = {v: Reddit.Sort};

export type InboxTab = {
    tab: "compose",
    // uh oh compose is not a json listing (it's a 404) so this parsing
    // needs to happen above pageFromListingA
    to: string | undefined,
    subject: string | undefined,
    message: string | undefined,
} | {
    tab: "inbox",
    // selfreply is "post replies". comments is "comment replies"
    inbox_tab: "inbox" | "unread" | "messages" | "comments" | "selfreply" | "mentions",
} | {
    tab: "sent",
} | {
    tab: "message",
    msgid: string,
} | {
    tab: "mod", // /message/moderator seems unused, that's what new modmail is for
};
export type ParsedPath = {
    kind: "sidebar",
    sub: SubrInfo,
} | {
    kind: "subreddit",
    sub: SubrInfo,
    current_sort: SubSort,
    is_user_page: boolean, // /u/…/hot. user subreddit pages must have /hot /new /random otherwise they will display the normal user page

    before: string | null, // fullname
    after: string | null,
} | {
    kind: "user",
    username: string,
    current: {
        kind: "sorted-tab",
        tab: "overview" | "comments" | "submitted",
        sort: {sort: Reddit.SortMode | "unsupported", t: Reddit.SortTime},
        // overview defaults ?sort=new
        // comments defaults ?sort=new
        // submitted defaults ?sort=hot
    } | {
        kind: "gild-tab",
        tab: "gilded",
        by: "received" | "given" | "unsupported",
        // /gilded/ : received
        // /gilded/reveived
        // /gilded/given
    } | {
        kind: "unsorted-tab",
        tab: "upvoted" | "downvoted" | "hidden" | "saved",
    },
} | {
    kind: "inbox",
    current: InboxTab,
} | {
    kind: "link_out",
    out: string,
} | {
    kind: "todo",
    msg: string,
    path: string,
} | {
    kind: "redirect",
    to: string,
} | {
    kind: "raw",
    path: string,
} | {
    kind: "duplicates",
    sub: SubrInfo, // if this is 'home', the page must be fetched before the subreddit is known.
    post_id_unprefixed: string,
    after: string | null,
    before: string | null,
    sort: Reddit.DuplicatesSort | null,
    crossposts_only: boolean,
} | {
    kind: "comments",
    sub: SubrInfo, // if this is 'home', the page must be fetched before the subreddit is known
    post_id_unprefixed: string,
    focus_comment: string | null, // unprefixed id | null
    // /comments/:post_id_unprefixed.json?comment=:focus_comment
    sort_override: Reddit.Sort | null,
    context: string | null,
} | {
    kind: "wiki",
    sub: SubrInfo,
    path: string[],
    query: {[key: string]: string},
} | {
    kind: "subreddits",
    value: {
        tab: "mine",
        subtab: "subscriber" | "contributor" | "moderator",
    } | {
        tab: "new",
    } | {
        tab: "popular",
    },
} | {
    kind: "submit",
    sub: SubrInfo,
};

export type SubrInfo = {
    kind: "homepage",
    base: string[],
} | {
    kind: "userpage",
    base: string[],
    user: string,
} | {
    kind: "multireddit",
    base: string[],
    user: string,
    multireddit: string,
} | {
    kind: "subreddit",
    base: string[],
    subreddit: string,
} | {
    kind: "mod",
    base: string[],
} | {
    kind: "error",
    base: string[],
    pathraw: string,
};

type LoadMoreUnmountedData = {
    kind: "listing",
    url: string,
} | {
    kind: "TODO more",
};
const load_more_unmounted_encoder = encoderGenerator<LoadMoreUnmountedData, "load_more_unmounted">("load_more_unmounted");

type LoadMoreData = {
    kind: "api_loadmore",
    link_fullname: `t3_${string}`,
    children: string[],
    parent_permalink: SortedPermalink,
} | {
    kind: "parent_permalink",
    permalink: string,
    // TODO change this
    // kind: "parent",
    // comment_fullname?: string,
    // link_fullname: string,
} | {
    kind: "context",
    subreddit: string,
    link_id: string,
    parent_id: string,
} | {
    kind: "duplicates",
    lmurl: string,
    // TODO change this
    // all the query params + after: string
};
const load_more_encoder = encoderGenerator<LoadMoreData, "load_more">("load_more");
export function getPointsOn(listing: {
    name: string,
    score_hidden?: undefined | boolean,
    hide_score?: undefined | boolean,
    score: number,
    likes: true | false | null,
    upvote_ratio?: undefined | number,
    archived?: undefined | boolean,
}): Generic.CounterAction {
    // not sure what rank is for
    const vote_data = {id: listing.name, rank: "2"};
    return {
        kind: "counter",
        client_id: client.id,

        unique_id: "/vote/"+listing.name+"/",
        time: Date.now(),

        increment: {
            icon: "up_arrow",
            color: "orange",
            label: "Upvote",
            undo_label: "Undo Upvote",
            // done_label: "Upvoted"
        },
        decrement: {
            icon: "down_arrow",
            color: "indigo",
            label: "Downvote",
            undo_label: "Undo Downvote",
            // done_label: "Downvoted"
        },

        special: "reddit-points",

        count_excl_you: (listing.score_hidden ?? listing.hide_score ?? false) && listing.score === 1
            ? "hidden"
            : listing.score + (listing.likes === true ? -1 : listing.likes === false ? 1 : 0)
        ,
        you: listing.likes === true ? "increment" : listing.likes === false ? "decrement" : undefined,

        percent: listing.upvote_ratio,
        actions: listing.archived ?? false ? {error: "archived <6mo"} : {
            increment: encodeVoteAction({...vote_data, dir: "1"}),
            decrement: encodeVoteAction({...vote_data, dir: "-1"}),
            reset: encodeVoteAction({...vote_data, dir: "0"}),
        },
    };
}

function threadFromInboxMsg(inbox_msg: Reddit.InboxMsg): Generic.Node {
    if(inbox_msg.kind === "t1" || inbox_msg.kind === "t4") {
        const msg = inbox_msg.data;
        return {
            kind: "thread",
            info: {
                time: msg.created_utc * 1000,
                edited: false,
                author: msg.author != null ? {
                    name: "u/"+msg.author,
                    link: "/u/"+msg.author,
                    color_hash: msg.author,
                    client_id: client.id,
                } : undefined,
                pinned: false,
            },
            body: {kind: "text", client_id: client.id, content: msg.body_html, markdown_format: "reddit_html"},
            display_mode: {body: "visible", comments: "collapsed"},
            link: msg.context,
            layout: "reddit-comment",
            default_collapsed: false,
            actions: [
                ...inbox_msg.kind === "t1" ? [getPointsOn(msg)] : [],
                ...msg.context ? [{kind: "link", client_id: client.id, url: msg.context, text: "Context"} as const] : [],
                ...inbox_msg.kind === "t4" ? [{kind: "link", client_id: client.id, url: "/message/messages/"+msg.id, text: "Permalink"} as const] : [],
                {
                    kind: "counter",
                    client_id: client.id,

                    neutral_icon: "envelope_open",

                    increment: {
                        icon: "envelope",
                        color: "white",
                        label: "Mark Unread",
                        undo_label: "🠶 New",
                        // undo_label: "Mark Read"
                        // done_label: "🠶 New"
                    },
                    decrement: null,

                    count_excl_you: "none",
                    you: msg.new ? "increment" : undefined,
                    unique_id: "/unread/"+msg.name+"/",
                    time: Date.now(),
                    actions: {
                        increment: act_encoder.encode({kind: "mark_read", direction: "un", fullname: msg.name}),
                        reset: act_encoder.encode({kind: "mark_read", direction: "", fullname: msg.name}),
                    },
                },
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

function topLevelThreadFromInboxMsg(inbox_msg: Reddit.InboxMsg): Generic.UnmountedNode {
    if(inbox_msg.kind === "t1" || inbox_msg.kind === "t4") {
        const msg = inbox_msg.data;
        // TODO display the link title
        // t1:
        // - msg.link_title
        // and then also put the load more thing
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
}

function topLevelThreadFromListing(listing_raw: Reddit.Post, options: ThreadOpts = {}, parent_permalink: SortedPermalink): Generic.UnmountedNode {
    const res = threadFromListing(listing_raw, options, parent_permalink);
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
                        client_id: client.id,
                    },
                    pinned: false,
                },
                body: {kind: "link", client_id: client.id, url: listing_raw.data.link_permalink},
                display_mode: {body: "visible", comments: "collapsed"},
                link: listing_raw.data.link_permalink,
                layout: "reddit-post",
                default_collapsed: false,
                actions: [{kind: "link", client_id: client.id, url: listing_raw.data.link_permalink, text: "Permalink"}],
                raw_value: listing_raw,
                replies: [],
            }, ...(listing_raw.data.parent_id === listing_raw.data.link_id
                ? []
                : [loadMoreContextNode(listing_raw.data.subreddit, listing_raw.data.link_id.replace("t3_", ""), listing_raw.data.parent_id.replace("t1_", ""))]
            ), res],
            replies: [],
        };
    }
    return {
        parents: [res],
        replies: [],
    };
}
function loadMoreContextNode(subreddit: string, link_id: string, parent_id: string): Generic.LoadMore {
    return {
        kind: "load_more",
        load_more: load_more_encoder.encode({kind: "context", subreddit: subreddit, link_id, parent_id}),
        url: "/r/"+subreddit+"/comments/" + link_id + "?comment="+parent_id.replace("t1_", "")+"&context=8",
        raw_value: [subreddit, link_id, parent_id],
    };
}
function threadFromListing(listing_raw: Reddit.Post, options: ThreadOpts = {}, parent_permalink: SortedPermalink): Generic.Node {
    try {
        const res = threadFromListingMayError(listing_raw, options, parent_permalink);
        return res;
    }catch(e) {
        console.log(e);
        return {
            kind: "thread",
            body: {kind: "richtext", content: [rt.p(rt.error("Error! "+(e as Error).toString(), e))]},
            display_mode: {body: "visible", comments: "visible"},
            raw_value: {error: e as Error, listing: listing_raw},
            link: "Error!",
            layout: "error",
            actions: [],
            default_collapsed: false,
        };
    }
}
export function deleteButton(fullname: string): Generic.Action {
    return {
        kind: "delete",
        client_id: client.id,
        data: encodeDeleteAction(fullname),
    };
}
type ReportInfo = {
    subreddit: string,
    fullname: string,
};
const report_encoder = encoderGenerator<ReportInfo, "report">("report");
export function reportButton(fullname: string, subreddit: string): Generic.Action {
    return {
        kind: "report",
        client_id: client.id,
        data: report_encoder.encode({subreddit, fullname}),
    };
}
export function replyButton(fullname: string): Generic.ReplyAction {
    return {
        kind: "reply",
        client_id: client.id,
        key: "reply-"+fullname,
        text: "Reply",
        reply_info: reply_encoder.encode({parent_id: fullname}),
        mode: "reply",
    };
}
export function editButton(fullname: string): Generic.Action {
    return {
        kind: "reply",
        client_id: client.id,
        key: "edit-"+fullname,
        text: "Edit",
        reply_info: reply_encoder.encode({parent_id: fullname}),
        mode: "edit",
    };
}
export function saveButton(fullname: string, saved: boolean): Generic.Action {
    return {
        kind: "counter",
        client_id: client.id,

        increment: {
            icon: "bookmark",
            color: "green",
            label: "Save",
            undo_label: "Unsave",
        },
        decrement: null,

        unique_id: `/save/${fullname}/`,
        time: Date.now(),

        count_excl_you: "none",
        you: saved ? "increment" : undefined,
        actions: {
            increment: act_encoder.encode({kind: "save", fullname,  direction: ""}),
            reset: act_encoder.encode({kind: "save", fullname, direction: "un"}),
        },
    };
}

export function authorFromInfo(opts: {
    author: string,
    flair_bits: FlairBits | null,
    additional_flairs?: undefined | Generic.Flair[],
    distinguished: Reddit.UserDistinguished | null,
    is_submitter: boolean,
    author_cakeday: boolean | undefined,
    pfp: string | undefined,
    pfp_over18: boolean,
}): Generic.InfoAuthor {
    const system_colors: {[key in Reddit.UserDistinguished]: Generic.SystemKind} = {
        admin: "admin",
        moderator: "moderator",
        unsupported: "error",
    };
    return {
        color_hash: opts.author,
        client_id: client.id,
        name: opts.author,
        link: "/u/"+opts.author,
        flair: [
            ...opts.flair_bits ? flairToGenericFlair(opts.flair_bits) : [],
            ...opts.is_submitter ? as<Generic.Flair[]>([{
                elems: [{
                    kind: "text",
                    text: "«OP»",
                    styles: {},
                }],
                content_warning: false,
                system: "op",
            }]) : [],
            ...opts.author_cakeday ?? false ? as<Generic.Flair[]>([{
                elems: [{
                    kind: "text",
                    text: "«🍰»",
                    styles: {},
                }],
                content_warning: false,
                system: "cake",
            }]) : [],
            ...opts.distinguished != null ? as<Generic.Flair[]>([{
                elems: [{
                    kind: "text",
                    text: "«"+opts.distinguished+"»",
                    styles: {},
                }],
                content_warning: false,
                system: system_colors[opts.distinguished] ?? system_colors.unsupported,
            }]) : [],
            ...opts.additional_flairs ?? [],
        ],
        pfp: opts.pfp != null && opts.pfp !== "" ? {
            // "profileIcon_snoo" :: reddit avatar creator pfp
            // "profileIcon_snoo-nftv2" :: reddit nft pfp
            // I'm sure this data is somewhere else, but I can't find it even in new.reddit's desktopapi or gql
            cw_masked: opts.pfp_over18 && !opts.pfp.includes("profileIcon_snoo") ? true : false,
            url: opts.pfp,
            view: opts.pfp.includes("profileIcon_snoo-nftv2") ? "reddit-nft" : null,
        } : undefined,
    };
}
export function authorFromPostOrComment(
    listing: Reddit.PostSubmission | Reddit.PostComment,
    additional_flairs?: Generic.Flair[],
): Generic.InfoAuthor {
    return authorFromInfo({
        author: listing.author,
        flair_bits: {
            type: listing.author_flair_type, text: listing.author_flair_text,
            text_color: listing.author_flair_text_color,
            background_color: listing.author_flair_background_color,
            richtext: listing.author_flair_richtext,
        },
        additional_flairs: additional_flairs,
        distinguished: listing.distinguished,
        is_submitter: 'is_submitter' in listing ? (listing.is_submitter ?? false) : false,
        author_cakeday: listing.author_cakeday,
        pfp: listing.profile_img,
        pfp_over18: listing.profile_over_18 ?? false,
    });
}

export function authorFromT2(t2: Reddit.T2): Generic.InfoAuthor {
    return authorFromInfo({
        author: t2.data.name,
        flair_bits: null,
        additional_flairs: [],
        distinguished: null,
        is_submitter: false,
        author_cakeday: false,
        pfp: t2.data.icon_img,
        pfp_over18: t2.data.subreddit.over18,
    });
}

const fetch_path = encoderGenerator<{path: string}, "fetch_removed_path">("fetch_removed_path");

export type SortedPermalink = {
    permalink: string, // with sort param
    sort: Reddit.Sort,
    is_chat: boolean,
};

// TODO instead of this, make a function to get the permalink from a SortedPermalink object
export function sortWrap(parent: SortedPermalink, next: string): SortedPermalink {
    return {
        permalink: updateQuery(next, {sort: parent.sort}),
        sort: parent.sort,
        is_chat: parent.is_chat,
    };
}

const removal_reasons: {[key in Reddit.RemovedByCategory]: (raw_name: string, subreddit_prefixed: string) => Generic.RemovalMessage} = {
    anti_evil_ops: () => ({
        short: "Anti-Evil Operations",
        title: "Removed by Reddit's Anti-Evil Operations",
        body: "For violations of reddit's Content Policy: https://reddit.com/help/contentpolicy",
    }),
    community_ops: () => ({
        short: "Community Operations",
        title: "Sorry, this post was removed by Reddit's Community team.",
        body: "It's rare, but Reddit's Community Team will occasionally remove posts from feeds to keep communities safe and civil.",
    }),
    legal_operations: () => ({
        short: "Legal Operations",
        title: "This post was removed for legal reasons",
        body: "«TODO fill this»",
    }),
    copyright_takedown: () => ({
        short: "Copyright Takedown",
        title: "Removed for Copyright Infringement",
        body: "«TODO fill this»",
    }),
    reddit: () => ({
        short: "Spam Filters",
        title: "Sorry, this post was removed by Reddit's spam filters.",
        body: "Reddit's automated bots frequently filter posts it thinks might be spam.",
    }),
    author: () => ({
        short: "Author",
        title: "Removed by the author",
        body: "The author of this post decided to remove it.",
    }),
    deleted: () => ({
        short: "Author",
        title: "Deleted by the author",
        body: "The author of this post decided to delete it.",
    }),
    moderator: (unused, subreddit_prefixed) => ({
        short: "Moderators",
        title: "Removed by moderators of "+subreddit_prefixed,
        body: "Moderators of "+subreddit_prefixed+" decided to remove this post, likely due to a violation of the subreddit rules.",
    }),
    automod_filtered: () => ({
        short: "Filtered by AutoModerator",
        title: "This post was filtered by AutoModerator",
        body: "«TODO fill this»",
    }),
    content_takedown: () => ({
        short: "Content Takedown",
        title: "Sorry, this post was removed by Reddit.",
        body: "Reddit administrators occasionally remove posts that violate Reddit's User Agreement and Content Policy.",
    }),
    unsupported: (raw_name) => ({
        short: raw_name,
        title: "This post was removed for «"+raw_name+"»",
        body: "ThreadClient does not know what that means.",
    }),
};

export function getCodeButton(markdown: string): Generic.CodeAction {
    return {kind: "code", body: {kind: "richtext", content: [
        rt.pre(markdown, "markdown"),
    ]}};
}

export function getCommentBody(listing: Reddit.PostComment): Generic.Body {
    let is_deleted: Generic.RemovalMessage | undefined;
    if(listing.author === "[deleted]") {
        if(JSON.stringify(listing.rtjson) === JSON.stringify({document: [{c: [{e: "text", t: "[deleted]"}], e: "par"}]})) {
            is_deleted = removal_reasons.deleted("deleted", listing.subreddit_name_prefixed);
        }else if(JSON.stringify(listing.rtjson) === JSON.stringify({document: [{c: [{e: "text", t: "[removed]"}], e: "par"}]})) {
            is_deleted = removal_reasons.moderator("moderator", listing.subreddit_name_prefixed);
        }
    }
    const body_content: Generic.Body = {
        kind: "richtext", content: richtextDocument(listing.rtjson, {media_metadata: listing.media_metadata ?? {}})
    };
    const comment_body: Generic.Body = is_deleted != null
        ? {kind: "removed", removal_message: is_deleted,
            fetch_path: fetch_path.encode({path: "https://api.pushshift.io/reddit/comment/search?ids="+listing.id}),
            body: body_content,
            client_id: client.id,
        } : body_content
    ;
    return comment_body;
}

export function getPostBody(listing: Reddit.PostSubmission): Generic.Body {
    if(
        listing.crosspost_parent_list && listing.crosspost_parent_list.length === 1
    ) return {
        kind: "crosspost",
        source: threadFromListing(
            {kind: "t3", data: listing.crosspost_parent_list[0]!},
            {force_expand: "crosspost"},
            sortWrap({
                permalink: listing.permalink,
                sort: "unsupported",
                is_chat: false,
            }, listing.permalink),
        ) as Generic.Thread,
        client_id: client.id,
    };
    if(listing.is_self) return {
        kind: "array",
        body: [
            listing.rtjson.document.length
                ? {kind: "richtext", content: richtextDocument(listing.rtjson, {media_metadata: listing.media_metadata ?? {}})}
                : listing.url === "https://www.reddit.com" + listing.permalink // isn't this what is_self is for? why am I doing this check?
                ? {kind: "none"}
                : {kind: "link", client_id: client.id, url: listing.url, embed_html: listing.media_embed?.content}, // does this code path ever get used?
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
    };
    if(listing.gallery_data) return {
        kind: "gallery",
        images: listing.gallery_data.items.map(gd => {
            if(!listing.media_metadata) throw new Error("missing media metadata");
            const moreinfo = listing.media_metadata[gd.media_id];
            if(!moreinfo) throw new Error("missing mediameta for "+gd.media_id);
            return mediaMetaToBody(moreinfo, gd.caption);
        })
    };
    if(listing.rpan_video) return {
        kind: "video",
        source: {kind: "video", sources: [{url: listing.rpan_video.hls_url}]},
        gifv: false,
    };
    if(listing.preview && listing.preview.images.length === 1) {
        const image = listing.preview.images[0]!;
        if(image.variants.mp4) {
            const mp4 = image.variants.mp4;
            const sources = [...mp4.resolutions, mp4.source].sort((a, b) => b.width - a.width).map(source => ({
                url: source.url,
                quality: source.width + "×" + source.height,
            }));
            return {
                kind: "video",
                source: {
                    kind: "video",
                    sources: sources,
                    preview: [...sources].reverse(),
                },
                gifv: true,
            };
        }
        if(listing.preview.enabled) {
            // not used on videos
            // TODO have sources on images that specify resolutions
            // in order to use lower quality versions when not in fullscreen
            // preview
            return {
                kind: "captioned_image",
                url: image.source.url,
                w: image.source.width,
                h: image.source.height,
            };
        }
    }
    return {kind: "link", client_id: client.id, url: listing.url, embed_html: listing.media_embed?.content};
}

export function getPostThumbnail(
    listing: Reddit.PostSubmission,
    force_expand: ThreadOpts["force_expand"],
): Generic.Thumbnail | undefined {
    if(force_expand === "crosspost") return undefined;
    if(listing.preview?.images?.[0]?.resolutions?.[0]?.url != null) {
        return {kind: "image", url: listing.preview.images[0].resolutions[0].url};
    }
    if(listing.rpan_video) {
        return {kind: "image", url: listing.rpan_video.scrubber_media_url};
    }
    if(listing.thumbnail != null && listing.thumbnail !== "") {
        if(listing.thumbnail.includes("/")) {
            return {kind: "image", url: listing.thumbnail};
        }
        return {kind: "default", thumb: (as<{[key: string]: Generic.ThumbType}>({
            self: "self", default: "default", image: "image",
            spoiler: "spoiler", nsfw: "nsfw", account: "account",
        }))[listing.thumbnail] ?? "error"};
    }
    return {kind: "default", thumb: "default"};
}

export const flair_spoiler: Generic.Flair = {elems: [{kind: "text", text: "Spoiler", styles: {}}], content_warning: true};
export const flair_over18: Generic.Flair = {elems: [{kind: "text", text: "NSFW", styles: {}}], content_warning: true};
export const flair_oc: Generic.Flair = {elems: [{kind: "text", text: "OC", styles: {}}], content_warning: false};

export function getPostFlair(listing: Reddit.PostSubmission): Generic.Flair[] {
    const flairs: Generic.Flair[] = [];
    flairs.push(
        ...flairToGenericFlair({
            type: listing.link_flair_type, text: listing.link_flair_text,
            text_color: listing.link_flair_text_color,
            background_color: listing.link_flair_background_color,
            richtext: listing.link_flair_richtext,
        })
    );
    if(listing.spoiler) flairs.push(flair_spoiler);
    if(listing.over_18) flairs.push(flair_over18);
    if(listing.is_original_content) flairs.push(flair_oc);
    flairs.push(...awardingsToFlair(listing.all_awardings ?? []));

    if(listing.approved === true) {
        flairs.push({
            elems: [{kind: "text", text: "✓ Approved", styles: {}}],
            content_warning: false,
            system: "approved",
        });
    }
    return flairs;
}

const as = <T>(a: T): T => a;
export type ThreadOpts = {
    force_expand?: undefined | "open" | "crosspost" | "closed",
    link_fullname?: undefined | `t3_${string}`,
    show_post_reply_button?: undefined | boolean,
};
function threadFromListingMayError(listing_raw: Reddit.Post, options: ThreadOpts = {}, parent_permalink: SortedPermalink): Generic.Node {
    options.force_expand ??= "closed";
    if(listing_raw.kind === "t1") {
        // Comment
        const listing = listing_raw.data;

        const result: Generic.Node = {
            kind: "thread",
            body: getCommentBody(listing),
            display_mode: {body: "visible", comments: "visible"},
            raw_value: listing_raw,
            link: updateQuery(listing.permalink, {context: "3", sort: parent_permalink.sort}),
            layout: "reddit-comment",
            info: {
                time: listing.created_utc * 1000,
                edited: listing.edited === false ? false : listing.edited * 1000,
                author: authorFromPostOrComment(listing, awardingsToFlair(listing.all_awardings ?? [])),
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                pinned: listing.pinned || listing.stickied || false,
            },
            actions: ((): Generic.Action[] => [
                replyButton(listing.name),
                {
                    kind: "link",
                    client_id: client.id,
                    text: "Permalink",
                    url: listing.permalink ? updateQuery(listing.permalink, {context: "3", sort: parent_permalink.sort}) : "Error no permalink",
                },
                editButton(listing.name),
                deleteButton(listing.name),
                saveButton(listing.name, listing.saved),
                reportButton(listing.name, listing.subreddit),
                ...parent_permalink.is_chat ? [] : [getPointsOn(listing)],
                getCodeButton(listing.body),
            ])(),
            default_collapsed: listing.collapsed,
            replies: [
                ...listing.locked ? [((): Generic.Thread => ({
                    kind: "thread",
                    body: {
                        kind: "richtext",
                        content: [
                            rt.p(rt.txt("This comment is locked.")),
                            rt.p(rt.txt(
                                "Only moderators are able to comment on this thread."
                            )),
                        ],
                    },
                    display_mode: {body: "visible", comments: "collapsed"},
                    raw_value: listing.locked,
                    link: "no",
                    actions: [],
                    default_collapsed: false,
                    layout: "reddit-post",
                }))()] : [],
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                ...listing.replies ?
                    listing.replies.data.children.map(v => threadFromListing(v, options, sortWrap(parent_permalink, listing.permalink)))
                : [],
            ],
        };
        return result;
    }else if(listing_raw.kind === "t3") {
        const listing = listing_raw.data;
        // if((listing as any).preview) console.log((listing as any).preview);

        const is_deleted: undefined | Generic.RemovalMessage = (listing.removed_by_category != null
            ? (removal_reasons[listing.removed_by_category] ?? removal_reasons.unsupported)(listing.removed_by_category, listing.subreddit_name_prefixed)
            : undefined
        );
        const post_id_no_pfx = listing.name.substring(3);

        if(listing.mod_reports.length + listing.user_reports.length > 0) {
            //
        }

        const body_content: Generic.Body = getPostBody(listing);

        const result: Generic.Node = {
            kind: "thread",
            title: {
                text: listing.title,
            },
            flair: getPostFlair(listing),
            body: is_deleted != null
                ? {kind: "removed", removal_message: is_deleted,
                    fetch_path: fetch_path.encode({path: "https://api.pushshift.io/reddit/submission/search?ids="+post_id_no_pfx}),
                    body: body_content,
                    client_id: client.id,
                }
                : body_content
            ,
            display_mode: options.force_expand === "crosspost"
                ? {body: "visible", comments: "collapsed"}
                : {body: "collapsed", body_default: options.force_expand, comments: "collapsed"}
            ,
            raw_value: listing_raw,
            link: listing.permalink,
            thumbnail: getPostThumbnail(listing, options.force_expand),
            layout: "reddit-post",
            info: {
                time: listing.created_utc * 1000,
                edited: listing.edited === false ? false : listing.edited * 1000,
                author: authorFromPostOrComment(listing, []),
                in: {
                    link: "/"+listing.subreddit_name_prefixed,
                    name: listing.subreddit_name_prefixed,
                },
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                pinned: listing.stickied || false,
            },
            actions: [...options.show_post_reply_button ?? false ? [replyButton(listing.name)] : [], {
                kind: "link",
                client_id: client.id,
                url: listing.permalink,
                text: listing.num_comments.toLocaleString() + " comment"+(listing.num_comments === 1 ? "" : "s"),
            }, {
                kind: "link",
                client_id: client.id,
                url: "/domain/"+listing.domain,
                text: listing.domain,
            }, editButton(listing.name), deleteButton(listing.name), saveButton(listing.name, listing.saved),
            getPointsOn(listing), {
                kind: "link",
                client_id: client.id,
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
    }else if(listing_raw.kind === "t5"){
        const {data: listing} = listing_raw;
        const result: Generic.Node = {
            kind: "thread",
            display_mode: {
                body: "collapsed",
                body_default: "closed",
                comments: "visible",
            },
            raw_value: listing_raw,
            link: listing.url,
            layout: "reddit-post",
            title: {text: listing.display_name_prefixed},
            thumbnail: {
                kind: "image",
                url: listing.community_icon,
            },
            body: {
                kind: "text",
                client_id: client.id,
                content: listing.description_html,
                markdown_format: "reddit_html",
            },
            actions: [
                createSubscribeAction(listing.url.replace("/r/", "").replace("/u/", "u_"), listing.subscribers, listing.user_is_subscriber ?? false),
            ],
            default_collapsed: true,
        };
        return result;
    }else{ //eslint-disable-line no-else-return
        expectUnsupported(listing_raw.kind);
        return {
            kind: "thread",
            title: {text: "unsupported listing kind "+listing_raw.kind},
            body: {kind: "text", client_id: client.id, content: "unsupported", markdown_format: "none"},
            display_mode: {body: "collapsed", comments: "collapsed"},
            raw_value: listing_raw,
            link: "TODO no link",
            layout: "error",
            actions: [],
            default_collapsed: false,
        };
    }
    // console.log("Post: ",listing);
    
}

function getLoginURL() {
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
        encodeQuery({client_id: reddit_app_id, response_type: "code", state, redirect_uri, duration: "permanent", scope})
    ;
    return url;
}

async function fetchSubInfo(sub: SubrInfo): Promise<{
    sidebar: Generic.ContentNode[] | null,
    header?: undefined | Generic.ContentNode,
}> {
    if(sub.kind === "homepage") return {sidebar: null};
    if(sub.kind === "userpage") return {sidebar: null};
    if(sub.kind === "mod") return {sidebar: null};
    if(sub.kind === "subreddit") {
        const [widgets, about] = await Promise.all([
            redditRequest(`/r/${ec(sub.subreddit)}/api/widgets`, {method: "GET", onerror: e => undefined, cache: true}),
            redditRequest(`/r/${ec(sub.subreddit)}/about`, {method: "GET", onerror: e => undefined, cache: true}),
        ]);
        const subinfo: SubInfo = {subreddit: sub.subreddit, sub_t5: about ?? null, widgets: widgets ?? null};
        return {
            sidebar: sidebarFromWidgets(subinfo),
            header: subredditHeader(subinfo),
        };
    }
    if(sub.kind === "multireddit") {
        const [multi_info] = await Promise.all([
            redditRequest(("/" + ["api", "multi", ...sub.base].join("/")) as unknown as "/api/multi/__unknown_base", {method: "GET", onerror: e => undefined, cache: true}),
        ]);
        return {
            sidebar: multi_info ? sidebarFromMulti(multi_info) : null,
        };
    }
    if(sub.kind === "error") return {sidebar: null};
    assertNever(sub);
}

function sidebarFromMulti(multi_raw: Reddit.LabeledMulti): Generic.ContentNode[] {
    const multi = multi_raw.data;
    return [
        {
            kind: "widget",
            title: multi.display_name,
            raw_value: multi_raw,
            widget_content: {
                kind: "body",
                body: {
                    kind: "array",
                    body: [{
                        kind: "richtext",
                        content: [
                            rt.p(
                                rt.txt("Curated by "),
                                rt.link(client, "/u/"+multi.owner, {is_user_link: multi.owner.toLowerCase()},
                                    rt.txt("u/"+multi.owner),
                                ),
                            ),
                            rt.p(rt.txt("Created "), rt.timeAgo(multi.created_utc * 1000)),
                        ],
                    }, {
                        kind: "text",
                        client_id: client.id,
                        content: multi.description_html,
                        markdown_format: "reddit_html",
                    }],
                },
            },
            actions_bottom: [
                {kind: "link", client_id: client.id, text: "Create a copy", url: "TODO"},
            ],
        },
        {
            kind: "widget",
            title: "Subreddits ("+multi.subreddits.length+")",
            raw_value: multi.subreddits,
            widget_content: {
                kind: "list",
                items: multi.subreddits.map(sub => {
                    return {
                        // icon: undefined,
                        name: {kind: "text", text: "r/"+sub.name},
                        click: {kind: "link", client_id: client.id, url: "/r/"+sub.name},
                        //action: createSubscribeAction(sub.name, sub.subscribers, sub.isSubscribed),
                    };
                }),
            },
        }
    ];
}

function subPfp(sub: Reddit.T5Data): null | Generic.InfoPfp {
    const icon = sub.community_icon || sub.icon_img || "";
    if(!icon) return null;
    return {
        url: icon,
    };
}
function subBanner(sub: Reddit.T5Data): Generic.Banner {
    const banner = sub.banner_background_image || sub.banner_img || "";
    const color = sub.primary_color || "";
    return banner ? {
        kind: "image",
        desktop: banner,
    } : color ? {
        kind: "color",
        color,
    } : null;
}

export function userIdentityCard(user: Reddit.T2Data): Generic.FilledIdentityCard {
    return {
        names: {
            display: user.name,
            raw: "u/"+user.name,
        },
        pfp: subPfp(user.subreddit),
        theme: {
            banner: subBanner(user.subreddit),
        },
        description: {
            kind: "text",
            client_id: client.id,
            content: user.subreddit.public_description,
            markdown_format: "none",
        },
        actions: {
            main_counter: {
                kind: "counter",
                client_id: client.id,
    
                increment: {
                    icon: "join",
                    color: "white",
                    label: "Follow",
                    undo_label: "Unfollow",
                    // _label: "Following"
                },
                decrement: null,
    
                unique_id: "/follow/"+user.name+"/",
                time: Date.now(),
    
                style: "pill-filled",
                incremented_style: "pill-empty",
    
                count_excl_you: user.is_friend ? user.subreddit.subscribers - 1 : user.subreddit.subscribers,
                you: user.is_friend ? "increment" : undefined,
    
                actions: {
                    error: "TODO implement add friend",
                },
            },
        },
        menu: null,
        raw_value: user,
    };
}

function generateUserSidebar(
    user: Reddit.T2 | undefined,
    trophies: Reddit.TrophyList | {data: undefined} | undefined,
    modded_subs: Reddit.ModeratedList | {data: undefined} | undefined,
): Generic.ContentNode[] {
    const resitems: Generic.ContentNode[] = [];
    if(user?.data) resitems.push({kind: "page2_identity_card", data: userIdentityCard(user.data)}, {
        kind: "widget",
        title: "About",
        widget_content: {kind: "body", body: {kind: "richtext", content: [
            rt.h1(rt.link(client, "/u/"+user.data.name, {is_user_link: user.data.name}, rt.txt(user.data.name))),
            rt.p(rt.txt(user.data.link_karma + " post karma")),
            rt.p(rt.txt(user.data.comment_karma + " comment karma")),
            rt.p(rt.txt("Account created "), rt.timeAgo(user.data.created_utc * 1000)),
        ]}},
        raw_value: user,
    }); else resitems.push({
        kind: "widget",
        title: "TODO",
        widget_content: {kind: "body", body: {kind: "richtext", content: [
            rt.p(rt.txt("Failed to fetch user info for this user :(")),
        ]}},
        raw_value: user,
    });

    if(modded_subs?.data) resitems.push({
        kind: "widget",
        title: "Moderates",
        raw_value: modded_subs,
        widget_content: {
            kind: "list",
            items: modded_subs.data.map((sub): Generic.WidgetListItem => {
                return {
                    icon: sub.community_icon || sub.icon_img || "undefined",
                    name: {kind: "text", text: sub.sr_display_name_prefixed},
                    click: {kind: "link", url: sub.url},
                    // action: createSubscribeAction(sub.name, sub.subscribers, ??),
                };
            }),
        },
    }); else if(!modded_subs) resitems.push({
        kind: "widget",
        title: "TODO",
        widget_content: {kind: "body", body: {kind: "richtext", content: [
            rt.p(rt.txt("Failed to fetch modded subs for this user :(")),
        ]}},
        raw_value: modded_subs,
    });

    if(trophies?.data) resitems.push({
        kind: "widget",
        title: "Trophy Case",
        widget_content: {kind: "body", body: {kind: "richtext", content: [
            ...trophies.data.trophies.map(({data: trophy}): Generic.Richtext.Paragraph => {
                const rt_content: Generic.Richtext.Paragraph[] = [
                    ...trophy.url != null ? [rt.p(rt.link(client, trophy.url, {}, rt.txt(trophy.url)))] : [],
                    ...trophy.description != null ? [rt.p(rt.txt(trophy.description))] : [],
                ];
                return {kind: "body", body: {
                    // kind: "link_preview",
                    // title: trophy.name,
                    // description: trophy.description + " " + trophy.granted_at,
                    // thumb: trophy.icon_70 ?? undefined,
                    // click: {kind: "richtext", content: [
                    //     ...trophy.url != null ? [rt.p(rt.link(trophy.url, {}, rt.txt(trophy.url)))] : [],
                    //     ...trophy.description != null ? [rt.p(rt.txt(trophy.description))] : [],
                    // ]},
                    // click_enabled: false,
                    // url: trophy.url ?? "NO",

                    kind: "crosspost",
                    client_id: client.id,
                    source: {
                        kind: "thread",
                        title: {text: trophy.name},
                        body: rt_content.length ? {kind: "richtext", content: rt_content} : {kind: "none"},
                        thumbnail: {
                            kind: "image",
                            url: trophy.icon_70,
                        },
                        display_mode: {body: "collapsed", comments: "collapsed", body_default: "closed"},
                        raw_value: trophy,
                        link: trophy.icon_70,
                        layout: "reddit-post",
                        info: {
                            time: trophy.granted_at != null ? trophy.granted_at * 1000 : false,
                            edited: false,
                            pinned: true,
                        },
                        actions: [],
                        default_collapsed: false,
                    },
                }};
            })
        ]}},
        raw_value: user,
    }); else resitems.push({
        kind: "widget",
        title: "TODO",
        widget_content: {kind: "body", body: {kind: "richtext", content: [
            rt.p(rt.txt("Failed to fetch trophy case for this user :(")),
        ]}},
        raw_value: trophies,
    });

    return resitems;
}

export function jstrOf<T>(v: T): Reddit.JStr<T> {
    return JSON.stringify(v) as unknown as Reddit.JStr<T>;
}

export function parseLink(path: string): [parsed: ParsedPath, path: string] {
    let parsed = path_router.parse(path)!;

    for(let i = 0; parsed.kind === "redirect" && i < 100; i++) {
        path = parsed.to;
        parsed = path_router.parse(path)!;
    }
    
    return [parsed, path];
}

export function ec<T extends string>(v: T): Reddit.PathBit<T> {
    return v as Reddit.PathBit<T>;
}

export const client_id = "reddit";
export const client: ThreadClient = {
    id: client_id,
    // loginURL: getLoginURL(),
    getPage,
    loader: loadPage2,
    submit: submitPage2,
    async getThread(pathraw_in): Promise<Generic.Page> {
        try {
            const [parsed, pathraw] = parseLink(pathraw_in);

            console.log("PARSED URL:", parsed);

            if(parsed.kind === "comments") {
                // ?comment=… ?context=… ?depth=… ?limit=… ?showedits=true ?showmedia=true ?showmore=true ?showtitle=true ?sort=confidence|top|new|controversial|old|random|qa|live
                // ?sr_detail=… // passes the subreddit about page with the result
                const [page, subinfo] = await Promise.all([
                    redditRequest(`/comments/${ec(parsed.post_id_unprefixed)}`, {method: "GET", query: {
                        sort: parsed.sort_override, comment: parsed.focus_comment, context: parsed.context,
                    }}),
                    fetchSubInfo(parsed.sub),
                ]);

                return pageFromListing(pathraw, parsed, page, {...subinfo});
            }else if(parsed.kind === "duplicates") {
                // ?sort=num_comments|new
                // ?before=
                const [duplicates, subinfo] = await Promise.all([
                    redditRequest(`/duplicates/${ec(parsed.post_id_unprefixed)}`, {method: "GET", query: {
                        after: parsed.after, before: parsed.before, sort: parsed.sort, crossposts_only: "" + parsed.crossposts_only,
                    }}),
                    fetchSubInfo(parsed.sub),
                ]);

                return pageFromListing(pathraw, parsed, duplicates, {...subinfo});
            }else if(parsed.kind === "subreddit") {
                const link = "/"+[...parsed.sub.base, parsed.current_sort.v].join("/");
                const [listing, subinfo] = await Promise.all([
                    redditRequest(link as "/__unknown_base/__unknown_sort", {method: "GET", query: {
                        t: parsed.current_sort.t, before: parsed.before, after: parsed.after,
                    }}),
                    fetchSubInfo(parsed.sub),
                ]);

                return pageFromListing(pathraw, parsed, listing, {...subinfo});
            }else if(parsed.kind === "wiki") {
                const link = "/"+[...parsed.sub.base, "wiki", ...parsed.path].join("/") + "?" + encodeQuery(parsed.query);
                const [result, subinfo] = await Promise.all([
                    redditRequest(link as "/__any", {method: "GET"}),
                    fetchSubInfo(parsed.sub),
                ]);
                
                return pageFromListing(pathraw, parsed, result, {...subinfo});
            }else if(parsed.kind === "user") {
                const link = pathraw;
                const [result, userabout, trophies, modded_subs] = await Promise.all([
                    redditRequest(link as "/__any", {method: "GET"}),
                    redditRequest(`/user/${ec(parsed.username)}/about`, {method: "GET", onerror: e => undefined, cache: true}),
                    redditRequest(`/api/v1/user/${ec(parsed.username)}/trophies`, {method: "GET", onerror: e => undefined, cache: true}),
                    redditRequest(`/user/${ec(parsed.username)}/moderated_subreddits`, {
                        method: "GET", onerror: e => undefined, cache: true,
                    }), // this is undocumented?
                ]);

                return pageFromListing(pathraw, parsed, result, {sidebar: generateUserSidebar(userabout, trophies, modded_subs)});
            }else if(parsed.kind === "subreddits") {
                const link = pathraw;
                const result = await redditRequest(link as "/__any", {method: "GET"});

                return pageFromListing(pathraw, parsed, result, {sidebar: null});
            }else if(parsed.kind === "inbox") {
                // TODO
                if(parsed.current.tab === "compose") {
                    // TODO
                }else if(parsed.current.tab === "mod") {
                    // TODO
                }else if(parsed.current.tab === "message") {
                    // TODO
                }else if(parsed.current.tab === "inbox") {
                    const link = "/message/"+parsed.current.inbox_tab;
                    const result = await redditRequest(link as "/__any", {method: "GET"});

                    return pageFromListing(pathraw, parsed, result, {sidebar: null});
                }else if(parsed.current.tab === "sent") {
                    // TODO
                }else assertNever(parsed.current);
            }else if(parsed.kind === "link_out") {
                return {
                    title: "LinkOut",
                    navbar: getNavbar(pathraw),
                    body: {kind: "one", item: {parents: [{kind: "thread",
                        body: {kind: "richtext", content: [
                            rt.h1(rt.link(client, "raw!"+parsed.out, {}, rt.txt("View on reddit.com"))),
                            rt.p(rt.txt("ThreadClient does not support this URL")),
                        ]},
                        display_mode: {comments: "visible", body: "visible"},
                        link: pathraw,
                        raw_value: parsed,
                        layout: "reddit-post",
                        actions: [],
                        default_collapsed: false,
                    }], replies: []}},
                    display_style: "comments-view",
                };
            }else if(parsed.kind === "todo") {
                const resj = await redditRequest(parsed.path as "/__any", {method: "GET", onerror: (error): Reddit.AnyResult => ({
                    kind: "unsupported",
                    extra: {
                        title: error.message,
                        stack: error.stack,
                        console: error,
                    },
                })});

                return pageFromListing(pathraw, parsed, resj, {sidebar: [{
                    kind: "widget",
                    title: "TODO",
                    widget_content: {kind: "body", body: {kind: "richtext", content: [
                        rt.p(rt.txt("This page "), rt.code(pathraw), rt.txt(" is not supported (yet)")),
                        rt.p(rt.link(client, "raw!https://www.reddit.com"+parsed.path, {}, rt.txt("View on reddit.com"))),
                        rt.p(rt.txt(parsed.msg)),
                    ]}},
                    raw_value: parsed,
                }]});
            }else if(parsed.kind === "raw") {
                const resj = await redditRequest(parsed.path as "/__unknown", {method: "GET"});
                return pathFromListingRaw(pathraw, resj, {sidebar: [{
                    kind: "widget",
                    title: "Raw",
                    widget_content: {kind: "body", body: {kind: "richtext", content: [
                        rt.p(rt.txt("This is a raw page.")),
                        rt.p(rt.link(client, parsed.path, {}, rt.txt("View Rendered"))),
                    ]}},
                    raw_value: parsed,
                }]});
            }else if(parsed.kind === "redirect") {
                return {
                    title: "LinkOut",
                    navbar: getNavbar(pathraw),
                    body: {kind: "one", item: {parents: [{kind: "thread",
                        body: {kind: "richtext", content: [
                            rt.h1(rt.txt("Error! Redirect Loop")),
                            rt.p(rt.txt("ThreadClient tried to redirect over 100 times.")),
                            rt.p(rt.txt("Path: "), rt.code(pathraw), rt.error("Code", parsed)),
                        ]},
                        display_mode: {comments: "visible", body: "visible"},
                        link: pathraw,
                        raw_value: parsed,
                        layout: "reddit-post",
                        actions: [],
                        default_collapsed: false,
                    }], replies: []}},
                    display_style: "comments-view",
                };
            }else if(parsed.kind === "sidebar") {
                throw new Error("ENOTSUPPORTED;SUBREDDIT-SIDEBAR;PAGE1");
            }else if(parsed.kind === "submit") {
                return {
                    title: "Submit",
                    navbar: getNavbar(pathraw),
                    body: {kind: "one", item: {parents: [{kind: "thread",
                        title: {text: "Submit"},
                        body: {kind: "richtext", content: [
                            rt.p(
                                rt.link(client, updateQuery(pathraw, {"--tc-view": "page2"}), {},
                                    rt.txt("submit a post to "+parsed.sub.base.join("/")),
                                ),
                            ),
                        ]},
                        display_mode: {comments: "visible", body: "visible"},
                        link: pathraw,
                        raw_value: parsed,
                        layout: "reddit-post",
                        actions: [],
                        default_collapsed: false,
                    }], replies: []}},
                    display_style: "comments-view",
                };
            }else assertNever(parsed);

            return pathFromListingRaw(pathraw, parsed, {sidebar: [{
                kind: "widget",
                title: "TODO",
                widget_content: {kind: "body", body: {kind: "richtext", content: [
                    rt.p(rt.txt("This page "), rt.code(pathraw), rt.txt(" is not supported (yet)")),
                    rt.p(rt.txt(parsed.kind)),
                    rt.p(rt.txt("View it on "), rt.link(client, "raw!https://reddit.com"+pathraw, {}, rt.txt("reddit.com")), rt.txt(".")),
                ]}},
                raw_value: parsed,
            }]});

        }catch(err_raw) {
            const e = err_raw as Error;
            console.log(e);
            const is_networkerror = e.toString().includes("NetworkError");
            
            return {
                title: "Error",
                navbar: getNavbar(pathraw_in),
                body: {kind: "one", item: {parents: [{
                    kind: "thread",
                    title: {text: "Error"},
                    body: {
                        kind: "text",
                        client_id: client.id,
                        content: `Error ${e.toString()}`+ (is_networkerror
                            ? `. If you're using Firefox, try disabling 'Enhanced Tracker Protection' ${""
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
                    link: pathraw_in,
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

        const v = await fetch("https://www.reddit.com/api/v1/access_token", {
            method: "POST", mode: "cors", credentials: "omit",
            headers: {
                'Authorization': "Basic "+btoa(reddit_app_id+":"),
                'Content-Type': "application/x-www-form-urlencoded",
            },
            body: encodeQuery({grant_type: "authorization_code", code, redirect_uri}),
        }).then(res => res.json()) as Reddit.AccessToken;
    
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
        type PushshiftResult = {data: {selftext?: undefined | string, body?: undefined | string}[]};
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
                client_id: client.id,
                content: item.selftext,
                markdown_format: "reddit",
            };
        }
        //eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if(item.body) {
            return {
                kind: "text",
                client_id: client.id,
                content: item.body,
                markdown_format: "reddit",
            };
        }
        console.log("got item", item);
        // TODO: fetchRemoved should return a full post.
        // fetchremoved does not work for link posts atm because of this.
        throw new Error("no selftext or body");
    },
    async act(action_raw: Generic.Opaque<"act">): Promise<void> {
        const act = act_encoder.decode(action_raw);
        if(act.kind === "vote") {
            const res = await redditRequest("/api/vote", {
                method: "POST",
                mode: "urlencoded",
                body: act.query,
            });
            console.log("VOTE RES", res);
        }else if(act.kind === "delete") {
            const res = await redditRequest("/api/del", {
                method: "POST",
                mode: "urlencoded",
                body: {id: act.fullname},
            });
            console.log(res);
        }else if(act.kind === "save") {
            const res = await redditRequest(`/api/${act.direction}save`, {
                method: "POST",
                mode: "urlencoded",
                body: {id: act.fullname},
            });
            console.log("SAVE RES", res);
        }else if(act.kind === "subscribe") {
            const res = await redditRequest("/api/subscribe", {
                method: "POST",
                mode: "urlencoded",
                body: {
                    action: act.direction,
                    sr_name: act.subreddit,
                },
            });
            console.log("SUBSCRIBE RES", res);
        }else if(act.kind === "mark_read") {
            const res = await redditRequest(`/api/${act.direction}read_message`, {
                method: "POST",
                mode: "urlencoded",
                body: {
                    id: act.fullname,
                },
                override: true,
            });
            console.log("READMESSAGE RES", res);
        }else if(act.kind === "log_out") {
            localStorage.removeItem("reddit-secret");
        }else assertUnreachable(act);
    },
    previewReply(md: string, data: Generic.Opaque<"reply">): Generic.PostContent {
        //eslint-disable-next-line @typescript-eslint/no-unused-vars
        const reply_info = reply_encoder.decode(data);
        const legacy_value: Generic.Thread = {
            kind: "thread",
            body: {kind: "text", client_id: client.id, content: md, markdown_format: "reddit"},
            display_mode: {body: "visible", comments: "visible"},
            raw_value: [md, data],
            link: "no link",
            layout: "reddit-comment",
            info: {
                time: false,
                edited: false,
                author: {
                    name: "TODO You",
                    color_hash: "TODO You",
                    link: "/u/TODO You",
                    client_id: client.id,
                    // flair: …
                },
                pinned: false,
            },
            actions: [{
                kind: "counter",
                client_id: client.id,
                
                increment: {
                    icon: "up_arrow",
                    color: "orange",
                    label: "Upvote",
                    undo_label: "Undo Upvote",
                    // done_label: "Upvoted"
                },
                decrement: {
                    icon: "down_arrow",
                    color: "indigo",
                    label: "Downvote",
                    undo_label: "Undo Downvote",
                    // done_label: "Downvoted"
                },

                special: "reddit-points",

                unique_id: null,
                time: 0,

                count_excl_you: 0,
                you: "increment",

                percent: 1,
                actions: {error: "reply not posted"},
            }],
            default_collapsed: false,
        };
        return {
            kind: "legacy",
            client_id: client.id,
            thread: legacy_value,
        };
    },
    async sendReply(md: string, data_raw: Generic.Opaque<"reply">, mode): Promise<Generic.Node> {
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
        const body: Reddit.ApiCommentOrEditComment = {
            api_type: "json",
            thing_id: reply_info.parent_id,
            return_rtjson: jstrOf(true),
            ...(md === "richtext_demo"
                ? {richtext_json: jstrOf(richtext_json)}
                : {text: md}
            ),
        };
        const url = ({reply: "/api/comment", edit: "/api/editusertext"} as const)[mode];
        const reply = await redditRequest(url, {
            method: "POST",
            mode: "urlencoded",
            body,
        });
        console.log(reply);
        // the reply also has a "rte_mode": "markdown" | "unsupported"
        return threadFromListing({kind: "t1", data: reply}, {}, {permalink: "TODO", sort: "unsupported", is_chat: false});
    },
    async fetchReportScreen(data_raw) {
        const data = report_encoder.decode(data_raw);
        const [sub_rules, sub_about] = await Promise.all([
            await redditRequest(`/r/${ec(data.subreddit)}/about/rules`, {method: "GET", cache: true}),
            await redditRequest(`/r/${ec(data.subreddit)}/about`, {method: "GET", cache: true}),
        ]);

        const kind = data.fullname.startsWith("t1_") ? "comment" : data.fullname.startsWith("t3_") ? "link" : "unsupported";

        const result: Generic.ReportScreen[] = [];

        const sub_rules_out: Generic.ReportScreen[] = [];
        for(const sub_rule of sub_rules.rules) {
            if(sub_rule.kind === "link") {
                if(kind !== "link") continue;
            }else if(sub_rule.kind === "comment") {
                if(kind !== "comment") continue;
            }else if(sub_rule.kind === "all") {
                // ✓
            }else expectUnsupported(sub_rule.kind);

            sub_rules_out.push({
                title: sub_rule.violation_reason,
                description: {
                    kind: "text",
                    client_id: client.id,
                    content: sub_rule.description_html ?? "",
                    markdown_format: "reddit_html",
                },
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

        const response = await redditRequest("/api/report", {
            method: "POST",
            mode: "urlencoded",
            body: {
                sr_name: report.subreddit,
                thing_id: report.fullname,
                ...(report.reason.kind === "sub"
                    ? {rule_reason: report.reason.id}
                    : report.reason.kind === "site"
                    ? {site_reason: report.reason.id, custom_text: text == null ? undefined : text} // assuming this is right, can't test it
                    : report.reason.kind === "sub_other"
                    ? {reason: text!}
                    : assertNever(report.reason)
                ),
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
            body: text != null ? {kind: "text", client_id: client.id, content: text, markdown_format: "none"} : {kind: "none"},
        };
    },

    async loadMore(action: Generic.Opaque<"load_more">): Promise<Generic.Node[]> {
        const act = load_more_encoder.decode(action);
        if(act.kind === "api_loadmore") {
            const remaining = [...act.children];
            const batch = remaining.splice(0, 100);

            const resp = await redditRequest("/api/morechildren", {
                method: "GET",
                query: {
                    api_type: "json",
                    limit_children: "false",
                    children: batch.join(","),
                    link_id: act.link_fullname,
                    sort: act.parent_permalink.sort,
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
            const resp = await redditRequest(act.permalink as "/__any_page", {
                method: "GET",
            });
            const [parsed_link, pathraw] = parseLink(act.permalink)!;
            if(parsed_link.kind !== "comments") throw new Error("bad link to parent_permalink: "+parsed_link.kind);
            const translated_resp = pageFromListing(pathraw, parsed_link, resp, {sidebar: null});
            if(translated_resp.body.kind === "one") {
                return translated_resp.body.item.replies;
            }
            console.log("Error", translated_resp);
            throw new Error("todo support load more returning other body ("+translated_resp.body.kind+")");
        }else if(act.kind === "context") {
            // TODO /r/:subreddit/comments/:link_id?comment=:parent_id&context=8
            // then split them out and return an array
            throw new Error("TODO load more context");
        }else if(act.kind === "duplicates") {
            // TODO /duplicates/…/…
            throw new Error("TODO load more duplicates");
        }else assertNever(act);
    },
    async loadMoreUnmounted(
        action: Generic.Opaque<"load_more_unmounted">,
    ): Promise<{
        children: Generic.UnmountedNode[],
        next?: undefined | Generic.LoadMoreUnmounted,
    }> {
        const act = load_more_unmounted_encoder.decode(action);
        if(act.kind === "listing") {
            const resp = await redditRequest(act.url as "/__any_listing", {
                method: "GET",
            });
            const [parsed_url, pathraw] = parseLink(act.url)!;
            const translated_resp = pageFromListing(pathraw, parsed_url, resp, {sidebar: null});
            if(translated_resp.body.kind === "listing") {
                return {children: translated_resp.body.items, next: translated_resp.body.next};
            }
            console.log("Error", translated_resp);
            throw new Error("todo support load more returning other body ("+translated_resp.body.kind+")");
        }else if(act.kind === "TODO more") {
            throw new Error("TODO more");
        }else assertNever(act);
    },
    async hydrateInbox(inbox_raw: Generic.Opaque<"deferred_inbox">): Promise<Generic.InboxData> {
        const inbox = deferred_inbox.decode(inbox_raw);
        if(inbox.kind === "inbox") {
            const resp = await redditRequest("/api/me", {
                method: "GET",
            });
            const count = resp.data.inbox_count;
            return {
                messages: count === 0 ? {
                    kind: "zero",
                } : {
                    kind: "exact",
                    value: count
                },
                url: count === 0 ? "/message/inbox" : "/message/unread",
            };
            // in the future, clicking the button could have resp preloaded rather than loading it again
        }else if(inbox.kind === "modmail") {
            // TODO this response also comes from the inbox thing
            // but rather than a number it's just a boolean "new_modmail_exists"
            // we should support that. but right now each one needs its own seperate request.
            const resp = await redditRequest("/api/mod/conversations/unread/count", {
                method: "GET",
            });
            return {
                messages: resp.notifications > 0 ? {kind: "exact", value: resp.notifications} : {kind: "zero"},
                url: "/mod/mail/all"
            };
        }else assertNever(inbox);
    }
};

// turns out (content: never): never => {} doesn't work properly
// TODO make a util.ts file that has stuff like assertNever, expectUnsupported, …
// or add expectUnsupported to base.ts
function assertNever(content: never): never {
    console.log("not never:", content);
    throw new Error("Expected never");
}
function siteRuleToReportScreen(data: ReportInfo, site_rule: Reddit.FlowRule): Generic.ReportScreen {
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
                description: {kind: "text", client_id: client.id, content: site_rule.complaintPrompt, markdown_format: "none"},
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
}

type ReportAction = {
    fullname: string,
    subreddit: string,
    text_max?: undefined | number,
    reason: {kind: "sub", id: string} | {kind: "site", id: string} | {kind: "sub_other"},
};
// note: sub_other should pass the text through the other_reason field when reporting
const report_action_encoder = encoderGenerator<ReportAction, "send_report">("send_report");

// {method: "POST", mode: "json", body: unknown}
type RequestOpts<ThingType extends Reddit.RequestInfo, Extra> = {
    onerror?: undefined | ((e: Error) => Extra),
    onstatus?: undefined | ((status: number, res: ThingType["response"]) => Extra),
    cache?: undefined | boolean,
    override?: undefined | boolean,
} & (ThingType["query"] extends {[key: string]: string | null | undefined} ? {
    query: ThingType["query"],
} : {
    query?: undefined,
}) & (ThingType["body"] extends {[key: string]: string | undefined} ? {
    method: "POST",
    mode: "urlencoded",
    body: ThingType["body"],
} : {
    method: "GET",
    body?: undefined,
});
// note: TODO reset caches on a few occasions
// : if you send any requests to edit the subreddit about text or anything like that, clear all caches containing /r/:subname/ or ending with /r/:subname
// : if you click the refresh button at the top of the page, clear caches maybe
const request_cache = new Map<string, unknown>();

async (cond: boolean, use: <T>(v: T) => void) => {
    // tests for the redditRequest return type

    {
        let tres = await redditRequest("/api/test/0", {
            query: {a: "b"},
            method: "GET",
        });

        if(cond) tres = "no";
        // @ts-expect-error
        if(cond) tres = "yes";

        use<"no">(tres);
    }

    {
        let tres = await redditRequest("/api/test/0", {
            query: {a: "b"},
            method: "GET",
            onerror: () => "yes" as const,
        });

        if(cond) tres = "no";
        if(cond) tres = "yes";
        // @ts-expect-error
        if(cond) tres = "maybe";

        use<"yes" | "no">(tres);
    }

    {
        let tres = await redditRequest("/api/test/0", {
            query: {a: "b"},
            method: "GET",
            onerror: () => undefined,
        });

        if(cond) tres = "no";
        if(cond) tres = undefined;
        // @ts-expect-error
        if(cond) tres = "yes";

        use<"no" | undefined>(tres);
    }
};

export async function redditRequest<Path extends keyof Reddit.Requests, Extra = never>(
    path: Path,
    opts: RequestOpts<Reddit.Requests[Path], Extra>,
): Promise<Reddit.Requests[Path]["response"] | Extra> {
    const optsmode = (opts as unknown as {mode: undefined | "urlencoded" | "json"}).mode;
    // TODO if error because token needs refreshing, refresh the token and try again
    try {
        const authorization = await getAuthorization();

        const full_url = pathURL(!!authorization, updateQuery(path, opts.query ?? {}), {override: opts.override});
        const fetchopts: RequestInit = {
            method: opts.method, mode: "cors", credentials: "omit",
            headers: {
                ...authorization ? {'Authorization': authorization} : {},
                ...opts.method === "POST" ? {
                    'Content-Type': {
                        json: "application/json",
                        urlencoded: "application/x-www-form-urlencoded",
                    }[optsmode!],
                } : {},
            },
            ...opts.method === "POST" ? {
                body: (optsmode) === "json" ? (
                    JSON.stringify(opts.body)
                ) : optsmode === "urlencoded" ? (
                    Object.entries(opts.body ?? (() => {throw new Error("post with undefined body")})()).flatMap(([a, b]) => (
                        b == null ? [] : [encodeURIComponent(a) + "=" + encodeURIComponent(b)]
                    )).join("&")
                ) : assertUnreachable(opts as never),
            } : {},
        };
        const cache_text = JSON.stringify([full_url, fetchopts]);
        const prev_cache = request_cache.get(cache_text);
        if(prev_cache != null && (opts.cache ?? false)) return prev_cache as Reddit.Requests[Path]["response"];
        const [status, res] = await fetch(full_url, fetchopts).then(async (v) => {
            return [v.status, await v.json() as Reddit.Requests[Path]["response"]] as const;
        });
        if(status !== 200) {
            if(opts.onstatus) return opts.onstatus(status, res);
            console.log(status, res);
            throw new Error("got status "+status);
        }

        const res_apierror = res as unknown as Reddit.APIError;
        if(typeof res_apierror === "object") {
            if('json' in res_apierror
            && typeof res_apierror.json === "object"
            && 'errors' in res_apierror.json
            && res_apierror.json.errors.length > 0) {
                throw new Error(
                    res_apierror.json.errors.map(([id, message]) => id+": "+message).join(", "),
                );
            }else if(true
                && 'jquery' in res_apierror && Array.isArray(res_apierror.jquery)
                && 'success' in res_apierror && res_apierror.success === false
            ) {
                throw new Error(
                    res_apierror.jquery.flatMap(item => item[2] === "call" ? item[3]
                    .map(itm => typeof itm === "string" ? itm : "") : []).join(", "),
                );
            }
        }

        if(opts.cache ?? false) request_cache.set(cache_text, res);
        return res;
    }catch(e) {
        console.log("Got error", e);
        if(opts.onerror) return opts.onerror(e as Error);
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
