

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
