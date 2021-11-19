import {destringify} from "json-recursive";
import * as Generic from "api-types-generic";
import * as example_post from "./example_post.json";

const parsed = destringify(JSON.stringify(example_post)) as Generic.Page2;

(async () => {
    if(parsed.pivot.err) {
        console.log("error: "+parsed.pivot.err);
        return;
    }
    let focus: Generic.Post = parsed.pivot.ref!;
    // note we need to store both the focus and like a path to get here
    // because a reply can have a different parent than the parent node
    // we could make a basic wrapper around Generic.Post that gives like
    // - viewportParent: …
    // - viewportReplies: …

    printPost(focus);
})()

function printPost(post: Generic.Post) {
    console.log(post);
}