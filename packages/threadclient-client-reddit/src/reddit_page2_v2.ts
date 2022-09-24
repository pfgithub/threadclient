/*
import * as Generic from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import { getSrId, subUrl } from "./page2_from_listing";
import { client, SubrInfo, SubSort } from "./reddit";

links
in
page2







getobject(ObjKind, obj_base, obj_full)

there are two types of objects

take eg:

- a subreddit object
  - this always exists and doesn't have to load
- a comment object
  - this has to load

here's a question: why is the subreddit object different than the comment object
- because it's the pivot, and we decided that the pivot doesn't have to load
but that's not a good reason

ok so what about::
our previous psys attempt used:
- the subreddit would have fill data of: its listing content
the new thing would be:
- the subreddit has fill data of its Reddit.T5Data

so here's the question:
- what do you do when you fetch a page?

ok here a post has this info:
```
export type Post = {
    kind: "post",

    content: PostContent, // content should always be in a PostData. eg: crossposts that are embedded in a body also need parent, replies.
    internal_data: unknown,

    disallow_pivot?: undefined | boolean,
    parent: null | PostParent,
    replies: null | PostReplies,
    
    url: string | null, // if a thing does not have a url, it cannot be the pivot
    client_id: string,
};
```

in order for the pivot to be a post, wew would need:
- content should be a loader
- url needs to be determinable from the object's basic
  - we can include a 'vanity' url inside the object's content. ie: a post's root url
    would be `/r/[subreddit]/comments/[postid]/0` but we would prefer the url
    `/r/[subreddit]/comments/[postid]/[postname]`

ok this is how objects work

given the basic, I can create any post

what about nullable contents?

- oh—given the basic, can I create the loader?
  - yes
  - we'll have to make exceptions for any linked loaders

*/
