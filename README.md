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
    -   the ability to collapse a comment from anywhere in a comment (I have a [userscript](https://github.com/pfgithub/customizations/blob/master/userscripts/reddit/userscript.user.js) to add this)
    -   sidebar widgets
    -   profile pictures
    -   replying with richtext (TODO in threadreader)
    -   removal reasons (TODO in threadreader)
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
