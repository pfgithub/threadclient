import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { ThreadClient } from "threadclient-client-base";

export const client: ThreadClient = {
    id: "shell",

    async getPage(path: string): Promise<Generic.Page2> {
        // we can just return all the content i guess
        // might be nice if we structured it so it can be dynamically imported in the future but this
        // is okay for now
        return content as unknown as Generic.Page2;
    }
};

const content = {
    "/homepage/unthreading": {
        content: [rt.p(
            rt.txt("It often gets difficult to read long comment chains because the indentation gets too deep"),
        )],
        parent: null,
        replies: ["/homepage/unthreading/0"],
    },
    "/homepage/unthreading/0": {
        content: [rt.p(
            rt.txt("ThreadClient fixes this by unthreading comment chains, like this!"),
        )],
        parent: "/homepage/unthreading",
        replies: ["/homepage/unthreading/0/0"],
    },
    "/homepage/unthreading/0/0": {
        content: rt.p(
            rt.txt("Use the toggle switch above to see the difference"),
        ),
        parent: "/homepage/unthreading/0",
        replies: [],
    },

    "/homepage/link-previews": {
        content: [rt.p(
            rt.txt("ThreadClient supports previewing links from many different sources, directly inline."),
        ), rt.p(
            rt.link({id: client.id}, "TODO a link", {}, rt.txt("Try it out!")),
        )],

        parent: null,
        replies: [],
    },

    "/homepage/swipe-actions": {
        content: [rt.p(
            rt.txt("something or other"),
        )],
    },
};
