import * as Generic from "../types/generic.js";

export type ThreadClient = {
    id: string,
    links: () => [string, () => string][]
    isLoggedIn: () => boolean,
    getLoginURL: () => string,
    getThread: (path: string) => Promise<Generic.Page>,
    login: (query: URLSearchParams) => Promise<void>,
    fetchRemoved?: (fetch_removed_path: string) => Promise<Generic.Body>,
    redditVote?: (data: string) => Promise<void>,
};