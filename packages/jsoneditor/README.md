```
yarn install
yarn dev
```

# note

collaborative editing:

we'll back it with mongodb which gives change notifications i think

then we can have a server that connects to the database and sends events to clients

either this or we can use firebase. this will be harder but also i need to learn how
to do distributed stuff and it will be very useful because i can reuse it for interpunct
and other things

# note

consider making a js way to define typescript types

like

`type Person = {a: string, b: string}`

→

`const person = ty.object({a: ty.string, b: ty.string}); type Person = typeof person`

this way we can check your json data for errors at runtime

# note

here's something fun

although i'm not sure what i'd use it for

https://solid-command-palette.vercel.app/demo

also it feels like you could create a fun api where instead of that `cond/run` thing you
could put a jsx node like &lt;Action /&gt; anywhere and have it only show when that would
be rendered. have to keep in mind that it's possible to have nodes exist without oncleanup
being called that aren't rendered on the page though. shouldn't be too much of an issue
to deal with.

anyway we probably can't use that one specifically because it appears to be prestyled and
stuff but probably can reuse some of its code especially for handling arrow keys, scroll
into view, and accessability. although putting it that way those seem pretty trivial like
just call `.scrollIntoView()` when an element's selector changes from false to true.

anyway not sure what i would use this for, it just seems like the type of feature this
app would have. i guess undo/redo buttons can go in there.

# note

undo/redo considerations

- when you undo, we should also undo the ui state to the point where your change is
  visible and focused
- this means we should start keeping track of ui state
- we should also keep track of ui state for other reasons - in tabs, when you switch
  tabs and switch back, it forgets your tabs. also it would be nice to keep ui state
  across hmr reloads.
- anyway, undo will have to do stuff like: move your cursor in a richtext input back to
  where it was, and that requires keeping ui state

## note

ok so I was thinking

we're not worried about permissions yet

but

we might be able to have a very trivial permission implementation by:

- storing user permissions in the document
- storing user ids in actions a user creates and validating them on the server
- on the client, ignore actions a user is not allowed to create
- if the server maintains a snapshot, do the same thing there too

this would allow untrusted clients to create lots of actions that do nothing though

we need to support large volumes of actions and ratelimiting before we can do permissions
that way if we want to do that.

also we should probably make actions specify the subtrees they modify

that's an easy change

because eventually we'll want to be able to only send relevant content to clients rather
than the entire action stream.

oh. note: this only allows for write control, not access control for viewing things. so eg
we can't make the card game not even tell the client card was drawn until it has been
flipped over or have documents inside a document that only some users are allowed to
access. I think it would be cool if eventually every document was in one big action
stream but that might not be a resonable thing to do, it might make sense to instead have
view control at the document level and link documents to eachother instead.

## note

I want to make a website for the richtext editor

we should make the website use the editor itself

have like a bar at the top that has all the buttons and shows "unsaved changes" that
when you click it prefills a github PR for you

and the entire page and documentation and examples and all that except for editor
controls is inside the editor.

that would be really cool
