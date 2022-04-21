import * as util from "tmeta-util";
import { assertNever, encodeQuery } from "tmeta-util";
import { all_builtin_newreddit_routes as all_routes } from "./new_reddit_route_data";
import { ParsedPath, SubrInfo } from "./reddit";

export const path_router = util.router<ParsedPath>();

const marked_routes: string[] = [];
const linkout = (opts: util.BaseParentOpts): ParsedPath => ({
    kind: "link_out",
    out: "https://www.reddit.com"+opts.path+"?"+encodeQuery(opts.query),
});
const todo = (todo_msg: string) => (opts: util.BaseParentOpts): ParsedPath => ({
    kind: "todo",
    path: opts.path+"?"+encodeQuery(opts.query), msg: todo_msg,
});

path_router.route(["raw", {path: "rest"}] as const, opts => ({
    kind: "raw",
    path: "/" + opts.path.join("/") + "?"+encodeQuery(opts.query),
}));

// TODO
// /original/submit // → redirect /submit
// /original/:categoryName/:sort([a-z]+)? // → redirect /
// /explore · /explore/:categoryName // redirect /
// /web/special-membership/:subredditName · /web/membership/:subredditName // → redirect /r/:subredditName
// /vault/burn // → no idea, it requires some query parameters

// /me/m/:multiredditName
// /me/m/:multiredditName/:sort(best)?
// /me/m/:multiredditName/:sort(hot)?
// /me/m/:multiredditName/:sort(new)?
// /me/m/:multiredditName/:sort(rising)?
// /me/m/:multiredditName/:sort(controversial)?
// /me/m/:multiredditName/:sort(top)?
// /me/m/:multiredditName/:sort(gilded)?
// /me/m/:multiredditName/:sort(awarded)?

marked_routes.push("/acknowledgements");
path_router.route(["acknowledgements"] as const, linkout);

marked_routes.push("/appeal");
path_router.route(["appeal"] as const, linkout);
marked_routes.push("/appeals");
path_router.route(["appeals"] as const, linkout);

marked_routes.push("/avatar");
path_router.route(["appeals"] as const, linkout);

marked_routes.push("/coins");
path_router.route(["coins"] as const, linkout);

marked_routes.push("/coins/mobile");
path_router.route(["coins", "mobile"] as const, linkout);

marked_routes.push("/r/u_:profileName", "/r/u_:profileName/:rest(.*)");
path_router.route(["r", {user: {kind: "starts-with", text: "u_"}}, {remainder: "rest"}] as const,
    opts => ({kind: "redirect", to: "/"+["user", opts.user, ...opts.remainder].join("/")+"?"+encodeQuery(opts.query)})
);
marked_routes.push("/u/:profileName", "/u/:profileName/:rest(.*)", "/u/me/avatar");
path_router.route(["u", {user: "any"}, {remainder: "rest"}] as const,
    opts => ({kind: "redirect", to: "/"+["user", opts.user, ...opts.remainder].join("/")+"?"+encodeQuery(opts.query)})
);

marked_routes.push("/verification/:verificationToken");
path_router.route(["verification", {vtoken: "any"}], linkout);

marked_routes.push("/label/subreddits");
path_router.route(["label", "subreddits"], linkout);

marked_routes.push("/premium");
path_router.route(["premium"], linkout);

// used in old.reddit to gild posts eg: /framedGild/t3_…?author=…&subredditId=t5_…&subredditName=…
marked_routes.push("/framedGild/:thingId");
path_router.route(["framedGild", {thing: "any"}] as const, linkout);

marked_routes.push("/framedModal/:type");
path_router.route(["framedModal", {type: "any"}] as const, linkout);

marked_routes.push("/community-points/", "/vault/", "/web/community-points/");
path_router.route(["community-points"] as const, linkout);
path_router.route(["vault"] as const, linkout);
path_router.route(["web", "community-points"] as const, linkout);

// TODO
// /user/me · /user/me/:rest(.*)
// fetch the current user then redirect to /user/…/… with query

function userOrSubredditOrHome(urlr: util.Router<util.BaseParentOpts & {
    user?: undefined | string,
    subreddit?: undefined | string,
    multireddit?: undefined | string,
}, ParsedPath>, kind: "home" | "subreddit" | "user" | "multireddit") {
    const getSub = (opts: {
        user?: undefined | string,
        subreddit?: undefined | string,
        multireddit?: undefined | string,
    }): SubrInfo => ((opts.multireddit != null && opts.user != null)
        ? {
            kind: "multireddit",
            multireddit: opts.multireddit,
            user: opts.user,
            base: ["user", opts.user, "m", opts.multireddit],
        }
        : opts.user != null
        ? {kind: "userpage", user: opts.user, base: ["user", opts.user]}
        : opts.subreddit != null
        ? {kind: "subreddit", subreddit: opts.subreddit, base: ["r", opts.subreddit]}
        : {kind: "homepage", base: []}
    );

    if(kind === "home" || kind === "subreddit" || kind === "user") {
        if(kind === "home") marked_routes.push("/submit");
        if(kind === "subreddit") marked_routes.push("/r/:subredditName/submit");
        if(kind === "user") marked_routes.push("/user/:profileName/submit");
        urlr.route(["submit"] as const, todo("submit post"));
    }

    const base_sort_methods = ["best", "hot", "new", "rising", "controversial", "top", "gilded", "awarded"] as const;
    if(kind === "home") marked_routes.push("", "/", ...base_sort_methods.map(sm => "/"+sm));
    if(kind === "user") {/*new.reddit does not support /u/…/hot eg but old.reddit does*/}
    if(kind === "subreddit") marked_routes.push(
        "/r/:subredditName", ...base_sort_methods.map(sm => "/r/:subredditName/"+sm),
    );
    if(kind === "multireddit") marked_routes.push(
        "/user/:username/m/:multiredditName",
        ...base_sort_methods.map(sm => "/user/:username/m/:multiredditName/"+sm),
    );
    urlr.route([{sort: [...base_sort_methods, ...kind === "user" ? [] : [null]]}] as const, opts => ({
        kind: "subreddit",
        sub: getSub(opts),
        is_user_page: false,
        current_sort: {v: opts.sort ?? "hot", t: opts.query["t"] ?? "all"},

        before: opts.query["before"] ?? null,
        after: opts.query["after"] ?? null,
    }));

    if(kind === "subreddit") {
        urlr.route(["@sidebar"] as const, opts => ({
            kind: "subreddit_sidebar",
            sub: getSub(opts),
        }));
    }

    if(kind === "subreddit" || kind === "user") {
        // /r/:subredditName/collection/:collectionId/:partialPostId/:partialCommentId · /r/:subredditName/collection/:collectionId/:partialPostId
        //  · /r/:subredditName/collection/:collectionId
        // /user/:subredditName/collection/:collectionId/:partialPostId/:partialCommentId · /user/:subredditName/collection/:collectionId/:partialPostId
        //  · /user/:subredditName/collection/:collectionId
        // • Collections. Sample colection: https://www.reddit.com/r/MagicEye/collection/84359211-be58-4c98-87cd-26bc10c59fb3
        // • Sample API request: /reddit/api/v1/collections/collection?collection_id=84359211-be58-4c98-87cd-26bc10c59fb3&include_links=true
        //   include_links chooses whether to give link ids or complete link content
        // • Note: add support for posts that are part of collections. Maybe add a collections (#) button if data.collections.length > 1\
    }

    if(kind === "subreddit" || kind === "user" || kind === "home") {
        const rpfx = kind === "subreddit" ? (
            "/r/:subredditName"
        ): kind === "user" ? (
            "/user/:subredditName"
        ): kind === "home" ? "" : assertNever(kind);

        marked_routes.push(rpfx+"/duplicates/:partialPostId/:urlSafePostTitle?");
        urlr.route(["duplicates", {post_id_unprefixed: "any"}, {url_safe_post_title: "optional"}] as const, opts => ({
            kind: "duplicates",
            sub: getSub(opts),
            post_id_unprefixed: opts.post_id_unprefixed,

            after: opts.query["after"] ?? null,
            before: opts.query["before"] ?? null,
            crossposts_only: (opts.query["crossposts_only"] as string | null) === "true",
            sort: opts.query["sort"] ?? "num_comments",
        }));

        marked_routes.push(rpfx+"/comments/:partialPostId/:urlSafePostTitle?");
        urlr.route(["comments", {post_id_unprefixed: "any"}, {url_safe_post_title: "optional"}] as const, opts => ({
            kind: "comments",
            sub: getSub(opts),
            post_id_unprefixed: opts.post_id_unprefixed,
            focus_comment: opts.query["comment"] ?? null,
            sort_override: opts.query["sort"] ?? null,
            context: opts.query["context"] ?? null,
        }));
        
        marked_routes.push(rpfx+"/comments/:partialPostId/:urlSafePostTitle/:partialCommentId");
        urlr.route([
            "comments",
            {post_id_unprefixed: "any"},
            {url_safe_post_title: "any"},
            {partial_comment_id: "any"},
        ] as const, opts => ({
            kind: "comments",
            sub: getSub(opts),
            post_id_unprefixed: opts.post_id_unprefixed,
            focus_comment: opts.partial_comment_id,
            sort_override: opts.query["sort"] ?? null,
            context: opts.query["context"] ?? null,
        }));
    }
}

path_router.with(["user", "me"] as const, urlr => {
    marked_routes.push("/user/me/avatar");
    urlr.catchall(todo("redirect to current user"));
});
path_router.with(["user", {user: "any"}] as const, urlr => {
    marked_routes.push("/user/:profileName/avatar");
    urlr.route(["user", {profile_name: "any"}, "avatar"] as const, opts => ({
        kind: "redirect",
        to: "/avatar",
    }));

    marked_routes.push("/user/:profileName", "/user/:profileName/comments",
        "/user/:profileName/submitted", "/user/:profileName/submitted/:rest(.*)"
    );
    urlr.route([{tab: ["overview", "comments", "submitted", null]}] as const, opts => ({
        kind: "user",
        username: opts.user,
        current: {kind: "sorted-tab", tab: opts.tab ?? "overview", sort: {
            sort: opts.query["sort"] ?? (opts.tab === "submitted" ? "hot" : "new"),
            t: opts.query["t"] ?? "all",
        }},
    }));
    marked_routes.push("/user/:profileName/posts");
    urlr.route(["posts"] as const, opts => ({
        kind: "redirect",
        to: "/user/"+opts.user+"/submitted?"+encodeQuery(opts.query),
    }));

    const sortless_tabs = ["downvoted", "hidden", "saved", "upvoted"] as const;

    marked_routes.push(...[...sortless_tabs, "gilded", "given"].map(tab => "/user/:profileName/"+tab));
    marked_routes.push("/user/:profileName/gilded/given");
    urlr.route([{tab: sortless_tabs}], opts => ({
        kind: "user",
        username: opts.user,
        current: {kind: "unsorted-tab", tab: opts.tab},
    }));
    urlr.route(["gilded", {by: ["received", "given", null]}] as const, opts => ({
        kind: "user",
        username: opts.user,
        current: {kind: "gild-tab", tab: "gilded", by: opts.by ?? opts.query["show"] ?? "received"},
    }));
    urlr.route(["given"] as const, opts => ({
        kind: "user",
        username: opts.user,
        current: {kind: "gild-tab", tab: "gilded", by: "given"},
    }));

    marked_routes.push("/user/:profileName/snoo");
    urlr.route(["snoo"] as const, todo("snoo"));

    marked_routes.push("/user/:profileName/draft/:draftId");
    urlr.route(["draft", {draft_id: "any"}] as const, todo("drafts"));
    
    // /user/:profileName/about/edit/moderation
    marked_routes.push("/user/:profileName/about/edit/moderation");
    urlr.route(["about", "edit", "moderation"] as const, todo("user profile moderation settings"));

    urlr.with(["m", {multireddit: "any"}] as const, urlr => userOrSubredditOrHome(urlr, "multireddit"));

    userOrSubredditOrHome(urlr, "user");
});
path_router.with(["r", {subreddit: "any"}] as const, urlr => {
    // TODO wikis
    marked_routes.push(
        "/r/:subredditName/wiki/revisions",
        "/r/:subredditName/wiki/settings/:wikiPageName+",
        "/r/:subredditName/wiki/edit/:wikiPageName+",
        "/r/:subredditName/wiki/create/:wikiPageName+",
        "/r/:subredditName/wiki/revisions/:wikiPageName+",
        "/r/:subredditName/wiki/",
        "/r/:subredditName/w/:wikiPageName*",
        "/r/:subredditName/wiki/:wikiPageName+",
    );
    urlr.with([{w_wiki: ["w", "wiki"]}] as const, urlr => {
        // TODO support hash links
        urlr.route([{wiki_path: "rest"}] as const, opts => ({
            kind: "wiki",
            sub: {kind: "subreddit", base: ["r", opts.subreddit], subreddit: opts.subreddit},
            // note: reddit redirects from /wiki to /wiki/index but it forgets
            // to copy query parameters, causing &lt; and &gt; to be passed.
            path: opts.wiki_path.length === 0 ? ["index"] : opts.wiki_path,
            query: opts.query,
        }));

    });

    userOrSubredditOrHome(urlr, "subreddit");
});

// /wiki/
// /w/:wikiPageName*
// /wiki/:wikiPageName+
path_router.route([{w_wiki: ["w", "wiki"]}, {wiki_path: "rest"}] as const, opts => ({
    kind: "wiki",
    sub: {kind: "homepage", base: []},
    path: opts.wiki_path,
    query: opts.query,
}));

path_router.with(["message"] as const, urlr => {
    const message_pages = ["inbox", "unread", "messages", "comments", "selfreply", "mentions"] as const;
    marked_routes.push(...message_pages.map(mpg => "/message/"+mpg));
    urlr.route([{tab: [...message_pages]}] as const, opts => ({
        kind: "inbox",
        current: {tab: "inbox", inbox_tab: opts.tab},
    }));
    // "compose", "sent"
    marked_routes.push("/message/compose");
    urlr.route(["compose"] as const, opts => ({
        kind: "inbox",
        current: {
            tab: "compose",
            to: opts.query["to"],
            subject: opts.query["subject"],
            message: opts.query["message"],
        },
    }));
    marked_routes.push("/message/sent");
    urlr.route(["sent"] as const, opts => ({
        kind: "inbox",
        current: {tab: "sent"},
    }));
    marked_routes.push("/message/moderator");
    urlr.route(["moderator"] as const, opts => ({
        kind: "inbox",
        current: {tab: "mod"},
    }));
    marked_routes.push("/message/messages/:messageId([A-Za-z0-9]+)");
    urlr.route(["messages", {message_id: "any"}] as const, opts => ({
        kind: "inbox",
        current: {tab: "message", msgid: opts.message_id},
    }));
});

userOrSubredditOrHome(path_router, "home");

path_router.with(["mod"] as const, urlr => {
    path_router.catchall(todo("not supported"));
});

path_router.with(["subreddits"] as const, urlr => {
    urlr.with(["mine"] as const, urlr => {
        urlr.route([{tab: [null, "subscriber", "contributor", "moderator"] as const}], opts => ({
            kind: "subreddits",
            value: {
                tab: "mine",
                subtab: opts.tab ?? "subscriber",
            },
        }));
    });
    urlr.route([{tab: [null, "new", "popular"] as const}], opts => ({
        kind: "subreddits",
        value: {tab: opts.tab ?? "popular"},
    }));
});

path_router.catchall(todo("not supported"));


// /r/mod/about/:pageName(edited|modqueue|reports|spam|unmoderated)?
// /r/mod/:sort(best)? · /r/mod/:sort(hot)? · /r/mod/:sort(new)? · /r/mod/:sort(rising)? · /r/mod/:sort(controversial)? · /r/mod/:sort(top)? · /r/mod/:sort(gilded)?
//  · /r/mod/:sort(awarded)? · /me/f/mod/:sort(best)? · /me/f/mod/:sort(hot)? · /me/f/mod/:sort(new)? · /me/f/mod/:sort(rising)? · /me/f/mod/:sort(controversial)? · /me/f/mod/:sort(top)?
//  · /me/f/mod/:sort(gilded)? · /me/f/mod/:sort(awarded)?
// /rpan/r/:subredditName/:partialPostId? · /rpan/:partialPostId?
// /settings/:page(account|messaging|profile|privacy|notifications|feed|gold|payments|premium|creator|special)?
// /settings/data-request
//inexact | /prefs/:page(deactivate|blocked)? // redirect → /settings/
//inexact | /user/:username/about/edit · /user/:username/about/edit/privacy // redirect → /settings/profile
// /search · /r/:subredditName/search · /me/m/:multiredditName/search · /user/:username/m/:multiredditName/search
// /t/:topicSlug
// /subreddits/create
// /subreddits/leaderboard · /subreddits/leaderboard/:categoryName/
// • this is from the gql api so it can't be supported in threadclient
// /r/:subredditName/about · /r/:subredditName/about/:pageName(awards|muted|badges|banned|chat|settings|contributors|emojis|emotes|eventposts|moderators|rules
//  |removal|modqueue|reports|spam|unmoderated|edited|postflair|log|flair|edit|userflair|wiki|wikicontributors|wikibanned|traffic|scheduledposts|broadcasting|content)
//  · /user/:profileName/about/:pageName(awards) · /r/:subredditName/about/:pageName(wiki)/:wikiSubRoute(revisions|wikibanned|wikicontributors)
//  · /r/:subredditName/about/:pageName(wiki)/:wikiSubRoute(edit|create|settings|revisions)/:wikiPageName+ · /r/:subredditName/about/:pageName(wiki)/:wikiPageName*
// /report
//# unused (redirects to /)
// /original
// /notifications/

// this router should maybe actually send the network requests too
// + make some catchall routes for unsupported things
// but then eg /raw/… would be equivalent to ?tr_display=raw and not have the subreddit sidebar stuff

// /r/:subreddit

// maybe display this data on a custom route rather than in the console

const router_diagnostics: string[] = [];
for(const marked_route of marked_routes) {
    if(!all_routes.has(marked_route)) {
        router_diagnostics.push("• unknown: "+marked_route);
    }else{
        all_routes.delete(marked_route);
    }
}
if(all_routes.size > 0) {
    for(const route of all_routes) {
        router_diagnostics.push("• missing: "+route);
    }
}
if(router_diagnostics.length > 0) {
    console.log("reddit router ::");
    for(const router_diagnostic of router_diagnostics) {
        console.log(router_diagnostic);
    }
}