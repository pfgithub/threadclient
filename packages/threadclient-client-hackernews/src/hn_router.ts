import * as util from "tmeta-util";

// all of these : ?page=…
// News · /news (/ → /news) (TODO redirects)
// New · /newest
// Past · /front  (?day=…)  ("Stories from «». Go back a day, month, or year. Go forward a day or month.")
// Comments · /newcomments
// Ask · /ask
// Show · /show
// Jobs · /jobs
// Submit : I don't think node hnapi supports login, for good reason
//
// /item?id=…
// /user?id=…
//     Submissions · /submitted?id=…
//     Comments · /threads?id=…
//     Favourites · /favorites?id=…
// user page implementation is limited
//     http://api.hackerwebapp.com/user/…

export type Redirect = {
    kind: "redirect",
    to: string,
};
export type ParsedPath = {
    kind: "home",
    tab: "news" | "newest" | "newcomments" | "ask" | "show" | "jobs",
    page: number,
} | {
    kind: "front",
    day: string | undefined, // UTC
    page: number,
} | {
    kind: "item",
    id: string,
} | {
    kind: "user",
    name: string,
};

const path_router = util.router<ParsedPath | Redirect>();

path_router.route([] as const, () => ({
    kind: "redirect",
    to: "/news",
}));
for(const tab of ["news", "newest", "newcomments", "ask", "show", "jobs"] as const) {
    path_router.route([tab] as const, opts => ({
        kind: "home",
        tab: tab,
        page: +(opts.query["page"] ?? "1"),
    }));
}
path_router.route(["front"] as const, opts => ({
    kind: "front",
    day: opts.query["day"],
    page: +(opts.query["page"] ?? "1"),
}));
path_router.route(["item"] as const, opts => ({
    kind: "item",
    id: opts.query["id"] ?? "0",
}));
path_router.route(["user"] as const, opts => ({
    kind: "user",
    name: opts.query["id"] ?? "0",
}));

export function parseLink(path: string): [parsed: ParsedPath, path: string] {
    let parsed = path_router.parse(path)!;

    for(let i = 0; parsed.kind === "redirect" && i < 100; i++) {
        path = parsed.to;
        parsed = path_router.parse(path)!;
    }
    if(parsed.kind === "redirect") throw new Error(">100 redirects. "+path);
    
    return [parsed, path];
}