Demo:

-   Reddit: https://thread.pfg.pw/reddit
-   Mastodon (wip) `https://thread.pfg.pw/mastodon/:your_instance/timelines/public`

## building

get dependencies: `yarn install`

build (dev): `yarn webpack serve`

build (once): `yarn webpack`

to log in on a local build, after giving threadreader access to reddit, edit the url from `https://thread.pfg.pw/…` to `http://localhost:…/…`.

## todo

all todo:

-   [x] dark mode for people without darkreader
-   [x] fix youtube embed ignoring time codes (there will probably be more things like this to fix)
-   [x] fix user name color randomization in light mode (generate a light color and return the same with inverted l for darkness)
-   [x] decrease bundle size (mostly by making it not add polyfills that use `ActiveXObject`…)
-   [x] use onhide in more places, eg when collapsing a comment or navigating away
-   [x] add eslint
-   [x] make pwa
-   [x] eslint disallow shadowing
-   [x] maybe? eslint strict booleans in ifs and stuff
-   [x] eslint formatting
-   [x] eslint strict promise error handling
-   [x] add a loading indicator to the fullscreen loader thing
-   [x] catch errors in more places
-   [x] fix load more buttons that are threaded or something like `post |> comment |> load 2 more` those 2 should appear under comment
-   [x] fix comments on mobile (they used to go edge to edge, now they don't for some reason)
-   [ ] decrease indent width on mobile and make the permalink button more prominent or something for when things get too deep
-   [ ] update `@typescript-eslint/restrict-plus-operands` to add an option to allow string + number as long as string is on the left side
-   [ ] the refresh button
-   [ ] avoid keeping iframes in dom when they are not visible
-   [ ] proper, non-hacky way to auto disable darkreader extension
-   [ ] full mobile support (no buttons that are too close together + design more optimized for mobile)
-   [ ] a button to switch to markdown source view (uh oh what if the comment doesn't have any markdown source…)
-   [ ] websockets eg : reddit live threads and : mastodon timeline streaming
-   [ ] multiple accounts (eg a url thing like /1/reddit or something idk)
-   [ ] simplify css to have less `>` selectors and more classes added by js
-   [ ] fix youtube embeds causing horizontal scrolling on mobile
-   [ ] improve appearence of very indented comments on mobile
-   [ ] make the buttons more seperate on mobile - possibly remove all links except for a … link and an upvote link and make the whole post a link like apollo
-   [ ] make images fullscreen when tapping them rather than opening in a new tab (the fullscreen api is really nice on mobile but not really made for this purpose on desktop)
-   [ ] do the thing where opening a page has it overlay and you can click out to go back
-   [ ] fix history items when navigating past a reload - currently if you navigate back past a reload and navigate forward, navigating back will require another reload when it shouldn't
-   [ ] make images a bit smaller on desktop - 95% of viewport height is kind of big
-   [ ] fix wrong scrolling when going to a comment section and pressing back in firefox
-   [ ] fix wrong scrolling occasionally when clicking show on post content
-   [ ] set up hot module replacement to support reloading `clients/reddit.ts` (currently it doesn't because old copies of client objects are stored)
-   [ ] when a reply window thing is open with entered text, prompt before closing the page. make sure this works for 2+ open reply things even if one is closed
-   [ ] res-like click and drag image to zoom. and get rid of the click to open in new tab, there's a link right above the image you can click
-   [ ] send a notification when the serviceworker has new content available on reload
-   [ ] add the first line of the body richtext to show up when the thing is collapsed (and make sure it's max 1 line overflow ellipsis)
-   [ ] some simple unit tests (eg number shortening like 12502 → 12.5k, 350351 → 350k)
-   [ ] improve poll appearence
-   [ ] "unsupported" → type unsupported = …

reddit todo:

-   [x] upvotes and vote percentages
-   [x] threading
-   [x] markdown parser
-   [x] link previews within post bodies and comments
-   [x] fix "load more" buttons with empty children arrays but 10 depth or something
-   [x] sidebars and stuff (that contain information about the subreddit, not the post)
-   [x] sidebar info: use /r/…/api/widgets to get topbar+sidebar widgets
-   [x] replies + reply preview
-   [x] wiki pages + wiki markdown parser (note: currently the wiki parser is the same as the normal parser. TODO fix in snudown.wasm)
-   [x] poll viewing. poll voting requires gql.reddit.com which needs a website session and proxying, so no voting.
-   [ ] post duplicates ("discussions in x other subs") (still todo: fetch duplicate count when loading a post)
-   [ ] subscribe to subreddits (requires an api request to /r/…/about to determine if subbed) (also this will add support for subreddit banner images)
-   [ ] show old.reddit sidebar /r/…/sidebar when logged out or with a toggle + show rules /r/…/about/rules
-   [ ] improve mobile sidebars (do a custom route for /r/:subreddit/sidebar and rather than showing the sidebar, have a link to there)
-   [ ] show messages for quarrentined subreddits (these pass through cors luckily). banned subreddit messages
-   do not pass through cors, so ban messages cannot be shown.
-   [ ] richtext replies
-   [ ] posts + post preview (+ /api/v1/:subreddit/post_requirements)
-   [ ] fix dark flairs being displayed on a dark background
-   [ ] user profile pages, defaulting to the overview tab
-   [ ] navigation buttons eg homepage link
-   [ ] mod tools and stuff + mod messages also + post removal tools that have options to use the subreddit things like comment distinguished stickied
-   [ ] notifications (+ if you see the notification on one tab have it go away from the other tabs too without requiring a refresh, unlike old. and new.reddit)
-   [ ] display <0 or ≤0 for posts with 0 votes because the actual count is unknown
-   [ ] code block automatic syntax highlighting (using hljs automatic or something)
-   [ ] display raw markdown view by default for a comment predominately composed of braille characters (to fix this https://i.imgur.com/0rH8yUf.png)
-   [ ] when revealing a crosspost with the same content warnings as the parent post, don't require accepting twice
-   [ ] fix load more when loading batches of 100 comments sometimes the batch will contain a top level load more button
-   [ ] support op, mod distinguished, and admin distinguished comments and posts
-   [ ] option to disable default collapsed comments (eg due to crowd control or downvoting)
-   [ ] preview subreddit links like sneakpeakbot does and also hide sneakpeakbot replies unless they have comments (may require slight restructuring | just fetch the reddit client yeah ok)
-   [ ] what if sneakpeakbot replies got embedded into the comment itself hmm - as a crosspost thing but collapsed by default
-   [ ] support `redd.it` links
-   [ ] properly handle request errors + refresh token when a request fails rather than relying on the system clock
-   [ ] improve login flow, especially on mobile pwa
-   [ ] infinite things there are infinite things to do

mastodon todo:

-   [x] post action buttons like favourite and stuff
-   [x] see if is reblog/boost
-   [x] image alt text (+ hover text) rather than visible caption
-   [ ] option to mute user, block user, or block domain on user profiles
-   [ ] user profile fields
-   [ ] user profile pins (`/?pinned=true`) + make user profiles load on the dev server (express? doesn't like the `@`s in urls)
-   [ ] update how user profiles work :: have a main page that loads the profile and pins and then a seperate page for loading all the posts and stuff that is embeded with load more
-   [ ] language support
-   [ ] user profiles including follow and block buttons and stuff
-   [ ] navigating to specific users by `@`
-   [ ] sites that don't have public access to `/api/v1/accounts` but do have public access to `/@user` accept:json
-   [ ] posting I guess
-   [ ] voting in polls (+ poll ui improvements)
-   [ ] fix that "view parent" thing that looks bad
-   [ ] improved url paths
-   [ ] emojis. why did they make emojis some weird text replacement thing instead of … including them in the html that already has to be decoded, or for usernames eg rich text like reddit flairs
-   [ ] make the `/mastodon` page not 404

twitter todo:

-   [ ] set up the proxy server
-   [ ] try a request
