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