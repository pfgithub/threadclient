import * as Generic from "api-types-generic";

export type ThreadClientImplements = {
    id: string,
    getLoginURL?: undefined | ((path: Generic.Opaque<"login_url">) => Promise<string>),
    login?: undefined | ((path: string[], query: URLSearchParams) => Promise<void>),
    getThread?: undefined | ((path: string) => Promise<Generic.Page>),
    fetchRemoved?: undefined | ((fetch_removed_path: Generic.Opaque<"fetch_removed_path">) => Promise<Generic.Body>),
    //v I guess this should return the updated action state. mastodon returns an entire updated post, reddit returns nothing.
    //v since this isn't uil, I don't have any easy way to update an entire post at once so that wouldn't be very useful
    act?: undefined | ((action: Generic.Opaque<"act">) => Promise<void>),
    fetchReportScreen?: undefined | ((report: Generic.Opaque<"report">) => Promise<Generic.ReportFlow>),
    sendReport?: undefined | ((action: Generic.Opaque<"send_report">, text?: string) => Promise<Generic.SentReport>),
    previewReply?: undefined | ((body: string, reply_info: Generic.Opaque<"reply">) => Generic.PostContent),
    sendReply?: undefined | ((
        body: string, reply_info: Generic.Opaque<"reply">, mode: "reply" | "edit",
    ) => Promise<Generic.Node>),

    loadMore?: undefined | ((action: Generic.Opaque<"load_more">) => Promise<Generic.Node[]>),
    loadMoreUnmounted?: undefined | ((
        action: Generic.Opaque<"load_more_unmounted">
    ) => Promise<{children: Generic.UnmountedNode[], next?: undefined | Generic.LoadMoreUnmounted}>),

    hydrateInbox?: undefined | ((inbox: Generic.Opaque<"deferred_inbox">) => Promise<Generic.InboxData>),

    submit?: undefined | ((action: Generic.Opaque<"submit">, content: Generic.SubmitResult.SubmitPost) => Promise<string>),
};
export abstract class ThreadClient implements ThreadClientImplements {
    id: string;
    getLoginURL?: undefined | ((path: Generic.Opaque<"login_url">) => Promise<string>);
    login?: undefined | ((path: string[], query: URLSearchParams) => Promise<void>);
    /** @deprecated: replace with getPagev2 */
    getThread?: undefined | ((path: string) => Promise<Generic.Page>);
    fetchRemoved?: undefined | ((fetch_removed_path: Generic.Opaque<"fetch_removed_path">) => Promise<Generic.Body>);
    //v I guess this should return the updated action state. mastodon returns an entire updated post, reddit returns nothing.
    //v since this isn't uil, I don't have any easy way to update an entire post at once so that wouldn't be very useful
    act?: undefined | ((action: Generic.Opaque<"act">) => Promise<void>);
    fetchReportScreen?: undefined | ((report: Generic.Opaque<"report">) => Promise<Generic.ReportFlow>);
    sendReport?: undefined | ((action: Generic.Opaque<"send_report">, text?: string) => Promise<Generic.SentReport>);
    previewReply?: undefined | ((body: string, reply_info: Generic.Opaque<"reply">) => Generic.PostContent);
    sendReply?: undefined | ((
        body: string, reply_info: Generic.Opaque<"reply">, mode: "reply" | "edit",
    ) => Promise<Generic.Node>);

    loadMore?: undefined | ((action: Generic.Opaque<"load_more">) => Promise<Generic.Node[]>);
    loadMoreUnmounted?: undefined | ((
        action: Generic.Opaque<"load_more_unmounted">
    ) => Promise<{children: Generic.UnmountedNode[], next?: undefined | Generic.LoadMoreUnmounted}>);

    hydrateInbox?: undefined | ((inbox: Generic.Opaque<"deferred_inbox">) => Promise<Generic.InboxData>);

    submit?: undefined | ((action: Generic.Opaque<"submit">, content: Generic.SubmitResult.SubmitPost) => Promise<string>);

    constructor(id: string) {
        this.id = id;
    }
    
    abstract hasPage2(): boolean;
    abstract pageFromURL(url: string): Promise<{pivot: Generic.Link<Generic.Post>, dirty: Generic.Link<unknown>[]}>;
    abstract loaderLoad(request: Generic.Opaque<"loader">): Promise<{dirty: Generic.Link<unknown>[]}>;
    resolveLink<T>(link: Generic.Link<T>): T {
        const rlres = this.resolveLinkOld(link);
        if (rlres == null || rlres.error) throw new Error("link contents none or error: "+(rlres?.error ?? "none"));
        return rlres.value!;
    }
    /** @deprecated use resolveLink instead (TODO: finish the checklist) */
    abstract resolveLinkOld<T>(link: Generic.Link<T>): Generic.ReadLinkResult<T> | null;
    abstract dupe(): {client: ThreadClient, dirty: Generic.Link<unknown>[]};
}

export class ObservableMap<T, U, Tracking> {
    private _map: Map<T, U>;
    private _dependencies: Map<T, Set<Tracking>>;
    private _tracking?: {key: Tracking, cleared: Set<T>};
    constructor(prev?: ObservableMap<T, U, Tracking>) {
        this._map = new Map(prev?._map);
        this._dependencies = new Map(prev?._dependencies.entries().map(([k, v]) => [k, new Set(v)]));
        this._tracking = prev?._tracking; // should be undefined. maybe we should assert it is.
    }

    get(key: T): U | undefined {
        this._view(key);
        return this._map.get(key);
    }
    has(key: T): boolean {
        this._view(key);
        return this._map.has(key);
    }
    setAndList(key: T, value: U): Set<Tracking> {
        this._map.set(key, value);
        return this._deps(key);
    }
    private _deps(key: T): Set<Tracking> {
        if (!this._dependencies.has(key)) {
            this._dependencies.set(key, new Set());
        }
        return this._dependencies.get(key)!;
    }
    private _view(key: T): void {
        if (this._tracking === undefined) return;
        const deps = this._deps(key);
        if (!this._tracking.cleared.has(key)) {
            this._tracking.cleared.add(key);
            deps.clear();
        }
        deps.add(this._tracking.key);
    }

    // https://github.com/tc39/proposal-upsert
    getOrInsert(key: T, value: U): U {
        if (!this._map.has(key)) this._map.set(key, value);
        return this._map.get(key)!;
    }
    getOrInsertComputed(key: T, value: (key: T) => U): U {
        if (!this._map.has(key)) this._map.set(key, value(key));
        return this._map.get(key)!;
    }

    track(key: Tracking): {[Symbol.dispose]: () => void} {
        this.beginTracking(key);
        return {[Symbol.dispose]: this.endTracking.bind(this)};
    }
    beginTracking(key: Tracking): void {
        if (this._tracking !== undefined) {
            throw new Error("should not be tracking");
        }
        this._tracking = {key, cleared: new Set()};
    }
    endTracking(): void {
        if (this._tracking === undefined) {
            throw new Error("should be tracking");
        }
        this._tracking = undefined;
    }
}

const cxsym = Symbol("client");
export abstract class ThreadClientHelper extends ThreadClient {
    dirty: Set<Generic.Link<unknown>>;

    /** @deprecated: migrate off of Page2Content */
    dirty_content: Generic.Page2Content;
    /** @deprecated: migrate off of Page2Content */
    stored_content: Generic.Page2Content;

    constructor(id: string, prev?: ThreadClientHelper) {
        super(id);
        this.dirty = new Set(prev?.dirty);
        this.stored_content = {...prev?.stored_content ?? {}, [cxsym]: this as any};
        this.dirty_content = {...prev?.dirty_content ?? {}, [cxsym]: this as any};
    }

    addDirty(add: Set<Generic.Link<unknown>>): void {
        for (const item of add) this.dirty.add(item);
    }

    takeDirty(): Generic.Link<unknown>[] {
        for (const key of Object.keys(this.dirty_content)) this.dirty.add(key as Generic.Link<unknown>);
        const dirty = [...this.dirty];
        this.dirty.clear();
        Object.assign(this.stored_content, this.dirty_content);
        this.dirty_content = {[cxsym]: this as any};
        console.log("dirty", dirty, Object.keys(this.dirty_content), Object.keys(this.stored_content));
        return dirty;
    }
    /** @deprecated: migrate off of Page2Content */
    static fromContent<T extends abstract new (...args: any) => any>(this: T, content: Generic.Page2Content): NoInfer<InstanceType<T>> {
        const res = content[cxsym] as unknown as InstanceType<T>;
        if (!res) throw new Error("missing client in fromContent");
        return res;
    }
}

//eslint-disable-next-line @typescript-eslint/ban-types
export function encoderGenerator<InType extends Object, T extends Generic.DataEncodings>(t: T): {
    encode: (v: InType) => Generic.Opaque<T>,
    decode: (v: Generic.Opaque<T>) => InType,
} {
    const encoder_symbol = Symbol(t);
    return {
        encode(v) {
            return {...v, encoding_symbol: encoder_symbol, encoding_type: t};
        },
        decode(v) {
            if(v.encoding_symbol !== encoder_symbol) {
                console.log("decoder error", v, t, encoder_symbol);
                throw new Error("Decoder was passed encoded data from the wrong encoder");
            }
            return v as unknown as InType;
        }
    };
}

export class DeprecatedClient extends ThreadClient {
    getLoginURL?: undefined | ((path: Generic.Opaque<"login_url">) => Promise<string>);
    login?: undefined | ((path: string[], query: URLSearchParams) => Promise<void>);
    /** @deprecated: replace with getPagev2 */
    getThread?: undefined | ((path: string) => Promise<Generic.Page>);
    fetchRemoved?: undefined | ((fetch_removed_path: Generic.Opaque<"fetch_removed_path">) => Promise<Generic.Body>);
    //v I guess this should return the updated action state. mastodon returns an entire updated post, reddit returns nothing.
    //v since this isn't uil, I don't have any easy way to update an entire post at once so that wouldn't be very useful
    act?: undefined | ((action: Generic.Opaque<"act">) => Promise<void>);
    fetchReportScreen?: undefined | ((report: Generic.Opaque<"report">) => Promise<Generic.ReportFlow>);
    sendReport?: undefined | ((action: Generic.Opaque<"send_report">, text?: string) => Promise<Generic.SentReport>);
    previewReply?: undefined | ((body: string, reply_info: Generic.Opaque<"reply">) => Generic.PostContent);
    sendReply?: undefined | ((
        body: string, reply_info: Generic.Opaque<"reply">, mode: "reply" | "edit",
    ) => Promise<Generic.Node>);

    loadMore?: undefined | ((action: Generic.Opaque<"load_more">) => Promise<Generic.Node[]>);
    loadMoreUnmounted?: undefined | ((
        action: Generic.Opaque<"load_more_unmounted">
    ) => Promise<{children: Generic.UnmountedNode[], next?: undefined | Generic.LoadMoreUnmounted}>);

    hydrateInbox?: undefined | ((inbox: Generic.Opaque<"deferred_inbox">) => Promise<Generic.InboxData>);

    submit?: undefined | ((action: Generic.Opaque<"submit">, content: Generic.SubmitResult.SubmitPost) => Promise<string>);

    content: Generic.Page2Content = {};
    constructor(private backing: ThreadClientImplements & {
        /** @deprecated: replace with getPagev2 */
        getPage?: undefined | ((path: string) => Promise<Generic.Page2>),
        getPagev2?: (path: string) => Promise<Generic.Pagev2>
        loader?: undefined | ((
            request: Generic.Opaque<"loader">,
        ) => Promise<Generic.LoaderResult>),
    }) {
        super(backing.id);
        this.getLoginURL = backing.getLoginURL;
        this.login = backing.login;
        this.getThread = backing.getThread;
        this.fetchRemoved = backing.fetchRemoved;
        this.act = backing.act;
        this.fetchReportScreen = backing.fetchReportScreen; // this will switch to a loader
        this.sendReport = backing.sendReport;
        this.previewReply = backing.previewReply;
        this.sendReply = backing.sendReply;
        this.loadMore = backing.loadMore;
        this.loadMoreUnmounted = backing.loadMoreUnmounted;
        this.hydrateInbox = backing.hydrateInbox;
        this.submit = backing.submit;
    }

    hasPage2(): boolean {
        return !!(this.backing.getPage || this.backing.getPagev2);
    }
    async pageFromURL(url: string): Promise<{pivot: Generic.Link<Generic.Post>, dirty: Generic.Link<unknown>[]}> {
        const client = this.backing;
        if (!client.getPagev2) {
            if (client.getPage) {
                const result = await client.getPage(url);
                this.content = {...this.content, ...result.content};
                return {pivot: result.pivot, dirty: Object.keys(result.content) as Generic.Link<unknown>[]};
            }
            throw new Error("missing getThread/getPage for client: "+client.id);
        }
        const page2new = await client.getPagev2!(url);
        const dirty = new Set<Generic.Link<unknown>>();
        for (const key of Object.keys(page2new.content)) dirty.add(key as Generic.Link<unknown>);
        this.content = {...this.content, ...page2new.content};
        const rl_res = Generic.readLink(this.content, page2new.loader.key);
        if (rl_res == null) {
            const loadreq = Generic.readLink(page2new.content, page2new.loader.request);
            if(loadreq == null || loadreq.error != null) throw new Error("load fail: "+JSON.stringify(loadreq));
            if (client.loader == null) throw new Error("load fail - missing client.loader");
            const loadres = await client.loader(loadreq.value);
            this.content = {...this.content, ...loadres.content};
            for (const key of Object.keys(loadres.content)) dirty.add(key as Generic.Link<unknown>);
        }
        return {pivot: page2new.loader.key, dirty: [...dirty]};
    }
    async loaderLoad(request: Generic.Opaque<"loader">): Promise<{dirty: Generic.Link<unknown>[]}> {
        const result = await this.backing.loader!(request);
        this.content = {...this.content, ...result.content};
        return {dirty: Object.keys(result.content) as Generic.Link<unknown>[]};
    }
    resolveLinkOld<T>(link: Generic.Link<T>): Generic.ReadLinkResult<T> | null {
        return Generic.readLink(this.content, link);
    }
    // first we need to modify all things to assume all links are filled
    // - that means vertical loaders to linked lists and horizontal loaders to linked lists
    // - ✗ looks like we have to wait until the migration to do this
    // then we can migrate to this
    // then we can migrate to assuming all links are filled by changing vertical loaders
    // then we can start implementing nondeprecated clients

    dupe(): {client: DeprecatedClient, dirty: Generic.Link<unknown>[]} {
        const result = new DeprecatedClient(this.backing);
        result.content = {...this.content};
        return {client: result, dirty: []};
    }
}
