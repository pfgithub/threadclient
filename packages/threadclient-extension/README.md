dev

`bun --bun run dev`, then go to `about:debugging#/runtime/this-firefox` and load extension/manifest.json as a temporary add-on

# building:

`bun --bun run build`

# other:

https://github.com/antfu/vitesse-webext

features I want:

- [x] auto redirect to thread.pfg.pw
- [ ] click the icon to search for reddit comments on a youtube video
  - done, needs threadclient impl
- [ ] do that for lots of pages, not just youtube
- [ ] proxy uploading images to reddit's s3 bucket if it's even possible. I think it is but haven't tested.
