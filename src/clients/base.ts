
import * as Generic from "../types/generic";

export type ThreadClient = {
    id: string,
    links: () => [string, () => string][],
    isLoggedIn: (path: string) => boolean,
    loginURL: string | ((path: string) => Promise<string>),
    getThread: (path: string, from: "pageload" | "loadmore") => Promise<Generic.Page>,
    login: (path: string[], query: URLSearchParams) => Promise<void>,
    fetchRemoved?: (fetch_removed_path: string) => Promise<Generic.Body>,
    //v I guess this should return the updated action state. mastodon returns an entire updated post, reddit returns nothing.
    //v since this isn't uil, I don't have any easy way to update an entire post at once so that wouldn't be very useful
    act: (action: string) => Promise<void>,
    previewReply: (body: string, reply_info: string) => Generic.Thread,
    sendReply: (body: string, reply_info: string) => Promise<Generic.Node>,
};
