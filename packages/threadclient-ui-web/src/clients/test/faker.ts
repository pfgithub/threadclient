import faker from "@faker-js/faker";
import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { encoderGenerator } from "threadclient-client-base";
import { assertNever } from "tmeta-util";


// ok
// ids will be like this:
//
// /group/subreddit_id/post_id/comment_1/comment_2/…
// /user/user_id/post/comment_1/comment_2/…

function newLink<T>(v: string): Generic.Link<T> {
    return v as Generic.Link<T>;
}
function saveLink<T>(content: Generic.Page2Content, link: Generic.Link<T>, value: T): void {
    content[link] = {data: value};
}

function generateAuthor(): Generic.InfoAuthor {
    // we should pass in the username and have it generate an id based
    // on that
    const username = faker.internet.userName();
    const pfp = faker.image.avatar();
    return {
        name: username,
        color_hash: username.toLowerCase(),
        link: "/faker"+"/user/"+username,
        client_id: "test",
        pfp: {url: pfp, hover: pfp},
    };
}

function setSeed(seed: string, fn_name: string): number[] {
    return (fn_name+":"+seed).split("").map(v => v.codePointAt(0)!);
}

function getParent(id_raw: Generic.Link<Generic.Post>): Generic.Link<Generic.Post> | null {
    const id = id_raw.toString();
    if(id.split("/").length <= 2) return null;
    return newLink<Generic.Post>(id.split("/").slice(0, -1).join("/"));
}
function getReplies(id_link: Generic.Link<Generic.Post>): Generic.Link<Generic.Post>[] {
    const id = id_link.toString();
    faker.seed(setSeed(id, "getReplies"));

    // subreddits will be paginated and go on forever
    // posts will have 0-50 replies
    // comments will have 0-3 replies

    const kind = postKind(id);
    if(kind === "comment") {
        const count = faker.datatype.number(3);
        return new Array(count).fill(0).map(() => {
            return newLink<Generic.Post>(id + "/" + faker.random.alphaNumeric(6));
        });
    }

    const count = faker.datatype.number(50);
    return new Array(count).fill(0).map(() => {
        return newLink<Generic.Post>(id + "/" + faker.random.alphaNumeric(6));
    });
}

function generateTextBody(): Generic.Body {
    return {
        kind: "richtext",
        content: new Array(faker.datatype.number({min: 1, max: 4})).fill(0).map(() => (
            rt.p(rt.txt(faker.lorem.paragraph()))
        )),
    };
}
function generateShortTextBody(): Generic.Body {
    return {
        kind: "richtext",
        content: [rt.p(rt.txt(faker.lorem.sentence()))],
    };
}
function generateTinyTextBody(): Generic.Body {
    return {
        kind: "richtext",
        content: [rt.p(rt.txt(faker.lorem.word()))],
    };
}

function generateThumbnailFor(body: Generic.Body): Generic.Thumbnail {
    if(body.kind === "captioned_image") {
        return {
            kind: "image",
            url: body.url.replace(/\/\d+?\/\d+?.jpg/, "/140/140.jpg"),
        };
    }
    if(body.kind === "richtext") {
        return {
            kind: "default",
            thumb: "self",
        };
    }
    return {
        kind: "default",
        thumb: "default",
    };
}

function generatePostBody(): Generic.Body {
    const pick = faker.random.arrayElement(["text", "image"]);
    if(pick === "text") {
        return generateTextBody();
    }else{
        const w = 650;
        const h = 365;
        return {
            kind: "captioned_image",
            url: generatePostImage(w, h),
            w: w,
            h: h,
        };
    }
}

function pastDate(): number {
    const now = Date.now();
    return now - Math.floor(10 ** faker.datatype.float({min: 4, max: 11}));
}

function genCreationEdited() {
    const creation_date = pastDate();
    const edit_date = pastDate();

    return {
        creation_date: creation_date,
        edited: faker.datatype.boolean() ? {
            date: edit_date > creation_date ? (
                edit_date
            ) : undefined
        } : undefined,
    };
}

function generatePost(id: string): Generic.PostContent {
    // consider some kind of pushSeed() defer popSeed() thing
    // so we don't have to deal with weird global state

    const body = generatePostBody();

    return {
        kind: "post",
        title: {text: faker.lorem.sentence()},
        body,
        author: generateAuthor(),
        show_replies_when_below_pivot: false,
        collapsible: {default_collapsed: true},
        thumbnail: generateThumbnailFor(body),

        info: {
            ...genCreationEdited(),
            pinned: faker.datatype.boolean() && faker.datatype.boolean(),
            in: { // I think we'll want to display this by setting the parent to
                // the subreddit and then making a small view to show what the subreddit
                // is.
                // I'll test that out in ui_testing I guess
                // nvm I tested that and it just looks kinda bad. maybe I'll
                // be able to do it somehow like maybe doing a custom opener for it
                // with a background color or something?
                name: faker.random.word(),
                link: "TODO",
                client_id: "test",
            },
        },
        actions: {
            vote: generatePoints(id, true),
        },
    };
}

function generatePoints(id: string, controversiality: boolean): Generic.CounterAction {
    const count_excl_you = Math.floor(10 ** faker.datatype.float({max: 6})) - 50;

    const arrayv: [
        text: string,
        text2: string,
        color: Generic.Color,
        icon: Generic.Icon,
        decrement?: undefined | [
            text: string, text2: string, color: Generic.Color, icon: Generic.Icon,
        ],
    ][] = [
        ["Favourite", "Undo Favourite", "yellow", "star"],
        ["Like", "Undo Like", "pink", "heart"],
        ["Upvote", "Undo Upvote", "reddit-upvote", "up_arrow", [
            "Downvote", "Undo Downvote", "reddit-downvote", "down_arrow",
        ]]
    ];
    const [label, undo_label, color, icon, decrement] = faker.random.arrayElement(arrayv);

    return {
        kind: "counter",
        client_id: "test",
        unique_id: "vote_"+id,
        time: Date.now(),
        
        increment: {
            icon,
            color,
            label,
            undo_label,
        },
        decrement: decrement ? {
            icon: decrement[3],
            color: decrement[2],
            label: decrement[0],
            undo_label: decrement[1],
        } : null,

        count_excl_you: count_excl_you,
        // technically this should say "≤0" if the count is 0
        // we should fix that
        you: faker.random.arrayElement([undefined, "increment", decrement ? "decrement" : undefined]),
        actions: {
            increment: action_encoder.encode({kind: "void"}),
            decrement: action_encoder.encode({kind: "void"}),
            reset: action_encoder.encode({kind: "void"}),
        },
        percent: controversiality ? faker.datatype.float({max: 1}) : undefined,
    };
}

function generateComment(id: string): Generic.PostContent {
    return {
        kind: "post",
        title: null,
        body: faker.random.arrayElement([
            generateTextBody,
            generateShortTextBody,
            generateTinyTextBody,
        ])(),
        author: generateAuthor(),
        show_replies_when_below_pivot: true,
        collapsible: {default_collapsed: false},

        info: {
            ...genCreationEdited(),
        },
        actions: {
            vote: generatePoints(id, false),
        },
    };
}

function generateTodo(id: string): Generic.PostContent {
    return {
        kind: "post",
        title: {text: "TODO"},
        body: {kind: "none"},
        
        show_replies_when_below_pivot: false,
        collapsible: {default_collapsed: true},
    };
}

function postKind(id: string): "todo" | "post" | "comment" {
    const splitlen = id.split("/").length - 1;
    if(splitlen < 3) return "todo";
    if(splitlen === 3) return "post";
    return "comment";
}

function generateContent(id: string): Generic.PostContent {
    const kind = postKind(id);
    if(kind === "post") {
        return generatePost(id);
    }else if(kind === "comment") {
        return generateComment(id);
    }else if(kind === "todo") {
        return generateTodo(id);
    }else{
        assertNever(kind);
    }
}

function generate(content: Generic.Page2Content, id_link: Generic.Link<Generic.Post>): void {
    const id = id_link.toString();
    const replies = getReplies(id_link);

    faker.seed(setSeed(id, "generate"));
    const content_value = generateContent(id);

    const result: Generic.Post = {
        url: "/faker"+id,
        client_id: "test",
        parent: getParent(id_link),
        replies: {
            items: replies,
        },

        kind: "post",
        content: content_value.kind === "post" ? {
            ...content_value,
            info: {
                ...(content_value.info ?? {}),
                comments: replies.length,
            },
        } : content_value,
        internal_data: id,
        display_style: "centered",
    };
    saveLink(content, newLink<Generic.Post>(id), result);
}

function generatePostImage(w: number, h: number) {
    const seed = faker.random.alphaNumeric(6);
    return "https://picsum.photos/seed/"+seed+"/"+w+"/"+h+".jpg";
}

export async function loadMore2(
    key: Generic.Link<Generic.Post>,
    loader_val: Generic.Loader,
): Promise<Generic.LoaderResult> {
    const loader_enc = loader_val.key;
    await new Promise(r => setTimeout(r, 200));
    if(Math.random() < 0.1) throw new Error("Load failed (random chance)");

    const loader = load_encoder.decode(loader_enc);

    const content: Generic.Page2Content = {};

    if(loader.kind === "horizontal") {
        const licopy = [...loader.items];
        fillReplyArray(content, licopy, 20, 10);
        saveLink(content, key, {
            kind: "loaded",

            parent: loader.parent, // TODO? technically it doesn't really matter does it
            replies: {
                items: licopy,
            },
            
            url: null,
            client_id: "test",
        });
        return {
            content,
        };
    }else if(loader.kind === "other") {
        throw new Error("TODO");
    }else assertNever(loader);
}

export async function act(act_enc: Generic.Opaque<"act">): Promise<void> {
    const action = action_encoder.decode(act_enc);
    () => action;
    await new Promise(r => setTimeout(r, 200));
    if(Math.random() < 0.1) throw new Error("Action failed");
    return;
}

export type LoaderData = {
    kind: "horizontal",
    items: Generic.Link<Generic.Post>[],
    parent: null | Generic.Link<Generic.Post>,
} | {
    kind: "other",
};
export const load_encoder = encoderGenerator<LoaderData, "loader">("loader");

export type ActData = {
    kind: "void",
};
export const action_encoder = encoderGenerator<ActData, "act">("act");

function generateHorizontalLoader(
    content: Generic.Page2Content,
    items: Generic.Link<Generic.Post>[],
    parent: null | Generic.Link<Generic.Post>,
): Generic.Link<Generic.Loader>[] {
    if(items.length === 0) return [];

    const id = Symbol("loader") as Generic.Link<Generic.Loader>;
    saveLink(content, id, {
        parent: parent,
        replies: null,
        url: null,
        client_id: "test",

        kind: "loader",
        key: load_encoder.encode({
            kind: "horizontal",
            items,
            parent,
        }),
        load_count: items.length,
    });
    return [id];
}

function readLink<T>(content: Generic.Page2Content, link: Generic.Link<T>): T {
    const res = content[link];
    if(!res) throw new Error("missing link");
    if('error' in res) throw new Error("link error; "+res.error);
    return res.data as T;
}

function fillReplies(
    content: Generic.Page2Content,
    root_link: Generic.Link<Generic.Post>,
    maximum: number,
    depth: number,
    opts: {pivot: boolean},
): number {
    generate(content, root_link);
    maximum -= 1;

    const root = readLink(content, root_link);

    if(root.replies == null) return maximum;
    if(root.kind === "post" && root.content.kind === "post") {
        if(!opts.pivot && !root.content.show_replies_when_below_pivot) {
            const items = root.replies.items.splice(0, root.replies.items.length);
            const loader = generateHorizontalLoader(content, items, root_link);
            root.replies.items.splice(0, 0, ...loader);

            return maximum;
        }
    }
    if(depth <= 0) {
        const items = root.replies.items.splice(0, root.replies.items.length);
        const loader = generateHorizontalLoader(content, items, root_link);
        root.replies.items.splice(0, 0, ...loader);

        return maximum;
    }
    maximum = fillReplyArray(content, root.replies.items, maximum, depth);
    return maximum;
}

function fillReplyArray(
    content: Generic.Page2Content,
    rpl_arr: Generic.Link<Generic.Post>[],
    maximum: number,
    depth: number,
): number {
    for(const [i, reply] of rpl_arr.entries()) {
        if(maximum <= 0) {
            const root = getParent(reply);
            const items = rpl_arr.splice(i, rpl_arr.length - i);
            const loader = generateHorizontalLoader(content, items, root);
            rpl_arr.splice(i, 0, ...loader);

            return maximum;
        }

        maximum = fillReplies(content, reply, maximum, depth - 1, {pivot: false});
    }
    return maximum;
}

export async function getPage(
    path: string,
): Promise<Generic.Page2> {
    const content: Generic.Page2Content = {};

    const root_link_text = path === "/" ? "/home" : path;

    const root_link = newLink<Generic.Post>(root_link_text);
    fillReplies(content, root_link, 100, 10, {pivot: true}); // we could use a url ?limit= param for this

    const parent = getParent(root_link);
    if(parent) generate(content, parent);

    return {
        content,
        pivot: root_link,
    };
}