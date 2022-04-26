import { encodeQuery, router } from "tmeta-util";

type ParseResult = {
    kind: "timeline",
    tmname: "home" | "public" | "local" | "tag",
    api_path: string,
    host: string,
} | {
    kind: "status",
    status: string,
    host: string,
} | {
    kind: "account",
    account: string,
    host: string,
    api_url: string,
} | {
    kind: "404",
    reason: string,
    host: string,
} | {
    kind: "instance-selector",
} | {
    kind: "instance-home",
    host: string,
} | {
    kind: "raw",
    path: string,
    host: string,
} | {
    kind: "notifications",
    host: string,
};

export const url_parser = router<ParseResult>();

url_parser.with([{host: "any"}] as const, urlr => {
    urlr.route(["raw", {path: "rest"}] as const, opts => ({
        kind: "raw",
        path: "/" + opts.path.join("/") + "?"+encodeQuery(opts.query),
        host: opts.host,
    }));
    urlr.route([] as const, opts => ({
        kind: "instance-home",
        host: opts.host,
    }));
    urlr.with(["timelines"] as const, urlr => {
        urlr.route(["home"] as const, opts => ({
            kind: "timeline",
            tmname: "home",
            api_path: "/api/v1/timelines/home?"+encodeQuery(opts.query),
            host: opts.host,
        }));
        urlr.route(["public", "local"] as const, opts => ({
            kind: "timeline",
            tmname: "local",
            api_path: "/api/v1/timelines/public?"+encodeQuery({...opts.query, local: "true"}),
            host: opts.host,
        }));
        urlr.route(["public"] as const, opts => ({
            kind: "timeline",
            tmname: "public",
            api_path: "/api/v1/timelines/public?"+encodeQuery({...opts.query, local: "false"}),
            host: opts.host,
        }));
        urlr.route(["local"] as const, opts => ({
            kind: "timeline",
            tmname: "local",
            api_path: "/api/v1/timelines/public?"+encodeQuery({...opts.query, local: "true"}),
            host: opts.host,
        }));
        urlr.route(["tag", {hashtag: "any"}] as const, opts => ({
            kind: "timeline",
            tmname: "tag",
            api_path: "/api/v1/timelines/tag/"+opts.hashtag+"?"+encodeQuery(opts.query),
            host: opts.host,
        }));
        urlr.catchall(opts => ({
            kind: "404",
            reason: "Unsupported timeline",
            host: opts.host,
        }));
    });
    urlr.route(["statuses", {statusid: "any"}] as const, opts => ({
        kind: "status",
        status: opts.statusid,
        host: opts.host,
    }));
    urlr.route(["accounts", {accountid: "any"}] as const, opts => ({
        kind: "account",
        account: opts.accountid,
        host: opts.host,
        api_url: "/api/v1/accounts/"+opts.accountid+"/statuses?"+encodeQuery({...opts.query}),
    }));
    urlr.route(["notifications"], opts => ({
        kind: "notifications",
        host: opts.host,
    }));
    urlr.catchall(opts => ({
        kind: "404",
        reason: "Not Found",
        host: opts.host,
    }));
});
url_parser.catchall(() => ({
    kind: "instance-selector"
}));