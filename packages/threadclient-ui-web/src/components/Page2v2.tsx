import {createContext, For, JSX, useContext} from "solid-js";
import Page2ContentManager from "../util/Page2ContentManager";
import * as Generic from "api-types-generic";
import { ReadLink } from "./page2";
import OneLoader from "./OneLoader";
import { Show } from "tmeta-util-solid";

/*
interaction model:
for posts:
- content is hidden. click to repivot and show content.
- because page2 acts like page1 now with how history works, this doesn't physically hurt
  (and it no longer loses state and stuff)
- if we really wanted to, we could use a fullscreensnapview to view post content. maybe eventually
  but for now this is fine.
*/

// * recommendation: use this like page1 where you have one <Page2v2> node per
// history element
export function Page2v2(props: {
    pivot: Generic.Link<Generic.Post>,
}): JSX.Element {
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
        <Show when={pivot.replies}>{replies => (
            <OneLoader loader={replies.loader} label="Load More">{replies_items => <div>
                <For each={replies_items}>{reply_item => {
                    if(typeof reply_item === "object") return <div>todo top level loader</div>;
                    return <ReadLink link={reply_item} fallback={<div>error unfilled reply object?</div>}>{post => (
                        <TopLevelPost
                            id={reply_item}
                            post={post}
                        />
                    )}</ReadLink>;
                }}</For>
            </div>}</OneLoader>
        )}</Show>
    </>}</ReadLink>;
}

function TopLevelPost(props: {id: Generic.Link<Generic.Post>, post: Generic.Post}): JSX.Element {
    return <div>
        post
    </div>;
}