/*eslint-disable max-len*/

// note: all routes on reddit:
// (how to generate this
// - find RouterComponent in the react components list
// - right click, store as global variable
/*
copy(
     JSON.stringify([...new Set($reactTemp0
        .map(route => ({
            path: Array.isArray(route.props.path) ? route.props.path : [route.props.path],
            exact: !!route.props.exact,
        }))
        .flatMap(itm => itm.path.map(pth => (itm.exact ? "" : "inexact|")+pth))
        .flatMap(itm => {
            const matches = itm.matchAll(/\/:[a-zA-Z]+?\(([a-zA-Z\|]+)\)(\??)/g);

            let allitms = [itm];

            for(const [wholematch, group, isq] of matches) {
                const msplit = group.split("|");
                if(allitms.length === 1 || (msplit.length === 1 && isq === "")) {
                    const aitm = allitms[0];
                    allitms = [];
                    if(isq === "?") allitms.push(aitm.replace(wholematch, ""));
                    for(const pick of msplit) {
                        allitms.push(aitm.replace(wholematch, "/"+pick));
                    }
                }
            }

            return allitms;
        })
        .sort()
     )], null, "    ")
   )
*/
// how to test routes without reloading:
// {
//   const teststate = (state) => {
//     history.pushState({}, "Hi", state);
//     history.pushState({}, "Hi", state);
//     history.back(); 
//   }
//   teststate("/route")
// }

export const all_builtin_newreddit_routes = new Set([
    "",
    "/",
    // [snipped out a section of /:languageCode/]
    // seems like new.reddit is adding languageCode and countryCode into the url but for some reason they
    // couldn't do that as a preprocessing step beefore the url parsing?
    // anyway they seem to all be redirects for now so it doesn't matter for us
    "/acknowledgements",
    "/appeal",
    "/appeals",
    "/avatar",
    "/avatar/:username",
    "/avatar/:username/:avatarId",
    "/awarded",
    "/best",
    "/coins",
    "/coins/mobile",
    "/comments/:partialPostId/:urlSafePostTitle/:partialCommentId",
    "/comments/:partialPostId/:urlSafePostTitle?",
    "/community-points/",
    "/community-points/documentation/*",
    "/controversial",
    "/duplicates/:partialPostId/:urlSafePostTitle?",
    "/econ-management",
    "/explore",
    "/explore/:categoryName",
    "/framedGild/:thingId",
    "/framedModal/:type",
    "/gilded",
    "/hot",
    "/label/subreddits",
    "/me/f/mod",
    "/me/f/mod/awarded",
    "/me/f/mod/best",
    "/me/f/mod/controversial",
    "/me/f/mod/gilded",
    "/me/f/mod/hot",
    "/me/f/mod/new",
    "/me/f/mod/rising",
    "/me/f/mod/top",
    "/me/m/:multiredditName",
    "/me/m/:multiredditName/awarded",
    "/me/m/:multiredditName/best",
    "/me/m/:multiredditName/controversial",
    "/me/m/:multiredditName/gilded",
    "/me/m/:multiredditName/hot",
    "/me/m/:multiredditName/new",
    "/me/m/:multiredditName/rising",
    "/me/m/:multiredditName/search",
    "/me/m/:multiredditName/top",
    "/message/comments",
    "/message/compose",
    "/message/inbox",
    "/message/mentions",
    "/message/messages",
    "/message/messages/:messageId([A-Za-z0-9]+)",
    "/message/moderator",
    "/message/selfreply",
    "/message/sent",
    "/message/unread",
    "/new",
    "/notifications/",
    "/original",
    "/original/:categoryName/:sort([a-z]+)?",
    "/original/submit",
    "/powerup",
    "/powerups",
    "/prediction",
    "/predictions",
    "/premium",
    "/r/:subredditName",
    "/r/:subredditName/about",
    "/r/:subredditName/about/awards",
    "/r/:subredditName/about/badges",
    "/r/:subredditName/about/banned",
    "/r/:subredditName/about/broadcasting",
    "/r/:subredditName/about/chat",
    "/r/:subredditName/about/content",
    "/r/:subredditName/about/contributors",
    "/r/:subredditName/about/edit",
    "/r/:subredditName/about/edited",
    "/r/:subredditName/about/emojis",
    "/r/:subredditName/about/emotes",
    "/r/:subredditName/about/eventposts",
    "/r/:subredditName/about/flair",
    "/r/:subredditName/about/log",
    "/r/:subredditName/about/moderators",
    "/r/:subredditName/about/modqueue",
    "/r/:subredditName/about/muted",
    "/r/:subredditName/about/postflair",
    "/r/:subredditName/about/powerups",
    "/r/:subredditName/about/predictions",
    "/r/:subredditName/about/removal",
    "/r/:subredditName/about/reports",
    "/r/:subredditName/about/rules",
    "/r/:subredditName/about/scheduledposts",
    "/r/:subredditName/about/settings",
    "/r/:subredditName/about/spam",
    "/r/:subredditName/about/talkhosts",
    "/r/:subredditName/about/traffic",
    "/r/:subredditName/about/unmoderated",
    "/r/:subredditName/about/userflair",
    "/r/:subredditName/about/wiki",
    "/r/:subredditName/about/wiki/:wikiPageName*",
    "/r/:subredditName/about/wiki/create/:wikiPageName+",
    "/r/:subredditName/about/wiki/edit/:wikiPageName+",
    "/r/:subredditName/about/wiki/revisions",
    "/r/:subredditName/about/wiki/revisions/:wikiPageName+",
    "/r/:subredditName/about/wiki/settings/:wikiPageName+",
    "/r/:subredditName/about/wiki/wikibanned",
    "/r/:subredditName/about/wiki/wikicontributors",
    "/r/:subredditName/about/wikibanned",
    "/r/:subredditName/about/wikicontributors",
    "/r/:subredditName/awarded",
    "/r/:subredditName/best",
    "/r/:subredditName/collection/:collectionId",
    "/r/:subredditName/collection/:collectionId/:partialPostId",
    "/r/:subredditName/collection/:collectionId/:partialPostId/:partialCommentId",
    "/r/:subredditName/comments/:partialPostId/:urlSafePostTitle/:partialCommentId",
    "/r/:subredditName/comments/:partialPostId/:urlSafePostTitle?",
    "/r/:subredditName/controversial",
    "/r/:subredditName/duplicates/:partialPostId/:urlSafePostTitle?",
    "/r/:subredditName/gilded",
    "/r/:subredditName/hot",
    "/r/:subredditName/new",
    "/r/:subredditName/predictions",
    "/r/:subredditName/rising",
    "/r/:subredditName/search",
    "/r/:subredditName/submit",
    "/r/:subredditName/top",
    "/r/:subredditName/w/:wikiPageName*",
    "/r/:subredditName/wiki/",
    "/r/:subredditName/wiki/:wikiPageName+",
    "/r/:subredditName/wiki/create/:wikiPageName+",
    "/r/:subredditName/wiki/edit/:wikiPageName+",
    "/r/:subredditName/wiki/revisions",
    "/r/:subredditName/wiki/revisions/:wikiPageName+",
    "/r/:subredditName/wiki/settings/:wikiPageName+",
    "/r/mod",
    "/r/mod/about",
    "/r/mod/about/edited",
    "/r/mod/about/modqueue",
    "/r/mod/about/reports",
    "/r/mod/about/spam",
    "/r/mod/about/unmoderated",
    "/r/mod/awarded",
    "/r/mod/best",
    "/r/mod/controversial",
    "/r/mod/gilded",
    "/r/mod/hot",
    "/r/mod/new",
    "/r/mod/rising",
    "/r/mod/top",
    "/r/u_:profileName",
    "/r/u_:profileName/:rest(.*)",
    "/report",
    "/rising",
    "/rpan/:partialPostId?",
    "/rpan/r/:subredditName/:partialPostId?",
    "/search",
    "/settings",
    "/settings/account",
    "/settings/creator",
    "/settings/data-request",
    "/settings/dsp",
    "/settings/feed",
    "/settings/gold",
    "/settings/messaging",
    "/settings/notifications",
    "/settings/payments",
    "/settings/premium",
    "/settings/privacy",
    "/settings/profile",
    "/settings/special",
    "/submit",
    "/subreddits/leaderboard",
    "/subreddits/leaderboard/:categoryName/",
    "/t/:topicSlug",
    "/talk",
    "/top",
    "/u/:profileName",
    "/u/:profileName/:rest(.*)",
    "/u/me/avatar",
    "/user/:profileName",
    "/user/:profileName/about/awards",
    "/user/:profileName/about/edit/moderation",
    "/user/:profileName/avatar",
    "/user/:profileName/comments",
    "/user/:profileName/downvoted",
    "/user/:profileName/draft/:draftId",
    "/user/:profileName/followers",
    "/user/:profileName/gilded",
    "/user/:profileName/gilded/given",
    "/user/:profileName/given",
    "/user/:profileName/hidden",
    "/user/:profileName/posts",
    "/user/:profileName/saved",
    "/user/:profileName/snoo",
    "/user/:profileName/submit",
    "/user/:profileName/submitted",
    "/user/:profileName/submitted/:rest(.*)",
    "/user/:profileName/upvoted",
    "/user/:subredditName/collection/:collectionId",
    "/user/:subredditName/collection/:collectionId/:partialPostId",
    "/user/:subredditName/collection/:collectionId/:partialPostId/:partialCommentId",
    "/user/:subredditName/comments/:partialPostId/:urlSafePostTitle/:partialCommentId",
    "/user/:subredditName/comments/:partialPostId/:urlSafePostTitle?",
    "/user/:subredditName/duplicates/:partialPostId/:urlSafePostTitle?",
    "/user/:username/m/:multiredditName",
    "/user/:username/m/:multiredditName/awarded",
    "/user/:username/m/:multiredditName/best",
    "/user/:username/m/:multiredditName/controversial",
    "/user/:username/m/:multiredditName/gilded",
    "/user/:username/m/:multiredditName/hot",
    "/user/:username/m/:multiredditName/new",
    "/user/:username/m/:multiredditName/rising",
    "/user/:username/m/:multiredditName/search",
    "/user/:username/m/:multiredditName/top",
    "/user/me",
    "/user/me/:rest(.*)",
    "/user/me/avatar",
    "/vault/",
    "/vault/burn",
    "/verification/:verificationToken",
    "/w/:wikiPageName*",
    "/web/community-points/",
    "/web/membership/:subredditName",
    "/web/points-migration/",
    "/web/special-membership/:subredditName",
    "/wiki/",
    "/wiki/:wikiPageName+",
    "inexact|/prefs",
    "inexact|/prefs/blocked",
    "inexact|/prefs/deactivate",
    "inexact|/user/:username/about/edit",
    "inexact|/user/:username/about/edit/privacy"
]);