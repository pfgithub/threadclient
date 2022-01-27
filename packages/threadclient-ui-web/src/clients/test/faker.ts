import faker from "@faker-js/faker";

import type * as Generic from "api-types-generic";
import { Richtext, rt } from "api-types-generic";
import * as commonmark from "commonmark";
import { encoderGenerator, ThreadClient } from "threadclient-client-base";
import { assertNever } from "tmeta-util";
import { LogEntry, variables } from "virtual:_variables";

() => faker;

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

function parseID(id: string): string[] {
    return id.split("/").filter(w => w).reverse();
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

    const count = faker.datatype.number(50);
    return new Array(count).fill(0).map(() => {
        return newLink<Generic.Post>(id + "/" + faker.random.alphaNumeric(6));
    });
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
        content: {
            kind: "post",
            title: {text: faker.lorem.sentence()},
            body: {
                kind: "richtext",
                content: new Array(3).fill(0).map(() => rt.p(rt.txt(faker.lorem.paragraph()))),
            },
            author: generateAuthor(),
            show_replies_when_below_pivot: false,
            collapsible: {default_collapsed: true},
            thumbnail: {
                kind: "image",
                url: generateThumbnailImage(),
            },
        },
        internal_data: id,
        display_style: "centered",
    });
}

function generateThumbnailImage() {
    const seed = faker.random.alphaNumeric(6);
    return "https://picsum.photos/seed/"+seed+"/140/140";
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