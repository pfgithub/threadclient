import "./reddit-richtext.scss";
import { hideshow, HideShowCleanup } from "../app";

import Quill from "quill";
import "quill/dist/quill.snow.css";

export function richtextEditor(env: Env): HideShowCleanup<HTMLDivElement> {
    const frame = el("div");
    const hsc = hideshow(frame);
    
    // import txt from "!!raw-loader!quill/dist/quill.snow.css";
    // // putting quill in a shadow causes it to not function properly
    // // pressing ctrl+a test does weird stuff
    // const shadow = frame.attachShadow({mode: "open"});
    // shadow.adch(el("style").atxt(txt));

    const inner_frame = el("div").adto(el("div").adto(frame));

    const quill = new Quill(inner_frame, {
        modules: {
            toolbar: {
                container: [
                    ["bold", "italic", "link", "strike", "code", {script: "super"}, "spoiler"], // , custom: spoiler
                    [{header: [1, 2, 3, 4, 5, 6, false]}],               
                    [{list: "ordered"}, {list: "bullet"}, "blockquote", "code-block"], // TODO table
                ],
                handlers: {
                    spoiler: function(value: string) {
                        console.log("spoiler", value);
                    },
                },
            },
        },
        theme: "snow",
    });
    hsc.on("cleanup", () => quill.disable());

    return hsc;
}

type Env = {usernames: string[]};

type TextStyle = {
    strong?: boolean,
    emphasis?: boolean,
    strikethrough?: boolean,
    superscript?: boolean,
    code?: boolean,
    error?: string,
};
type RichtextSpan = {parent: RichtextParagraph} & ({
    kind: "text",
    text: string,
    format: TextStyle,
    node: HTMLSpanElement,
} | {
    kind: "u/",
    user: string,
    leading_slash: boolean,
    node: HTMLSpanElement,
});
type RichtextParagraph = {parent: State} & ({
    kind: "text",
    spans: RichtextSpan[],
    node: HTMLParagraphElement,
} | {
    kind: "hr",
    node: HTMLHRElement,
});
type State = {
    paragraphs: RichtextParagraph[],
    parent: null,
};

function isBeforeInputEventAvailable(): boolean {
    if(!(window.InputEvent as unknown as undefined | {object: true})) return false;
    return typeof (InputEvent.prototype as unknown as {getTargetRanges: (() => void) | undefined}).getTargetRanges === "function";
}

function mkrange(start: Node, s_offset: number, end: Node, e_offset: number): Range {
    const res = document.createRange();
    res.setStart(start, s_offset);
    res.setEnd(end, e_offset);
    return res;
}

function clearNodeRange(parent: Node, left_child_index: number, right_child_index?: number): void {
    if(parent instanceof Text) {
        const val = parent.nodeValue ?? "";
        const new_rhs = right_child_index != null ? val.substring(right_child_index) : "";
        parent.nodeValue = val.substring(0, left_child_index) + new_rhs;
    }else if(parent instanceof HTMLElement){
        const children = parent.childNodes;
        const final_index = right_child_index ?? children.length;
        
        const to_remove: ChildNode[] = [];
        for(let i = left_child_index; i < final_index; i++) {
            to_remove.push(children[i]!);
        }
        to_remove.forEach(v => v.remove());
    }else {
        console.log("Uh oh! Not sure how to delete this range!");
    }
}
function clearRange(range: StaticRange): Range {
    const [left_container, left_offset, right_container, right_offset] = [range.startContainer, range.startOffset, range.endContainer, range.endOffset] as const;

    // 1: find nearest parent
    let nearest_parent: Node; {
        const seen_nodes = new Set<Node>();

        let lv: Node | null = left_container;
        let rv: Node | null = right_container;

        whlp: while(true) {
            for(const v of [lv, rv]) {
                if(seen_nodes.has(v)) {
                    nearest_parent = v;
                    break whlp;
                }
                seen_nodes.add(v);
            }

            lv = lv.parentNode!;
            rv = rv.parentNode!;
        }
    }

    // 2: assemble left_stack and right_stack *including* parent


    const left_stack: [Node, number][] = [];
    const right_stack: [Node, number][] = [];

    for(const [base, offset, stack] of [[left_container, left_offset, left_stack], [right_container, right_offset, right_stack]] as const) {
        let node = base;
        stack.push([base, offset]);
        while(true) {
            if(node === nearest_parent) break;
            const parent = node.parentElement;
            if(!parent) throw new Error("never");
            const is_left = base === left_container;
            stack.push([parent, findChildIndex(parent, node) + (is_left ? 1 : 0)]); // + 1 for left only
            // why? this is why:
            // … left | …    … | right …
            // | is the cursor that things should delete from/to
            node = parent;
        }
    }

    const [, parent_left] = left_stack.pop()!;
    const [, parent_right] = right_stack.pop()!;
    
    for(const [container, offset] of left_stack) {
        clearNodeRange(container, offset);
    }
    for(const [container, offset] of right_stack) {
        clearNodeRange(container, 0, offset);
    }
        
    clearNodeRange(nearest_parent, parent_left, parent_right);
    
    return mkrange(left_container, left_offset, left_container, left_offset);
}

function mkel<K extends keyof HTMLElementTagNameMap>(tag_name: K, data: ElemData): HTMLElementTagNameMap[K] {
    return el(tag_name).attr({'data-json': JSON.stringify(data)});
}
function getData(el: HTMLElement): ElemData {
    const data = el.getAttribute("data-json");
    if(data == null || data === "") return {level: "unsupported"};
    return JSON.parse(data) as ElemData;
}
// so atm this insertAt is uuh not right
// should insertAt allow you to say insertAt(container, 5, mkel("br", …))?
// and a seperate method for inserting text? idk
function insertAt(start_container: Node, start_offset: number, text: string): Range {
    if(start_container instanceof Text) {
        const val = start_container.nodeValue ?? "";
        start_container.nodeValue = val.slice(0, start_offset) + text + val.slice(start_offset);

        return mkrange(start_container, start_offset + text.length, start_container, start_offset + text.length);
    }else if(start_container instanceof HTMLElement){
        const attrs = getData(start_container);
        // this should be recursive
        if(attrs.level === "root") {
            // insert a new paragraph
            const node = mkel("p", {type: "paragraph", level: "paragraph"});
            start_container.insertBefore(node, start_container.childNodes[start_offset] ?? null);
            return insertAt(node, 0, text);
        }else if(attrs.level === "paragraph" && attrs.type === "paragraph") {
            const node = mkel("span", {level: "span", type: "text"});
            start_container.insertBefore(node, start_container.childNodes[start_offset] ?? null);
            return insertAt(node, 0, text);
        }else if(attrs.level === "span" && attrs.type === "text") {
            const txtn = txt("");
            start_container.insertBefore(txtn, start_container.childNodes[start_offset] ?? null);
            return insertAt(txtn, 0, text);
        }
        console.log("unsupported", start_container, attrs.level);
        return mkrange(start_container, start_offset, start_container, start_offset);
    }
    console.log("unsupported", start_container);
    return mkrange(start_container, start_offset, start_container, start_offset);
}

function createErrorNode(text: string): HTMLElement {
    return el("img").clss("richtext-span-error-element").attr({alt: text}); // works right on chrome but not firefox

    // works-ish on firefox but not chrome
    // bad because it's possible to get your cursor in the text
    // const res = el("span").clss("richtext-span-error-element");
    // const shadow = res.attachShadow({mode: "closed"});
    // shadow.atxt(text);
    // return res;
}

type ElemData = {
    level: "root",
    type: "paragraph-list",
} | {
    level: "paragraph",
    type: "paragraph",
} | {
    level: "span",
    type: "text" | "line-break",
} | {
    level: "unsupported",
};
type DataLevel = ElemData["level"];

function findChildIndex(parent: HTMLElement, search_child: Node): number {
    const node_list = parent.childNodes;
    let res_index: number | undefined;
    // Array.from(node_list).findIndex(node => node === search_child)
    node_list.forEach((node, i) => {
        if(node === search_child) res_index = i;
    });
    if(res_index === undefined) throw new Error("invalid call to findChildIndex");
    return res_index;
}

function splitAt(container: Node, offset: number, level: DataLevel): [Node, ChildNode | null, number] {
    const parent = container.parentElement!;
    if(container instanceof Text) {
        
        // 1: split self
        const val = container.nodeValue ?? "";
        const text_left = val.substring(0, offset);
        const text_right = val.substring(offset);

        const new_lhs = txt(text_left);
        container.nodeValue = text_right;

        parent.insertBefore(new_lhs, container);

        // 2: split parent
        const split_index = findChildIndex(parent, container);
        return splitAt(parent, split_index, level);
    }
    if(!(container instanceof HTMLElement)) {
        console.log("not supported>3:", container);
        throw new Error("not supported node type");
    }
    const attrs = getData(container);
    if(attrs.level === "span") {
        if(attrs.type === "text") {
            // create a new before_span
            const before_span = mkel("span", {level: "span", type: "text"});
            
            // move all the nodes 0..offset → before_span
            const nodes_to_move: Node[] = [];
            for(let i = 0; i < offset; i++) {
                nodes_to_move.push(container.childNodes[i]!);
            }
            nodes_to_move.forEach(node => before_span.adch(node));

            parent.insertBefore(before_span, container);

            if(level === "span") return [parent, container, findChildIndex(parent, container)];
            const split_index = findChildIndex(parent, container);
            return splitAt(parent, split_index, level);
        }else if(attrs.type === "line-break"){
            console.log(attrs, container);
            throw new Error("asked to split a line break? idk what to do?");
        }else assertNever(attrs.type);
    }
    if(attrs.level === "paragraph") {
        if(level === "span") {
            // it's already split lol nothing to do;
            return [container, container.childNodes[offset] ?? null, offset];
        }
    }
    throw new Error("TODO: "+attrs.level);
}
function assertNever(v: never): never {
    console.log("expected never, got", v);
    throw new Error("expected never");
}

// shift-enter: insert line break, enter: insert paragraph
// instead of this, what about one enter = line break, enter on line break = paragraph
// the reddit editor does enter/shift+enter but idk
const input_type_map: {[key: string]: FakeInputType} = {
    insertText: "insert",
    insertFromPaste: "insert_data_transfer",
    insertFromDrop: "insert_data_transfer",
    insertLineBreak: "insert_line_break",
    insertParagraph: "insert_line_break",
    deleteContentForward: "delete",
    deleteContentBackward: "delete",
    deleteWordForward: "delete",
    deleteWordBackward: "delete",
    deleteByCut: "delete",
};

type FakeInputType = 
    | "insert"
    | "insert_line_break"
    | "insert_data_transfer"
    | "delete"
;

// TODO figure out how to use composition events. composition events seem to make changes to the dom without asking first.

// TODO: figure out how to use undo/redo

// I think the resolution to these will have to be changing the architecture quite a bit or something
// no idea actually
// like I can do undo myself easily by copying nodes every input or whatever
// but that isn't right and won't behave properly
// uuh
// this architecture is flawed isn't it

export function richtextEditorCustom(env: Env): HideShowCleanup<HTMLDivElement> {
    const outer_frame = el("div");
    const hsc = hideshow(outer_frame);

    const frame = outer_frame;
    // // shadow dom version. this is unnecessary and probably bad and would require some hacky stuff
    // // to reload css on save
    // const frame = outer_frame.attachShadow({mode: "open"});
    // frame.adch(el("style").atxt(…));

    if(!isBeforeInputEventAvailable()) {
        // https://bugzilla.mozilla.org/show_bug.cgi?id=970802
        frame.atxt(""
            + "Not supported. Try another browser like Chrome ≥60, Edge ≥79, or Safari ≥10.1, "
            + "or on Firefox ≥75 go to about:config and enable dom.input_events.beforeinput.enabled"
        );
        return hsc;
    }

    const contenteditable = mkel("div", {type: "paragraph-list", level: "root"}).attr({contenteditable: "true"}).adto(frame).clss("richtext-editor-content").clss("richtext-placeholder");

    contenteditable.onev("beforeinput", (event_raw) => {
        const e = event_raw as InputEvent;
        e.preventDefault();
        e.stopPropagation();
        const ranges = (e as unknown as {getTargetRanges: () => StaticRange[]}).getTargetRanges();
        const input_type = input_type_map[e.inputType] ?? "unsupported";
        console.log("Beforeinput", input_type, e, ranges);

        contenteditable.classList.remove("richtext-placeholder");

        const sel = window.getSelection()!;
        sel.removeAllRanges();
        for(const range of ranges) {
            if(input_type === "insert") {
                clearRange(range);
                sel.addRange(insertAt(range.startContainer, range.startOffset, e.data!));
            }else if(input_type === "delete") {
                sel.addRange(clearRange(range));
            }else if(input_type === "insert_data_transfer") {
                clearRange(range);

                let text = "«Paste content not found»";
                const transfer = (e as unknown as {dataTransfer: DataTransfer | undefined}).dataTransfer;
                if(transfer) {
                    const data = transfer.getData("text"); // todo other things eg images or html or whatever
                    text = data || "«No such data»";
                }

                sel.addRange(insertAt(range.startContainer, range.startOffset, text));
            }else if(input_type === "insert_line_break") {
                clearRange(range);
                // TODO check if left of range is a br. if so, delete it and splitParagraphAt
                const [parent_node, rhs_node, rhs_idx] = splitAt(range.startContainer, range.startOffset, "span");
                parent_node.insertBefore(mkel("br", {type: "line-break", level: "span"}), rhs_node);
                sel.addRange(mkrange(parent_node, rhs_idx + 1, parent_node, rhs_idx + 1));
            }else{
                expectUnsupported(input_type);
                clearRange(range);
                const [parent_node, rhs_node, rhs_idx] = splitAt(range.startContainer, range.startOffset, "span");
                parent_node.insertBefore(createErrorNode(e.inputType), rhs_node);
                sel.addRange(mkrange(parent_node, rhs_idx + 1, parent_node, rhs_idx + 1));
            }
        }
    });

    return hsc;
}

const expectUnsupported = (v: "unsupported"): void => {/**/};