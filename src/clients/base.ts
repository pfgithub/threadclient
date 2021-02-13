
import * as Generic from "../types/generic";

export type ThreadClient = {
    id: string,
    links: () => [string, () => string][],
    isLoggedIn: (path: string) => boolean,
    loginURL: string | ((path: string) => Promise<string>),
    getThread: (path: string) => Promise<Generic.Page>,
    login: (path: string[], query: URLSearchParams) => Promise<void>,
    fetchRemoved?: (fetch_removed_path: Generic.Opaque<"fetch_removed_path">) => Promise<Generic.Body>,
    //v I guess this should return the updated action state. mastodon returns an entire updated post, reddit returns nothing.
    //v since this isn't uil, I don't have any easy way to update an entire post at once so that wouldn't be very useful
    act: (action: Generic.Opaque<"act">) => Promise<void>,
    fetchReportScreen?: (report: Generic.Opaque<"report">) => Promise<Generic.ReportFlow>,
    sendReport?: (action: Generic.Opaque<"send_report">, text?: string) => Promise<Generic.SentReport>,
    previewReply: (body: string, reply_info: Generic.Opaque<"reply">) => Generic.Thread,
    sendReply: (body: string, reply_info: Generic.Opaque<"reply">) => Promise<Generic.Node>,

    loadMore: (action: Generic.Opaque<"load_more">) => Promise<Generic.Node[]>,
    loadMoreUnmounted: (action: Generic.Opaque<"load_more_unmounted">) => Promise<{children: Generic.UnmountedNode[], next?: Generic.LoadMoreUnmounted}>,
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
