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
        link: "/user/"+username,
        client_id: "test",
        pfp: {url: pfp, hover: pfp},
    };
}

function generate(content: Generic.Page2Content, id: string): void {
    faker.seedValue = parseID(id)[0]!;

    saveLink(content, newLink<Generic.Post>(id), {
        url: id,
        client_id: "test",
        parent: null, // TODO "/"+parseID(id)[1..].reverse().join("/")
        replies: null, // TODO

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
            collapsible: {default_collapsed: false},
            thumbnail: {
                kind: "image",
                url: faker.image.image(140, 140),
            },
        },
        internal_data: id,
        display_style: "centered",
    });
}

export async function getPage(
    path: string,
): Promise<Generic.Page2> {
    const content: Generic.Page2Content = {};

    generate(content, "/0");

    return {
        content,
        pivot: newLink("/0"),
    };
}