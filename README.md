Demo:

-   Reddit: https://thread.pfg.pw/reddit
-   Mastodon (wip) `https://thread.pfg.pw/mastodon/:your_instance/timelines/public`

## building

get dependencies: `yarn install`

build (watch): `yarn gulp watch`

build (once): `yarn gulp all`

in a seperate terminal: `serve -n src -s` (requires `npm i -g serve` / `yarn global add serve`)

to log in on a local build, after giving threadreader access to reddit, edit the url from `https://thread.pfg.pw/…` to `http://localhost:…/…`.

## hot reload css

```js
Array.from(document.querySelectorAll("link")).forEach((l) => {
    const url = new URL(l.href);
    url.search = "?reload=" + Date.now();
    const newlink = el("link").attr({ href: url.href, rel: "stylesheet" });
    l.parentNode.insertBefore(newlink, l);
    newlink.onload = () => {
        l.remove();
        console.log("loaded");
    };
});
```

TODO: a websocket or something to get the client to autoreload css on save. also race protection.

## todo

all todo:

-   [x] dark mode for people without darkreader
-   [ ] the refresh button
-   [ ] use onhide in more places, eg when collapsing a comment or navigating away
-   [ ] give up on onhide just delete the elements to not waste ram storing youtube iframes
-   [ ] proper, non-hacky way to auto disable darkreader extension
-   [ ] full mobile support maybe, might not be worth it
-   [ ] a button to switch to markdown source view
-   [ ] websockets eg : reddit live threads and : mastodon timeline streaming
-   [ ] multiple accounts (eg a url thing like /1/reddit or something idk)

reddit todo:

-   [x] upvotes and vote percentages
-   [x] threading
-   [x] markdown parser
-   [x] link previews within post bodies and comments
-   [ ] post duplicates ("discussions in x other subs")
-   [ ] replies + reply preview
-   [ ] posts + post preview
-   [ ] user profile pages, defaulting to the overview tab
-   [ ] poll viewing. poll voting requires gql.reddit.com which needs a website session and proxying, so no voting.
-   [ ] wiki pages + wiki markdown parser (easy to add)
-   [ ] more navigation buttons eg homepage link
-   [ ] sidebars and stuff (that contain information about the subreddit, not the post)
-   [ ] mod tools and stuff + mod messages also + post removal tools that have options to use the subreddit things like comment distinguished stickied
-   [ ] notifications (+ if you see the notification on one tab have it go away from the other tabs too without requiring a refresh, unlike old. and new.reddit)
-   [ ] infinite things there are infinite things to do

mastodon todo:

-   [x] post action buttons like favourite and stuff
-   [ ] option to mute user, block user, or block domain on user profiles
-   [ ] see if is reblog/boost
-   [ ] user profile fields
-   [ ] language support
-   [ ] image alt text (+ hover text) rather than visible caption
-   [ ] user profiles including follow and block buttons and stuff
-   [ ] navigating to specific users by `@`
-   [ ] sites that don't have public access to `/api/v1/accounts` but do have public access to `/@user` accept:json
-   [ ] posting I guess
-   [ ] voting in polls (+ poll ui improvements)
-   [ ] fix that "view parent" thing that looks bad
-   [ ] improved url paths
-   [ ] emojis. why did they make emojis some weird text replacement thing instead of … including them in the html that already has to be decoded, or for usernames eg rich text like reddit flairs

## other

new.reddit has a secret api

https://gateway.reddit.com/desktopapi/v1/postcomments/t3_80hlz6?rtj=only&emotes_as_images=true&profile_img=true&allow_over18=1&include=identity&subredditName=redesign&hasSortParam=false&include_categories=true&onOtherDiscussions=false

it returns a much better structured response with less redundant information and it doesn't require any markdown parser to display posts and it supports inline images and videos in text posts and stuff

unfortunately, this is locked down using cors headers, so threadreader cannot use it without a proxy.

it is likely that it will also be impossible to post richtext posts either without a proxy
