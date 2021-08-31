# Contributing to ThreadClient

## Development Setup

Requires:

- nodejs
- [yarn](https://yarnpkg.com/) package manager (install with `npm install --global yarn`)

```
yarn install
```

Start build watcher:

```
yarn workspace threadreader-ui-web dev
```

Threadclient can now be visited at `http://localhost:3004`.

To log in locally, after giving threadreader access to reddit, edit the url from `https://thread.pfg.pw/…` to
`http://localhost:3004/…`.

Note: imgur preview is not supported on localhost. To test imgur support, add an entry to your /etc/hosts file eg
`127.0.0.1 threadreader`, and access threadreader during development from `http://threadreader`.

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

The ThreadClient website (thread.pfg.pw) is in `packages/threadreader-ui-web`

ThreadClient is currently in the middle of a migration to Solid JS and a new client structure. Some components in
`src/components/` are only used in the new page2 format. This can be enabled in settings > developer
options > page version "v2". Note that many pages do not yet work in page2.

## Questions

If you have questions, you can create an [issue](https://github.com/pfgithub/threadclient/issues/new/choose)
