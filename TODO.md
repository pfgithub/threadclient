## TODO

woah look at this

https://reddit.zendesk.com/hc/en-us/articles/205926439-Reddiquette

https://reddit.zendesk.com/api/v2/help_center/en-us/articles/205926439-Reddiquette.json

we can put the reddit help center in threadclient

it even has access-control-allow-origin: *

fancy

also don't even have to fix any white-space:pre-wrap bugs

- note: consider using an html minifier rather than trying to handle whitespace ourselves. these know how
  to handle whitespace for default nodes
- that's actually a good idea we should do that for reddit wiki pages

## TODO

https://github.com/poudels14/slate-solid

woah a solid js slate wrapper

I'm pretty sure there was some reason I couldn't use slate but I should at least
try it

- nope, doesn't look like it will work

## TODO

Virtual scrolling with IntersectionObserver

https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API

looks like this will make it relatively simpleish

just have one element for all the things that are not loaded in the virtual scroll
and when it comes into view, add elements until it is no longer in view

also we can set a percentage or something so it loads stuff that isn't quite
in view

## todo

support pushshift

you should be able to go to `https://api.pushshift.io/reddit/search/submission`

and maybe even configure all the parameters and stuff

https://github.com/pushshift/api

I just want to display the results nicely

## todo

consider using a WeakMap to store post data linked to navigation entries?

so when the nav entries get deleted the post data does too

## todo

how to upgrade:

- use windi css analyzer to find all classes (eg `mt-5px` and especially arbitrary `mt-34` eg)
- use tailwind css analyzer to confirm all migrated correctly

\[!] fancy features we get if we upgrade

- https://tailwindcss.com/docs/typography-plugin
- it now supports `.no-prose` to embed content inside and it's also a lot more
  customizable now so we may be able to use this for richtext
- (this is assuming that more prose can be embedded inside a .no-prose tag)
- (ok it does. relies on some real sketchy 'where' tags)
- (anyway the reason for this is because it will handle our text sizes better)
- (`prose-xl` `prose-base` `prose-sm`)
- (rather than us having to go and code that)

original notes:

- tailwind css 3 is basically the same as windicss, I can probably switch to it
- \[!] I have to change eg `w-10px` to `w-[10px]`
- and stuff like `text-[color:var(--my-var)]` instead of `text-$my-var`
- https://www.kirillvasiltsov.com/writing/type-check-tailwind-css/ oh wow I could do this
  but this is the sketchiest thing I've seen in my life
- https://github.com/thien-do/typed.tw hmm
- could do something like that. `tw.bg('red').text('white')`
- huh that could be nice
- need conditionals. `tw.add(condition ? tw.bg('red') : tw.bg('blue'))`
- that will work fine

## todo

figure out how to patch solidjs to apply this change to createComponent in dev builds

```js
const prev = createElement;
createElement = (...a) => {
  const res = prev(...a);
  if(res instanceof HTMLElement) {
      res.setAttribute("data-component", Comp.name);
  }
  return res;
}
```

just will make it easier to find components

## nothing to do

```
Error: USERNAME_OUTBOUND_LINKING_DISALLOWED: Linking to users is not allowed.
```

huh that's a fancy error. there's probably somewhere in the data it will show so we
can detect it and disable it

## todo

"post insights"

not sure if there's a public api for this yet, but it's available in the gql api
which the extension will proxy

```
{
  "id":"b73048dbf918",
  "variables":{
    "postId":"t3_…",
    "subredditId":"t5_…",
  }
}
```

(note that while this api request will never return a different data structure, the
query hash may be removed causing the api to no longer function)

## todo

- along with getting chat messages working,
- switch unread message count to `/api/v1/me` `.inbox_count`. also this will let us get our username. also we should save.

## bug!

sidebar iframes with relative links have the wrong base url

oh I can hack it I think: `<base href="http://pathtooriginalpage" />`

## todo

- support https://thread.pfg.pw/reddit/api/v1/me/karma
  - link to it from a profile dropdown or something

## todo

- consider using github subtrees? like you can merge another repo into this one and keep
  the history and stuff. and that would be nice because it makes projects more
  discoverable while keeping the monorepo structure.

## todo

- [ ] add a "load above" when you're sorting on new (?before=`[first post id]`)
- [ ] I think it's critical that I make a seperate codepath for page2.
- [ ] like from entry.ts, completely different, only sharing the
      serviceworker stuff
- [ ] that way I can get page2 working with hot reload and significantly
      improve development experience
- [ ] be careful with what I'm doing in flatten.ts - I'm kinda accidentally
      recreating virtual dom and that will have terrible performance implications.
      when you collapse something, it should not have to regenerate the entire array.
  - huh... that's not ideal is it
  - like if I add a reply I don't want to regenerate the whole array, just anything
    relevant
  - also I should be keeping around hidden items in dom so navigation works and stuff
  - ok I'm not going to worry about that for now - I'll be able to do memoization and
    stuff if I need

## note

```
db data (eg reddit api results)
→
semantic data (page2, not frontend specific)
→
display data (translates easily to an actual rendered thing)
→
rendered on your screen/display
```

## todo

- [ ] ok I know I lose the fun animations on collapsing posts and stuff but I
      think I have to do this:
  - rather than rendering posts in a hierarchy, render them from a single
    array using a single <\For>
  - handle indentation in the post renderer
  - why:
    - this seems like a far more useful structure
    - allows for unthreading to occur without losing state
    - allows for virtual scrolling
    - allows for loading more to occur without losing state

## todo

- [ ] make it so you can go to thread.pfg.pw/https://... and it does the thing
- [ ] consider rather than having inline link previews, make it so when you click
      a link it navigates to thread.pfg.pw/the link that could be neat maybe
- [x] rather than the "delete draft" prompt have the ui save draft replies
      by post id so when you click reply again it lets you type or whatever

## todo

- here's a fun idea that might be kind of difficult working within vite
- what if every time a version of threadclient was made it made a new folder
  with the version name (git hash / semver if I get fancy) and then:
- old versions of threadclient would continue to function correctly before
  they are updated
- you could go into settings and get like a version selector to revert to
  previous versions (make sure to add some kind of override to get back to
  the latest if the version selector thing breaks)

## todo

- [x] !! v.redd.it isn't cors protected anymore
- [x] use the DASHPlaylist.mpd
- [x] maybe even use a default video player
- [x] just have to merge the audio and video in js
- [x] TODO: https://github.com/windicss/plugins/tree/main/packages/icons
- [ ] also check out https://github.com/bradlc/tailwindcss-fluid
- consider:
- [x] vite + https://github.com/antfu/vite-plugin-pwa
- [x] probably not since the webpack config is kinda messy and I need both react and solid
- [x] or I can just delete the tiny bit of react for now
- [ ] switch to https://github.com/antfu/unplugin-icons (it supports solid js and is built for vite)
- [ ] check out rush for incremental monorepo stuff https://rushjs.io/pages/intro/welcome/

todo:

- [ ] apply thiss tyle to url previews:

  ```css
  .clickerthing:hover,
  .clickerthing:focus {
    background-color: var(--cool-gray-200);
    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.5);
  }
  .clickerthing {
    transition: all 0.1s;
  }
  ```

fun stuff:

- [ ] display all comments from a single list. use props to specify how indented, if threaded, ...
  - this allows for:
    - fun pivoting animations
    - pivoting without losing dom state
      - the new pivot is selected
      - old comments which are unused are display:none'd
      - new comments are inserted where it makes sense
    - a mobile depth limit with an automatic pivot button or something
    - mobile should probably have a completely different comment appearence more like apollo anyway. the collapse
      button is hard to press on mobile
    - mobile gestures, so eg you can swipe to collapse a comment
    - more fun stuff
  - this has some downsides:
    - the hover effect on the comment collapse buttons might not be as good as it could be
    - I can't do collapse transitions anymore (like I could collapse transition all the comments in view but I'm not
      sure how much css would like that, having 20 elements doing height transitions at the same time)
    - I guess I could use a single fake element taking up all the space and then transform transitions - no, transform
      transitions still require everything to be in the same parent node
- [ ] check out https://www.tiptap.dev/ for the richtext editor
  - I haven't looked into it at all, if it does good typescript support then I should try it
  - https://github.com/andi23rosca/tiptap-solid there is a solid js port thing
- [x] show a content summary thing on collapsed comments.
  - eg: https://user-images.githubusercontent.com/6010774/132083968-7eef3197-0cad-4828-ae26-16bed7056ec8.png
  - generate these based on the body type. some body types may have no summary and might just be `[image]`
  - these go after the username and the rest of the infobar. if there is a thumbnail, these don't display at all
  - actually these are basically thumbnails but for text. huh
- [ ] check out `.icon_color` and consider using this instead of color_hash, or at leat
      using this color while the image is loading.
- [ ] what if braille images were inserted as an actual 'braille image' component in richtext? that could be fun
      couldn't it. also would improve summaries and screenreader support. not sure if it's worth it though, it would
      be useful to parse out the text and stuff
- [ ] https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/progress_event xhr progress when loading in
      bad internet
- [ ] doing richtext things: visualviewport finally allows us to position an element above the ios keyboard! and combine that with position device-fixed or a polyfill and it'll be a pretty nice bar thing
- mock the reddit api and use things eg https://github.com/marak/Faker.js/ and maybe have some sample pages and stuff

page2 todo:

- [ ] load more
- [ ] possibly allow the post to specify the format of its info bar?
- [ ] mobile fixes:
  - [ ] the transition thing is based on the position of the navbar but on mobile the position
        of that changes because of translateY. TODO max(viewport top, translateY) or just go
        back to the previous top of screen + height or delete --mobile-transform for now because
        it's not very good
  - [x] top level objects should go edge to edge on the screen
  - [ ] thumbnails take up wayy too much space, consider:
    - use text-sm font size for titles
    - use smaller thumbnails
    - compress info bar and actions
- [ ] implement sort in a way that it doesn't require all comments to store their own sorts. ideally
      when you click a comment to focus it, the sort from the pivot could be used.
- [ ] for TimeAgo instead of "2y ago" write like "2019" or "Mar"
- [ ] for TimeAgo, provide an option for an even more compact version that's just "5d" instead of "5 days ago"
- [ ] mobile: compress the info bar. eg "\[by] · \[in] · ↑3k · 2d · ✎6h". maybe even hide the \[by] if there is
      an \[in] and the post is above the pivot, then put a longer info bar at the bottom of the post like apollo.
- [ ] this still looks very bad, but here is an example of some things that could be done:
  - https://i.imgur.com/ji1G657.png
  - it might help to use an actual interface design program to make mockups and then try to replicate those

preview todo:

- add support for youtube.com/shorts (I think youtube offers an oembed thing so I don't have to do url parsing)

tmeta todo:

- [ ] add an action that runs every time:
  - check if there were any changes in .yarn or node_modules
    - if there were, run `yarn check`

reddit post page2:

- [ ] vote count, vote buttons, % upvoted
- [x] time ago
- [x] code button should give code of the selected post
- [x] author flair should not inherit post award flair
- [x] post body should display below action bar. (possibly: two action bars? one for above and one for below body)
- [x] posted in subreddit
- [x] actions: comment count, domain, delete, save, duplicates, report
  - [ ] rewrite the report action in solid and make it appear in the right place
- [x] reply action, when at pivot (because show replies when below pivot is false)
- [ ] reply action should add the posted comment to the tree
- [x] click to focus
- [ ] when a post has no body, it shouldn't collapse/uncollapse. eg r/askreddit.
- [x] choose between displaying a top level wrapper or an inner wrapper of toggling colors using a resource. have
      just one component used to draw the wrapper

reddit comment todo:

- [x] a single reply should not be shown as threaded
- [x] post voting
- [x] post time ago
- [ ] post reply button
- [ ] when you click reply and then close it, make sure clicking the reply button again
      will give you the same text you just typed. and also future: TODO make it so you
      get a prompt before navigating away from a page you started typing a reply in

todo:

- switch to a monorepo structure
- packages/
  - [x] api-types-generic/
  - [x] api-types-reddit/
  - [x] api-types-mastodon/
  - [ ] api-types-hackernews/
  - [x] threadclient-web-ui/
  - [ ] threadclient-client-common/
  - [ ] threadclient-client-reddit/
  - [ ] threadclient-client-mastodon/
  - [ ] threadclient-client-test/
  - [ ] threadclient-client-hackernews/
  - [ ] threadclient-webextension/
  - [x] eslint-plugin-custom-rules/
  - a config helper thing so you don't have to make a `lint` script in every package and add a `tsconfig.json` and
    `.eslintrc.js` / or it does it automatically

unrelated:

- upgrade timeAgo to support weeks/months. "last month", "two months ago", …
- do this using the local timezone? not like https://github.com/hustcc/timeago.js/blob/master/src/utils/date.ts
- a post on reddit with 0 points actually has ≤0 points, so upvoting or downvoting it should not change
  the point count

all todo:

- [x] dark mode for people without darkreader
- [x] fix youtube embed ignoring time codes (there will probably be more things like this to fix)
- [x] fix user name color randomization in light mode (generate a light color and return the same with inverted l for darkness)
- [x] decrease bundle size (mostly by making it not add polyfills that use `ActiveXObject`…)
- [x] use onhide in more places, eg when collapsing a comment or navigating away
- [x] add eslint
- [x] make pwa
- [x] eslint disallow shadowing
- [x] maybe? eslint strict booleans in ifs and stuff
- [x] eslint formatting
- [x] eslint strict promise error handling
- [x] add a loading indicator to the fullscreen loader thing
- [x] catch errors in more places
- [x] fix load more buttons that are threaded or something like `post |> comment |> load 2 more` those 2 should appear under comment
- [x] fix comments on mobile (they used to go edge to edge, now they don't for some reason)
- [x] watchable counters
- [x] improve how parent and child nodes and listings are represented:
      reddit lets you link to a comment that might be deep in the thread. mastodon
      has the same. improve how this is represented in Generic data and improve how it is displayed on the page. currently, {header, replies}
      is how posts exist. instead, change so the top level can have either a listing or a single thread. listings are single_thread[].
      single_thread has {parents: thing[]} which might have a load more on top and {replies: thing[]}
- [x] choose how to sort comments
- [x] instead of a ".prose" class, use shadow dom so bodies can be embedded within prose without prose styles leaking (.prose class is gone,
      replaced with normal richtext)
- [ ] show the description of privated subreddits: https://www.reddit.com/subreddits/search.json?q=SharksAreSmooth&limit=1&raw_json=1
  - [ ] support `/reddit/subreddits/search?q=SharksAreSmooth&limit=1&raw_json=1`. this is a listing with t5 children
- [ ] probably move the styles that used to be in prose back into typography.css but as `.prose-ul` rather than `.prose ul`
- [ ] support wikipedia file urls eg `https://en.wikipedia.org/wiki/File:Pixel_geometry_01_Pengo.jpg`
- [ ] make it possible for sorting menus to not reload the entire page on click (eg add an option to menu actions no_reload: true that tells
      the renderer to clear the content area, load, and refill it without clearing any of the frame and without pushing a new history item)
- [ ] oembed (eg for youtube and other sites)
- [ ] add a settings page where you can enable/disabled `Code` buttons and other developer tools. (hide them by default)
- [ ] support hovering on eg user or subreddit links to see a small info card
- [ ] decrease indent width on mobile and make the permalink button more prominent or something for when things get too deep
- [ ] update `@typescript-eslint/restrict-plus-operands` to add an option to allow string + number as long as string is on the left side
- [ ] fix spoilers :: 1: only have one spoiler implementation instead of two. 2: use a css class rather than .style.opacity. 3: set the cursor to pointer
      on the outside and set pointer-events: none on the content while the content is not revealed. I thought I did this already but maybe something
      with having two seperate implementations caused it.
- [ ] the refresh button
- [ ] expand bitly links (for example, the links in the `r/iama` new sidebar calendar widget) - nvm bitly's api requires the requester knows a secret which is not possible
- [ ] add a wikipedia client `https://en.wikipedia.org/w/rest.php/v1/page/…`, `{headers: {'Accept': "application/json; charset=UTF-8", 'Origin': location.origin}}`
- [ ] support open in new tab on added to homescreen version of page
- [ ] avoid keeping iframes in dom when they are not visible
- [ ] twitter tweet preview support (`https://cdn.syndication.twimg.com/tweet?id=`:id`&lang=en`)
- [ ] proper, non-hacky way to auto disable darkreader extension
- [ ] full mobile support (no buttons that are too close together + design more optimized for mobile)
- [ ] a button to switch to markdown source view (uh oh what if the comment doesn't have any markdown source…)
- [ ] websockets eg : reddit live threads and : mastodon timeline streaming
- [ ] multiple accounts (eg a url thing like /1/reddit or something idk)
- [ ] simplify css to have less `>` selectors and more classes added by js
- [ ] fix youtube embeds causing horizontal scrolling on mobile
- [ ] improve appearence of very indented comments on mobile
- [ ] make the buttons more seperate on mobile - possibly remove all links except for a … link and an upvote link and make the whole post a link like apollo
- [ ] make images fullscreen when tapping them rather than opening in a new tab (the fullscreen api is really nice on mobile but not really made for this purpose on desktop)
- [ ] do the thing where opening a page has it overlay and you can click out to go back
- [ ] fix history items when navigating past a reload - currently if you navigate back past a reload and navigate forward, navigating back will require another reload when it shouldn't
- [ ] make images a bit smaller on desktop - 95% of viewport height is kind of big
- [ ] fix wrong scrolling when going to a comment section and pressing back in firefox
- [ ] fix wrong scrolling occasionally when clicking show on post content
- [ ] check for leaks by destroying the root hsc and see if any hscs were left undestroyed
- [ ] set up hot module replacement to support reloading `clients/reddit.ts` (currently it doesn't because old copies of client objects are stored)
- [ ] when a reply window thing is open with entered text, prompt before closing the page. make sure this works for 2+ open reply things even if one is closed
- [ ] res-like click and drag image to zoom. and get rid of the click to open in new tab, there's a link right above the image you can click
- [ ] send a notification when the serviceworker has new content available on reload
- [ ] add the first line of the body richtext to show up when the thing is collapsed (and make sure it's max 1 line overflow ellipsis)
- [ ] some simple unit tests (eg number shortening like 12502 → 12.5k, 350351 → 350k)
- [ ] improve poll appearence
- [ ] "unsupported" → type unsupported = …

reddit todo:

- [x] upvotes and vote percentages
- [x] threading
- [x] markdown parser
- [x] link previews within post bodies and comments
- [x] fix "load more" buttons with empty children arrays but 10 depth or something
- [x] sidebars and stuff (that contain information about the subreddit, not the post)
- [x] sidebar info: use /r/…/api/widgets to get topbar+sidebar widgets
- [x] replies + reply preview
- [x] wiki pages + wiki markdown parser (note: currently the wiki parser is the same as the normal parser. TODO fix in snudown.wasm)
- [x] poll viewing. poll voting requires gql.reddit.com which needs a website session and proxying, so no voting.
- [x] subscribe to subreddits (requires an api request to /r/…/about to determine if subbed) (also this will add support for subreddit banner images)
- [x] show old.reddit sidebar /r/…/sidebar when logged out or with a toggle
- [x] post report button with rules from `/r/…/about/rules`
- [x] fix braille images that show up right on mobile but not desktop
- [x] imgur gallery api? `https://api.imgur.com/3/gallery/7Yn3dUp`
- [x] rpan support
- [x] make full use of Generic.Page - for threads where you are linked part way into the thread, set up the parent nodes correctly
- [x] fix depth based load more things to not include the parent comment twice. this will be automatically fixed by doing ^^^^
- [x] support op, mod distinguished, and admin distinguished comments and posts
- [x] messages
- [x] header images
- [ ] add support for /about/stylesheet eg /reddit/r/askreddit/about/stylesheet. it could look really neat showing both the css and associated images and stuff.
- [ ] add support for /u/me. also when ppl link there, make the link appear as if it is linking to you directly with /u/yourusername when you hover it.
- [ ] fix it so when you subscribe to a sub and then navigate to that sub page it still shows you as subscribed. this is
      an easy, but annoying, fix. just have to change it so the time the page was fetched gets piped through the whole system
      so good data doesn't get replaced with older bad data. - this should be easier to fix with page2 I think
- [ ] add support for showing the multireddits a user has. new.reddit gets a fancy gql api for this but we have to use
      `/api/multi/:user` which is slow and will hold up page load so it must be done async. also along with this, other
      things that are only relevant to sidebar widgets should be switched to async too.
- [ ] reddit youtube comments using `/search?syntax=cloudsearch&q=`encode(`(url:`vid_id`) AND (site:youtube.com OR site:youtu.be)`)
- [ ] improve messages appearence
- [ ] moderator list is hidden while logged out https://www.reddithelp.com/hc/en-us/articles/360049499032 (although, for some reason, you can still
-       see the moderator list on new.reddit by going to `https://www.reddit.com/r/`subreddit`/about/moderators`
- [ ] if you see the message on one tab have it go away from the other tabs too without requiring a refresh, unlike old. and new.reddit
- [ ] support contest mode
- [ ] figure out what "url_overridden_by_dest" is
- [ ] more braille image support, [for example](https://thread.pfg.pw/reddit/r/unicodecirclejerk/comments/izk1ef/%E0%B6%9E_unicode_among_us_crewmate_symbol/gamw9br/)
- [ ] even more braille image support, [for example](https://thread.pfg.pw/reddit/r/unicodecirclejerk/comments/izk1ef/%E0%B6%9E_unicode_among_us_crewmate_symbol/gjq382v/)
- [ ] make it clear that there are more comments available to be viewed when you are viewing just one thread
- [ ] mod tools including:
  - [ ] view post reports (using `post.mod_reports`, `post.mod_reports_dismissed`, `post.user_reports`)
  - [ ] remove posts + add removal reasons like new.reddit including the option to add stickied comment prefilled with a template using the markdown editor
  - [ ] mod messages
  - [ ] edit the subreddit sidebar new.reddit widgets and old.reddit sidebar (and clear the cache)
- [ ] post duplicates ("discussions in x other subs") (still todo: fetch duplicate count when loading a post)
- [ ] fix load more buttons when there are >100 things to load. right now it seems to load in the wrong order.
- [ ] improve mobile sidebars (do a custom route for /r/:subreddit/sidebar and rather than showing the sidebar, have a link to there)
- [ ] show messages for quarrentined subreddits (these pass through cors luckily). banned subreddit messages
      do not pass through cors, so ban messages cannot be shown.
- [ ] richtext replies
- [ ] posts + post preview (+ /api/v1/:subreddit/post_requirements)
- [ ] upload images to reddit (it seems possible, post to /asset to get perms and then upload to `reddit-uploaded-media.s3-accelerate.amazonaws.com`)
- [ ] fix dark flairs being displayed on a dark background
- [ ] support live comment / chat threads (eg used in rpan chat)
- [ ] get more information about specific awards by clicking them
- [ ] user profile pages, defaulting to the overview tab
- [ ] navigation buttons eg homepage link
- [ ] display <0 or ≤0 for posts with 0 votes because the actual count is unknown
- [ ] use the `post.media`/`post.secure_media` property?
- [ ] code block automatic syntax highlighting (using hljs automatic or something)
- [ ] when revealing a crosspost with the same content warnings as the parent post, don't require accepting twice
- [ ] fix load more when loading batches of 100 comments sometimes the batch will contain a top level load more button (this is even easier now - the load mores can be consolidated)
- [ ] option to disable default collapsed comments (eg due to crowd control or downvoting)
- [ ] preview subreddit links like sneakpeakbot does and also hide sneakpeakbot replies unless they have comments (may require slight restructuring | just fetch the reddit client yeah ok)
- [ ] what if sneakpeakbot replies got embedded into the comment itself hmm - as a crosspost thing but collapsed by default
- [ ] support `redd.it` links
- [ ] properly handle request errors + refresh token when a request fails rather than relying on the system clock
- [ ] improve login flow, especially on mobile pwa
- [ ] infinite things there are infinite things to do

mastodon todo:

- [x] post action buttons like favourite and stuff
- [x] see if is reblog/boost
- [x] image alt text (+ hover text) rather than visible caption
- [x] user profile fields
- [x] (alternative used) update how user profiles work :: have a main page that loads the profile and pins and then a seperate page for loading all the posts and stuff that is embeded with load more
- [x] fix that "view parent" thing that looks bad (it looks even worse now but it is represented properly now)
- [x] emojis. why did they make emojis some weird text replacement thing instead of … including them in the html that already has to be decoded, or for usernames eg rich text like reddit flairs
- [x] improve card support (eg show title and stuff using a new body type `{kind: "card", thumb: string, title: string, onopen: Body}`)
- [ ] report accounts. how: report button on posts, accounts. clicking report : there is a checkbox "Send anonymized copy of this report to «site.tld» moderators?" : there is a uuh a textbox with character limit for report text (note: character limits vary by sites) : there is a list of posts to include in the report : there is a button "add more" that tells you to click the report button on more posts to include in this report. A bit more complicated than reddit reporting, but not too bad. It is unclear how to get good ui for selecting posts to include in the report.
- [ ] emojis in more places
- [ ] blurhashes
- [ ] support at links and hashtag links without leaving the app
- [ ] option to mute user, block user, or block domain on user profiles
- [ ] user profile pins (`/?pinned=true`) + make user profiles load on the dev server (express? doesn't like the `@`s in urls)
- [ ] language support
- [ ] user profiles including follow and block buttons and stuff
- [ ] navigating to specific users by `@`
- [ ] sites that don't have public access to `/api/v1/accounts` but do have public access to `/@user` accept:json
- [ ] posting I guess
- [ ] voting in polls (+ poll ui improvements)
- [ ] improved url paths
- [ ] make the `/mastodon` page not 404

twitter/tumblr todo:

> twitter and tumblr both use OAuth 1.0a which requires having a server to proxy requests and requires that the sender of the requests knows the application secret.
>
> because of this, neither of them support cors, and even if they did, couldn't be used in threadclient directly.

- [ ] create an oauth 1.0a proxy server
- [ ] try some requests

hackernews todo:

https://github.com/cheeaun/node-hnapi node-hnapi.herokuapp.com

mail todo:

- use like imap/pop/smtp/gmail api or something
- threadclient actually fits well as an email interface
- unfortunately will require a backend but at least it doesn't require a secret so the backend can be run locally on a computer

github todo:

https://github.com/octokit/octokit.js/ it has issues support

hackernews todo:

- use the official api for everything, only use the unofficial one for getting lists of things in eg /newest
- https://github.com/minimaxir/hacker-news-undocumented/blob/master/README.md
