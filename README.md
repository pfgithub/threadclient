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
-   [ ] the refresh button
-   [ ] instead of giving up on onhide just don't store youtube iframes…
-   [ ] proper, non-hacky way to auto disable darkreader extension
-   [ ] full mobile support maybe, might not be worth it
-   [ ] a button to switch to markdown source view (uh oh what if the comment doesn't have any markdown source…)
-   [ ] websockets eg : reddit live threads and : mastodon timeline streaming
-   [ ] multiple accounts (eg a url thing like /1/reddit or something idk)
-   [ ] fix dark flairs being displayed on a dark background (occurs on reddit flairs with no bg color set)
-   [ ] add eslint for formatting and typescript-eslinting
-   [ ] make pwa

reddit todo:

-   [x] upvotes and vote percentages
-   [x] threading
-   [x] markdown parser
-   [x] link previews within post bodies and comments
-   [x] fix "load more" buttons with empty children arrays but 10 depth or something
-   [ ] post duplicates ("discussions in x other subs")
-   [ ] subscribe to subreddits (put it in an info thing at the top of a subreddit listing and then todo show a sidebar on posts)
-   [ ] show messages for quarrentined subreddits (these pass through cors luckily). banned subreddit messages
-   do not pass through cors, so ban messages cannot be shown.
-   [ ] replies + reply preview
-   [ ] posts + post preview
-   [ ] user profile pages, defaulting to the overview tab
-   [ ] poll viewing. poll voting requires gql.reddit.com which needs a website session and proxying, so no voting.
-   [ ] wiki pages + wiki markdown parser (easy to add)
-   [ ] navigation buttons eg homepage link
-   [ ] sidebars and stuff (that contain information about the subreddit, not the post)
-   [ ] mod tools and stuff + mod messages also + post removal tools that have options to use the subreddit things like comment distinguished stickied
-   [ ] notifications (+ if you see the notification on one tab have it go away from the other tabs too without requiring a refresh, unlike old. and new.reddit)
-   [ ] display <0 or ≤0 for posts with 0 votes because the actual count is unknown
-   [ ] code block automatic syntax highlighting (using hljs automatic or something)
-   [ ] display raw markdown view by default for a comment predominately composed of braille characters (to fix this https://i.imgur.com/0rH8yUf.png)
-   [ ] infinite things there are infinite things to do

mastodon todo:

-   [x] post action buttons like favourite and stuff
-   [x] see if is reblog/boost
-   [x] image alt text (+ hover text) rather than visible caption
-   [ ] option to mute user, block user, or block domain on user profiles
-   [ ] user profile fields
-   [ ] language support
-   [ ] user profiles including follow and block buttons and stuff
-   [ ] navigating to specific users by `@`
-   [ ] sites that don't have public access to `/api/v1/accounts` but do have public access to `/@user` accept:json
-   [ ] posting I guess
-   [ ] voting in polls (+ poll ui improvements)
-   [ ] fix that "view parent" thing that looks bad
-   [ ] improved url paths
-   [ ] emojis. why did they make emojis some weird text replacement thing instead of … including them in the html that already has to be decoded, or for usernames eg rich text like reddit flairs
