```
yarn install
yarn dev
```

## note

if this gets finished, this should get merged into tmeta

make sure to merge with history with git-subtree:

https://stackoverflow.com/questions/6426247/merge-git-repository-in-subdirectory

## note

this is almost complete with functionality

- [ ] we need to be able to export to and import from json
  - [ ] ideally this would be configurable - you would write the serialization module yourself
- [ ] we should keep the state saved in localstorage so it doesn't go away
- [ ] we need to support optional fields

next step is making a mockup real ui to see how it could look

- [ ] we want to highlight fields which are incomplete and need to be filled in
- [ ] we want it to look nice
- [ ] we want it to be faster than writing manual json
  - [ ] it likely will not be faster for cases wher you have to copy/paste
        a lot of structure
  - [ ] it should be faster for straight data entry
  - [ ] it should be faster for being able to figure out what fields there are

## TODO:

- ok we're:
  - making the text editor. nothing fancy, literally just using input elements and
    a few basic keybinds for now
- first I want to:
  - change arrays to be objects with symbol keys utilizing js object property order
  - search for regex `array_item|array_symbol` and fix all of those locations
  - oh I have to enable typescript strict mode this is unusable
    - oh wow we're not ready for strict mode

## notes

about the internal data structure:

- this is shared across clients
- once we get a proper history manager and have commits and stuff this will handle
  undo and redo and stuff
- this will be able to be synced across multiple clients. if we make a minor change
  (switch it to store history as events) we can trivially add multi-user editing so
  that will be nice.

issues:

- something about code
- right, some structures we want to be able to put user-written functions in
- eg summary
- and some we want to define like special ids that have meanings to clients
- eg all of richtext
- consider:
  - use wasm for summaries
  - use uuids + code in jsoneditor for printing
- either that or we can use uuids everywhere
- not sure

notes:

- may want to consider storing basically every object as a pointer in one big root
  structure? just so if we want to move something around it doesn't make as many changes
  in the json. not sure, if that becomes an issue we can make it work that way.
- that has an advantage that we can move from a store with horrible deep diffing to
  our own structure that only has one level of diffing. so that would be nice.

ok I'm not ready to do the next step in texteditor yet (either cursor movement or text
input) so I'm going to see about supporting wasm code functions

or just a tiny homebrew dsl language or something

oh right and then we have to move oh no

it is very annoying not having typed data

i'm going to make some type guards before i do this

actually I can do it automatically right?

ok I'm going to try uuh