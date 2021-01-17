
import * as Generic from "../types/generic.js";

export type ThreadClient = {
    id: string,
    links: () => [string, () => string][]
    isLoggedIn: () => boolean,
    loginURL: string | ((path: string) => Promise<string>),
    getThread: (path: string) => Promise<Generic.Page>,
    login: (path: string[], query: URLSearchParams) => Promise<void>,
    fetchRemoved?: (fetch_removed_path: string) => Promise<Generic.Body>,
    redditVote?: (data: string) => Promise<void>,
};
