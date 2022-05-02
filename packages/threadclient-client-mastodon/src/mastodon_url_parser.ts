import * as Mastodon from "api-types-mastodon";
import { assertNever, encodeQuery, router } from "tmeta-util";

export type UrlReturning<T> = string & {__m_returns: T};
function u<T>(s: string): UrlReturning<T> {
    return s as UrlReturning<T>;
}
export function timelineApiUrl(tl: Timeline): UrlReturning<Mastodon.Status[]> {
    const tl_query = {};
    if(tl.kind === "home") {
        return u("/api/v1/timelines/home?"+encodeQuery({...tl_query}));
    }else if(tl.kind === "public") {
        return u("/api/v1/timelines/public?"+encodeQuery({...tl_query, local: "false"}));
    }else if(tl.kind === "local") {
        return u("/api/v1/timelines/public?"+encodeQuery({...tl_query, local: "true"}));
    }else if(tl.kind === "tag") {
        return u("/api/v1/timelines/tag/"+tl.tag+"?"+encodeQuery({...tl_query}));
    }else if(tl.kind === "account") {
        return u("/api/v1/accounts/"+tl.account_id+"/statuses?"+encodeQuery({...tl_query}));
    }else{
        assertNever(tl);
    }
}
export function timelineAppUrl(host: string, tl: Timeline): string {
    if(tl.kind === "home") {
        return "/"+host+"/home";
    }else if(tl.kind === "public") {
        return "/"+host+"/public";
    }else if(tl.kind === "local") {
        return "/"+host+"/public/local";
    }else if(tl.kind === "tag") {
        return "/"+host+"/tags/"+tl.tag;
    }else if(tl.kind === "account") {
        return "/"+host+"/accounts/"+tl.account_id;
    }else{
        assertNever(tl);
    }
}

//, query: {[key: string]: string}
export type Timeline = {
    kind: "home",
} | {
    kind: "public",
} | {
    kind: "local",
} | {
    kind: "tag", tag: string,
} | {
    kind: "account", account_id: string,
};

type ParseResult = {
    kind: "timeline",
    tl: Timeline,
    host: string,
} | {
    kind: "acct_internal_redirect",
    acct: string,
    host: string,
} | {
    kind: "status",
    status: string,
    host: string,
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
} | {
    kind: "todo",
    host: string,
};

export const url_parser = router<ParseResult>();

// https://github.com/mastodon/mastodon/blob/d4592bbfcd091c4eaef8c8f24c47d5c2ce1bacd3/app/javascript/mastodon/features/ui/index.js
// has all the routes
// oh wow we're using legacy routes
url_parser.with([{host: "any"}] as const, urlr => {
    // ^ TODO in with we should be able to specify a postprocessor that takes the return value of its
    // sub-urlr and returns a new one. so basically we don't have to put {host: …} in everything because
    // it will do it for us. and it's ts compatible.

    urlr.route(["raw", {path: "rest"}] as const, opts => ({
        kind: "raw",
        path: "/" + opts.path.join("/") + "?"+encodeQuery(opts.query),
        host: opts.host,
    }));
    urlr.route([] as const, opts => ({
        kind: "instance-home",
        host: opts.host,
    }));

    const tl = (v: Timeline) => (opts: {host: string}): ParseResult => ({
        kind: "timeline",
        tl: v,
        host: opts.host,
    });

    urlr.route(["home"], tl({kind: "home"}));
    urlr.route(["timelines", "home"], tl({kind: "home"}));

    urlr.route(["public"], tl({kind: "public"}));
    urlr.route(["timelines", "public"], tl({kind: "public"}));

    urlr.route(["public", "local"], tl({kind: "local"}));
    urlr.route(["timelines", "public", "local"], tl({kind: "local"}));

    urlr.route(["conversations"], opts => ({kind: "todo", host: opts.host}));
    urlr.route(["timelines", "direct"], opts => ({kind: "todo", host: opts.host}));

    urlr.route(["tags", {tag: "any"}] as const, o => tl({kind: "tag", tag: o.tag})(o));

    urlr.route(["lists", {tag: "any"}] as const, o => ({kind: "todo", host: o.host}));

    urlr.route(["notifications"], o => ({kind: "notifications", host: o.host}));

    urlr.route(["favourites"], o => ({kind: "todo", host: o.host}));

    urlr.route(["bookmarks"], o => ({kind: "todo", host: o.host}));
    urlr.route(["pinned"], o => ({kind: "todo", host: o.host}));

    urlr.route(["start"], o => ({kind: "todo", host: o.host}));
    urlr.route(["directory"], o => ({kind: "todo", host: o.host}));

    // identical
    urlr.route(["explore"], o => ({kind: "todo", host: o.host}));
    urlr.route(["search"], o => ({kind: "todo", host: o.host}));
    
    // identical
    urlr.route(["publish"], o => ({kind: "todo", host: o.host}));
    urlr.route(["statuses", "new"], o => ({kind: "todo", host: o.host}));

    // TODO suport /@:acct
    urlr.with(["accounts", {id: "any"}] as const, urlr => {
        urlr.route([], o => tl({kind: "account", account_id: o.id})(o));
        urlr.route(["with_replies"], o => ({kind: "todo", host: o.host}));
        urlr.route(["followers"], o => ({kind: "todo", host: o.host}));
        urlr.route(["following"], o => ({kind: "todo", host: o.host}));
        urlr.route(["media"], o => ({kind: "todo", host: o.host}));
    });
    urlr.with([{acct: {kind: "starts-with", text: "@"}}] as const, urlr => {
        urlr.catchall(o => ({kind: "acct_internal_redirect", host: o.host, acct: o.acct}));
    });
    // TODO support route(/@:acct/:status_id) → status()

    // legacy:
    urlr.route(["timelines", "tag", {tag: "any"}] as const, o => tl({kind: "tag", tag: o.tag})(o));
    urlr.route(["timelines", "list", {id: "any"}] as const, o => ({kind: "todo", host: o.host}));
    urlr.with(["statuses", {status_id: "any"}] as const, urlr => {
        urlr.route([], opts => ({kind: "status", status: opts.status_id, host: opts.host}));
        urlr.route(["reblogs"], o => ({kind: "todo", host: o.host}));
        urlr.route(["favourites"], o => ({kind: "todo", host: o.host}));
    });

    urlr.route(["follow_rquests"], o => ({kind: "todo", host: o.host}));
    urlr.route(["blocks"], o => ({kind: "todo", host: o.host}));
    urlr.route(["domain_blocks"], o => ({kind: "todo", host: o.host}));
    urlr.route(["mutes"], o => ({kind: "todo", host: o.host}));
    urlr.route(["lists"], o => ({kind: "todo", host: o.host}));

    urlr.catchall(opts => ({
        kind: "404",
        reason: "Not Found",
        host: opts.host,
    }));
});
url_parser.catchall(() => ({
    kind: "instance-selector"
}));