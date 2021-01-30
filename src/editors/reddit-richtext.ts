import "./reddit-richtext.scss";
import { hideshow, HideShowCleanup } from "../app";

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

function clearRange(range: StaticRange): Range {
    if(range.startContainer === range.endContainer && range.startOffset === range.endOffset) {
        return mkrange(range.startContainer, range.startOffset, range.endContainer, range.endOffset);
    }
    if(range.startContainer === range.endContainer) {
        if(range.startContainer instanceof Text) {
            const val = range.startContainer.nodeValue ?? "";
            range.startContainer.nodeValue = val.slice(0, range.startOffset) + val.slice(range.endOffset);

            return mkrange(range.startContainer, range.startOffset, range.startContainer, range.startOffset);
        }
    }
    // :: find nearest parent
    // :: loop do stuff
    console.log("Cannot clear range");
    return mkrange(range.startContainer, range.startOffset, range.endContainer, range.endOffset);
}
function insertAt(start_container: Node, start_offset: number, text: string): Range {
    if(start_container instanceof Text) {
        const val = start_container.nodeValue ?? "";
        start_container.nodeValue = val.slice(0, start_offset) + text + val.slice(start_offset);

        return mkrange(start_container, start_offset + text.length, start_container, start_offset + text.length);
    }else if(start_container instanceof HTMLElement){
        const data_type = start_container.getAttribute("data-type");
        if(data_type === "paragraph_list") {
            // insert a new paragraph
            const [fmt_node, text_node] = createTextNode({});
            el("p").adto(start_container).adch(fmt_node).attr({'data-type': "paragraph"});
            text_node.nodeValue = text;

            return mkrange(text_node, text.length, text_node, text.length);
        }
        console.log("unsupported", start_container, data_type);
        return mkrange(start_container, start_offset, start_container, start_offset);
    }
    console.log("unsupported", start_container);
    return mkrange(start_container, start_offset, start_container, start_offset);
}

function createTextNode(format: TextStyle): [HTMLElement, Text] {
    const tn = txt("");
    return [el("span").attr({'data-type': "text"}).adch(tn), tn];
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

function splitAt(container: Node, offset: number): [ChildNode, Range] {
    if(container instanceof Text) {
        const val = container.nodeValue ?? "";
        const text_v_left = val.substr(0, offset);
        const text_v_right = val.substr(offset);

        const parent_item = container.parentElement!;
        const data_type = parent_item.getAttribute("data-type");
        if(data_type === "text") {
            if(parent_item.childNodes.length !== 1) throw new Error("incorrect child node count");
            const [new_lhs, lhs_tn] = createTextNode({});
            lhs_tn.nodeValue = text_v_left;
            container.nodeValue = text_v_right;
            parent_item.parentElement!.insertBefore(new_lhs, parent_item);

            return [parent_item, mkrange(container, 0, container, 0)];
        }
        throw new Error("uuh?");
    }
    throw new Error("unsupported");
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

// - ok so::
// - on enter: clear the range
// - split the current node at the range left
// » if left node is br
//   - delete br
//   - split the current node at the current position
//   - insert a paragraph below the current paragraph
//   - take all the rhs and put them in the new paragraph
//   - set selection beginning of new paragraph
// » else
//   - insert br
//   - set selection beginning of next line

export function richtextEditor(env: Env): HideShowCleanup<HTMLDivElement> {
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

    const contenteditable = el("div").attr({contenteditable: "true"}).adto(frame).clss("richtext-editor-content").clss("richtext-placeholder");

    contenteditable.attr({'data-type': "paragraph_list"});

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
                const [rhs_node, end_range] = splitAt(range.startContainer, range.startOffset);
                rhs_node.parentNode!.insertBefore(el("br").attr({'data-type': "line-break"}), rhs_node);
                sel.addRange(end_range);
            }else{
                expectUnsupported(input_type);
                clearRange(range);
                const [rhs_node, end_range] = splitAt(range.startContainer, range.startOffset);
                rhs_node.parentNode!.insertBefore(createErrorNode(e.inputType), rhs_node);
                sel.addRange(end_range);
            }
        }
    });

    return hsc;
}

const expectUnsupported = (v: "unsupported"): void => {/**/};