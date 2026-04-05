/** if the URL is supported by threadclient, return it as a path.
 * @example https://reddit.com/r/all -> /reddit/r/all
 * */
export function resolveThreadClientSupportedURL(href: string): {client: string, path: string} | null {
    let urlparsed: URL | undefined;
    try {
        urlparsed = new URL(href);
    }catch(e) {
        return null;
    }

    // === REDDIT ===
    if(urlparsed && (urlparsed.host === "reddit.com" || urlparsed.host.endsWith(".reddit.com"))) {
        if(urlparsed.host === "mod.reddit.com") {
            return {client: "reddit", path: "/mod"+urlparsed.pathname+urlparsed.search+urlparsed.hash};
        }else{
            return {client: "reddit", path: urlparsed.pathname+urlparsed.search+urlparsed.hash};
        }
    }
    if(urlparsed && (urlparsed.host === "redd.it")) {
        return {client: "reddit", path: "/reddit/comments"+urlparsed.pathname+urlparsed.search+urlparsed.hash};
    }

    // === HACKERNEWS ===
    if (urlparsed && (urlparsed.host === "news.ycombinator.com")) {
        return {client: "hackernews", path: urlparsed.pathname+urlparsed.search+urlparsed.hash};
    }

    return null;
}