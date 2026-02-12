# building:

`bun --bun run build`

# other:

https://github.com/antfu/vitesse-webext

before release:

- [ ] require few permissions on install (perms to manage thread.pfg.pw)
- [ ] options page

features I want:

- [x] auto redirect to thread.pfg.pw
- [ ] click the icon to search for reddit comments on a youtube video
- [ ] do that for lots of pages, not just youtube
- [ ] proxy getting reddit chat message count and pass to threadclient (fixes an issue)
  - this should be enabled by default (no going into settings and accepting an extra permission)
  - gql
  - url: `https://gql.reddit.com/?request_timestamp=${Date.now()}`
  - body: `{id "d99f8962bcd6"}`
  - authorization: `Bearer ${…}`
    - i'm not sure where that token is from. the first bit is in the `reddit_session` cookie but where's the
      part after the dash from? idk
  - response:
    ```js
    {data: {badgeIndicators: {
        chatUnreadMessages: {count: number},
        chatUnreadMentions: {count: number},
        chatHasNewMessages: {isShowing: boolean},
        chatUnacceptedInvites: {count: number},
    }}}
    ```
  - ok I couldn't figure out how to get the authorization token, so new plan:
    - have the user navigate to `reddit.com` or `old.reddit.com` and intercept requests to
      `gql.reddit.com` to get the token
    - save the token
    - if requests start erroring, ask the user to do that again.
- [ ] proxy uploading images to reddit's s3 bucket if it's even possible. I think it is but haven't tested.

ok I think I have to do this to get it in my browser:

https://stackoverflow.com/questions/44537589/how-do-i-install-webextension-that-developed-by-myself-to-firefox-nightly

