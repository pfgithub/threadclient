import * as Generic from "api-types-generic";
import { promises as fs } from "fs";
import { destringify } from "json-recursive";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { switchKind } from "tmeta-util";
import * as example_post from "./example_post.json";
import fetch from "node-fetch";

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

const cachedir = path.join(os.homedir(), ".cache", "threadclient-term");
const imgcachedir = path.join(cachedir, "images");

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

enum TermColor {
    black = 0,
    brblack = 60,
    red = 1,
    brred = 61,
    green = 2,
    brgreen = 62,
    yellow = 3,
    bryellow = 63,
    blue = 4,
    brblue = 64,
    magenta = 5,
    brmagenta = 65,
    cyan = 6,
    brcyan = 66,
    white = 7,
    brwhite = 67,

    normal = 200,
};

type TermStyle = {
    bg?: undefined | TermColor,
    fg?: undefined | TermColor,

    bold?: undefined | boolean,
    italic?: undefined | boolean,
    underline?: undefined | boolean,

    indent?: undefined | TermText[],
};

type TermText = string | {
    style: TermStyle,
    children: TermText[],
};

async function downloadimage(url: string): Promise<{filename: string, bytes: number}> {
    const cachename = btoa(url);
    const filename = imgcachedir + "/" + cachename;

    try {
        const stat = await fs.stat(filename);
        return {filename, bytes: stat.size};
    } catch(e) {
        // do nothing
    }

    const fetchres = await fetch(url).then(r => r.arrayBuffer());
    await fs.writeFile(filename, Buffer.from(fetchres));

    return {filename, bytes: fetchres.byteLength};
}
async function printimage(image: {filename: string, bytes: number}): Promise<string> {
    return "\x1b]1337;File="; // idk
}

async function main() {
    await fs.mkdir(imgcachedir, {recursive: true});

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

        const v = {
            left: parentnode,
            right: firstchild,
            up: prevnode,
            down: nextnode,
        }[key.name];
        if(v) {
            const q = v(focus);
            if(q) focus = q;
            else ers.push("not found in direction");
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
}

function parentnode(vn: VisualNode) {
    return vn.visual_parent;
}
function firstchild(vn: VisualNode) {
    return vn.visual_replies?.[0];
}
function getnodeindex(vn: VisualNode) {
    return vn.visual_parent?.visual_replies?.findIndex(v => v === vn) ?? undefined;
}
function addnode(vn: VisualNode, pm: number) {
    const index = getnodeindex(vn);
    if(index == null) {
        return undefined;
    }else if(index === -1) {
        throw new Error("unreachable; should be found visually");
    }else{
        const findex = index + pm;
        const fitem = vn.visual_parent?.visual_replies?.[findex];
        if(!fitem) {
            return undefined;
        }else{
            return fitem;
        }
    }
}
function nextnode(vn: VisualNode) {
    return addnode(vn, 1);
}
function prevnode(vn: VisualNode) {
    return addnode(vn, -1);
}

function style(style: TermStyle, ...children: TermText[]): TermText {
    return {
        style,
        children,
    };
}

function arrayjoin<T>(a: T[], b: () => T): T[] {
    const c: T[] = [];
    a.forEach((item, i) => {
        if(i !== 0) c.push(b());
        c.push(item);
    });
    return c;
}

function printBody(body: Generic.Body): TermText[] {
    if(body.kind === "richtext") return arrayjoin(body.content.flatMap(printRichtextParagraph), () => "\n\n");
    return [style({fg: TermColor.red}, "*"+body.kind+"*")];
}

function printRichtextParagraph(rtpar: Generic.Richtext.Paragraph): TermText[] {
    return switchKind(rtpar, {
        paragraph: par => par.children.flatMap(printRichtextSpan),
        body: body => printBody(body.body),
        heading: heading => ["#".repeat(heading.level), " ", style({bold: true, underline: true}, ...heading.children.flatMap(printRichtextSpan))],
        horizontal_line: () => ["---"], // iterm2 image that spans term width?
        blockquote: bquot => [style({indent: ["> "]}, ...arrayjoin(bquot.children.flatMap(printRichtextParagraph), () => "\n\n"))],
        list: () => [style({fg: TermColor.red}, "*list*")],
        code_block: () => [style({fg: TermColor.red}, "*code_block*")],
        table: () => [style({fg: TermColor.red}, "*table*")],
    });
}

function printRichtextSpan(span: Generic.Richtext.Span): TermText[] {
    if(span.kind === "text") return [span.text];
    return [style({fg: TermColor.red}, "*span "+span.kind+"*")];
    // <span fg=red>*span*</span>
}

function postld(visual: VisualNode): {indent: string, once: string} {
    // return "\x1b[90m" + (visual.depth > 0 ? "│ ".repeat(visual.depth) : "* ") + "\x1b(B\x1b[m";

    return {
        indent: (visual.depth > 0 ? "  ".repeat(visual.depth) : "* "),
        once: "\x1b[2D" + ((getnodeindex(visual) ?? -2) + 1) + " ",
    };
}

// const postmarker = "\x1b[94m│ \x1b(B\x1b[m";
// const postsplit = "\x1b[94m· \x1b(B\x1b[m";
const postmarker = "│ ";
const postsplit = "  ";

function postformat(ld: {indent: string, once: string}, post: TermText[], styl: "center" | "other"): TermText[] {
    const stylv = styl === "center" ? TermColor.brblack : TermColor.black;
    return [style({indent: [ld.indent], bg: stylv}, style({indent: [postmarker]}, ld.once, ...post))];
}

function printPost(visual: VisualNode) {
    const {post} = visual;

    const ld = postld(visual);

    if(post.kind === "loader") return console.log("enotpost");
    const {content} = post;
    if(content.kind !== "post") return console.log("enotpost");

    const finalv: TermText[] = [];

    const parent = parentnode(visual);
    if(parent) {
        const pld = postld(parent);
        finalv.push(...postformat(pld, ["← left (parent)"], "other"));
        finalv.push(pld.indent + postsplit);
    }

    const above = prevnode(visual);
    if(above) {
        const pld = postld(above);
        finalv.push(...postformat(pld, ["↑ up (prev)"], "other"));
        finalv.push(pld.indent + postsplit);
    }

    const postr: TermText[][] = [];
    // \x1b[<N>D
    if(content.title) {
        postr.push([content.title.text]);
        postr.push([""]);
    }
    if(content.author) {
        postr.push(["by "+content.author.name]);
        postr.push([""]);
    }
    postr.push(printBody(content.body));

    finalv.push(...postformat(ld, arrayjoin(postr, () => ["\n"]).flat(), "center"));

    const child = firstchild(visual);
    if(child) {
        const pld = postld(child);
        finalv.push(ld.indent + postsplit);
        finalv.push(...postformat(pld, ["→ right (child)"], "other"));
    }

    const below = nextnode(visual);
    if(below) {
        const pld = postld(below);
        finalv.push(pld.indent + postsplit);
        finalv.push(...postformat(pld, ["↓ down (next)"], "other"));
    }

    console.log(printTermText(arrayjoin(finalv, () => "\n")));

    // imgcat thumbnail.png --width 8 --height 4
    // protocol: https://iterm2.com/documentation-images.html
}

function pushStyle(base: TermStyle | undefined, add: TermStyle | undefined): TermStyle {
    return {
        bg: add?.bg ?? base?.bg,
        fg: add?.fg ?? base?.fg,

        bold: add?.bold ?? base?.bold,
        italic: add?.italic ?? base?.italic,
        underline: add?.underline ?? base?.underline,

        indent: [style(base ?? {}, ...(add?.indent ?? []))],
    };
}

function printTermStyle(style: TermStyle | undefined): string {
    const colors: number[] = [];

    if(style?.bold ?? false) colors.push(1);
    // [2m dim
    if(style?.italic ?? false) colors.push(3);
    if(style?.underline ?? false) colors.push(4);
    // [7m inverse
    // [8m hidden
    if(style?.fg !== undefined) colors.push(style.fg + 30);
    if(style?.bg !== undefined) colors.push(style.bg + 40);

    return "\x1b(B\x1b[m" + colors.map(col => "\x1b["+col+"m").join("");
    // return (colors.length ? "<"+colors.join(",")+">" : "<clr>");
}

const eoltxt = "\x1b[0K\x1b(B\x1b[m";

function printTermText(ttxt: TermText[], style?: TermStyle): string {
    const res: string[] = [];
    let reqclr = false;
    for(const txti of ttxt) {
        if(typeof txti === "string") {
            if(reqclr) {
                reqclr = false;
                res.push(printTermStyle(style));
            }
            res.push(txti.split("\n").map((l, i): string => {
                if(i === 0) return l;
                return printTermText(style?.indent ?? [], {}) + printTermStyle(style) + l;
            }).join(eoltxt + "\n"));
        }else{
            if(txti.style.indent) {
                res.push(printTermText(txti.style.indent, style));
            }
            const nstyl = pushStyle(style, txti.style);
            res.push(printTermStyle(nstyl));
            reqclr = true;
            res.push(printTermText(txti.children, nstyl));
        }
    }
    if(!style) return res.join("") + eoltxt;
    return res.join("");
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

main();