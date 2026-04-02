import type * as Generic from "api-types-generic";

export type ThreadClient = {
    id: string,
    getLoginURL?: undefined | ((path: Generic.Opaque<"login_url">) => Promise<string>),
    login?: undefined | ((path: string[], query: URLSearchParams) => Promise<void>),
    /** @deprecated: replace with getPagev2 */
    getPage?: undefined | ((path: string) => Promise<Generic.Page2>),
    getPagev2?: (path: string) => Promise<Generic.Pagev2>
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

    loader?: undefined | ((
        request: Generic.Opaque<"loader">,
    ) => Promise<Generic.LoaderResult>),

    hydrateInbox?: undefined | ((inbox: Generic.Opaque<"deferred_inbox">) => Promise<Generic.InboxData>),

    submit?: undefined | ((action: Generic.Opaque<"submit">, content: Generic.SubmitResult.SubmitPost) => Promise<string>),
};

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

export class DeprecatedClient implements ThreadClient {
    id: string;
    getLoginURL?: undefined | ((path: Generic.Opaque<"login_url">) => Promise<string>);
    login?: undefined | ((path: string[], query: URLSearchParams) => Promise<void>);
    /** @deprecated: replace with getPagev2 */
    getPage?: undefined | ((path: string) => Promise<Generic.Page2>);
    getPagev2?: (path: string) => Promise<Generic.Pagev2>
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

    loader?: undefined | ((
        request: Generic.Opaque<"loader">,
    ) => Promise<Generic.LoaderResult>);

    hydrateInbox?: undefined | ((inbox: Generic.Opaque<"deferred_inbox">) => Promise<Generic.InboxData>);

    submit?: undefined | ((action: Generic.Opaque<"submit">, content: Generic.SubmitResult.SubmitPost) => Promise<string>);

    content: Generic.Page2Content = {};
    constructor(backing: ThreadClient) {
        this.id = backing.id;
        this.getLoginURL = backing.getLoginURL;
        this.login = backing.login;
        this.getPagev2 = backing.getPagev2;
        this.getThread = backing.getThread;
        this.fetchRemoved = backing.fetchRemoved;
        this.act = backing.act;
        this.fetchReportScreen = backing.fetchReportScreen; // this will switch to a loader
        this.sendReport = backing.sendReport;
        this.previewReply = backing.previewReply;
        this.sendReply = backing.sendReply;
        this.loadMore = backing.loadMore;
        this.loadMoreUnmounted = backing.loadMoreUnmounted;
        this.loader = backing.loader;
        this.hydrateInbox = backing.hydrateInbox;
        this.submit = backing.submit;
    }

    async pageFromURL(url: string): Promise<{pivot: Generic.VerticalLoader, dirty: Generic.Link<unknown>[]}> {
        const result = await this.getPagev2!(url)
        this.content = {...this.content, ...result.content};
        return {pivot: result.loader, dirty: Object.keys(result.content) as Generic.Link<unknown>[]};
    }
    async loaderLoad(request: Generic.Opaque<"loader">): Promise<{dirty: Generic.Link<unknown>[]}> {
        const result = await this.loader!(request);
        this.content = {...this.content, ...result.content};
        return {dirty: Object.keys(result.content) as Generic.Link<unknown>[]};
    }
    resolveLink<T>(link: Generic.Link<T>): T {
        if (!Object.hasOwn(this.content, link)) throw new Error("missing link target");
        const resp = this.content[link];
        if (resp == null || 'error' in resp) throw new Error("link contents none or error: "+(resp?.error ?? "none"));
        return resp.data as T;
    }
    /** @deprecated use resolveLink instead (TODO: finish the checklist) */
    resolveLinkOld<T>(link: Generic.Link<T>): Generic.ReadLinkResult<T> {
        if (!Object.hasOwn(this.content, link)) throw new Error("missing link target");
        const resp = this.content[link];
        return resp as Generic.ReadLinkResult<T>;
    }
    // first we need to modify all things to assume all links are filled
    // - that means vertical loaders to linked lists and horizontal loaders to linked lists
    // - ✗ looks like we have to wait until the migration to do this
    // then we can migrate to this
    // then we can migrate to assuming all links are filled by changing vertical loaders
    // then we can start implementing nondeprecated clients
}
