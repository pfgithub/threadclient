import * as Generic from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import { encoderGenerator } from "threadclient-client-base";
import {
    client,
    jstrOf,
    rawlink, redditRequest,
    SubrInfo, SubSort
} from "./reddit";
import { loadPage2v2 } from "./reddit_page2_v2";

export function subUrl(details: SubrInfo, sort: SubSort): string {
    // [!] on user pages like overview and submitted, `?sort={{sort.v}}&t={{sprt.t}} should be used instead
    //      of `/submitted/hot` eg

    // note that on user pages, [...details.base] does not link to `/hot`, instead it links to some other thing
    return "/"+[...details.base, sort.v === "unsupported" ? "hot" : sort.v].join("/") + (sort.v === "controversial" || sort.v === "top" ? (
        "?t="+encodeURIComponent(sort.t)
    ) : "");
}

type SubmitData = {
    kind: "newpost",
    sub: string, // for user subreddits, probably "u_username"
};
export const submit_encoder = encoderGenerator<SubmitData, "submit">("submit");

export async function submitPage2(
    key: Generic.Opaque<"submit">,
    value: Generic.SubmitResult.SubmitPost,
): Promise<string> {
    const submit_data = submit_encoder.decode(key);

    // !TODO make this typesafe and improve the 
    // Generic.SubmitResult.SubmitPost type
    // we could make this typesafe by:
    // - describing the result type we want
    // - in the submission_data, use a function that knows the wanted result type
    const title_field = value.fields?.['_title']?.title;
    if(title_field == null || title_field.length === 0) throw new Error("a title is requierd");
    const content_field = value.fields?.['_content']?.content;
    if(content_field == null) throw new Error("post content is required");
    const flair_field = value.fields?.['_postflair']?.flair_one;
    const flags_field = value.fields?.['_postopts']?.flair_many;

    const content_kind = content_field?.tab ?? "_textpost";

    const getflag = (v: string) => {
        return flags_field?.[v] ?? false;
    };

    if(getflag("_EVENT")) throw new Error("Making Event Posts is not yet supported in ThreadClient");

    const body: Reddit.ApiSubmitBody = {
        api_type: "json",
        validate_on_submit: "true",
        show_error_list: "true",

        title: title_field,

        flair_id: flair_field ?? undefined,
        // flair_text: …,

        kind: 0 as any as "self",

        sendreplies: jstrOf(true),

        nsfw: jstrOf(getflag("_OVER18")),
        spoiler: jstrOf(getflag("_SPOILER")),
        original_content: jstrOf(getflag("_OC")),
        discussion_type: getflag("_LIVECHAT") ? "CHAT" : undefined,

        sr: submit_data.sub,
    };
    if(content_kind === "_nothing") {
        body.kind = "self";
        body.text = "";
    }else if(content_kind === "_textpost") {
        body.kind = "self";
        body.text = content_field.choices?.['_textpost']?.text ?? "";
    }else if(content_kind === "_linkpost") {
        body.kind = "link";
        body.url = content_field.choices?.['_linkpost']?.link ?? "";
    }else{
        throw new Error("TODO support content kind: " + content_kind);
    }

    console.log("sendbody", body);

    const res = await redditRequest("/api/submit", {
        method: "POST",
        query: {
            resubmit: "true",
        },
        body,
        mode: "urlencoded",
    });

    console.log("%+%", res);

    return res.json.data.url;
}

export function getPostInfo(listing_raw: Reddit.T1 | Reddit.T3): Generic.PostInfo {
    const listing = listing_raw.data;
    return {
        creation_date: listing.created_utc * 1000,
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        edited: listing.edited ? {date: listing.edited * 1000} : undefined,
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        pinned: listing.pinned || listing.stickied || false,

        in: listing_raw.kind === "t3" ? {
            name: listing.subreddit_name_prefixed,
            link: "/"+listing.subreddit_name_prefixed,
            client_id: client.id,
        } : undefined, // don't show on comments

        comments: listing_raw.kind === "t3" ? listing_raw.data.num_comments : undefined,
    };
}

export function rawlinkButton(url: string): Generic.Action {
    return {kind: "link", text: "View on reddit.com", url: rawlink(url), client_id: "reddit", icon: "external"};
}


// Two examples of load more:
// - /comments/omvrb7 - a horizontal loader is needed for the pinned post
// - /comments/omvrb7/a/h6yus3q/?context=3 - a vertical loader is needed above the highest post
// TO FIND:
// - a depth-based horizontal loader

export async function loadPage2(
    content: Generic.Page2Content,
    lreq: Generic.Opaque<"loader">,
): Promise<void> {
    return loadPage2v2(content, lreq);
}