# AnRichtext

[!] when we have code samples that contain UUIDS, replace the uuid with a node that says
"unique id" and when copied, copies an actual unique id

so like we would have `const inline_code = "[Generate Unique ID]"` and you can click it
and it will generate and copy to your clipboard or you can copy the whole thing and paste
it and it will have a unique id in there

AnRichtext is a richtext editor for the web. This entire page is editable, try try editing
it! (note: we'll want every page to be editable and for the "unsaved changes" to persist
across pages you view. so it's practically a cms, just one that you can only save changes
with by making a github pr) (oh and we'll want to retype this document inside the editor
itself and make sure everything we have on the entire website can be made within the
editor) (obviously there will be specialized custom components we've defined but these
will have an actual button in some dropdown menu in a more section)

# Code Example

(dropdown to select between js and ts showing how the content model is typesafe)
```jsx
function App() {
    const root = create();
    return <RichtextEditor>
        (we're still figuring out how this will look)
        (will probably also need ui state too)
        (this example should make use of a bunch of default components for a nice
         complicated editor with simple code. we can also have demos for how you
         can define elements and schema and stuff)
        (the defaults will be opt-in and provided by a seperate package)
    </RichtextEditor>;
}
```

# Features

## Completely customizable.

AnRichtext does not come with a single line of CSS or default document model. You define
your document model to match what you need and write your components with your own css,
or add in items from a template.

## Ready for collaborative editing

<CollaborativeEditingDemo />
(we can do something simple like show two editors side-by-side and show the other cursor
in the inactive one)

## Use for any text input

examples using it as a replacement for <input /> that allows aggrandizements or
a replacement for input that autoresizes or …

## Typescript

AnRichtext is written in typescript and has strong typing or something

## Mobile support

actually it probably doesn't support mobile at all right now but this is required for
a 1.0 release. unfortunately we might end up having to use contenteditable to handle
certain types of mobile cursor movements. we also may want to do stuff like utilize
visualviewport to position buttons above the keyboard. maybe, maybe not.

oh right, contenteditable=true may be required for richtext copy/paste from outside
apps and we can probably hack it for copy/paste within our app.

## Size

AnRichtext is <ReleaseSize />kb and supports tree-shedding to only include the functions
you actually use in the output (it doesn't, we need this for any release. you just have
to enable some flag in a package.json right? not sure)
