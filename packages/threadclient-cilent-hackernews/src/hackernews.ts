
import * as Generic from "api-types-generic";
import { encoderGenerator, ThreadClient } from "threadclient-client-base";
import { assertNever, assertUnreachable, splitURL, updateQuery } from "tmeta-util";
import * as HN from "./api_types";
import { path_router } from "./routing";


type LoaderData = {
    kind: "item",
    item: BaseItem,
} | {
    kind: "user",
    user: BaseUser,
} | {
    kind: "listing",
    listing: BaseListing,
};
const opaque_loader = encoderGenerator<LoaderData, "loader">("loader");

type BaseClient = {_?: undefined};
export const base_client = {
    url: (base: BaseClient): string | null => null,
    post: Generic.autoOutline("client→post", (content, base: BaseClient): Generic.Post => {
        return {
            kind: "post",
            content: {
                kind: "client",
                navbar: {
                    actions: [
                        {kind: "link", client_id, url: "/", text: "Home"},
                        {kind: "link", client_id, url: "/newest", text: "New"},
                        {kind: "link", client_id, url: "/front", text: "Past"},
                        {kind: "link", client_id, url: "/newcomments", text: "Comments"},
                        {kind: "link", client_id, url: "/ask", text: "Ask"},
                        {kind: "link", client_id, url: "/show", text: "Show"},
                        {kind: "link", client_id, url: "/jobs", text: "Jobs"},
                        {kind: "link", client_id, url: "/best", text: "Best"},
                    ],
                    inboxes: [],
                    client_id,
                },
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

export type BaseListing = {type: HN.ListingType};
export const base_listing = {
    url: (base: BaseListing): string => {
        return updateQuery("/" + base, {});
    },
    post: Generic.autoOutline("listing→post", (content, base: BaseListing): Generic.Post => {
        const id_loader = Generic.p2.fillLinkOnce(content, (
            Generic.autoLinkgen<Generic.Opaque<"loader">>("listing→replies_loader", base)
        ), () => {
            return opaque_loader.encode({
                kind: "listing",
                listing: base,
            });
        });
        const id_filled = base_listing.repliesId(base);
        return {
            kind: "post",
            content: {
                kind: "page",
                wrap_page: {
                    header: {
                        temp_title: base.type,
                        filled: Generic.p2.prefilledOneLoader<Generic.FilledIdentityCard>(content, Generic.autoLinkgen("listing→identity→header", base), {
                            names: {
                                display: null,
                                raw: base.type,
                            },
                            pfp: null,
                            theme: {banner: {kind: "color", color: "#ff6600"}},
                            description: null,
                            actions: {main_counter: null},
                            menu: null,
                            raw_value: 0,
                        }),
                    },
                    sidebar: {
                        display: "tree",
                        loader: Generic.p2.prefilledHorizontalLoader(content, Generic.autoLinkgen("listing→identity→sidebar", base), []),
                    },
                },
            },
            internal_data: base,
            parent: base_client.asParent(content, {}),
            replies: {
                display: "repivot_list",
                loader: {
                    kind: "horizontal_loader",
                    key: id_filled,
                    request: id_loader,

                    load_count: null,
                    autoload: false,
                    client_id,
                },
            },
            url: base_listing.url(base),
            client_id,
        };
    }),
    repliesId: (base: BaseListing): Generic.NullableLink<Generic.HorizontalLoaded> => {
        return Generic.autoLinkgen<Generic.HorizontalLoaded>("listing→replies", base);
    },
};
export type FullListing = {base: BaseListing, full: HN.Listing};
export const full_listing = {
    fill: Generic.autoFill((full: FullListing) => base_listing.repliesId(full.base), (content, full): Generic.HorizontalLoaded => {
        return full.full.map((id): Generic.HorizontalLoader => {
            return base_item.horizontalLoader(content, {id}); // maybe these should have autoload set to true?
        });
    }),
};

export type BaseItem = {id: number};
export const base_item = {
    url: (base: BaseItem): string => {
        return updateQuery("/item", {id: "" + base.id});
    },
    postLink: (base: BaseItem) => Generic.autoLinkgen<Generic.Post>("item→post", base),
    repliesLink: (base: BaseItem) => Generic.autoLinkgen<Generic.HorizontalLoaded>("item→replies", base),
    
    selfHorizontalContentID: (base: BaseItem) => Generic.autoLinkgen<Generic.HorizontalLoaded>("item→horizontalLoader", base),
    loadSelfRequest: Generic.autoFill((base: BaseItem) => Generic.autoLinkgen<Generic.Opaque<"loader">>("item→horizontalLoaderRequest", base), (content, base): Generic.Opaque<"loader"> => {
        return opaque_loader.encode({kind: "item", item: base});
    }),
    horizontalLoader: (content: Generic.Page2Content, base: BaseItem): Generic.HorizontalLoader => {
        return {
            kind: "horizontal_loader",
            key: base_item.selfHorizontalContentID(base),
            request: base_item.loadSelfRequest(content, base),

            load_count: 1,
            client_id,
        };
    },
};
export type FullItem = {base: BaseItem, full: HN.Item};
export const full_item = {
    fill: Generic.autoFill((full: FullItem) => base_item.postLink(full.base), (content, full): Generic.Post => {
        // also fill any horizontal content loaders for this item
        Generic.p2.fillLinkOnce(content, base_item.selfHorizontalContentID(full.base), (): Generic.HorizontalLoaded => [base_item.postLink(full.base)]);

        const body: Generic.Body[] = [];
        if (full.full.url != null) body.push({kind: "link", url: full.full.url, client_id});
        if (full.full.text != null) body.push({kind: "text", content: full.full.text, markdown_format: "reddit_html", client_id});
        if (full.full.deleted) body.push({kind: "richtext", content: [Generic.rt.p(Generic.rt.txt("[deleted]"))]});

        return {
            kind: "post",
            content: {
                kind: "post",
                thumbnail: full.full.title != null ? {kind: "default", thumb: full.full.url != null ? "default" : "self"} : undefined,
                title: full.full.title != null ? {text: full.full.title} : null,
                author2: full.full.by != null ? base_user.authorCard(content, {id: full.full.by}) : undefined,
                body: body.length > 1 ? {kind: "array", body} : body.length === 1 ? body[0]! : {kind: "none"},
                collapsible: {default_collapsed: full.full.type !== "comment"},
                info: {
                    creation_date: full.full.time != null ? full.full.time * 1000 : undefined,
                    comments: full.full.descendants,
                },
                actions: {
                    other: [rawlinkButton(base_item.url(full.base))],
                },
            },
            internal_data: full,
            parent: {loader: {
                kind: "vertical_loader",
                key: full.full.parent != null ? base_item.postLink({id: full.full.parent}) : base_client.post(content, {}),
                temp_parents: [base_client.post(content, {})],
                request: full.full.parent != null ? base_item.loadSelfRequest(content, {id: full.full.parent}) : Generic.p2.createSymbolLinkToError(content, "hn-full_item-noparent", full),
                client_id,
            }},
            replies: (full.full.kids != null && full.full.kids.length > 0) ? {
                display: "tree",
                loader: Generic.p2.prefilledHorizontalLoader(content, base_item.repliesLink(full.base), full.full.kids?.map(ch => base_item.horizontalLoader(content, {id: ch}))),
            } : null,
            url: base_item.url(full.base),
            client_id,
        };
    }),
};

type BaseUser = {id: string};
const base_user = {
    url: (base: BaseUser): string => updateQuery("/user", {id: base.id}),
    authorCard: Generic.autoFill((base: BaseUser) => Generic.autoLinkgen<Generic.LimitedIdentityCard>("user→card", base), (content, base): Generic.LimitedIdentityCard => {
        return {
            name_raw: base.id,
            url: base_user.url(base),
            client_id,
            raw_value: base,
            // to fill the card, we can use the same base_user.loadRequest()
        };
    }),
    loadRequest: Generic.autoOutline("user→load_request", (content, base: BaseUser): Generic.Opaque<"loader"> => {
        return opaque_loader.encode({kind: "user", user: base});
    }),
    headerId: (base: BaseUser) => Generic.autoLinkgen<Generic.FilledIdentityCard>("user→wrap→header", base),
    repliesId: (base: BaseUser) => Generic.autoLinkgen<Generic.HorizontalLoaded>("user→replies", base),
    post: Generic.autoOutline("user→post", (content, base: BaseUser): Generic.Post => {
        return {
            kind: "post",
            content: {
                kind: "page",
                wrap_page: {
                    header: {
                        temp_title: base.id,
                        filled: {
                            kind: "one_loader",
                            request: base_user.loadRequest(content, base),
                            key: base_user.headerId(base),
                            client_id,
                        },
                    },
                    sidebar: {
                        display: "tree",
                        loader: Generic.p2.prefilledHorizontalLoader(content, Generic.autoLinkgen("user→wrap→sidebar", base), []),
                    },
                },
            },
            internal_data: base,
            parent: base_client.asParent(content, {}),
            replies: {
                display: "repivot_list",
                loader: {
                    kind: "horizontal_loader",
                    request: base_user.loadRequest(content, base),
                    key: base_user.repliesId(base),
                    client_id,
                },
                // todo sorts: submisisons/comments/favourites
                // unfortunately, the api only supports submissions
            },
            url: base_user.url(base),
            client_id,
        };
    }),
};
export type FullUser = {base: BaseUser, full: HN.User};
export const full_user = {
    fill(content: Generic.Page2Content, full: FullUser): void {
        Generic.p2.fillLink(content, base_user.headerId(full.base), {
            names: {
                display: null,
                raw: full.full.id,
            },
            pfp: null,
            theme: {banner: {kind: "color", color: "#ff6600"}},
            description: full.full.about != null ? {kind: "text", content: full.full.about, client_id, markdown_format: "reddit_html"} : {kind: "none"},
            actions: {main_counter: null},
            menu: null,
            raw_value: full,
        });
        Generic.p2.fillLink(content, base_user.repliesId(full.base), (full.full.submitted ?? []).map(item => base_item.horizontalLoader(content, {id: item})));
    },
};

type BaseRawlink = {url: string};
const base_rawlink = {
    post: Generic.autoFill((base: BaseRawlink) => Generic.autoLinkgen<Generic.Post>("rawlink→post", base), (content, base): Generic.Post => {
        return {
            kind: "post",
            content: {
                kind: "post",
                title: {text: "URL not supported"},
                body: {kind: "link", url: rawlink(base.url), client_id},
                collapsible: false,
            },
            internal_data: base,
            replies: null,
            parent: base_client.asParent(content, {}),
            url: base.url,
            client_id,
        };
    }),
};

export type UTLRes = {
    content: Generic.Page2Content,
    pivot_loader: null | Generic.OneLoader<Generic.Post>, // TODO: shouldn't this be a vertical loader?
};
export async function getPagev2(pathraw_in: string): Promise<Generic.Pagev2> {
    let parsed = path_router.parse(pathraw_in);
    if (!parsed) parsed = {kind: "link_out", out: pathraw_in};
    const content: Generic.Page2Content = {};

    if (parsed.kind === "listing") {
        const link = base_listing.post(content, {
            type: parsed.listing,
        });
        return {content, loader: Generic.p2.prefilledVerticalLoader(content, link, undefined)};
    } else if (parsed.kind === "item") {
        const item_base: BaseItem = {id: parsed.id};
        return {content, loader: {
            kind: "vertical_loader",
            temp_parents: [base_client.post(content, {})],
            key: base_item.postLink(item_base),
            request: Generic.p2.createSymbolLinkToValue<Generic.Opaque<"loader">>(content, opaque_loader.encode({
                kind: "item",
                item: {id: parsed.id},
            })),
            client_id,
        }};
    } else if (parsed.kind === "user") {
        const link = base_user.post(content, {id: parsed.id});
        return {content, loader: Generic.p2.prefilledVerticalLoader(content, link, undefined)};
    } else if (parsed.kind === "link_out") {
        const link = base_rawlink.post(content, {url: parsed.out});
        return {content, loader: Generic.p2.prefilledVerticalLoader(content, link, undefined)};
    } else assertNever(parsed);
}
async function loadPage2(
    lreq: Generic.Opaque<"loader">,
): Promise<Generic.LoaderResult> {
    const content: Generic.Page2Content = {};
    const dec = opaque_loader.decode(lreq);
    if (dec.kind === "listing") {
        const resp = await hnRequest(`/v0/${dec.listing.type as HN.PathBit}`, {method: "GET"});
        full_listing.fill(content, {base: dec.listing, full: resp});
    } else if (dec.kind === "item") {
        const resp = await hnRequest(`/v0/item/${(""+dec.item.id) as HN.PathBit}`, {method: "GET"});
        full_item.fill(content, {base: dec.item, full: resp});
    } else if (dec.kind === "user") {
        const resp = await hnRequest(`/v0/user/${dec.user.id as HN.PathBit}`, {method: "GET"});
        full_user.fill(content, {base: dec.user, full: resp});
    } else {
        throw new Error("hn-todo");
    }
    return {content};
}


export const client_id = "hackernews";
export const client: ThreadClient = {
    id: client_id,
    getPagev2: getPagev2,
    loader: loadPage2,
};


type RequestOpts<ThingType extends HN.RequestInfo, Extra> = {
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
function baseURL() {
    return "https://hacker-news.firebaseio.com";
}
function pathURL(path: string, opts: {override?: undefined | boolean}) {
    const [pathname, query, hash] = splitURL(path);
    if(!pathname.startsWith("/")) {
        throw new Error("path didn't start with `/` : `"+path+"`");
    }
    if(opts.override ?? false) return baseURL() + pathname + query.toString();
    const res = baseURL() + pathname + ".json?"+query.toString() + (hash === "" ? "" : "#"+hash);
    return res;
}
export async function hnRequest<Path extends keyof HN.Requests, Extra = never>(
    path: Path,
    opts: RequestOpts<HN.Requests[NoInfer<Path>], Extra>,
): Promise<HN.Requests[NoInfer<Path>]["response"] | NoInfer<Extra>> {
    const optsmode = (opts as unknown as {mode: undefined | "urlencoded" | "json"}).mode;
    // TODO if error because token needs refreshing, refresh the token and try again
    try {
        const full_url = pathURL(updateQuery(path, opts.query ?? {}), {override: opts.override});
        const fetchopts: RequestInit = {
            method: opts.method, mode: "cors", credentials: "omit",
            headers: {
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
        const [status, res] = await fetch(full_url, fetchopts).then(async (v) => {
            return [v.status, await v.json() as HN.Requests[Path]["response"]] as const;
        });
        if(status !== 200) {
            if(opts.onstatus) return opts.onstatus(status, res);
            console.log(status, res);
            throw new Error("got status "+status);
        }
        return res;
    }catch(e) {
        console.log("Got error", e);
        if(opts.onerror) return opts.onerror(e as Error);
        throw e;
    }
}

export function rawlink(path: string): string {
    return "raw!https://news.ycombinator.com"+path;
}
export function rawlinkButton(url: string): Generic.Action {
    return {kind: "link", text: "View on news.ycombinator.com", url: rawlink(url), client_id: "reddit", icon: "external"};
}