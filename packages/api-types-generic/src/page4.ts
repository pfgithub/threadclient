/*
flow

ui asks the client postFromURL(url) -> Link<Post>, Data
client asks the server and returns the data
ui has the client render Semantic from Data
ui generates Display from Semantic
ui renders Display

user clicks 'upvote'
- ui sends the request to the client


so eg

hn post 123
-> {...}, opaque

so now ui goes to the client and says render out post (opaque) given (data)
client returns the rendered post. 'opaque' is a link

*/

namespace Semantic {
    export type Link<T> = {__v: T};
    export type ArrayLink<T> = {__v: T};
    export type Post = {
        author: string,
        parent: Link<Loader<Link<Post>>>,

        // not sure if we want this vs an array. maybe an array is better.
        // array would be children: Loader<Link<Post>[]> which doesn't let you position the loaders exactly where you want them so ig this.
        first_child: Link<Loader<Link<Post>>>, 
        next_sibling: Link<Loader<Link<Post>>>,
    };
    export type Loader<T> = {
        // if not yet loaded, render eg: (a, load 5 more, b)
        gap?: {
            request: LoadRequest,
            est_count?: number,
            // when this loads, it edits the link to this gaploader:
            // - set gap to undefined (or reduce the gap),
            // - set next to the next value
        },
        next: T | null,
    };
    type LoadRequest = string;
}

// Semantic is converted to Display
namespace Display {}

function enc<DB, T, U>(resolve: (db: DB, v: U) => T): {enc: (v: U) => Semantic.Link<T>, dec: (v: Semantic.Link<T>) => U} {
    return {enc: (a: unknown) => a, dec: (a: unknown) => a} as unknown as any;
}
function demo() {
    type HNDB = {
        posts: Map<number, HNPost>,
    };
    type HNPost = {by: string, parent: number, children: number[], text: string};
    const db: HNDB = {posts: new Map()};
    const pparent = enc<HNDB, Semantic.Loader<Semantic.Link<Semantic.Post>>, number | null>((db, parent): Semantic.Loader<Semantic.Link<Semantic.Post>> => {
        if (parent != null) {
            if (db.posts.has(parent)) throw new Error("TODO loader");
            return {next: pc.enc(db.posts.get(parent)!)};
        }
        return {next: parent};
    });
    const pc = enc<HNDB, Semantic.Post, HNPost>((db, post): Semantic.Post => {
        return {
            author: post.by,
            parent: pparent.enc(null),
            first_child: pparent.enc(null),
            next_sibling: pparent.enc(null),
        };
    });
    const client = {
        async postFromURL(): Promise<{result: Semantic.Link<Semantic.Post>, dirty: Semantic.Link<unknown>[]}> {
            const res = pc.enc({by: "author1", parent: 456, children: [123], text: "abc"});
            return {result: res, dirty: [res]};
        },
        async votePost(post: Semantic.Link<Semantic.Post>): Promise<{dirty: Semantic.Link<unknown>[]}> {
            // we internally update the data and mark dirty any affected links so the client can re-resolve them
            // and precisely rerender only affected items
            return {dirty: []};
        },
    };
}

// this is interesting. we probably don't want to do this, but we could
// maybe we want part of it:
// - currently, we resolve everything using the content object merge. but that makes it hard to do some things
//   - eg we would like to merge PageIdentityCard, LimitedIdentityCard, and FilledIdentityCard into one
//   - eg we would like to remove nonpivoted_identity_card
// - current is nice because we could move clients fully serverside. any server could provide this interface
// - going to this would require clientside logic per-server, but could reduce the amount of data sent between
//   client and server

// this should be possible to migrate slowly to
// we will implement it in page2 rather than remaking page2

// basically link resolution would change to be handled differently
// feels doable. we would first make sure existing stuff can work with no changes (ie by wrapping getpage/etc)
// the client will cache a map of link to value, and it will refetch those on dirty. once a value is no longer needed it can drop it too.

// main issue is we're adding even more processing
// page1: url -> page description -> render
// page2: url -> page description -> view -> render
// page4: url -> db -> page description -> view -> render
