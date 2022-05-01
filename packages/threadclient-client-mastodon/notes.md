ok mastodon/activitypub seems to be missing a lot of things required for making good ux here

eg:

- i want to be able to view any mastodon post in threadclient. how do I do this?
  - mastodon/activitypub provides no way of identifying that a link is to a post

so what do existing implementations do?

- they link out. they send you to some website with completely different ui and no or bad interoperability
  for actions like replying or liking a post

this… isn't very good

activitypub:

- activitypub is about notifying subscribers of actions:
  - post likes
  - account follows
  - new posts by followed account
  - viewing a specific account
    1. `[url]/.well-known/webfinger?resource=acc@[url]`
    2. find the `self` link
    3. fetch that with `'Accept': `application/ld+json; profile="https://www.w3.org/ns/activitystreams"``
    4. find the outbox link
    5. add all their posts to your server
