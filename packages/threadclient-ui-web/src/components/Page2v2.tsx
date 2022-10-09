import * as Generic from "api-types-generic";
import { Accessor, For, JSX } from "solid-js";
import { createTypesafeChildren, Show, SwitchKind } from "tmeta-util-solid";
import { getSettings, getWholePageRootContext } from "../util/utils_solid";
import OneLoader, { UnfilledLoader } from "./OneLoader";
import ReadLink from "./ReadLink";
import { SettingPicker } from "./settings";

/*
interaction model:
for posts:
- content is hidden. click to repivot and show content.
- because page2 acts like page1 now with how history works, this doesn't physically hurt
  (and it no longer loses state and stuff)
- if we really wanted to, we could use a fullscreensnapview to view post content. maybe eventually
  but for now this is fine.

concepts:
- title bar
  - posts have a title bar. this is where you can click to repivot to them, or if they are collapsed,
    uncollapse them. if they aren't uncollapsible, it will always repivot.

reading <Post>, this is the mess:
L85-120: determining if the object is collapsed requires a bit of a mess
  - this can be simplified as we're getting rid of that collapse holder thing because the
    nodes themselves will hold their collapse state. eventually, we'll probably want to add
    it back but in a better way to handle persisting collapse states.
    determining if the object 
L150-180:
  - that's a lot of lines of code to call two functions. also some mess with that
    whole thing about :: checking if (collapse is user controllable && thumbnail)
    - why does thumbnail affect whether an object is user controllable? ????
      - ah. collapse right now is either 'false' or 'default_collapsed: bool'
        * change: update collapse to be {default_collapsed: bool, user_controllable: bool}
          - a reddit post is 'default_collapsed: true', 'user_controllable: false'
            - hmm. this kind of requires reddit posts to be in 
          - a reddit comment is 'default_collapsed: (value)', 'user_controllable: true'
        * alternate solution: collapse state is never user controllable in repivot lists
          - if a reddit post were to be displayed in a tree for some reason, it would
            be expanded and have a collapse button
          - we tried this solution already and decided against it but it seems like a better
            idea now so let's try it again
        * alternate alternate solution
          - go backwards to where objects themselves can be repivot nodes instead of
            tree nodes. there was a reason we moved to repivot list though and I'm sure
            it was good so don't do this
    - that's a lot of stuff the PostTopBar needs
    - this is very different for objects with a thumbnail vs without them. objects with a
      thumbnail split into this three line view, whereas objects without a thumbnail
      collapse into this tiny bar with the info line and a little body summary
      * not sure what to do about this one yet
L180-200:
  - is that *another* collapse button?
    - right, because there is a seperate collapse button when the object is visible vs when
      it is hidden
    - this is bad because it requires us to handle focus instead of the browser doing it for us
ok a quick question to ask:
- are posts visually similar enough to comments to justify combining them into one renderer?
  - I think the answer is no. I'm not sure if they can even justify being the same content type.
    - posts have a thumbnail, title, info byline, and info data line. when pivoted, they have a body.
    - posts don't get seen in tree views
    - comments never have thumbnails or titles. they have a combined info byline and data line. they
      have a body that is always visible.
  - let's split these out. oh, and let's seperate tree stuff from the post itself.
    - the only thing is we'll have to do is go ask the post if it has some buttons occupying the top of its
      collapse button (eg vote buttons)


plan:
* collapse state is 'default_collapsed: bool'. collapse state is always controllable in trees,
  and never controllable in repivot lists. in the parent list, objects are in their default state
  but not controllable, and in the pivot, objects are always expanded
* the post content render no longer renders its own collapse button. all content types can
  have collapse buttons, and all do when rendered in a tree view. none do in repivot lists.
* split out PostContent kinds 'kind: "post"' →
  - "reddit_post" {
    title: {text: string, flair?: undefined | Flair[]},
    thumbnail: Thumbnail,
    info: PostInfo,
    - author: InfoAuthor, // ← author should be inside info and use the new partial id cards
    - actions: NodeActions, // ← actions should be inside info
    body: Body,
    // notably:
    // - thumbnail is required. use a kind default none if you don't want one.
    // - collapse info is moved to the Post
    // - title is required. this breaks our sidebar flair sort but who cares. the sidebar is already
    //   a hacky mess anyway, we can turn some of those things into real post content types.
    //   there might be other use cases in the future where we don't want a title to be required,
    //   if we find those it shouldn't be too hard to make that change.
    // - info is required. lots of properties in it will likely be optional though, so maybe 'info: {}'
    //   will be allowed.
  }
  - "reddit_comment" {
    info: PostInfo, // ← contains author and actions, same notes as before
    body: Body,
    // the link learns about it, but not where the client 
    // notably:
    // - it's missing flair. gildings will go in the author flair for now.
    // - it's missing title. we might want that eventually for some clients, or maybe
    //   we can get away with using a richtext body starting with an h1 of the title.
    // - collapse info is moved to the Post
  }
  - Post {…Post, default_collapsed: boolean}
  - todo: improve the naming. make it sound more generic or something. DataValueNodeObject.
  - when rendering posts, we tell them their collapse state. they have no control over
    it, except maybe with a 'collapse'/'uncollapse' action that we pass in if available.
  - question: if a post gets put in a tree, how does it behave?
    - we can just not care for now and figure it out later
    - specifically, this is asking: what is its default collapse state
* 'threadclient-client-reddit' → 'threadclient-glue-reddit'. or 'threadclient-server-reddit'
  - 'glue' is nice because it maintains a 'client (ui)' → 'glue' → 'server (reddit.com)'
  - 'client' is bad because 'client (ui)' → 'client' → 'server (reddit.com)'
  - 'emu' maybe acceptable. 'client (ui)' → 'tcemu' → 'server (reddit.com)'
  - eventually, we might have support for sites without any glue code where the ui directly
    talks to the server.

ok this doesn't feel right yet. here's what I put:
    // a 'content-first' post. styled like a reddit comment.
    // suitable for:
    // - reddit comments
    // - tw*tter posts
    // - hackernews comments
    export type PostContentCTF = {};
    // a 'metadata-first' post. styled like a reddit post.
    // suitable for:
    // - reddit posts
    // - forum topics and categories
    // - emails
    // - hackernews threads
    export type PostContentMTDF ={};

but thinking about these use-cases, it's more about different ways to display the same data:
- when looking at the email homepage, you see a bunch of reddit-style posts with titles and some metadata
- when you focus a specific one, it shows it in a tree view. here, it looks
  - no, it looks the same. it's expanded, and all the others are too. that's the only difference.

huh. seems right still.

convincing myself:
- comment:
  [pfp] [byline] [infobar] [collapsed_desc] [menu]
- post
  [thumbnail. kinda like a collapsed_desc in a comment]
  - [title]
  - [byline]
  - [infobar]
  [menu]
so in a comment, the byline/infobar are in one line and in a post it's two.
is this just a difference between having a collapsed_desc and a thumbnail?
possibly

the concept would be then: comments and posts are identical (as they are now)
and objects with thumbnails get a two-line byline/infobar whereas without thumbnails,
objects get a collapsed_desc.

ok so this implies maybe seperate view functions but the same model in generic.ts

so here's the concept

posts have:
- title (text, flair)
- thumbnail
- info
- body
comments have:
- [generated] collapse description
- info
- body

let's look at some other things and see how they compare:
info cards have:
- banner
- profile pic
- id-card-related actions
- description
yeah okay maybe that's different enough to justify a different structure

ok nevermind on the plan to change posts. we'll use two renderers, picked based on if
the post has a thumbnail or not.

*/

/*
function plans:

fn TreePost(post: Link<Post>)
  - controls the collapse button
  - has a special case for putting vote buttons in the gutter
  - has the swipe actions
  - displays replies (note: a flat replies fn is used here, but it only returns one layer of replies)
    (since collapse buttons are handled with indentation rather than nesting, child nodes are able to
     unthread themselves.)
fn DisplayPost(post: Link<Post>, collapsed: bool) :: displays the content of the post
*/


// * recommendation: use this like page1 where you have one <Page2v2> node per
// history element
export default function Page2v2(props: {
    pivot: Generic.Link<Generic.Post>,
}): JSX.Element {

    const settings = getSettings();

    /*
    so for the above:
    - we'll probably want to use some flat-style thing
        - this is because of stuff like header extraction and whatever else
        - this will also handle the title
        - we won't have any special flat nodes, just normal nodes though
    for the below:
    - probably just a standard for loop
    */
    return <ReadLink link={props.pivot} fallback={<>
        The pivot is not defined?
    </>}>{pivot => <>
        <div class="pt-2" />
        <SettingPicker
            setting={settings.indentMode}
            options={["desktop", "mobile", undefined]}
            name={v => ({
                desktop: "Desktop",
                mobile: "Mobile",
                default: "System Default",
            } as const)[v ?? "default"]}
        />
        <div class="pt-4" />
        <Show when={pivot.replies}>{replies => {
            const flatChildren = useFlatChildren(() => replies.loader);
            return <div class="space-y-4">
                <For each={flatChildren()}>{flat_child => (
                    <TopLevelWrapper>
                        <FlatChild ch={flat_child} indent={[]} />
                    </TopLevelWrapper>
                )}</For>
            </div>;
        }}</Show>
    </>}</ReadLink>;
}

function TopLevelWrapper(props: {children: JSX.Element}): JSX.Element {
  return <div class="bg-zinc-800">{props.children}</div>;
}

// we'll need some css tricks (likely solid js providers and no actual css tricks) to
// make sure posts work such that:
// - when you hover it, it highlights the entire post
// - when you hover the title, it highlights the entire title

type TreeIndent = {
    id: Generic.Link<Generic.Post>,
    depth: number,
    threaded: boolean,
};
function TreePost(props: {id: Generic.Link<Generic.Post>, post: Generic.Post, indent: TreeIndent[]}): JSX.Element {
    const settings = getSettings();
    // * note that this fn will need to special-case if the post has a vote button to put it
    //   in the collapse gutter on desktop
    return <div>
        {/* Self */}
        <TreeIndentOne indent={props.indent}>
            TODO self5
        </TreeIndentOne>
        {/* Replies */}
        <Show when={props.post.replies}>{replies => (
            <TreeReplies replies={replies} indent={[
                ...props.indent,
                {id: props.id, depth: props.indent.length, threaded: false},
            ]} />
        )}</Show>
    </div>;
}
const rainbow = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
];
function getRainbow(n: number): string {
    // this should be @mod not @rem
    // doesn't matter though, n should never be less than 0
    return rainbow[n % rainbow.length]!;
}
function TreeIndentOne(props: {indent: TreeIndent[], children: JSX.Element}): JSX.Element {
    // * consider checking for the optimize for touch css thing instead of
    //    using screen size to determine if we should use those rainbow side
    //    bars or desktop-style collapse buttons
    // * and we can add a setting in case it detects wrong
    const settings = getSettings();
    return <div class="flex flex-row">
        <div><SwitchKind item={{kind: settings.indentMode()}}>{{
            mobile: () => <Show when={props.indent[props.indent.length - 1]}>{last_indent => (
                <div class="w-1 pl-0.5 relative h-full" style={{
                    // pt-2 todo do that with gap instead
                    'margin-left': (0.25 * last_indent.depth)+"rem",
                }}>
                    <div class={"w-full h-full "+getRainbow(last_indent.depth)+" rounded" + (
                        last_indent.threaded ? "threaded-new threaded-new-ltsm" : ""
                    )} />
                </div>
            )}</Show>,
            desktop: () => <div class="h-full">
                <For each={props.indent}>{item => <>
                    <div class="inline-block">[TODO]</div>
                </>}</For>
            </div>,
        }}</SwitchKind></div>
        <div class="flex-1 w-0">
            {props.children}
        </div>
    </div>;
}
function FlatChild(props: {ch: FlatChild, indent: TreeIndent[]}): JSX.Element {
    return <SwitchKind item={props.ch}>{{
        post: post_id => <ReadLink link={post_id.link} fallback={(
            <div>error unfilled post {post_id.link.toString()}</div>
        )}>{post => (
            <TreePost id={post_id.link} post={post} indent={props.indent} />
        )}</ReadLink>,
        loader: loader => <TreeIndentOne indent={props.indent}>
            <UnfilledLoader label="Load More" loader={loader.loader} />
        </TreeIndentOne>,
        error: error => <TreeIndentOne indent={props.indent}>
            [todo indent]error: {error.message}
        </TreeIndentOne>,
    }}</SwitchKind>;
}

// * this fn will handle unthreading and indent management there in conjunction with the caller passing
//   in a bit of info. hopefully we can do threading properly but we might end up with either:
//   - the first comment not being marked as threaded
//   - comments with no replies being marked as threaded
//   and it will require a bit of a hack to resolve that unfortunately (without creating that mess where
//   we check the replies of the replies in the parent)
function TreeReplies(props: {replies: Generic.PostReplies, indent: TreeIndent[]}): JSX.Element {
    const flatChildren = useFlatChildren(() => props.replies.loader);
    return <For each={flatChildren()}>{flat_child => (
        <FlatChild ch={flat_child} indent={props.indent} />
    )}</For>;
}

type FlatChild = {
    kind: "post",
    link: Generic.Link<Generic.Post>,
} | ({
    kind: "loader",
    loader: Generic.BaseLoader,
}) | {
    kind: "error",
    message: string,
};
// [!] this function does not have anything to do with unthreading procedures
//      other than that you can check the length of its return value which helps
function useFlatChildren(loader: Accessor<Generic.HorizontalLoader>): () => FlatChild[] {
    return FlatChildTsch.useChildren(() => <>
        <ReadLink link={loader().key} fallback={(
            <FlatChildTsch
                kind="loader"
                loader={loader()}
            />
        )} whenError={emsg => (
            <FlatChildTsch kind="error" message={emsg} />
        )}>{value => (
            <For each={value}>{item => {
                if(typeof item === "object") {
                    const resv = useFlatChildren(() => item);
                    return <>{resv}</>;
                }
                return <FlatChildTsch kind="post" link={item} />;
            }}</For>
        )}</ReadLink>
    </>);
}
const FlatChildTsch = createTypesafeChildren<FlatChild>();