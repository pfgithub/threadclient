currently very wip

a thing for reading things on thread based websites like

-   reddit (wip)
-   twitter (might be impossible)
-   mastodon (planned, who knows)

demo: https://thread.pfg.pw/reddit

note that "Enhanced Tracking Prevention" in firefox must be disabled for the demo to
work. Firefox tracking prevention indiscriminately bans all requests to social media
sites.

this could be fixed in the future with a proxy site

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

-   upvotes and vote percentages
-   post duplicates
-   polls probably I guess
-   multiple accounts
-   mastodon to make sure the architecture actually works for multiple platforms
-   improve how links work when returned from a client
-   more pages eg wiki pages
-   the refresh button
-   more navigation buttons
-   sidebars and stuff (that contain information about the subreddit, not the post)
-   markdown parser (+ button to switch to markdown source view)
-   link previews within post bodies and comments
-   infinite things there are infinite things to do
