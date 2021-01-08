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
