import { autoFill, autoLinkgen, autoOutline, p2, readLink } from "api-types-generic";
import type * as Generic from "api-types-generic";
import { encoderGenerator, ThreadClient } from "threadclient-client-base";
import { LemmyHttp, ListingType, SortType } from 'lemmy-js-client';

export type BaseInstance = {
    hostname: string,
};
export type FilledInstance = {

};

export type BaseFeed = {
    // home feed only for now
    // home: /, /home ( Post, Local, Active )
    // subscribed: /home/data_type/Post/listing_type/Subscribed/sort/Active/page/1
    // all: /home/data_type/Post/listing_type/All/sort/Active/page/1
    //
    // this is strange? these are url query parameters but in the url itself?
    // interesting, you can get a comment feed with data_type=Comment
    // oh, that's in the UI too

    data_type: "Post" | "Comment",
    listing_type: ListingType,
    sort_type: SortType,
};
export type FilledFeed = {};

export type BaseCommunity = {};
export type FilledCommunity = {};

export type BasePost = {
    id: string, // numeric post id '/post/:id'
};
export type FilledPost = {
    // in_communities: BaseCommunity[]
};

export type BaseComment = {
    id: string, // looks like comment urls are just '/comment/:id'
};
export type FilledComment = {
    // parent: BaseComment | BasePost
};

const base_feed = {
    postLink: (base: BasePost) => autoLinkgen<Generic.Post>("feed_base→link", base),
    // asParent: (content: Generic.Page2Content, base: BasePost): Generic.PostParent => {

    // },
};

export type UTLRes = {
    content: Generic.Page2Content,
    pivot_loader: null | Generic.OneLoader<Generic.Post>,
};
export type UTLResAsync = { kind: "async", value: () => Promise<UTLRes> };
export function urlToOneLoader(pathraw_in: string): UTLRes | UTLResAsync {
    const content: Generic.Page2Content = {};
    // if(pathraw_in === "/demo") {
    //     const feed_base: BaseFeed = {};

    //     return {
    //         content,
    //         pivot_loader: p2.prefilledOneLoader(
    //             content,
    //             base_feed.post(content, feed_base),
    //             undefined,
    //         ),
    //     };
    // }else{
    //     throw new Error("unsupported path");
    // }
    throw new Error("unsupported path");
}

type LoaderData = {
    kind: "todo",
} | {
    kind: "feed",
    base: BaseFeed,
} | {
    kind: "post",
    base: BasePost,
};
const opaque_loader = encoderGenerator<LoaderData, "loader">("loader");


export async function loadPage2v2(
    lreq: Generic.Opaque<"loader">,
): Promise<Generic.LoaderResult> {
    const content: Generic.Page2Content = {};
    const data = opaque_loader.decode(lreq);
    if(data.kind === "todo") {
        throw new Error("TODO");
    }else throw new Error("TODO unsupported loader kind");

    return {content};
}

const client_id = "lemmy";
export const client: ThreadClient = {
    id: client_id,

    getPage: async (path) => {
        let v2res = urlToOneLoader(path);
        if ('kind' in v2res) {
            v2res = await v2res.value();
        }
        if (v2res.pivot_loader != null) {
            const rl_res = readLink(v2res.content, v2res.pivot_loader.key);
            if (rl_res != null) return {
                content: v2res.content,
                pivot: v2res.pivot_loader.key,
            };
            const loadreq = readLink(v2res.content, v2res.pivot_loader.request);
            if (loadreq == null || loadreq.error != null) throw new Error("load fail: " + JSON.stringify(loadreq));
            const loadres = await loadPage2v2(loadreq.value);
            return { content: { ...v2res.content, ...loadres.content }, pivot: v2res.pivot_loader.key };
        }
        throw new Error("not supported url "+path);
    },
    loader: loadPage2v2,
};

// const base_url = "test";
//

async function main() {
    const lemmy_client = new LemmyHttp("https://beehaw.org");
    const res = await lemmy_client.getSite({});
    // await lemmy_client.getPosts();
    console.log(res);
}

main().then(r => console.log("L", r)).catch(e => console.log("L", e));

// const jwt = await client.login({
//     // no oauth yet :/
//     username_or_email: "",
//     password: "",
// });
// lemmy_client.getPosts({
//     community_id: 0, // homepage local feed
// })


/*

you can only log in once
you pick an instance to log in to

ideally, requests are proxied through your instance

*/
