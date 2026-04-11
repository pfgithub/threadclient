# page2 vs page4

page2 is append-only. you can only replace if you know the full content
- that means even if you have partial content, you can't show anything

page4 lets you show partial content
- but do we ever want to show partial content? I'm not convinced
- it's kind of nice for loaders
- it could be used for identity cards but I don't really think we want that.
  - the advantage for identity cards is that you can compare them by link
    rather than comparing them by .value.name
  - but you end up with weird situations where 99% of the time a user shows
    one way and then 1% of the time it shows a different way because it happened
    to have content for the identity card. that breaks uniformity.
- it's kind of nice that irrelevant stuff doesn't need to get generated
- it's kind of nice for horizontal loaders:
  - if we remove sub-loaders, it will let the client deduplicate posts rather than
    asking the app to deduplicate posts
- our implementation has been good for typed links:
  - we have typed links now. but we could have this in page2.
- it's kind of annoying for multiple related links
  - eg post replies. both need to go get the same content
- it breaks having a server-only client
  - this is sad. page2 could easily be used server-only. page4 takes some effort.
    if we want to use it server-only now what would we do? we can't really make
    a general client anymore unless we make it like page2 but with exceptions
    for identity cards and loaders
    - we could do that if we want. it's just less powerful than a vanilla client.
    - although maybe you could include which data you want in opaques? could
      work somewhat. we can't just take the existing reddit client and make it
      server though.
  - this also means we can't run the client in a webworker really. maybe we could
    if we prefetched every link.
- we no longer need on_post/on_sub stuff in the bases for comments which saves
  a web request in a rare case. this is nice?

# sorting

so with sorting:

- a url can change the sort method. ie `/r/abc/top?t=all` vs `/r/abc/new`
- the sort method doesn't change anything about the post content, only the replies & the url
- it would be nice for Items to map from fullname to content. not listings though, that needs sort. mores also needs sort.

so how do we do it?

```
post:
  sort_group: Link<SortGroup>,
  sorted: SortedLink<{
    replies: ...,
    url: ...,
  }>,
sort_group:
  options: ["best", "new", ...]
  selection: string,
```

so now when you fetch /r/abc/top?t=all, it has to tell you which sort to start with. I guess since we're using client classes now,
the client could keep track of that? I mean we could literally have sort_value: `Link<string>` which we would default to the
current sort value

our issue here is what if you click on a post and then click back on the subreddit? ideally we would reset the sort.
- would we? unclear
- well right now that's a link so it will reset anyway, it's not a repivot point. unless you click on the identity card in the sidebar.

we're implementing sort like this. it will work, but it wouldn't allow us to display for example:
- the same listing twice. once sorted one way and once sorted another way.

and it's odd changing state for literally just calling getPage.

so ideally we will improve upon this later but at least for now we will have it working.

# alternate sorting

a version of sorting that is compatible with page2(non-4):
- sorters are a post with kind sorter
- when they are the pivot, they're not really the pivot. the client renders the thing above them as the real pivot
- when you're deep in a thread if you want to change the sort you scroll up to under the post. you change the sort there
- each item has its own replies
- there is a default

this is interesting to consider? but maybe we prefer existing sorting?

this would be the same as keeping that other sorting but only putting it on the top level instead of every reply too
