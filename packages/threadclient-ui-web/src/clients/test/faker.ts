import faker from "@faker-js/faker";
import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
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
        content: new Array(3).fill(0).map(() => rt.p(rt.txt(faker.lorem.paragraph()))),
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

function generatePost(): Generic.PostContent {
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
    };
}

function generateComment(): Generic.PostContent {
    return {
        kind: "post",
        title: null,
        body: generateTextBody(),
        author: generateAuthor(),
        show_replies_when_below_pivot: true,
        collapsible: {default_collapsed: false},
    };
}

function postKind(id: string): "post" | "comment" {
    if(id.split("/").length > 3) return "comment";
    return "post";
}

function generateContent(id: string): Generic.PostContent {
    const kind = postKind(id);
    if(kind === "post") {
        return generatePost();
    }else if(kind === "comment") {
        return generateComment();
    }else{
        assertNever(kind);
    }
}

function generate(content: Generic.Page2Content, id_link: Generic.Link<Generic.Post>): void {
    const id = id_link.toString();
    const replies = getReplies(id_link);
    faker.seed(setSeed(id, "generate"));

    saveLink(content, newLink<Generic.Post>(id), {
        url: "/faker"+id,
        client_id: "test",
        parent: getParent(id_link),
        replies: {
            items: replies,
        },

        kind: "post",
        content: generateContent(id),
        internal_data: id,
        display_style: "centered",
    });
}

function generatePostImage(w: number, h: number) {
    const seed = faker.random.alphaNumeric(6);
    return "https://picsum.photos/seed/"+seed+"/"+w+"/"+h+".jpg";
}

export async function getPage(
    path: string,
): Promise<Generic.Page2> {
    const content: Generic.Page2Content = {};

    const root_link_text = path === "/" ? "/home" : path;

    const root_link = newLink<Generic.Post>(root_link_text);
    generate(content, root_link);

    const parent = getParent(root_link);
    if(parent) generate(content, parent);

    for(const reply of getReplies(root_link)) {
        generate(content, reply);
    }

    return {
        content,
        pivot: root_link,
    };
}