
import * as Generic from "../types/generic";

export type ThreadClient = {
    id: string,
    links: () => [string, () => string][]
    isLoggedIn: (path: string) => boolean,
    loginURL: string | ((path: string) => Promise<string>),
    getThread: (path: string) => Promise<Generic.Page>,
    login: (path: string[], query: URLSearchParams) => Promise<void>,
    fetchRemoved?: (fetch_removed_path: string) => Promise<Generic.Body>,
    act: (action: string) => Promise<void>,
    previewReply: (body: string, reply_info: string) => Generic.Thread,
    // I guess this should return the updated action state. mastodon returns an entire updated post, reddit returns nothing.
    // since this isn't uil, I don't have any easy way to update an entire post at once so that wouldn't be very useful
};
