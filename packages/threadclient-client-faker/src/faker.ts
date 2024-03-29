import * as Generic from "api-types-generic";
import {rt} from "api-types-generic";
import { encoderGenerator, ThreadClient } from "threadclient-client-base";
import { faker as faker_dontuse } from "@faker-js/faker";

function setSeed(seed: string, property_id: string) {
    faker_dontuse.seed((seed + ":" + property_id).split("").map(v => v.codePointAt(0)!));
}
function faker(seed: object, prop: string): typeof faker_dontuse {
    setSeed(JSON.stringify(seed), prop);
    return faker_dontuse;
}
// consider making this return a promise to easily flag which are api requests

/*
this will be multi part:
- part 1: only render one post and everything else as loaders. make this ergonomic to code.
- part 2: have our own lil fake backend that gives similar data to what the reddit api gives
  in one request. make this ergonomic to code.
- part 3: rewrite the reddit client with this format. ideally, pull generic stuff out so that any
  client can use it.

I think it's time to move on to part 2. maybe do some f2 renaming first.

part 2:
- this involves:
  having 'partial'/'full' versions of our stuff
  - maybe have a Base type for the content? if base represents the minimal info to generate the object
  - how do we then fill as much content as we got from the api?

some notes:
- we might consider trying to merge base types like we did before?
  - client_root would be the base type and then we would specify all the output types it could generate?
*/

// we're going to want to version generic
// - api-types-generic/src/versions/0
// (no semver - the only versions we care about change structure)
// (and then we write code to auto convert old generic to new generic)
// (and downgrade fns. if it's missing a feature, the downgrade fn would put a notice that the
//  client is not able to handle the feature.)

/*
post
|- parent loader
|- comment, but content is empty
|- comment

that's what we get. do we want that?
idk but it's what we're getting. we'll have to hack around it. detect:
- if we don't have content available for the parent, don't render its outline. leave it as a loader.
*/

// Base specifies:
// - all the information you need to get an unfilled Post
// - all information in Base should be serializable to and deeserializable from a URL
type Base = {
    kind: "client_root",
} | {
    kind: "home",
} | RedditlikeCommunity | RedditlikeCommunitySidebar | RedditlikePost | RedditlikeComment;
type RedditlikeCommunity = {
    kind: "redditlike_community",
    raw_name: string, // generate with 'faker(…).random.word()'
};
type RedditlikeCommunitySidebar = {
    kind: "redditlike_community_sidebar",
    community: RedditlikeCommunity,
};
type RedditlikePost = {
    kind: "redditlike_post",
    id: string,
    in_community: RedditlikeCommunity,
};
type RedditlikeComment = {
    kind: "redditlike_comment",
    on_post: RedditlikePost,
    id: string,
};

type BaseIdentity = {
    kind: "redditlike_community_identity",
    community: RedditlikeCommunity,
};

function identityLoaderLink(identity: BaseIdentity): Generic.Link<Generic.Opaque<"loader">> {
    return Generic.p2.stringLink("identity_loader:"+JSON.stringify(identity));
}
function identityFilledLink(identity: BaseIdentity): Generic.Link<Generic.FilledIdentityCard> {
    return Generic.p2.stringLink("identity_value:"+JSON.stringify(identity));
}

function baseRepliesLink(base: Base): Generic.Link<Generic.HorizontalLoaded> {
    return Generic.p2.stringLink("base_replies:"+baseUrl(base));
}
function baseRepliesLoaderLink(base: Base): Generic.Link<Generic.Opaque<"loader">> {
    return Generic.p2.stringLink("base_replies_loader:"+baseUrl(base));
}
function baseLink(base: Base): Generic.Link<Generic.Post> {
    return Generic.p2.stringLink(baseUrl(base));
}
function baseContentLink(base: Base): Generic.Link<Generic.PostContentPost> {
    return Generic.p2.stringLink("base_content:"+baseUrl(base));
}
function baseUrl(base: Base): string {
    return "/?obj="+encodeURIComponent(JSON.stringify(base));
}
function urlToBase(url: string): Base {
    const ub = new URL(url, "https://faker.test/");
    const sp_obj = ub.searchParams.get("obj") ?? `{"kind":"home"}`;
    return JSON.parse(sp_obj) as Base;
}
// heh https://fakerjs.dev/api/hacker.html
// faker.hacker.phrase()

function baseContent(content: Generic.Page2Content, base: Base): Generic.Post {
    if(base.kind === "home") {
        return {
            kind: "post",
            content: basePostContent(content, base),
            internal_data: 0,
            parent: getAsParent(content, {kind: "client_root"}),
            replies: null,
            url: baseUrl(base),
            client_id: client.id,
        };
    }else if(base.kind === "redditlike_community") {
        return {
            kind: "post",
            content: {
                kind: "page",
                wrap_page: {
                    header: getIdentity(content, {kind: "redditlike_community_identity", community: base}),
                    sidebar: getReplies(content, {kind: "redditlike_community_sidebar", community: base}),
                },
            },
            internal_data: 0,
            parent: getAsParent(content, {kind: "client_root"}), // getParent({kind: "client_root"})
            replies: getReplies(content, base), // getReplies(self)
            url: baseUrl(base),
            client_id: client.id,
        };
    }else if(base.kind === "redditlike_post") {
        return {
            kind: "post",
            content: basePostContent(content, base),
            internal_data: 0,
            parent: getAsParent(content, base.in_community),
            replies: getReplies(content, base),
            url: baseUrl(base),
            client_id: client.id,
        };
    }else if(base.kind === "client_root") {
        return {
            kind: "post",
            content: {
                kind: "client",
                navbar: {
                    actions: [],
                    inboxes: [],
                    client_id: client.id,
                },
            },
            internal_data: 0,
            parent: null,
            replies: null,
            url: baseUrl(base),
            client_id: client.id,
        };
    }else throw new Error("TODO support object kind: "+(base as Base).kind);
}

function getIdentity(content: Generic.Page2Content, id_base: BaseIdentity): Generic.PageIdentityCard {
    const id_loader = identityLoaderLink(id_base);
    Generic.p2.fillLinkOnce(content, id_loader, () => {
        return opaque_loader.encode({
            kind: "one_identity",
            fill_identity_card: id_base,
        });
    });
    const id_filled = identityFilledLink(id_base); // leave empty
    return {
        temp_title: "c/"+id_base.community,
        filled: {
            kind: "one_loader",
            key: id_filled,
            load_count: null,
            request: id_loader,
            client_id: client.id,
            autoload: false,
        },
    };
}

// todo we can include the highest known value here. deal with that somehow.
// - we're probably going to rewrite how highest known values work to work with reddit
function getAsParent(content: Generic.Page2Content, base: Base): Generic.PostParent {
    // ok wait here's something interesting
    // we know the parent. "baseOutline(base)" fills for all values
    // in reddit, we don't always know the parent.
    // - in reddit, knowing the parent of a comment requires having that comment's full data
    // - in faker, the parent of the object is known for all objects in their base directly without
    //   requiring any 'api requests' (faker() calls)
    return {
        loader: Generic.p2.prefilledVerticalLoader(content, baseOutline(content, base), undefined),
    };
}
function getReplies(content: Generic.Page2Content, base: Base): Generic.PostReplies {
    const replies_key = baseRepliesLink(base);
    const request_key = baseRepliesLoaderLink(base);

    Generic.p2.fillLinkOnce(content, request_key, () => {
        return opaque_loader.encode({
            kind: "horizontal",
            fill_replies_of: base,
        });
    });

    // interestingly, we can only know the load_count if we have information for the object
    // that's a small issue with the loader api
    return {
        reply: undefined,
        display: "repivot_list",
        loader: {
            kind: "horizontal_loader",
            key: replies_key,
            load_count: null,
            request: request_key,
            client_id: client.id,
            autoload: false,
        },
    };
}
function baseOutline(content: Generic.Page2Content, base: Base): Generic.Link<Generic.Post> {
    const link = baseLink(base);
    Generic.p2.fillLinkOnce(content, link, (): Generic.Post => {
        return baseContent(content, base);
    });
    return link;
}
function oneIdentityLoader(content: Generic.Page2Content, base: BaseIdentity): void {
    const object_key = identityFilledLink(base);
    Generic.p2.fillLinkOnce(content, object_key, () => {
        return fillIdentityCard(content, base);
    });
}
function basePostContent(content: Generic.Page2Content, base: Base): Generic.PostContent {
    if(base.kind === "home") {
        // somehow here we need to know that we have data for this so we can call baseAPIPostContentPost
        // maybe we can indicate that it doesn't need data somehow?
        return {
            kind: "post",
            title: {text: "Welcome to Faker"},
            body: {kind: "richtext", content: [
                rt.p(rt.link(client, baseUrl({
                    kind: "redditlike_community",
                    raw_name: "asdfghjk",
                }), {}, rt.txt("c/asdfghjk"))),
            ]},
            collapsible: {default_collapsed: false},
        };
    }else if(base.kind === "redditlike_post") {
        return {kind: "post", title: null, collapsible: false, body: {kind: "text", content: "error todo", client_id: client.id, markdown_format: "none"}};
    }else{
        return {kind: "post", title: null, collapsible: false, body: {kind: "text", content: "error todo", client_id: client.id, markdown_format: "none"}};
    }
}

function apiGenImage(seed: object, mode: "nature" | "image", w: number, h: number): string {
    return faker(seed, "url").image[mode](w, h)
    + "?lock=" + faker(seed, "url_lock").datatype.number({min: 1, max: 1000000});
}

function apiGenBanner(seed: object): Generic.Banner {
    const random_val = faker(seed, "use_banner").datatype.number({min: 0, max: 999});
    if(random_val < 500) {
        return {kind: "image", desktop:
            // https://github.com/faker-js/faker/pull/1396
            apiGenImage([seed, "url"], "nature", 600, 200),
        };
    }else if(random_val < 900) {
        return {kind: "color", color: faker(seed, "color").color.rgb({prefix: "#"}) as `#${string}`};
    }else {
        return null;
    }
}
function apiGenSubPfp(seed: object): null | Generic.InfoPfp {
    const random_val = faker(seed, "use_pfp").datatype.number({min: 0, max: 999});
    if(random_val < 900) {
        return {
            url: faker(seed, "url").image.abstract(200, 200)
            + "?lock=" + faker(seed, "url_lock").datatype.number({min: 1, max: 1000000}),
        };
    }else{
        return null;
    }
}

function fillIdentityCard(content: Generic.Page2Content, base: BaseIdentity): Generic.FilledIdentityCard {
    if(base.kind === "redditlike_community_identity") {
        return {
            names: {
                display: faker(base, "title").company.name(),
                raw: "c/" + base.community.raw_name,
            },
            pfp: apiGenSubPfp([base, "pfp"]),
            theme: {
                banner: apiGenBanner([base, "banner"]),
            },
            description: {
                kind: "text",
                content: faker(base, "description").company.catchPhrase(),
                markdown_format: "none",
                client_id: client.id,
            },
            actions: {
                main_counter: null,
            },
            menu: null,
            raw_value: null,
        };
    }else throw new Error("todo support base kind "+(base as unknown as BaseIdentity).kind);
}

function contentLoader(content: Generic.Page2Content, container: Base): void {
    const c_id = baseContentLink(container);
    Generic.p2.fillLinkOnce(content, c_id, () => {
        return baseAPIPostContentPost(content, container);
    });
}

type APTRes = {
    body: Generic.Body,
    thumbnail: Generic.Thumbnail | undefined,
};

function generateTextBody(seed: object): Generic.Body {
    return {
        kind: "richtext",
        content: new Array(faker(seed, "par_count").datatype.number({min: 1, max: 4})).fill(0).map((__, i) => (
            rt.p(rt.txt(faker([seed, i], "par").lorem.paragraph()))
        )),
    };
}
function generateShortTextBody(seed: object): Generic.Body {
    return {
        kind: "richtext",
        content: [rt.p(rt.txt(faker(seed, "sentence").lorem.sentence()))],
    };
}
function generateTinyTextBody(seed: object): Generic.Body {
    return {
        kind: "richtext",
        content: [rt.p(rt.txt(faker(seed, "word").lorem.word()))],
    };
}
() => [generateShortTextBody, generateTinyTextBody];

function apiPostBodyThumb(seed: object): APTRes {
    return faker(seed, "choice").helpers.arrayElement<() => APTRes>([(): APTRes => {
        return {
            body: generateTextBody([seed, "content"]),
            thumbnail: {kind: "default", thumb: "self"},
        };
    }, (): APTRes => {
        const genimg = (w: number, h: number): string => {
            return apiGenImage([seed, "content"], "image", w, h);
        };
        const w = 640;
        const h = 480;
        return {body: {
            kind: "captioned_image",
            url: genimg(w, h),
            w: w, h: h,
        }, thumbnail: {
            kind: "image",
            url: genimg(140, 140),
        }};
    }] as const)();
}

function baseAPIPostContentPost(content: Generic.Page2Content, container: Base): Generic.PostContentPost {
    if(container.kind === "redditlike_post") {
        const post_body = apiPostBodyThumb([container, "body"]);
        return {
            kind: "post",
            title: {text: faker(container, "title").lorem.sentence()},
            // flair?
            // thumbnail?
            thumbnail: post_body.thumbnail,
            // info?
            // author?
            // body
            body: post_body.body,
            // collapsible
            collapsible: {default_collapsed: true},
            // actions?
        };
    }
    throw new Error("TODO baseApiPostContentPost");
}

function horizontalLoader(content: Generic.Page2Content, parent: Base): void {
    const hloader_id = baseRepliesLink(parent);
    Generic.p2.fillLinkOnce(content, hloader_id, () => {
        return fillHorizontalReplies(content, parent);
    });
}
function fillHorizontalReplies(content: Generic.Page2Content, parent: Base): Generic.HorizontalLoaded {
    if(parent.kind === "redditlike_community") {
        const res: Generic.HorizontalLoaded = [];

        // const reply_count = faker(seed, "reply-count").datatype.number({from:});
        // we could do infinite replies on this one
        for(let i = 0; i < 25; i += 1) {
            const seed = [parent, "reply_"+i];
            const post_id = faker(seed, "reply_name").random.alpha(10);
            res.push(baseOutline(content, {
                kind: "redditlike_post",
                id: post_id,
                in_community: parent,
            }));
        }

        return res;
    }else{
        throw new Error("Todo fill replies for: "+parent.kind);
    }
}

type LoaderData = {
    kind: "horizontal",
    fill_replies_of: Base,
} | {
    kind: "one_identity",
    fill_identity_card: BaseIdentity,
} | {
    kind: "content",
    for_post: Base,
};
const opaque_loader = encoderGenerator<LoaderData, "loader">("loader");

export const client: ThreadClient = {
    id: "faker",
    async getPage(url: string): Promise<Generic.Page2> {
        const base = urlToBase(url);
        const content: Generic.Page2Content = {};
        const pivot = baseOutline(content, base);
        return {pivot, content};
    },
    async loader(request: Generic.Opaque<"loader">): Promise<Generic.LoaderResult> {
        const req = opaque_loader.decode(request);
        const content: Generic.Page2Content = {};
        if(req.kind === "horizontal") {
            horizontalLoader(content, req.fill_replies_of);
        }else if(req.kind === "one_identity") {
            oneIdentityLoader(content, req.fill_identity_card);
        }else if(req.kind === "content") {
            contentLoader(content, req.for_post);
        }else throw new Error("TODO loader ["+(req as LoaderData).kind+"]");
        return {content};
    },
};