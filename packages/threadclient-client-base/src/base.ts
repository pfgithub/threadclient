import type * as Generic from "api-types-generic";

export type ThreadClient = {
    id: string,
    getLoginURL?: undefined | ((path: Generic.Opaque<"login_url">) => Promise<string>),
    login?: undefined | ((path: string[], query: URLSearchParams) => Promise<void>),
    getPage?: undefined | ((path: string) => Promise<Generic.Page2>),
    // getPagev2: (path: string) => {content: Generic.Page2Content, pivot: Generic.OneLoader<Generic.Post>}
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
