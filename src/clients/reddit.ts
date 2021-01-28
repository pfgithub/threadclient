import * as Reddit from "../types/api/reddit";
import * as Generic from "../types/generic";
import {ThreadClient} from "./base";
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
        content_warning: flair_text.toLowerCase().startsWith("cw:")
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
    return [{elems: resitems, content_warning: false}];
}

function encodeAction(act: "vote", query: string): string {
    return JSON.stringify({kind: act, query});
}
function decodeAction(act: string): {kind: "vote", query: string} | {kind: "-"} {
    return JSON.parse(act);
}

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
        case "img": case "video": {
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
        align: tbh.a ? ({'L': "left", 'C': "center", 'R': "right"} as const)[tbh.a] : undefined,
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
    if(format.length === 0) return [{kind: "text", text: text, styles: {}}];
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
        case "r/": return [{
            kind: "link",
            url: "/r/"+rtd.t,
            children: [{kind: "text", text: (rtd.l ? "/" : "") + "r/"+rtd.t, styles: {}}],
        }];
        case "u/": return [{
            kind: "link",
            url: "/u/"+rtd.t,
            children: [{kind: "text", text: (rtd.l ? "/" : "") + "u/"+rtd.t, styles: {}}],
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
    return !!localStorage.getItem("reddit-secret");
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
    query.set("rtj", "only");
    query.set("emotes_as_images", "true");
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
    if(!data) return null;
    const json = JSON.parse(data);
    console.log(json.expires, Date.now());
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
            return [res.status, await res.json()] as const;
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
            refresh_token: v.refresh_token || json.refresh_token,
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
    if(!access_token) return "";
    return "Bearer "+access_token;
};

const splitURL = (path: string): [string, URLSearchParams] => {
    const [pathname, ...query] = path.split("?");
    return [pathname, new URLSearchParams(query.join("?"))];
};
const updateQuery = (path: string, update: {[key: string]: string | undefined}) => {
    const [pathname, query] = splitURL(path);
    for(const [k, v] of Object.entries(update)) {
        if(v) query.set(k, v);
        else query.delete(k);
    }
    return pathname + "?" + query.toString();
};

const pageFromListing = (path: string, listing: Reddit.Page | Reddit.Listing | Reddit.MoreChildren): Generic.Page => {

    if(Array.isArray(listing)) {
        let link_fullname: string | undefined;
        if(listing[0].data.children[0].kind === "t3") {
            link_fullname = listing[0].data.children[0].data.name;
        }
        return {
            header: threadFromListing(listing[0].data.children[0], {force_expand: "open"}, path) as Generic.Thread,
            replies: listing[1].data.children.map(child => threadFromListing(child, {link_fullname}, path)),
            display_style: "comments-view",
        };
    }
    if('json' in listing) {
        if(listing.json.errors.length) {
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
            display_style: "comments-view",
        };
    }

    if(!('data' in listing) || listing.kind !== "Listing") {
        return {
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
            display_style: "comments-view",
        };
    }

    const replies = listing.data.children.map(child => threadFromListing(child, undefined, path));
    if(listing.data.before) {
        // TODO?
    }
    if(listing.data.after) {
        const next_path = updateQuery(path, {before: undefined, after: listing.data.after});
        replies.push({kind: "load_more", load_more: next_path, count: undefined, raw_value: listing});
    }

    return {
        header: {
            kind: "thread",
            title: {text: "Listing"},
            body: {kind: "text", content: "Listing", markdown_format: "none"},
            display_mode: {body: "collapsed", comments: "collapsed"},
            link: "TODO no link",
            layout: "error",
            actions: [],
            default_collapsed: false,
            raw_value: listing,
        },
        replies,
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
        actions: listing.archived ? {error: "archived <6mo"} : isLoggedIn() ? {
            increment: encodeAction("vote", encodeQuery({...vote_data, dir: "1"})),
            decrement: encodeAction("vote", encodeQuery({...vote_data, dir: "-1"})),
            reset: encodeAction("vote", encodeQuery({...vote_data, dir: "0"})),
        } : {error: "not logged in"},
    };
};
const threadFromListing = (listing_raw: Reddit.Post, options: {force_expand?: "open" | "crosspost" | "closed", link_fullname?: string} = {}, parent_permalink: string): Generic.Node => {
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

        const result: Generic.Node = {
            kind: "thread",
            body: is_deleted
                ? {kind: "removed", by: is_deleted,
                    fetch_path: "https://api.pushshift.io/reddit/comment/search?ids="+post_id_no_pfx,
                } : {kind: "richtext", content: richtextDocument(listing.rtjson, {media_metadata: listing.media_metadata ?? {}})},
            display_mode: {body: "visible", comments: "visible"},
            raw_value: listing_raw,
            link: listing.permalink,
            layout: "reddit-comment",
            info: {
                time: listing.created_utc * 1000,
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
            actions: [{
                kind: "reply",
                text: "Reply",
                // POST /api/comment {api_type: json, return_rtjson: true, richtext_json: JSON, text: string, thing_id: parent_thing_id}
                // wait I can use the api to post richtext comments but I can't use the api to get richtext comments what?
                reply_info: encodeReplyInfo({parent_id: listing.name}),
            }, {
                kind: "link",
                text: "Permalink",
                url: listing.permalink ?? "Error no permalink",
            }, getPointsOn(listing)],
            default_collapsed: listing.collapsed,
        };
        if(listing.replies) {
            result.replies = listing.replies.data.children.map(v => threadFromListing(v, options, listing.permalink));
        }
        return result;
    }else if(listing_raw.kind === "t3") {
        const listing = listing_raw.data;
        // if((listing as any).preview) console.log((listing as any).preview);

        let is_deleted: undefined | "author" | "moderator";
        if(listing.author === "[deleted]") {
            if(listing.is_self) {
                if(JSON.stringify(listing.rtjson) === JSON.stringify({document: [{c: [{e: "text", t: "[deleted]"}], e: "par"}]})) {
                    is_deleted = "author";
                }else if(JSON.stringify(listing.rtjson) === JSON.stringify({document: [{c: [{e: "text", t: "[removed]"}], e: "par"}]})) {
                    is_deleted = "moderator";
                }
            }
        }
        const post_id_no_pfx = listing.name.substring(3);

        const content_warnings: Generic.Flair[] = [];
        if(listing.spoiler) content_warnings.push({elems: [{type: "text", text: "Spoiler"}], content_warning: true});
        if(listing.over_18) content_warnings.push({elems: [{type: "text", text: "NSFW"}], content_warning: true});

        const result: Generic.Node = {
            kind: "thread",
            title: {
                text: listing.title,
            },
            flair: [
                ...flairToGenericFlair(listing.link_flair_type, listing.link_flair_text, listing.link_flair_text_color,
                    listing.link_flair_background_color, listing.link_flair_richtext
                ),
                ...content_warnings,
                ...awardingsToFlair(listing.all_awardings ?? []),
            ],
            body: is_deleted
                ? {kind: "removed", by: is_deleted,
                    fetch_path: "https://api.pushshift.io/reddit/submission/search?ids="+post_id_no_pfx,
                }
                : listing.crosspost_parent_list && listing.crosspost_parent_list.length === 1
                ? {kind: "crosspost", source:
                    threadFromListing({kind: "t3", data: listing.crosspost_parent_list[0]}, {force_expand: "crosspost"}, listing.permalink) as Generic.Thread
                }
                : listing.is_self
                ? listing.rtjson.document.length
                    ? {kind: "richtext", content: richtextDocument(listing.rtjson, {media_metadata: listing.media_metadata ?? {}})}
                    : {kind: "none"}
                : listing.gallery_data
                ? {kind: "gallery", images: listing.gallery_data.items.map(gd => {
                    if(!listing.media_metadata) throw new Error("missing media metadata");
                    const moreinfo = listing.media_metadata[gd.media_id];
                    if(!moreinfo) throw new Error("missing mediameta for "+gd.media_id);
                    if(moreinfo.e !== "Image") throw new Error("galleries only support images atm "+gd.media_id);
                    if(moreinfo.status !== "valid") throw new Error("unsupported status in gallery "+gd.media_id);
                    const res: Generic.GalleryItem = {
                        thumb: moreinfo.p[0].u ?? "error",
                        w: moreinfo.p[0].x,
                        h: moreinfo.p[0].y,
                        body: {
                            kind: "captioned_image",
                            url: moreinfo.s.u ?? "error",
                            w: moreinfo.s.x,
                            h: moreinfo.s.y,
                            caption: gd.caption,
                        }
                    };
                    return res;
                })}
                : {kind: "link", url: listing.url, embed_html: listing.media_embed?.content}
            ,
            display_mode: options.force_expand === "crosspost"
                ? {body: "visible", comments: "collapsed"}
                : {body: "collapsed", body_default: options.force_expand, comments: "collapsed"}
            ,
            raw_value: listing_raw,
            link: listing.permalink,
            thumbnail: options.force_expand === "crosspost"
                ? undefined
                : listing.preview?.images?.[0]?.resolutions?.[0]?.url
                ? {url: listing.preview.images[0].resolutions[0].url}
                : {url: listing.thumbnail ?? "none"}
            ,
            layout: "reddit-post",
            info: {
                time: listing.created_utc * 1000,
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
            actions: [{
                kind: "link",
                url: listing.permalink,
                text: listing.num_comments + " comment"+(listing.num_comments === 1 ? "" : "s"),
            }, {
                kind: "link",
                url: "/domain/"+listing.domain,
                text: listing.domain,
            }, getPointsOn(listing)],
            default_collapsed: false,
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
                load_more: options.link_fullname
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
    const scope =
        "identity edit flair history modconfig modflair modlog" + " " +
        "modposts modwiki mysubreddits privatemessages read report save" + " " +
        "submit subscribe vote wikiedit wikiread"
    ;

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
    async getThread(pathraw): Promise<Generic.Page> {
        const pathsplit = pathraw.split("/");
        if(pathsplit[1] === "u") pathsplit[1] = "user";
        const path = pathsplit.join("/");

        try {
            const [status, listing] = await fetch(pathURL(path), {
                mode: "cors", credentials: "omit",
                headers: {
                    ...isLoggedIn() ? {
                        'Authorization': await getAuthorization(),
                    } : {},
                    'Accept': "application/json",
                },
            }).then(async (v) => {
                return [v.status, await v.json() as Reddit.Page | Reddit.Listing | Reddit.MoreChildren] as const;
            });
            if(status !== 200) {
                console.log(status, listing);
                throw new Error("Got status "+status);
            }

            return pageFromListing(path, listing);
        }catch(e) {
            console.log(e);
            const is_networkerror = e.toString().includes("NetworkError");
            
            return {
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

        if(!code || !state) {
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
    async fetchRemoved(frmlink: string): Promise<Generic.Body> {
        type PushshiftResult = {data: {selftext?: string, body?: string}[]};
        const [status, restext] = await fetch(frmlink).then(async (v) => {
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
        if(res.data[0].selftext === "[deleted]"
            || res.data[0].selftext === "[removed]"
            || res.data[0].body === "[deleted]"
            || res.data[0].body === "[removed]"
        ) {
            throw new Error("Post was deleted before it could be saved.");
        }
        if(res.data[0].selftext) {
            return {
                kind: "text",
                content: res.data[0].selftext,
                markdown_format: "reddit",
            };
        }
        if(res.data[0].body) {
            return {
                kind: "text",
                content: res.data[0].body,
                markdown_format: "reddit",
            };
        }
        throw new Error("no selftext or body");
    },
    async act(action: string): Promise<void> {
        const act = decodeAction(action);
        if(act.kind === "vote") {
            type VoteResult = {__nothing: unknown};
            const [status, res] = await fetch(baseURL() + "/api/vote", {
                method: "post", mode: "cors", credentials: "omit",
                headers: isLoggedIn() ? {
                    'Authorization': await getAuthorization(),
                    'Content-Type': "application/x-www-form-urlencoded",
                } : {},
                body: act.query,
            }).then(async (v) => {
                return [v.status, await v.json() as VoteResult] as const;
            });
            if(status !== 200) {
                console.log(status, res);
                throw new Error("got status "+status);
            }
        }else if(act.kind === "-") {
            // placeholder. remove once new action kinds are added.
        }else assertUnreachable(act);
    },
    previewReply(md: string, data: string): Generic.Thread {
        //eslint-disable-next-line @typescript-eslint/no-unused-vars
        const reply_info = decodeReplyInfo(data);
        return {
            kind: "thread",
            body: {kind: "text", content: md, markdown_format: "reddit"},
            display_mode: {body: "visible", comments: "visible"},
            raw_value: [md, data],
            link: "no link",
            layout: "reddit-comment",
            info: {
                time: Date.now(),
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
};

type ReplyInfo = {parent_id: string};
function encodeReplyInfo(rply_info: ReplyInfo): string {
    return JSON.stringify(rply_info);
}
function decodeReplyInfo(rply_info: string): ReplyInfo {
    return JSON.parse(rply_info);
}

function assertUnreachable(v: never): never {
    console.log(v);
    throw new Error("not unreachable");
}