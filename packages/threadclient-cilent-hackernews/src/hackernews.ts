
import * as Generic from "api-types-generic";
import { DeprecatedClient, encoderGenerator, ObservableMap, Stringified, stringify, ThreadClient, ThreadClientHelper } from "threadclient-client-base";
import { assertNever, assertUnreachable, result, splitURL, updateQuery } from "tmeta-util";
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
    sort: HN.ListingType,
};
const opaque_loader = encoderGenerator<LoaderData, "loader">("loader");
type SortGroupData = {
    kind: "listing",
    listing: BaseListing,
};
const opaque_sort_group = encoderGenerator<SortGroupData, "sort_group">("sort_group");
type SortOptionData = {
    kind: "listing",
    sort: HN.ListingType,
};
const opaque_sort_option = encoderGenerator<SortOptionData, "sort_option">("sort_option");

type BaseClient = {_?: undefined};
function clientAsParent(content: Generic.Page2Content, base: BaseClient): Generic.PostParent {
    return {
        loader: Generic.p2.prefilledVerticalLoader(content, HnClient.fromContent(content).getLink("client", base), undefined),
    };
}

export type BaseListing = {
    _?: undefined,
    // this is currently empty because we changed all listings to sorts. arguably though we could have multiple:
    // - home listing: (home, newest)
    // - ask listing: (ask, asknew)
    // - show listing: (show, shownew)
    // - jobs listing: (jobs)
    // with posts automatically parented to the most detailed option. we can even have ask have home set as its parent eg.
    // and each can have its own submit page with an automatic prefix
};

type BaseUser = {id: string};

type BaseRawlink = {url: string};

export type UTLRes = {
    content: Generic.Page2Content,
    pivot_loader: null | Generic.OneLoader<Generic.Post>, // TODO: shouldn't this be a vertical loader?
};

type HnLinkDescriptors = {
    client: {
        data: BaseClient,
        content: Generic.Post,
    },

    listing: {
        data: BaseListing,
        content: Generic.Post,
    },
    listing_request: {
        data: BaseListing,
        content: Generic.Opaque<"loader">,
    },
    listing_replies: {
        data: BaseListing,
        content: Generic.HorizontalLoaded,
    },
    listing_sort_group: {
        data: BaseListing,
        content: Generic.SortGroup,
    },
    listing_sort_menu: {
        data: {_?: undefined},
        content: Generic.SortMenu,
    },

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

    user_limited_card: { // TODO: remove, just use user_card
        data: BaseUser,
        content: Generic.LimitedIdentityCard,
    },
    user_card: {
        data: BaseUser,
        content: Generic.FilledIdentityCard,
    },
    user_request: {
        data: BaseUser,
        content: Generic.Opaque<"loader">,
    },
    user_post: {
        data: BaseUser,
        content: Generic.Post,
    },
    user_replies: {
        data: BaseUser,
        content: Generic.HorizontalLoaded,
    },

    rawlink: {
        data: BaseRawlink,
        content: Generic.Post,
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
    client(client, base) {
        return result({error: null, value: {
            kind: "post",
            content: {
                kind: "client",
                navbar: {
                    actions: [
                        {kind: "link", client_id, url: "/", text: "Home"},
                        {kind: "link", client_id, url: "/front", text: "Past"},
                        {kind: "link", client_id, url: "/newcomments", text: "Comments"},
                    ],
                    inboxes: [],
                    client_id,
                },
            },
            internal_data: 0,
            parent: null,
            replies: null,
            url: null,
            client_id,
        }});
    },

    listing(client, base) {
        const content = client.dirty_content;
        const url = updateQuery("/", {});
        return result({error: null, value: {
            kind: "post",
            content: {
                kind: "page",
                wrap_page: {
                    header: {
                        temp_title: "hackernews",
                        filled: Generic.p2.prefilledOneLoader<Generic.FilledIdentityCard>(content, Generic.autoLinkgen("listing→identity→header", base), {
                            names: {
                                display: null,
                                raw: "hackernews",
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
            parent: clientAsParent(content, {}),
            replies: {
                display: "repivot_list",
                loader: {
                    kind: "horizontal_loader",
                    key: client.getLink("listing_replies", base),
                    request: client.getLink("listing_request", base),

                    load_count: null,
                    autoload: true,
                    client_id,
                },
                sort_group: client.getLink("listing_sort_group", base),
                sort_menu: client.getLink("listing_sort_menu", {}),
            },
            url,
            client_id,
        }});
    },
    listing_request(client, base) {
        const sort = client.getListingSort(base);
        return result({error: null, value: opaque_loader.encode({
            kind: "listing",
            listing: base,
            sort,
        })});
    },
    listing_replies(client, base) {
        const sort = client.getListingSort(base);
        const full = client.data.listing_id_to_listing.get(sort);
        if (!full) return null;
        return result({error: null, value: full.map((id): Generic.HorizontalLoader => {
            return itemHorizontalLoader(client, {id});
        })});
    },
    listing_sort_group(client, base) {
        const sort = client.getListingSort(base);
        return result({error: null, value: {
            selected: {key: sort},
            group: opaque_sort_group.encode({kind: "listing", listing: base}),
        }});  
    },
    listing_sort_menu(client, base) {
        const item = (label: string, value: HN.ListingType): Generic.SortOption => (
            {label, value: {kind: "single", key: value, request: opaque_sort_option.encode({kind: "listing", sort: value})}}
        );
        return result({error: null, value: {
            options: [
                item("Top", "topstories"),
                item("New", "newstories"),
                item("Ask", "askstories"),
                item("Show", "showstories"),
                item("Jobs", "jobstories"),
                item("Best", "beststories"),
            ],
        }});
    },

    item: (client: HnClient, base: BaseItem): Generic.ReadLinkResult<Generic.Post> | null => {
        const content = client.dirty_content;
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
                author2: full.by != null ? client.getLink("user_limited_card", {id: full.by}) : undefined,
                body: body.length > 1 ? {kind: "array", body} : body.length === 1 ? body[0]! : {kind: "none"},
                collapsible: {default_collapsed: full.deleted || full.dead || full.type !== "comment"},
                info: {
                    creation_date: full.time != null ? full.time * 1000 : undefined,
                    comments: full.descendants,
                },
                actions: {
                    vote: full.type !== "job" ? {
                        kind: "counter",
                        client_id,
                        unique_id: Generic.autoLinkgen("item→vote", base).toString(),
                        increment: {icon: "angle_up", color: "orange", label: "Upvote", undo_label: "Undo Upvote"},
                        decrement: full.type === "comment" ? {icon: "angle_down", color: "orange", label: "Downvote", undo_label: "Undo Downvote"} : null,
                        count_excl_you: full.score ?? "hidden",
                        you: undefined,
                        actions: {},
                        time: Date.now(),
                    } : undefined,
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
                key: parent_id != null ? client.getLink("item", {id: parent_id}) : client.getLink("client", {}),
                unfilled_parent: client.getLink("client", {}),
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

    user_limited_card(client, base) {
        const url = updateQuery("/user", {id: base.id});
        return result({error: null, value: {
            name_raw: base.id,
            url,
            client_id,
            raw_value: base,
        }});
    },
    user_card(client, base): Generic.ReadLinkResult<Generic.FilledIdentityCard> | null {
        const full = client.data.id_to_user.get(base.id);

        if (full == null) {
            // for the loader, we need to return null for now. TODO: once we migrate reddit, we will
            // be able to remove this
            if (true as false) {
                return null;
            }
        }
        
        return {error: null, value: {
            names: {
                display: full?.id ?? null,
                raw: base.id,
            },
            pfp: null,
            theme: {banner: {kind: "color", color: "#ff6600"}},
            description: full?.about != null ? {kind: "text", content: full.about, client_id, markdown_format: "reddit_html"} : {kind: "none"},
            actions: {main_counter: null},
            menu: null,
            raw_value: full,
            // url: `/user?id=${...}`
        }};
    },
    user_request(client, base) {
        return result({error: null, value: opaque_loader.encode({kind: "user", user: base})});
    },
    user_post(client, base) {
        const url = updateQuery("/user", {id: base.id});
        const content = client.dirty_content;
        return result({error: null, value: {
            kind: "post",
            content: {
                kind: "page",
                wrap_page: {
                    header: {
                        temp_title: base.id,
                        filled: {
                            kind: "one_loader",
                            request: client.getLink("user_request", base),
                            key: client.getLink("user_card", base),
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
            parent: clientAsParent(content, {}),
            replies: {
                display: "repivot_list",
                loader: {
                    kind: "horizontal_loader",
                    request: client.getLink("user_request", base),
                    key: HnClient.fromContent(content).getLink("user_replies", base),
                    client_id,
                },
                // todo sorts: submisisons/comments/favourites
                // unfortunately, the api only supports submissions
            },
            url,
            client_id,
        }});
    },
    user_replies(client, base): Generic.ReadLinkResult<Generic.HorizontalLoaded> | null {
        const full = client.data.id_to_user.get(base.id);
        if (!full) return null;
        return {error: null, value: full.submitted?.map((ch): Generic.HorizontalLoader => itemHorizontalLoader(client, {id: ch})) ?? []};
    },

    rawlink(client, base) {
        const content = client.dirty_content;
        return result({error: null, value: {
            kind: "post",
            content: {
                kind: "post",
                title: {text: "URL not supported"},
                body: {kind: "link", url: rawlink(base.url), client_id},
                collapsible: false,
            },
            internal_data: base,
            replies: null,
            parent: clientAsParent(content, {}),
            url: base.url,
            client_id,
        }});
    }
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
    data: {
        listing_id_to_listing: ObservableMap<HN.ListingType, HN.Listing, Generic.Link<unknown>>,
        id_to_item: ObservableMap<number, HN.Item, Generic.Link<unknown>>,
        id_to_user: ObservableMap<string, HN.User, Generic.Link<unknown>>,
        listing_to_sort: ObservableMap<Stringified<BaseListing>, HN.ListingType, Generic.Link<unknown>>,
    };

    constructor(prev?: HnClient) {
        super(client_id, prev);
        this.data = {
            listing_id_to_listing: new ObservableMap(prev?.data.listing_id_to_listing),
            id_to_item: new ObservableMap(prev?.data.id_to_item),
            id_to_user: new ObservableMap(prev?.data.id_to_user),
            listing_to_sort: new ObservableMap(prev?.data.listing_to_sort),
        };
    }
    dupe(): { client: HnClient; dirty: Generic.Link<unknown>[]; } {
        const res = new HnClient(this);
        return {client: res, dirty: res.takeDirty()};
    }

    getListingSort(listing: BaseListing): HN.ListingType {
        return this.data.listing_to_sort.get(stringify(listing)) ?? "topstories";
    }

    getLink<T extends keyof HnLinkDescriptors>(type: T, value: HnLinkDescriptors[NoInfer<T>]["data"]): Generic.Link<HnLinkDescriptors[NoInfer<T>]["content"]> {
        return `${JSON.stringify([type, value])}` as Generic.Link<HnLinkDescriptors[NoInfer<T>]["content"]>;
    }
    private async fetchListing(listing: HN.ListingType): Promise<void> {
        const resp = await hnRequest(`/v0/${listing as HN.PathBit}`, {method: "GET"});
        this.addDirty(this.data.listing_id_to_listing.setAndList(listing, resp));
    }
    private async fetchItem(id: number): Promise<Generic.Link<Generic.Post>> {
        const resp = await hnRequest(`/v0/item/${(""+id) as HN.PathBit}`, {method: "GET"});
        this.addDirty(this.data.id_to_item.setAndList(id, resp));

        return this.getLink("item", {id});
    }
    private async fetchUser(id: string): Promise<void> {
        const resp = await hnRequest(`/v0/user/${id as HN.PathBit}`, {method: "GET"});
        this.addDirty(this.data.id_to_user.setAndList(id, resp));
    }
    
    resolveLinkOld<T>(link: Generic.Link<T>): Generic.ReadLinkResult<T> | null {
        if (typeof link === "symbol" || !link.startsWith("[")) {
            return Generic.readLink(this.dirty_content, link) ?? Generic.readLink(this.stored_content, link);
        }
        const [type, value_raw] = JSON.parse(link as string) as [keyof HnLinkDescriptors, unknown];
        this.data.id_to_item.beginTracking(link);
        this.data.id_to_user.beginTracking(link);
        this.data.listing_id_to_listing.beginTracking(link);
        this.data.listing_to_sort.beginTracking(link);
        try {
            return resolvers[type](this, value_raw as any) as Generic.ReadLinkResult<T>;
        } catch(e) {
            console.error(e);
            return {error: (e as Error).toString(), value: null};
        } finally {
            // oops need to update esbuild to use 'using'
            this.data.id_to_item.endTracking();
            this.data.id_to_user.endTracking();
            this.data.listing_id_to_listing.endTracking();
            this.data.listing_to_sort.endTracking();
        }
    }

    hasPage2(): boolean {
        return true;
    }
    async pageFromURL(pathraw_in: string): Promise<{ pivot: Generic.Link<Generic.Post>; dirty: Generic.Link<unknown>[]; }> {
        let parsed = path_router.parse(pathraw_in);
        if (!parsed) parsed = {kind: "link_out", out: pathraw_in};

        if (parsed.kind === "listing") {
            const base_listing: BaseListing = {};
            const pivot = this.getLink("listing", base_listing);
            this.addDirty(this.data.listing_to_sort.setAndList(stringify(base_listing), parsed.listing));
            return {pivot, dirty: this.takeDirty()};
        } else if (parsed.kind === "item") {
            const pivot = await this.fetchItem(parsed.id);
            return {pivot, dirty: this.takeDirty()};
        } else if (parsed.kind === "user") {
            const pivot = this.getLink("user_post", {id: parsed.id});
            return {pivot, dirty: this.takeDirty()};
        } else if (parsed.kind === "link_out") {
            const pivot = this.getLink("rawlink", {url: parsed.out}); // no dirties are added because it never changes
            return {pivot, dirty: this.takeDirty()};
        } else assertNever(parsed);
    }
    async loaderLoad(request: Generic.Opaque<"loader">): Promise<{ dirty: Generic.Link<unknown>[]; }> {
        const dec = opaque_loader.decode(request);
        if (dec.kind === "listing") {
            await this.fetchListing(dec.sort);
        } else if (dec.kind === "item") {
            await this.fetchItem(dec.item.id);
        } else if (dec.kind === "user") {
            await this.fetchUser(dec.user.id);
        } else {
            throw new Error("hn-todo");
        }
        return {dirty: this.takeDirty()};
    }
    async sort(group: Generic.Opaque<"sort_group">, option: Generic.Opaque<"sort_option">, tokens: Generic.Tokens): Promise<{ dirty: Generic.Link<unknown>[]; tokens?: Generic.UpdateTokens; }> {
        const group_dec = opaque_sort_group.decode(group);
        const option_dec = opaque_sort_option.decode(option);
        if (group_dec.kind === "listing" && option_dec.kind === "listing") {
            this.addDirty(this.data.listing_to_sort.setAndList(stringify(group_dec.listing), option_dec.sort));
        } else {
            throw new Error("TODO");
        }
        return {dirty: this.takeDirty()};
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
    // maybe we should switch it so the client receives the full url instead of just the path
    if(path.match(/^\/algolia[\/?#]/)) return "raw!https://mod.reddit.com"+path.replace("/algolia", "");
    return "raw!https://news.ycombinator.com"+path;
}
export function rawlinkButton(url: string): Generic.Action {
    return {kind: "link", text: "View on news.ycombinator.com", url: rawlink(url), client_id: "reddit", icon: "external"};
}