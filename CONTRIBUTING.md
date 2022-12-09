# Contributing to ThreadClient

## Development Setup

Requires:

- nodejs
- [yarn](https://yarnpkg.com/getting-started/install/) package manager

```
git clone --depth 1 https://github.com/pfgithub/threadclient.git
cd threadclient
```

```
yarn install
```

Start build watcher:

```
yarn workspace threadclient-ui-web dev
```

Threadclient can now be visited at `http://localhost:3004`.

To log in locally, after giving threadclient access to reddit, edit the url from `https://thread.pfg.pw/…` to
`http://localhost:3004/…`.

Note: imgur preview is not supported on localhost. To test imgur support, add an entry to your /etc/hosts file eg
`127.0.0.1 threadclient`, and access threadclient during development from `http://threadclient:3004`.

Check code before commit:

```
yarn lint
```

Test before commit:

```
yarn test
```

Create a new package:

```
yarn create-package package-name
```

## Editor Setup

It may be useful to have extensions for:

- typescript
- eslint

to help with development.

## Project Structure

The ThreadClient website (thread.pfg.pw) is in `packages/threadclient-ui-web`

ThreadClient:

```
┌──────┐┌────────┐┌──────────┐┌─┐
│reddit││mastodon││hackernews││…│
└┬─────┘└┬───────┘└┬─────────┘└┬┘
┌v───────v─────────v───────────v┐
│semantic                       │
└┬────┬─────────┬───────────────┘
┌v──┐┌v───────┐┌v┐
│web││terminal││…│
└───┘└────────┘└─┘
```

- `reddit`: packages/threadclient-client-reddit
- `mastodon`: packages/threadclient-client-mastodon
- `semantic`\*: packages/api-types-generic
- `web`: packages/threadclient-ui-web
- `terminal`: terminal is very early in development and not really usable yet

ThreadClient works by having different Clients that conform to the interface
in `threadclient-client-base`. Clients return semantic data that is rendered by the UI.

\*: ThreadClient is currently partway through two migrations

- Data format: 'page1' → 'page2' structure
  - page1 requires reloading the page every time you click a post. a client returns
    a somewhat-semantic description of the page that was visited.
  - page2 gets closer to my original vision for threadclient, allowing you to click on
    a post to pivot to it without refreshing the page. a client returns a database
    of objects, and clicking 'load more' adds to the database.
- Javascript framework: vanilla js `_stdlib.ts` → solid js
  - page1 mostly renders with vanilla js, using some solid js components when possible to
    avoid having two implementations of things
  - `_stdlib.ts` is a wrapper around vanilla js dom methods to make them faster to write
    (`let div = document.createElement("div"); parent.addChild(div)` → `el("div").adto(parent)`).
    the plan is to rewrite or delete all code using these functions.
  - solid js is a react-like framework that doesn't get slower when you update components higher
    up in the heigherarchy. it seems to have roughly similar performance to the previous vanilla
    js code, but maybe encourages slower patterns. right now, page2 is significantly slower than
    page1 for navigating forwards/back and collapsing/expanding posts because of design decisions,
    but I'm planning on changing it so it works like page1 for those actions. it's also slower at
    loading very large comment pages and I likely can't fix that but am planning to mitigate it
    by lazy displaying comments and maybe doing actual profiling and improving things.

## Questions

If you have questions, you can create an [issue](https://github.com/pfgithub/threadclient/issues/new/choose)
