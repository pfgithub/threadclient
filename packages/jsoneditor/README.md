```
yarn install
yarn dev
```

# note

NEXT STEPS:

- probably switch to postgres / sqlite combo. sqlite dev builds and postgres for
  production. postgres has update notifications and sqlite is single-client
- actions need to store the database time they were added. this needs to be an atomically
  increasing number so that actions can only ever be inserted in the future, never in the
  past. [!] [!] [!] this solves all my problems
  - it means we can have actual snapshots! a snapshot = [a point in time, the value]
  - no actions can ever be added before that point in time (although actions can be added
    that say that their world state should be understood to be that of a given point in
    time) (and actions can still be evaluated in the order defined by the client time)
  - this requires the database has that one property but postgresdb should so that should
    be okay
  - wait a second this is literally what `id serial PRIMARY KEY` is
    - oh nevermind it's complicated https://timerwich.com/posts/2018/01/29/monotonically-increasing-ids-in-postgres/
    - oh and also that 30 second delay means in the future we'll want to put as many
      clients as possible into a single websocket connection. that's okay.
- actions need to specify what they were building off of. so if you insert an action it
  knows 
- consider using the push api - it's a single connection rather than a full websocket.
  the connection can be upgraded to a websocket if lots of people are editing
  - this one isn't super important yet, we'll just stay with websockets for now

- ok we're going to use supabase database + realtime + storage
- also consider if it's at all possible to not have documents at all and instead just
  have one large changelist where clients keep sub-snapshots
  - unfortunately i'm pretty sure 'begins with' queries aren't going to be fast enough
    for that at large scales
- ok we're going to be simple

- autoincrement id field
  - make sure we don't run into that race condition described above
    - probably just have the race condition for now because that doesn't give a clear way
      to deal with it and eventually we can switch to a database that supports this better
      or find a better google search result
- u128 document field
  - specifies which document the action affects
- some kind of affects_key field
  - not sure what datatype for this one. we can do jsonb i guess for now. it contains
    a string array.
- jsonb data field
  - [!] ensure that actions do not contain ordered json keys. note that snapshots do
    contain ordered json data and cannot use jsonb. snapshots can be stored in file
    storage though and they can be compressed or something. lots of things that can be
    done there.
  - note that we can consider using protobufs or a similar system with defined schemas for
    actions

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

# note

ok thinking about end to end encryption

- for small documents they can be peer to peer
- the issue is that if we want to send partial updates, we need to know some content
- I guess we can have encrypted sections inside unencrypted content where stuff inside
  the section is opaque

i'm not going to worry about this yet or take it into account for any design decisions,
we're not at the stage where it matters yet
