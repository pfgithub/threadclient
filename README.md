Demo:

-   Reddit: https://thread.pfg.pw/reddit
-   Mastodon: https://thread.pfg.pw/mastodon

## new features reddit doesn't have

-   "threaded replies" to decrease indentation ([some examples in this thread](https://thread.pfg.pw/reddit/r/woooosh/comments/lcd26e/these_people_always_misunderstand_everything/))
-   ability to preview links in comments like RES adds
-   ability to preview comments written in markdown mode before posting them
-   all external links open in a new tab by default so you never have to worry if you should click or ctrl click a link
-   usernames are different colors to make it easier to notice repeat users
-   threadreader preview supports these better than reddit in some ways:
    -   imgur albums
    -   gfycat gifs
    -   twitch clips
-   threadreader displays braille images correctly even if the author of the post formatted them incorrectly
    (what you see on [old.reddit](https://i.imgur.com/7ZVrqUz.png), [new.reddit](https://i.imgur.com/gFT0dHG.png),
    [threadreader](https://i.imgur.com/Hxix93m.png))
-   ability to easily view comment markdown ([screenshot](https://i.imgur.com/zwGtAkV.png))

## building

Requires:

-   yarn package manager

```
yarn install
```

Start build watcher:

```
yarn workspace threadreader-ui-web dev
```

To log in locally, after giving threadreader access to reddit, edit the url from `https://thread.pfg.pw/…` to `http://localhost:3004/…`.

Note: it is recommended to add an entry to your /etc/hosts file eg `127.0.0.1 threadreader`, and access
threadreader during development from `http://threadreader`, otherwise imgur support will fail due to cors errors.

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
