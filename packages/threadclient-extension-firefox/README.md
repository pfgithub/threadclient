# ThreadClient helper extension for Firefox

Currently adds:

- *this list is empty*

TODO:

- [ ] Automatically redirect supported pages on reddit.com to threadclient
  - Extract threadclient-router-reddit out from threadclient-client-reddit
  - Use that here to see if we support the page
- [ ] Issue [#1](https://github.com/pfgithub/threadclient/issues/1): Proxy requests to reddit to get the number of unread
  chat messages
  - POST https://gql.reddit.com/?requesst_timestamp={Date.now()} body: `{id: "d99f8962bcd6"}`
- [ ] Proxy s3 image upload requests to allow submitting images to subreddits
- [ ] Proxy oauth.reddit.com requests to allow getting information from 404'd pages rather than a NetworkError
- [ ] Reddit comments on Youtube using
  - `/search?syntax=cloudsearch&q=`encode(`(url:`vid_id`) AND (site:youtube.com OR site:youtu.be)`)
  - alternatively I can probably just sesarch the video id directly, probably not necessary to do that url filter