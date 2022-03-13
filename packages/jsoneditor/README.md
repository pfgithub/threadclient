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