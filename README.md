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