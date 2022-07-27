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
┌▽───────▽─────────▽───────────▽┐
│semantic                       │
└┬──────────────────────────────┘
┌▽───────────────┐
│flat            │
└┬─△──┬──────△──┬┘
┌▽─┴┐┌▽──────┴┐┌▽┐
│web││terminal││…│
└───┘└────────┘└─┘
```

- `reddit`: packages/threadclient-client-reddit
- `mastodon`: packages/threadclient-client-mastodon
- `semantic`\*: packages/api-types-generic
- `flat`: packages/threadclient-render-flatten
- `web`: packages/threadclient-ui-web
- `terminal`: terminal has not been implemented yet

\* Note that ThreadClient is currently in the middle of a migration from old-style 'page1'
data to newer, more semantic 'page2' data

ThreadClient works by having different Clients that conform to the interface
in `threadclient-client-base`. Clients return Generic data that is then
converted in `threadclient-render-flatten` to data easy for common ui display.
Data is then displayed.

Note that ThreadClient is currently in the middle of a migration from the old

ThreadClient is currently in the middle of a migration to Solid JS and a new client structure. Some components in
`src/components/` are only used in the new page2 format. This can be enabled in settings > developer
options > page version "v2". Note that many pages do not yet work in page2.

## Questions

If you have questions, you can create an [issue](https://github.com/pfgithub/threadclient/issues/new/choose)
