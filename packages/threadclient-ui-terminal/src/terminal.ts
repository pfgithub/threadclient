import * as Generic from "api-types-generic";
import { promises as fs } from "fs";
import { parse } from "@effectful/serialization";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import * as cp from "child_process";
import { assertNever, switchKind } from "tmeta-util";
import fetch from "node-fetch";

type VisualNode = {
    visual_parent: VisualNode | undefined,
    visual_replies: VisualNode[] | undefined,
    visual_reply_index: number,
    post: Generic.Post,
    depth: number,

    content: Generic.Page2Content, // hack because I'm not thinking right now
};

const cachedir = path.join(os.homedir(), ".cache", "threadclient-term");
const imgcachedir = path.join(cachedir, "images");

function unlink(content: Generic.Page2Content, link: Generic.Link<Generic.Post>): Generic.Post {
    const value = Generic.readLink(content, link);
    if(value == null || value.error != null) return {
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
                    kind: "error", text: value?.error ?? "error isn ull", value: value?.error ?? link,
                }]}],
            },
            title: null,
            collapsible: false,
        },
        internal_data: link,
    };
    return value.value;
}

// TODO: at top level, return VisualNode[]
// at or above the parent should be navigable with the up/down arrow keys rather than left/right
function generateVisualParentsAroundPost(
    content: Generic.Page2Content,
    post: Generic.Post,
    parent?: undefined | VisualNode,
    replies?: undefined | VisualNode[],
    depth = 0,
): VisualNode {
    const res: VisualNode = {
        post,
        visual_parent: undefined,
        visual_replies: undefined,
        visual_reply_index: 0,
        depth,
        content,
    };
    res.visual_parent = parent ?? (post.parent ?
        generateVisualParentsAroundPost(content, unlink(content, post.parent.loader.key), undefined, [res], depth - 1)
    : undefined);
    res.visual_replies = replies ?? (() => {
        const actual_replies = post.replies;
        if(!actual_replies) return undefined;
        const rplres: VisualNode[] = [];
        const ar_items = Generic.readLink(content, actual_replies.loader.key);
        for(const item of ar_items == null ? [] : ar_items.error != null ? [] : ar_items.value) {
            if(typeof item === "object") continue;
            rplres.push(generateVisualParentsAroundPost(content, unlink(content, item), res, undefined, depth + 1));
        }
        return rplres;
    })();
    return res;
}

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
}

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
} | TermText[];

export async function downloadimage(url: string, signal: AbortSignal): Promise<{filename: string, bytes: number}> {
    const cachename = Buffer.from(url).toString("base64").replaceAll("/", "_").replaceAll("+", "-"); // todo should probably hash rather than b64 encode
    const filename = imgcachedir + "/" + cachename + ".png";

    try {
        const stat = await fs.stat(filename);
        return {filename, bytes: stat.size};
    } catch(e) {
        // do nothing
    }

    const fetchres = await fetch(url, {signal}).then(r => r.arrayBuffer());
    await fs.mkdir(imgcachedir, {recursive: true});
    await fs.writeFile(filename, Buffer.from(fetchres));

    return {filename, bytes: fetchres.byteLength};
}
export async function printimage(image: {filename: string, bytes: number}): Promise<string> {
    return "\x1b]1337;File="; // idk
}

type KeyEvent = [insertext: string | undefined, key: {
    sequence: string,
    name: string,
    ctrl: boolean,
    meta: boolean,
    shift: boolean,
    code: string,
}];

type Task = {
    onKey: ((...ev: KeyEvent) => void),
    abort: () => void,
};

const tasks: Task[] = [];

// process.on("uncaughtException", (e) => {
//     console.log("uncau", e, "uacnu");
// });

async function runCommand([command, ...args]: string[], signal: AbortSignal): Promise<void> {
    const viewer = cp.spawn(command!, args, {signal, stdio: "inherit"});
    let is_abort_error = false;
    viewer.on("error", (e) => {
        if(e.name === "AbortError") { // recommended way, https://github.com/nodejs/node/issues/36084
            is_abort_error = true;
            return;
        }
        console.log("process errored", e.name);
    });
    const ecode = await new Promise<number | null>(r => viewer.on("exit", (code) => r(code)));
    if(ecode !== 0) throw new Error("command exited with code " + ecode);
    if(is_abort_error) throw new Error("is abort error");
}

async function displayBody(body: Generic.Body, signal: AbortSignal): Promise<void> {
    // for richtext we should go fullscreen and let you go paragraph by paragraph so you can eg view images
    if(body.kind === "captioned_image") {
        if(body.caption != null) console.log("caption: "+body.caption);
        if(body.alt != null) console.log("alt: "+body.alt);
        process.stdout.write("downloading image…");
        const imgv = await downloadimage(body.url, signal);
        process.stdout.write("\r"+eoltxt);

        // image viewers:
        // - in-terminal:
        //   - kitty image transfer api
        //   - iterm2 image transfer api
        // - seperate window:
        //   - feh $image
        //   - qlmanage -p $image # note: must end in an image file extension
        // - through system default apps:
        //   - xdg-open $image
        //   - open $image # note: must end in an image file extension

        await runCommand(["feh", imgv.filename], signal);
    }else if(body.kind === "link") {
        if(body.url.startsWith("https://v.redd.it/")) {
            await runCommand(["mpv", body.url + "/DASHPlaylist.mpd"], signal);
            // note when switching to if(body.kind === "video"), allow you to select a source before opening mpv
        }else{
            console.log("TODO call app.tsx previewLink() → Body and preview that value");
        }
    }else{
        console.log("TODO! "+body.kind);
    }
}

export async function main(opts: {
    focus: () => VisualNode | undefined,
    setFocus: (nf: VisualNode) => void,
    reload: () => Promise<void>,
}): Promise<(() => void)[]> {
    console.log("main()");
    const cleanup: (() => void)[] = [];

    // note we need to store both the focus and like a path to get here
    // because a reply can have a different parent than the parent node
    // we could make a basic wrapper around Generic.Post that gives like
    // - viewportParent: …
    // - viewportReplies: …

    const maintask: Task = {onKey: (itxt: KeyEvent[0], key: KeyEvent[1]) => {
        const scupdate = () => {
            clrscrn();
            drawconsole();
            console.log(key.name);

            update();
            drawconsole();
        };
        const scerror = (msg: string) => {
            console.log(key.name);
            console.log(printTermText([styl({fg: TermColor.red}, msg)]));
            drawconsole();
        };

        if(key.name === "v") {
            // open the body in a viewer program
            const focus = opts.focus()!;
            if(focus.post.kind === "post" && focus.post.content.kind === "post") {
                console.log("view content");

                const abort = new AbortController();

                const mtask: Task = {
                    onKey: (a, b) => {
                        console.log(a, b);
                    },
                    abort: () => {
                        console.log("^C");
                        abort.abort();
                    },
                };
                tasks.push(mtask);
                displayBody(focus.post.content.body, abort.signal).then(() => {
                    const index = tasks.indexOf(mtask);
                    if(index >= 0) tasks.splice(index, 1);

                    drawconsole();
                }).catch(e => {
                    const index = tasks.indexOf(mtask);
                    if(index >= 0) tasks.splice(index, 1);

                    if(e instanceof Error && e.name === "AbortError") { // recommended way, https://github.com/nodejs/node/issues/36084
                        // do nothing
                    }else console.log("errored", (e as Error).toString(), (e as Error).stack);
                    drawconsole();
                });
                return;
            }
            return scerror("post has no body");
        }else if(key.name === "f") {
            const focus = opts.focus()!;
            opts.setFocus(generateVisualParentsAroundPost(focus.content, focus.post));
            // todo navigation history and fwd/back
            return scupdate();
        }else if(key.name === "c") {
            console.log("code");
            return;
        }else if(key.name === "s") {
            scupdate();
            return;
        }else if(key.name === "r") {
            console.log("reload");
            const mtask: Task = {
                onKey: () => {/**/},
                abort: () => {/**/},
            };
            opts.reload().then(r => {
                // reloaded.
            }).catch(e => {
                const index = tasks.indexOf(mtask);
                if(index >= 0) tasks.splice(index, 1);
                console.log("error while reloading", e);
            });
            tasks.push(mtask);
            return;
        }

        const v = {
            left: parentnode,
            right: savedchild,
            up: prevnode,
            down: nextnode,
            n: nextvisual,
        }[key.name];
        if(v) {
            const focus = opts.focus()!;
            const q = v(focus);
            if(q) {
                opts.setFocus(q);
                updatesaved(q);
                return scupdate();
            }
            return scerror("not found in direction");
        }else{
            return scerror("unknown command; h for help");
        }
    },
        abort: () => {
            //
        },
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    readline.emitKeypressEvents(process.stdin);
    const onkeypress = (itxt: KeyEvent[0], key: KeyEvent[1]) => {
        if(key.name === "c" && key.ctrl || key.name === "d" && key.ctrl) {
            console.log("^"+key.name.toUpperCase());
            if(tasks.length === 0) process.exit(0);
            tasks.pop()!.abort();
            if(tasks.length === 0) process.exit(0);
            return;
        }
        const task0 = tasks[tasks.length - 1];
        if(task0) {
            return task0.onKey(itxt, key);
        }else{
            console.error("there is no task defined atm; error");
        }
    };
    process.stdin.on("keypress", onkeypress);
    cleanup.push(() => process.stdin.off("keypress", onkeypress));
    cleanup.push(() => {
        [...tasks].reverse().forEach(v => v.abort());
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
        printPost(opts.focus()!);
    };

    const startmain = () => {
        clrscrn();
        drawconsole();
        console.log("s");
        update();
        drawconsole();
        tasks.push(maintask);
    };


    if(opts.focus() == null) {
        let contents: string[];
        try {
            contents = await fs.readdir(__dirname + "/example_content");
        }catch(e) {
            console.log("you don't have any samples! go to /temp0/…a reddit url in threadclient and paste them into "
                +"a file in __dirname/example_content/",
            );
            process.exit(0);
        }
        if(contents.length === 0) {
            console.log("you don't have any samples! go to /temp0/…a reddit url in threadclient and paste them into "
                +"a file in __dirname/example_content/",
            );
            process.exit(0);
        }
        let findex = 0;

        const upd8 = (v: string) => {
            clrscrn();
            console.log("$>",v);

            console.log(findex, contents[findex]);

            console.log("↑, ↓, ⏎");
            process.stdout.write("$> ");
        };
        const resolve = async (resstr: string) => {
            const parsed = parse(
                await fs.readFile(__dirname + "/example_content/"+resstr, "utf-8"),
            ) as Generic.Page2;

            opts.setFocus(generateVisualParentsAroundPost(parsed.content, unlink(parsed.content, parsed.pivot)));
            startmain();
        };
        const mtask: Task = {
            onKey: (__, key) => {
                if(key.name === "down") {
                    findex += 1;
                }else if(key.name === "up") {
                    findex -= 1;
                }else if(key.name === "s") {
                    //
                }else if(key.name === "return") {
                    if(contents[findex] == null) {
                        console.log(key.name);
                        console.log("not found");
                        process.stdout.write("$> ");
                        return;
                    }

                    resolve(contents[findex]!).then(r => {
                        // done;
                    }).catch(e => {
                        console.log("error", e);
                        // error;
                    });
                    return;
                }else{
                    console.log(key.name);
                    console.log("unknown command; h for help");
                    process.stdout.write("$> ");
                    return;
                }
                upd8(key.name);
            },
            abort: () => {/**/},
        };
        tasks.push(mtask);
        upd8("s");
    }else{
        startmain();
    }

    return cleanup;
}

function parentnode(vn: VisualNode) {
    return vn.visual_parent;
}
function savedchild(vn: VisualNode) {
    return vn.visual_replies?.[vn.visual_reply_index];
}
function getnodeindex(vn: VisualNode) {
    return vn.visual_parent?.visual_replies?.findIndex(v => v === vn) ?? undefined;
}
function updatesaved(vn: VisualNode) {
    const nindex = getnodeindex(vn);
    if(nindex != null && vn.visual_parent) vn.visual_parent.visual_reply_index = nindex;
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
function nextvisual(vn: VisualNode) {
    let res: VisualNode = vn;

    while(!nextnode(res)) {
        // if we ever want to accept untrusted page2 data we have to do a validation step to make sure
        // it's not a cyclic graph
        const pn = parentnode(res);
        if(!pn) return undefined;
        res = pn;
    }

    return nextnode(res);
}
function nextnode(vn: VisualNode) {
    return addnode(vn, 1);
}
function prevnode(vn: VisualNode) {
    return addnode(vn, -1);
}

function styl(style: TermStyle, ...children: TermText[]): TermText {
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
    if(body.kind === "richtext") return arrayjoin(body.content.map(printRichtextParagraph), () => ["\n\n"]);
    if(body.kind === "captioned_image") {
        return [styl(
            {bg: TermColor.black},
            "["+(body.alt ?? "image")+"]",
            body.caption != null ? "\nCaption: "+body.caption : "",
        )];
    }
    if(body.kind === "array") {
        return arrayjoin(body.body.map(b => b ? printBody(b) : "*undefined*"), () => ["\n\n"]);
    }
    if(body.kind === "link") {
        return [styl({fg: TermColor.blue, underline: true}, body.url)];
    }
    return [styl({fg: TermColor.red}, "*body "+body.kind+"*")];
}

function printRichtextParagraph(rtpar: Generic.Richtext.Paragraph): TermText[] {
    return switchKind(rtpar, {
        paragraph: par => par.children.flatMap(printRichtextSpan),
        body: body => printBody(body.body),
        heading: heading => [
            "#".repeat(heading.level), " ",
            styl({bold: true, underline: true}, ...heading.children.map(printRichtextSpan)),
        ],
        horizontal_line: () => ["---"], // iterm2 image that spans term width?
        blockquote: bquot => [styl({indent: ["> "]},
            ...arrayjoin(bquot.children.map(printRichtextParagraph), () => ["\n\n"]),
        )],
        list: list => arrayjoin(list.children.map((li): TermText => {
            if(li.kind === "list_item") {
                return arrayjoin(li.children.map(printRichtextParagraph), () => ["\n\n"]);
            }else if(li.kind === "tight_list_item") {
                return li.children.map(printRichtextSpan);
            }else assertNever(li);
        }).map((itm, i) => list.ordered ? ["" + (i + 1) + ". ", itm] : ["- ", itm]), () => ["\n"]),
        code_block: () => [styl({fg: TermColor.red}, "*code_block*")],
        table: () => [styl({fg: TermColor.red}, "*table*")],
    });
}

function printRichtextSpan(span: Generic.Richtext.Span): TermText[] {
    if(span.kind === "text") return [styl({
        bold: span.styles.strong,
        italic: span.styles.emphasis,
        bg: span.styles.strikethrough ?? false ? TermColor.red : undefined, // check for term capability for \x1b[9m
    }, span.text)];
    if(span.kind === "link") return [
        styl({fg: TermColor.blue, underline: true}, ...span.children.map(printRichtextSpan)),
        ": ", // should do link helpers like page2 does instead of this
        styl({fg: TermColor.blue, underline: true}, span.url),
    ];
    if(span.kind === "error") return [
        styl({fg: TermColor.red}, span.text),
    ];
    return [styl({fg: TermColor.red}, "*span "+span.kind+"*")];
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

function postformat(ld: {indent: string, once: string}, post: TermText[], style: "center" | "other"): TermText[] {
    const stylv = style === "center" ? TermColor.brwhite : undefined;
    return [styl({indent: [ld.indent], fg: stylv}, styl({indent: [postmarker]}, ld.once, ...post))];
}

type InfoBarItem = {
    value: ["percent" | "number" | "timeago" | "hidden" | "none", number],
    icon: Generic.Icon,
    color: null | Generic.Color,
    text: string,
    disabled?: undefined | boolean,
};

function generateInfoBar(post: Generic.PostContentPost): InfoBarItem[] {
    // this can probably be unified between web and terminal, but TODO because web has the special counter
    // stuff and uses solid js tracking

    // otherwise this is basically the same code though
    // yeah we should definitely unify

    const res: InfoBarItem[] = [];

    if(post.info?.pinned === true) {
        res.push({
            icon: "pinned",
            value: ["none", -1000],
            color: "green",
            text: "Pinned",
        });
    }
    if(post.actions?.vote) {
        const voteact = post.actions.vote;
        const pt_count = voteact.count_excl_you;
        res.push({
            value: pt_count === "hidden"
            ? ["hidden", -1000] : pt_count === "none" ? ["none", -1000]
            : ["number", pt_count + ({
                increment: 1,
                decrement: -1,
                none: 0,
            } as const)[voteact.you ?? "none"]],
            icon: ({
                none: voteact.neutral_icon ?? voteact.increment.icon,
                increment: voteact.increment.icon,
                decrement: voteact.decrement?.icon ?? voteact.increment.icon,
            } as const)[voteact.you ?? "none"],
            color: ({
                none: null,
                increment: voteact.increment.color,
                decrement: voteact.decrement?.color ?? voteact.increment.color,
            } as const)[voteact.you ?? "none"],
            text: "Points",
            disabled: false,
        });
        if(post.actions.vote.percent != null) {
            res.push({
                icon: "controversiality",
                value: ["percent", post.actions.vote.percent],
                color: null,
                text: "Controversiality",
            });
        }
    }
    if(post.info?.comments != null) {
        res.push({
            icon: "comments",
            value: ["number", post.info.comments],
            color: null,
            text: "Comments",
        });
    }
    if(post.info?.creation_date != null) {
        res.push({
            icon: "creation_time",
            value: ["timeago", post.info.creation_date],
            color: null,
            text: "Posted",
        });
    }
    if(post.info?.edited) {
        res.push({
            icon: "edit_time",
            value: post.info.edited.date == null ? ["none", -1000] :
            ["timeago", post.info.edited.date],
            color: null,
            text: "Edited",
        });
    }

    return res;
}
const generic_icon_to_unicode_icon: {[key in Generic.Icon]?: undefined | string} = {
    // if we require a powerline font / nerd font, we can use fontawesome icons

    //pinned: "[pinned]",
    up_arrow: "↑",
    down_arrow: "↓",
    controversiality: "☺",
    //comments: "[comments]",
    //creation_time: "[created]",
    //edit_time: "[edited]",
};
function renderInfoBarItem(item: InfoBarItem): TermText {
    const icon = generic_icon_to_unicode_icon[item.icon] ?? item.icon.toUpperCase();
    return icon + " " + item.value[1];
}

// TODO:
// it needs to be more clear what TermText[] is
// because TermText = TermText[] | string
// so uuh
// maybe we can make TermText not contain TermText[] and then use a helper fn
// I can't do this right now because I don't have a typescript language server
function renderPost(post: Generic.Post): TermText[] {
    const {content} = post;
    if(content.kind !== "post") return [["enotpost"]];

    const postr: TermText[] = []; // lines

    if(content.title) {
        postr.push([content.title.text]);
        postr.push([]);
    }
    {
        postr.push(arrayjoin([
            (content.author ? ["by "+content.author.name] : []), // TODO color
            ...generateInfoBar(content).map(itm => renderInfoBarItem(itm)),
        ], () => ["   "]));
        postr.push([]);
    }
    postr.push(printBody(content.body));
    // postr.push([]);
    // postr.push([
    //     styl({bg: TermColor.black, fg: TermColor.white}, "[buttons]"),
    //     " ",
    //     styl({bg: TermColor.black, fg: TermColor.white}, "[go]"),
    //     " ",
    //     styl({bg: TermColor.black, fg: TermColor.white}, "[here]"),
    // ]);

    return arrayjoin(postr, () => ["\n"]);
}

function printPost(visual: VisualNode) {
    const ld = postld(visual);

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

    // \x1b[<N>D
    finalv.push(...postformat(ld, renderPost(visual.post), "center"));

    const child = savedchild(visual);
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

    const belowvisual = nextvisual(visual);
    if(belowvisual && below !== belowvisual) {
        const pld = postld(belowvisual);
        finalv.push(pld.indent + postsplit);
        finalv.push(...postformat(pld, ["n next (next)"], "other"));
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

        indent: [styl(base ?? {}, ...(add?.indent ?? []))],
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
    // TODO termcolor.normal

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
        }else if(Array.isArray(txti)) {
            res.push(printTermText(txti, style));
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
