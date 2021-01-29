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
            const text_node = txt(text);
            el("p").adto(start_container).adch(el("span").attr({'data-type': "text"}).adch(text_node)).attr({'data-type': "paragraph"});

            return mkrange(text_node, text.length, text_node, text.length);
        }
        console.log("unsupported", start_container, data_type);
        return mkrange(start_container, start_offset, start_container, start_offset);
    }
    console.log("unsupported", start_container);
    return mkrange(start_container, start_offset, start_container, start_offset);
}

// shift-enter: insert line break, enter: insert paragraph
// instead of this, what about one enter = line break, enter on line break = paragraph
// the reddit editor does enter/shift+enter but idk
const input_type_map: {[key: string]: FakeInputType} = {
    insertText: "insert",
    insertFromPaste: "insert_data_transfer",
    insertFromDrop: "insert_data_transfer",
    deleteContentForward: "delete",
    deleteContentBackward: "delete",
    deleteWordForward: "delete",
    deleteWordBackward: "delete",
    deleteByCut: "delete",
};

type FakeInputType = 
    | "insert"
    | "insert_data_transfer"
    | "delete"
;

export function richtextEditor(env: Env): HideShowCleanup<HTMLDivElement> {
    const frame = el("div");
    const hsc = hideshow(frame);

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
        const ranges = (e as unknown as {getTargetRanges: () => StaticRange[]}).getTargetRanges();
        console.log("Beforeinput", e, ranges);
        e.preventDefault();
        e.stopPropagation();
        const input_type = input_type_map[e.inputType] ?? "unsupported";

        const sel = window.getSelection()!;
        sel.removeAllRanges();
        for(const range of ranges) {
            if(input_type === "insert") {
                console.log("Insert text:", e.data);
                // from start container[start offset] to end container[end offset]::
                // delete things in between
                // add things

                // ok so the idea is to update state :: find the state node with start container, the state node with endcontainer, update

                    
                clearRange(range);
                sel.addRange(insertAt(range.startContainer, range.startOffset, e.data!));
        
                // startContainer startOffset endContainer endOffset
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
            }else{
                expectUnsupported(input_type);
                clearRange(range);
                sel.addRange(insertAt(range.startContainer, range.startOffset, e.inputType));
            }
        }
    });

    return hsc;
}

const expectUnsupported = (v: "unsupported"): void => {/**/};