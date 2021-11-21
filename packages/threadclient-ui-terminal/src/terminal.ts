import {destringify} from "json-recursive";
import * as Generic from "api-types-generic";
import * as example_post from "./example_post.json";
import * as fs from "fs";
import * as readline from "readline";

const parsed = destringify(JSON.stringify(example_post)) as Generic.Page2;

console.log(destringify(JSON.stringify({
    "@root": {a: {'$ref': "@1"}, b: [{'$ref': "@1"}]},
    "@1": "hi! how are you",
})));

type VisualNode = {
    visual_parent: VisualNode | undefined,
    visual_replies: VisualNode[] | undefined,
    post: Generic.Post,
    depth: number,
};

function unlink(link: Generic.Link<Generic.Post>): Generic.Post {
    if(link.err != null) return {
        parent: null,
        replies: null,
        client_id: "n/a",
        url: null,

        kind: "post",

        content: {
            kind: "post",
            body: {
                kind: "richtext",
                content: [{kind: "paragraph", children: [{
                    kind: "error", text: link.err, value: link.err,
                }]}],
            },
            show_replies_when_below_pivot: false,
            title: null,
            collapsible: false,
        },
        internal_data: link,
        display_style: "centered",
    };
    return link.ref;
}

function generateVisualParentsAroundPost(
    post: Generic.Post,
    parent?: undefined | VisualNode,
    replies?: undefined | VisualNode[],
    depth: number = 0,
): VisualNode {
    const res: VisualNode = {
        post,
        visual_parent: undefined,
        visual_replies: undefined,
        depth,
    };
    res.visual_parent = parent ?? (post.parent ?
        generateVisualParentsAroundPost(unlink(post.parent), undefined, [res], depth - 1)
    : undefined);
    res.visual_replies = replies ?? (() => {
        const actual_replies = post.replies;
        if(!actual_replies) return undefined;
        const rplres: VisualNode[] = [];
        for(const item of actual_replies.items) {
            rplres.push(generateVisualParentsAroundPost(unlink(item), res, undefined, depth + 1));
        }
        return rplres;
    })();
    return res;
}

const keys = {};

(async () => {
    if(parsed.pivot.err) {
        console.log("error: "+parsed.pivot.err);
        return;
    }
    let focus: VisualNode = generateVisualParentsAroundPost(parsed.pivot.ref!);
    // note we need to store both the focus and like a path to get here
    // because a reply can have a different parent than the parent node
    // we could make a basic wrapper around Generic.Post that gives like
    // - viewportParent: …
    // - viewportReplies: …

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", (insertext: string | undefined, key: {
        sequence: string,
        name: string,
        ctrl: boolean,
        meta: boolean,
        shift: boolean,
        code: string,
    }) => {
        if(key.name === "c" && key.ctrl) {
            console.log("^C"),
            process.exit(0);
        }

        clrscrn();
        drawconsole();

        const ers: string[] = [];
        console.log(key.name);
        if(key.name === "right") {
            if(!focus.visual_replies) {
                ers.push("post does not have replies");
            }else if(!focus.visual_replies[0]) {
                ers.push("no replies");
            }else{
                focus = focus.visual_replies[0];
            }
        }else if(key.name === "left") {
            if(!focus.visual_parent) {
                ers.push("no visual parent");
            }else{
                focus = focus.visual_parent;
            }
        }else{
            ers.push("unknown command");
        }

        update();
        console.log("");
        for(const er of ers) console.log(er);

        drawconsole();
    });

    const drawconsole = () => {
        process.stdout.write("$> ");
    };

    function clrscrn() {
        // done this way to have a clean history you can scroll up on
        // this is actually really cool I might consider adding it to my fish config
        for(let i = 0; i < process.stdout.rows - 1; i++) {
            console.log();
        }
        process.stdout.write("\x1b["+process.stdout.rows+"A");
    }

    const update = () => {
        printPost(focus);
    };
    clrscrn();
    update();
    drawconsole();
})();

function printPost(visual: VisualNode) {
    const {post} = visual;

    console.log(visual.depth > 0 ? "> ".repeat(visual.depth) : "++");

    if(post.kind === "loader") return console.log("enotpost");
    const {content} = post;
    if(content.kind !== "post") return console.log("enotpost");


    if(content.title) {
        console.log(content.title.text);
    }else{
        console.log("*no title*");
    }

    // imgcat thumbnail.png --width 8 --height 4
    // protocol: https://iterm2.com/documentation-images.html
}

// goal
// down arrow: next reply
// up arrow: previous reply
// right arrow: go to replies and focus first
// left arrow: go to visual parent (note: ¿how to go to semantic parent?)
// - note that for posts at or above the pivot, semantic parent is visual parent
// - maybe let you press f or something to refocus around that idk
// - yeah I think a focus/back would be useful. focus sets the pivot and regenerates
//   the semantic parent list