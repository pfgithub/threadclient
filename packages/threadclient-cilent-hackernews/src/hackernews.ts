
import * as Generic from "api-types-generic";
import { DeprecatedClient, encoderGenerator, ThreadClient, ThreadClientHelper } from "threadclient-client-base";
import { assertNever, assertUnreachable, splitURL, updateQuery } from "tmeta-util";
import * as HN from "./api_types";
import { path_router } from "./routing";

/*
threadclient-extension will be needed for:
- accounts:
    - log in
    - comment
    - submit
    - newpoll
    - upvote/downvote (requires html scraping, see https://lukakerr.github.io/javascript/reverse-engineering-hacker-news-into-an-api)
    - flag
    - favourite
- html scraping:
    - impl /past
    - impl /comments
    - user page comments/favourites
    - showing new user badges
    - showing comment opacities
    - showdead
- can be made as a threadclient ui feature
    - noprocrast
*/

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
                    autoload: true,
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
            return itemHorizontalLoader(HnClient.fromContent(content), {id});
        });
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
        Generic.p2.fillLink(content, base_user.repliesId(full.base), (full.full.submitted ?? []).map(id => itemHorizontalLoader(HnClient.fromContent(content), {id})));
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

type HnLinkDescriptors = {
    item: {
        data: BaseItem,
        content: Generic.Post,
    },
    item_horizontal: {
        data: BaseItem,
        content: Generic.HorizontalLoaded,
    },
    item_request: {
        data: BaseItem,
        content: Generic.Opaque<"loader">,
    },
    item_replies: {
        data: BaseItem,
        content: Generic.HorizontalLoaded,
    },
};

type BaseItem = {id: number};
function itemUrl(base: BaseItem): string {
    return updateQuery("/item", {id: "" + base.id});
}
const resolvers: {
    // TODO: eventually once all are migrated and we have upgraded loaders, this can return just T instead of ReadLinkResult<T>
    [key in keyof HnLinkDescriptors]: (client: HnClient, base: HnLinkDescriptors[key]["data"]) => Generic.ReadLinkResult<HnLinkDescriptors[key]["content"]> | null
} = {
    item: (client: HnClient, base: BaseItem): Generic.ReadLinkResult<Generic.Post> | null => {
        const content = client.content;
        const full = client.data.id_to_item.get(base.id);
        if (!full) return null;
        const url = itemUrl(base);
        const body: Generic.Body[] = [];
        if (full.url != null) body.push({kind: "link", url: full.url, client_id});
        if (full.text != null) body.push({kind: "text", content: full.text, markdown_format: "reddit_html", client_id});
        if (full.deleted) body.push({kind: "richtext", content: [Generic.rt.p(Generic.rt.txt("[deleted]"))]});
        if (full.parts) {
            body.push({kind: "richtext", content: [Generic.rt.ul(
                ...full.parts.map((part, i) => Generic.rt.li(Generic.rt.p(Generic.rt.link({id: client_id}, itemUrl({id: part}), {}, Generic.rt.txt(`Option ${i+1}`))))),
            )]});
        };

        const parent_id = full.parent ?? full.poll ?? undefined;

        return {error:null,value:{
            kind: "post",
            content: {
                kind: "post",
                thumbnail: full.title != null ? {kind: "default", thumb: full.url != null ? "default" : "self"} : undefined,
                title: full.title != null ? {text: full.title} : null,
                author2: full.by != null ? base_user.authorCard(content, {id: full.by}) : undefined,
                body: body.length > 1 ? {kind: "array", body} : body.length === 1 ? body[0]! : {kind: "none"},
                collapsible: {default_collapsed: full.deleted || full.dead || full.type !== "comment"},
                info: {
                    creation_date: full.time != null ? full.time * 1000 : undefined,
                    comments: full.descendants,
                },
                actions: {
                    vote: {
                        kind: "counter",
                        client_id,
                        unique_id: Generic.autoLinkgen("item→vote", base).toString(),
                        increment: {icon: "up_arrow", color: "orange", label: "Upvote", undo_label: "Undo Upvote"},
                        decrement: full.type === "comment" ? {icon: "down_arrow", color: "orange", label: "Downvote", undo_label: "Undo Downvote"} : null,
                        count_excl_you: full.score ?? "hidden",
                        you: undefined,
                        actions: {},
                        time: Date.now(),
                    },
                    other: [
                        {
                            // maybe this should be a report action rather than a counter?
                            kind: "counter",
                            client_id,
                            unique_id: Generic.autoLinkgen("item→flag", base).toString(),
                            increment: {icon: "flag", color: "orange", label: "Flag", undo_label: "Undo Flag"},
                            decrement: null,
                            count_excl_you: full.score ?? "hidden",
                            you: undefined,
                            actions: {},
                            time: Date.now(),
                        },
                        {
                            kind: "counter",
                            client_id,
                            unique_id: Generic.autoLinkgen("item→favourite", base).toString(),
                            increment: {icon: "star", color: "orange", label: "Favorite", undo_label: "Undo Favorite"},
                            decrement: null,
                            count_excl_you: full.score ?? "hidden",
                            you: undefined,
                            actions: {},
                            time: Date.now(),
                        },
                        rawlinkButton(url),
                    ],
                },
            },
            internal_data: full,
            parent: {loader: {
                kind: "vertical_loader",
                key: parent_id != null ? client.getLink("item", {id: parent_id}) : base_client.post(content, {}),
                unfilled_parent: base_client.post(content, {}),
                request: parent_id != null ? client.getLink("item_request", {id: parent_id}) : Generic.p2.createSymbolLinkToError(content, "hn-full_item-noparent", full),
                client_id,
            }},
            replies: (full.kids != null && full.kids.length > 0) ? {
                display: "tree",
                loader: {
                    kind: "horizontal_loader",
                    key: client.getLink("item_replies", base),
                    load_count: null,
                    request: Generic.p2.createSymbolLinkToError(content, "horizontal loader claimed to be prefilled", {}),
                    client_id,
                },
            } : null,
            url: url,
            client_id,
        }};
    },
    item_horizontal(client, base): Generic.ReadLinkResult<Generic.HorizontalLoaded> | null {
        if (!client.data.id_to_item.has(base.id)) return null;
        return {error: null, value: [client.getLink("item", base)]};
    },
    item_replies(client, base): Generic.ReadLinkResult<Generic.HorizontalLoaded> | null {
        const full = client.data.id_to_item.get(base.id);
        if (!full) return null;
        return {error: null, value: full.kids?.map((ch): Generic.HorizontalLoader => itemHorizontalLoader(client, {id: ch})) ?? []};
    },
    item_request(client, base): Generic.ReadLinkResult<Generic.Opaque<"loader">> | null {
        return {error: null, value: opaque_loader.encode({kind: "item", item: base})};
    },
};
function itemHorizontalLoader(client: HnClient, base: BaseItem): Generic.HorizontalLoader {
    return {
        kind: "horizontal_loader",
        key: client.getLink("item_horizontal", base),
        load_count: null,
        request: client.getLink("item_request", base),
        client_id,
        autoload: true,
    };
}

class HnClient extends ThreadClientHelper {
    /*
    decision:
    - either we can migrate to resolvers
    - or we can migrate only what is necessary
    the problem with the resolvers is they make you manually do dirty tracking
    and fixing that would be a bit annoying (the maps would have to be custom classes that track some stuff)
    and also we would be keeping around extra data

    using the old method we keep around less total data
    */
    data: {
        listing_id_to_listing: Map<HN.ListingType, HN.Listing>,
        id_to_item: Map<number, HN.Item>,
        id_to_user: Map<string, HN.User>,
    };

    constructor(prev?: HnClient) {
        super(client_id, prev);
        this.data = {
            listing_id_to_listing: new Map(prev?.data.listing_id_to_listing),
            id_to_item: new Map(prev?.data.id_to_item),
            id_to_user: new Map(prev?.data.id_to_user),
        };
    }
    dupe(): { client: HnClient; dirty: Generic.Link<unknown>[]; } {
        const res = new HnClient(this);
        return {client: res, dirty: res.takeDirtyAndApplyContent({})};
    }

    getLink<T extends keyof HnLinkDescriptors>(type: T, value: HnLinkDescriptors[NoInfer<T>]["data"]): Generic.Link<HnLinkDescriptors[NoInfer<T>]["content"]> {
        return `${JSON.stringify([type, value])}` as Generic.Link<HnLinkDescriptors[NoInfer<T>]["content"]>;
    }
    private async fetchItem(id: number): Promise<Generic.Link<Generic.Post>> {
        const resp = await hnRequest(`/v0/item/${(""+id) as HN.PathBit}`, {method: "GET"});
        this.data.id_to_item.set(id, resp);

        const item = this.getLink("item", {id});
        // this sucks. we should have these update automatically by tracking the dependencies of the resolve functions?
        this.dirty.add(item);
        this.dirty.add(this.getLink("item_horizontal", {id}));
        this.dirty.add(this.getLink("item_replies", {id}));
        return item;
    }
    
    resolveLinkOld<T>(link: Generic.Link<T>): Generic.ReadLinkResult<T> | null {
        if (typeof link === "symbol" || !link.startsWith("[")) {
            return Generic.readLink(this.content, link);
        }
        const [type, value_raw] = JSON.parse(link as string) as [keyof HnLinkDescriptors, unknown];
        try {
            return resolvers[type](this, value_raw as any) as Generic.ReadLinkResult<T>;
        } catch(e) {
            console.error(e);
            return {error: (e as Error).toString(), value: null};
        }
    }

    hasPage2(): boolean {
        return true;
    }
    async pageFromURL(pathraw_in: string): Promise<{ pivot: Generic.Link<Generic.Post>; dirty: Generic.Link<unknown>[]; }> {
        let parsed = path_router.parse(pathraw_in);
        if (!parsed) parsed = {kind: "link_out", out: pathraw_in};

        const content: Generic.Page2Content = this.makeContent();

        if (parsed.kind === "listing") {
            const pivot = base_listing.post(content, {
                type: parsed.listing,
            });
            return {pivot, dirty: this.takeDirtyAndApplyContent(content)};
        } else if (parsed.kind === "item") {
            const pivot = await this.fetchItem(parsed.id);
            return {pivot, dirty: this.takeDirtyAndApplyContent(content)};
        } else if (parsed.kind === "user") {
            const pivot = base_user.post(content, {id: parsed.id});
            return {pivot, dirty: this.takeDirtyAndApplyContent(content)};
        } else if (parsed.kind === "link_out") {
            const pivot = base_rawlink.post(content, {url: parsed.out});
            return {pivot, dirty: this.takeDirtyAndApplyContent(content)};
        } else assertNever(parsed);
    }
    async loaderLoad(request: Generic.Opaque<"loader">): Promise<{ dirty: Generic.Link<unknown>[]; }> {
        const content: Generic.Page2Content = this.makeContent();
        const dec = opaque_loader.decode(request);
        if (dec.kind === "listing") {
            const resp = await hnRequest(`/v0/${dec.listing.type as HN.PathBit}`, {method: "GET"});
            full_listing.fill(content, {base: dec.listing, full: resp});
        } else if (dec.kind === "item") {
            await this.fetchItem(dec.item.id);
        } else if (dec.kind === "user") {
            const resp = await hnRequest(`/v0/user/${dec.user.id as HN.PathBit}`, {method: "GET"});
            full_user.fill(content, {base: dec.user, full: resp});
        } else {
            throw new Error("hn-todo");
        }
        return {dirty: this.takeDirtyAndApplyContent(content)};
    }
}

export const client_id = "hackernews";
export const client: ThreadClient = new HnClient();

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