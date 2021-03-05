Demo:

-   Reddit: https://thread.pfg.pw/reddit
-   Mastodon: https://thread.pfg.pw/mastodon

## new features reddit doesn't have

-   gifs in comments are collapsed by default
-   "threaded replies" to decrease indentation ([some examples in this thread](https://thread.pfg.pw/reddit/r/woooosh/comments/lcd26e/these_people_always_misunderstand_everything/))
-   ability to preview links in comments like RES adds
-   ability to preview comments written in markdown mode before posting them
-   all external links open in a new tab by default so you never have to worry if you should click or ctrl click a link
-   usernames are different colors to make it easier to notice repeat users (new.reddit has profile pictures for this)
-   threadreader preview supports these better than reddit in some ways:
    -   imgur albums
    -   gfycat gifs
    -   twitch clips
-   threadreader displays braille images correctly even if the author of the post formatted them incorrectly
    (what you see on [old.reddit](https://i.imgur.com/7ZVrqUz.png), [new.reddit](https://i.imgur.com/gFT0dHG.png),
    [threadreader](https://i.imgur.com/Hxix93m.png))

## why this instead of new.reddit?

-   new.reddit is really slow and buggy. everything about the ui feels sluggish and bad.
    -   loading videos causes them to play like 3 times before they can be paused
    -   collapsing any comment causes the entire page to rerender in react, which is quite slow
    -   collapsing comments doesn't interact with the page scroll properly. only top level comments update the scroll when collapsed.
    -   clicking the expand button on a post image causes my cpu to spike for a second
    -   moving my mouse around the page causes my cpu to spike
-   when you get a message it shows up in the icons on all the tabs, but if you view the message it only goes away on the current tab (notifications are TODO in threadreader)

## why this instead of old.reddit?

-   old.reddit is missing many features including
    -   the "3 discussions in other communities" feature (wip in threadreader) ([userscript](https://github.com/pfgithub/customizations/blob/master/userscripts/reddit/userscript.user.js) to add this in old.reddit)
    -   the ability to collapse a comment from anywhere in a comment (I have a [userscript](https://github.com/pfgithub/customizations/blob/master/userscripts/reddit/userscript.user.js) to add this)
    -   richtext comments (wip in threadreader)
    -   sidebar widgets
    -   removal reasons (TODO in threadreader)
    -   adding flairs to posts before posting and submission guidelines (TODO in threadreader)
-   old.reddit takes a while to go back/forwards in the browser, so you have to use tabs instead
-   threadreader has dark mode support

## why this instead of m.reddit

-   m.reddit was turned from a mostly-working mobile site into an unusable ad to get the reddit app in 2019
-   threadreader already has better mobile support than both new.reddit and old.reddit

## why this instead of mastodon

-   it has a tree view which is more intuitive to me
-   it doesn't constantly link out to other sites with completely different ui and a non-functioning follow button

## building

Requires:

-   yarn package manager

```
yarn install
```

Start build watcher:

```
env NODE_ENV=development yarn webpack --watch
```

> Note that the initial build may take quite some time because it has to build tailwind css. Updates should be much faster.

Run a dev server such as `http-server` (`yarn global add http-server`):

```
http-server dist -c-1 -p 3004 dist/
```

To log in locally, after giving threadreader access to reddit, edit the url from `https://thread.pfg.pw/…` to `http://localhost:3004/…`.

Check code:

```
yarn eslint src
yarn tsc --noEmit
```

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
-   [x] watchable counters
-   [x] improve how parent and child nodes and listings are represented:
        reddit lets you link to a comment that might be deep in the thread. mastodon
        has the same. improve how this is represented in Generic data and improve how it is displayed on the page. currently, {header, replies}
        is how posts exist. instead, change so the top level can have either a listing or a single thread. listings are single_thread[].
        single_thread has {parents: thing[]} which might have a load more on top and {replies: thing[]}
-   [x] choose how to sort comments
-   [ ] instead of a ".prose" class, use shadow dom so bodies can be embedded within prose without prose styles leaking
-   [ ] make it possible for sorting menus to not reload the entire page on click (eg add an option to menu actions no_reload: true that tells
        the renderer to clear the content area, load, and refill it without clearing any of the frame and without pushing a new history item)
-   [ ] oembed (eg for youtube and other sites)
-   [ ] add a settings page where you can enable/disabled `Code` buttons and other developer tools. (hide them by default)
-   [ ] support hovering on eg user or subreddit links to see a small info card
-   [ ] decrease indent width on mobile and make the permalink button more prominent or something for when things get too deep
-   [ ] update `@typescript-eslint/restrict-plus-operands` to add an option to allow string + number as long as string is on the left side
-   [ ] fix spoilers :: 1: only have one spoiler implementation instead of two. 2: use a css class rather than .style.opacity. 3: set the cursor to pointer
        on the outside and set pointer-events: none on the content while the content is not revealed. I thought I did this already but maybe something
        with having two seperate implementations caused it.
-   [ ] the refresh button
-   [ ] expand bitly links (for example, the links in the `r/iama` new sidebar calendar widget) - nvm bitly's api requires the requester knows a secret which is not possible
-   [ ] add a wikipedia client `https://en.wikipedia.org/w/rest.php/v1/page/…`, `{headers: {'Accept': "application/json; charset=UTF-8", 'Origin': location.origin}}`
-   [ ] support open in new tab on added to homescreen version of page
-   [ ] avoid keeping iframes in dom when they are not visible
-   [ ] twitter tweet preview support (`https://cdn.syndication.twimg.com/tweet?id=`:id`&lang=en`)
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
-   [ ] check for leaks by destroying the root hsc and see if any hscs were left undestroyed
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
-   [x] subscribe to subreddits (requires an api request to /r/…/about to determine if subbed) (also this will add support for subreddit banner images)
-   [x] show old.reddit sidebar /r/…/sidebar when logged out or with a toggle
-   [x] post report button with rules from `/r/…/about/rules`
-   [x] fix braille images that show up right on mobile but not desktop
-   [x] imgur gallery api? `https://api.imgur.com/3/gallery/7Yn3dUp`
-   [x] rpan support
-   [x] make full use of Generic.Page - for threads where you are linked part way into the thread, set up the parent nodes correctly
-   [x] fix depth based load more things to not include the parent comment twice. this will be automatically fixed by doing ^^^^
-   [x] support op, mod distinguished, and admin distinguished comments and posts
-   [ ] support contest mode
-   [ ] figure out what "url_overridden_by_dest" is
-   [ ] more braille image support, [for example](https://thread.pfg.pw/reddit/r/unicodecirclejerk/comments/izk1ef/%E0%B6%9E_unicode_among_us_crewmate_symbol/gamw9br/)
-   [ ] even more braille image support, [for example](https://thread.pfg.pw/reddit/r/unicodecirclejerk/comments/izk1ef/%E0%B6%9E_unicode_among_us_crewmate_symbol/gjq382v/)
-   [ ] make it clear that there are more comments available to be viewed when you are viewing just one thread
-   [ ] mod tools including:
    -   [ ] view post reports (using `post.mod_reports`, `post.mod_reports_dismissed`, `post.user_reports`)
    -   [ ] remove posts + add removal reasons like new.reddit including the option to add stickied comment prefilled with a template using the markdown editor
    -   [ ] mod messages
    -   [ ] edit the subreddit sidebar new.reddit widgets and old.reddit sidebar (and clear the cache)
-   [ ] post duplicates ("discussions in x other subs") (still todo: fetch duplicate count when loading a post)
-   [ ] fix load more buttons when there are >100 things to load. right now it seems to load in the wrong order.
-   [ ] improve mobile sidebars (do a custom route for /r/:subreddit/sidebar and rather than showing the sidebar, have a link to there)
-   [ ] show messages for quarrentined subreddits (these pass through cors luckily). banned subreddit messages
        do not pass through cors, so ban messages cannot be shown.
-   [ ] richtext replies
-   [ ] posts + post preview (+ /api/v1/:subreddit/post_requirements)
-   [ ] upload images to reddit (it seems possible, post to /asset to get perms and then upload to `reddit-uploaded-media.s3-accelerate.amazonaws.com`)
-   [ ] fix dark flairs being displayed on a dark background
-   [ ] header images
-   [ ] support live comment / chat threads (eg used in rpan chat)
-   [ ] get more information about specific awards by clicking them
-   [ ] user profile pages, defaulting to the overview tab
-   [ ] navigation buttons eg homepage link
-   [ ] notifications (+ if you see the notification on one tab have it go away from the other tabs too without requiring a refresh, unlike old. and new.reddit)
-   [ ] display <0 or ≤0 for posts with 0 votes because the actual count is unknown
-   [ ] use the `post.media`/`post.secure_media` property?
-   [ ] jsonp hack when cors requests fail (spooky, evaluating code from a remote server) eg `?jsonp=jsonp_response_#` where each request adds a `window.jsonp_response_#`
        function and removes it after the jsonp request is completed. note that this doesn't work for requests that require authentication so maybe don't do it.
-   [ ] code block automatic syntax highlighting (using hljs automatic or something)
-   [ ] when revealing a crosspost with the same content warnings as the parent post, don't require accepting twice
-   [ ] fix load more when loading batches of 100 comments sometimes the batch will contain a top level load more button (this is even easier now - the load mores can be consolidated)
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
-   [x] user profile fields
-   [x] (alternative used) update how user profiles work :: have a main page that loads the profile and pins and then a seperate page for loading all the posts and stuff that is embeded with load more
-   [x] fix that "view parent" thing that looks bad (it looks even worse now but it is represented properly now)
-   [x] emojis. why did they make emojis some weird text replacement thing instead of … including them in the html that already has to be decoded, or for usernames eg rich text like reddit flairs
-   [x] improve card support (eg show title and stuff using a new body type `{kind: "card", thumb: string, title: string, onopen: Body}`)
-   [ ] emojis in more places
-   [ ] blurhashes
-   [ ] support at links and hashtag links without leaving the app
-   [ ] option to mute user, block user, or block domain on user profiles
-   [ ] user profile pins (`/?pinned=true`) + make user profiles load on the dev server (express? doesn't like the `@`s in urls)
-   [ ] language support
-   [ ] user profiles including follow and block buttons and stuff
-   [ ] navigating to specific users by `@`
-   [ ] sites that don't have public access to `/api/v1/accounts` but do have public access to `/@user` accept:json
-   [ ] posting I guess
-   [ ] voting in polls (+ poll ui improvements)
-   [ ] improved url paths
-   [ ] make the `/mastodon` page not 404

twitter/tumblr todo:

> twitter and tumblr both use OAuth 1.0a which requires having a server to proxy requests and requires that the sender of the requests knows the application secret.
>
> because of this, neither of them support cors, and even if they did, couldn't be used in threadreader directly.

-   [ ] create an oauth 1.0a proxy server
-   [ ] try some requests
