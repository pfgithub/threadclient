import type * as Generic from "../../types/generic";
import {rt} from "../../types/generic";

// note: a full set of tests is available here
// https://pfg.pw/snudown/test
// test all expected output → richtext transformations

// function renderSafeHTML(client: ThreadClient, safe_html: string & {_is_safe: true}, parent_node: Node, class_prefix: string): HideShowCleanup<undefined> {
//     const divel = el("div").adto(parent_node).clss("prose");
//     const hsc = hideshow();
//     divel.innerHTML = safe_html;
//     if(class_prefix) for(const node of Array.from(divel.querySelectorAll("*"))) {
//         Array.from(node.classList).forEach(classname => {
//             node.classList.replace(classname, class_prefix + classname);
//         });
//     }
//     for(const alink of Array.from(divel.querySelectorAll("a"))) {
//         const after_node = document.createComment("after");
//         if(!alink.parentNode) throw new Error("alink without parent node. never.");
//         alink.parentNode.replaceChild(after_node, alink);
//         if(!after_node.parentNode) throw new Error("never.");

//         const href = alink.getAttribute("href") ?? "error no href";
//         const content = Array.from(alink.childNodes);

//         const {newbtn} = renderPreviewableLink(client, href, after_node, after_node.parentNode).defer(hsc);

//         newbtn.attr({class: newbtn.getAttribute("class") + " " + alink.getAttribute("class")});
//         content.forEach(el => newbtn.appendChild(el));
//     }
//     // false positive?
//     // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
//     for(const spoilerspan of Array.from(divel.querySelectorAll(".md-spoiler-text")) as HTMLSpanElement[]) {
//         const children = Array.from(spoilerspan.childNodes);
//         el("span").adto(spoilerspan).adch(...children).clss("md-spoiler-content");
//         spoilerspan.attr({title: "Click to reveal spoiler"});
//         spoilerspan.clss("md-spoiler-unrevealed");
//         spoilerspan.addEventListener("click", (e) => {
//             if(!spoilerspan.classList.contains("md-spoiler-unrevealed")) return;
//             e.preventDefault();
//             e.stopPropagation();
//             spoilerspan.classList.remove("md-spoiler-unrevealed");
//             spoilerspan.attr({title: ""});
//         }, {capture: true});
//     }
//     for(const image of Array.from(divel.querySelectorAll("img"))) {
//         image.clss("preview-image");
//     }
//     return hsc;
// }


type GenMeta = {_?: undefined};

function childNodesToRichtextParagraphs(meta: GenMeta, nodes: NodeListOf<ChildNode>): Generic.Richtext.Paragraph[] {
    const committed: Generic.Richtext.Paragraph[] = [];
    function commit() {
        if(uncommitted_spans.length > 0) {
            committed.push(rt.p(...uncommitted_spans));
        }
        uncommitted_spans = [];
    }
    let uncommitted_spans: Generic.Richtext.Span[] = [];
    for(const node of Array.from(nodes)) {
        if(node instanceof Text && !(node.nodeValue ?? "").trim()) {
            if(uncommitted_spans.length > 0) {
                uncommitted_spans.push(...contentSpanToRichtextSpan(meta, node, {}));
            }
            continue;
        }
        const paragraph = contentParagraphToRichtextParagraph(meta, node);
        if(paragraph) {
            commit();
            committed.push(...paragraph);
        }else{
            uncommitted_spans.push(...contentSpanToRichtextSpan(meta, node, {}));
        }
    }
    commit();
    return committed;
}
function childListItemsToRichtextListItems(meta: GenMeta, nodes: NodeListOf<ChildNode>): Generic.Richtext.ListItem[] {
    return Array.from(nodes).flatMap((node): Generic.Richtext.ListItem[] => {
        if(node instanceof Text) {
            if((node.nodeValue ?? "").trim()) return [rt.ili(rt.error("Text content: "+node.nodeValue, node))];
            return [];
        }
        if(node instanceof Comment) {
            return [];
        }
        if(node instanceof HTMLElement) {
            if(node.nodeName === "LI") {
                return [rt.li(...childNodesToRichtextParagraphs(meta, node.childNodes))];
            }
            return [rt.ili(rt.error("Unsupported List Item <"+node.nodeName+">", node))];
        }
        return [rt.ili(rt.error("Unsupported List Item Node", node))];
    });
}
function contentParagraphToRichtextParagraph(meta: GenMeta, node: Node): Generic.Richtext.Paragraph[] | undefined {
    if(node instanceof Text) {
        return undefined;
    }
    if(node instanceof Comment) {
        return undefined;
    }
    if(node instanceof HTMLElement) {
        let classes = Array.from(node.classList).filter(clss => {
            return true;
        });
        const eatClass = (class_name: string): boolean => {
            if(!classes.includes(class_name)) return false;
            classes = classes.filter(clss => clss !== class_name);
            return true;
        };
        const noClasses = (...value: Generic.Richtext.Paragraph[]): Generic.Richtext.Paragraph[] => {
            if(classes.length !== 0) return [rt.blockquote(rt.p(rt.error(classes.map(clss => "."+clss).join(""), node.outerHTML)), ...value)];
            return value;
        };

        if(node.nodeName === "P") {
            return noClasses(rt.p(...contentSpansToRichtextSpans(meta, node.childNodes, {})));
        }else if(node.nodeName === "H1") {
            return noClasses(rt.hn(1, ...contentSpansToRichtextSpans(meta, node.childNodes, {})));
        }else if(node.nodeName === "H2") {
            return noClasses(rt.hn(2, ...contentSpansToRichtextSpans(meta, node.childNodes, {})));
        }else if(node.nodeName === "H3") {
            return noClasses(rt.hn(3, ...contentSpansToRichtextSpans(meta, node.childNodes, {})));
        }else if(node.nodeName === "H4") {
            return noClasses(rt.hn(4, ...contentSpansToRichtextSpans(meta, node.childNodes, {})));
        }else if(node.nodeName === "H5") {
            return noClasses(rt.hn(5, ...contentSpansToRichtextSpans(meta, node.childNodes, {})));
        }else if(node.nodeName === "H6") {
            return noClasses(rt.hn(6, ...contentSpansToRichtextSpans(meta, node.childNodes, {})));
        }else if(node.nodeName === "HR") {
            return noClasses(rt.hr());
        }else if(node.nodeName === "UL") {
            return noClasses(rt.ul(...childListItemsToRichtextListItems(meta, node.childNodes)));
        }else if(node.nodeName === "OL") {
            return noClasses(rt.ol(...childListItemsToRichtextListItems(meta, node.childNodes)));
        }else if(node.nodeName === "BLOCKQUOTE") {
            eatClass("md-spoiler-text"); // blockquote spoilers are depricated and not supported in new reddit
            return noClasses(rt.blockquote(...childNodesToRichtextParagraphs(meta, node.childNodes)));
        }else if(node.nodeName === "TABLE") {
            const thead = node.children[0];
            const tbody = node.children[1];
            if(!thead || !tbody || thead.nodeName !== "THEAD" || tbody.nodeName !== "TBODY") return [rt.p(rt.error("Table missing head/body", node))];
            //

            if(thead.children.length !== 1) {
                return [rt.p(rt.error("Table head has 0/2+ rows", node))];
            }
            const tbhrow = thead.children[0]!;
            if(tbhrow.nodeName !== "TR") return [rt.p(rt.error("Table head does not contain a row", node))];

            return noClasses(rt.table(
                Array.from(tbhrow.children).map(child => {
                    if(child.nodeName !== "TH") return rt.th(undefined, rt.error("Not th", child));
                    return rt.th(
                        ({left: "left", center: "center", right: "right", none: undefined} as const)[child.getAttribute("align") ?? "none" as const],
                        ...contentSpansToRichtextSpans(meta, child.childNodes, {}),
                    );
                }),
                ...Array.from(tbody.children).map(tbrow => {
                    if(tbrow.nodeName !== "TR") return [rt.td(rt.error("Not tr", tbrow))];
                    return Array.from(tbrow.children).map(child => {
                        if(child.nodeName !== "TD") return rt.td(rt.error("Not td", child));
                        return rt.td(...contentSpansToRichtextSpans(meta, child.childNodes, {}));
                    });
                }),
            ));
        }else if(node.nodeName === "PRE") {
            const child_elements = Array.from(node.children);
            if(child_elements.length !== 1 || child_elements[0]!.nodeName !== "CODE") return [rt.p(rt.error("Unsupported bad pre/code", node))];
            const code_el = child_elements[0]!;
            const classv = Array.from(code_el.classList);
            let lang: string | undefined;
            const mdcl = "md-code-language-";
            if(classv[0] != null && classv[0].startsWith(mdcl)) {
                lang = classv[0].substr(mdcl.length);
            }
            return noClasses({kind: "code_block", lang, text: code_el.textContent ?? "ENOTEXT"});
        }else if(node.nodeName === "DIV") {
            // if(eatClass("toc")) {
            //     return noClasses(...childNodesToRichtextParagraphs(meta, node.childNodes));
            // }
            return childNodesToRichtextParagraphs(meta, node.childNodes);
            // return noClasses(rt.p(rt.error("Unexpected <div>", node)));
        }
        return undefined;
    }
    return undefined;
}
function contentSpansToRichtextSpans(meta: GenMeta, node: NodeListOf<ChildNode>, styles: Generic.Richtext.Style): Generic.Richtext.Span[] {
    return Array.from(node).flatMap(child => contentSpanToRichtextSpan(meta, child, styles));
}
function contentSpanToRichtextSpan(meta: GenMeta, node: Node, styles: Generic.Richtext.Style): Generic.Richtext.Span[] {
    if(node instanceof Text) {
        let nv = node.nodeValue ?? "[ENoNodeValue]";
        nv = nv.replace(/^\s+/, " ");
        nv = nv.replace(/\s+$/, " ");
        return [rt.txt(nv, styles)];
    }
    if(node instanceof Comment) {
        return [];
    }
    if(node instanceof HTMLElement) {
        let classes = Array.from(node.classList).filter(clss => {
            return true;
        });
        const eatClass = (class_name: string): boolean => {
            if(!classes.includes(class_name)) return false;
            classes = classes.filter(clss => clss !== class_name);
            return true;
        };
        const noClasses = (...value: Generic.Richtext.Span[]): Generic.Richtext.Span[] => {
            if(classes.length !== 0) return [rt.error(classes.map(clss => "."+clss).join(""), node.outerHTML)];
            return value;
        };

        if(node.nodeName === "A") {
            let href_v = node.getAttribute("href") ?? "no href";

            if(href_v.startsWith("/")) {
                href_v = "https://www.reddit.com" + href_v;
            }
            // if(!href_v.startsWith("http://") && !href_v.startsWith("https://") && !href_v.startsWith("mailto:")) {
            //     return noClasses(rt.error("Bad link", href_v));
            // }

            return noClasses(rt.link(href_v, {},
                ...Array.from(node.childNodes).flatMap(child => contentSpanToRichtextSpan(meta, child, styles)),
            ));
        }else if(node.nodeName === "BR") {
            return noClasses(rt.br());
        }else if(node.nodeName === "SUP") {
            return noClasses(...contentSpansToRichtextSpans(meta, node.childNodes, {...styles, superscript: true}));
        }else if(node.nodeName === "STRONG") {
            return noClasses(...contentSpansToRichtextSpans(meta, node.childNodes, {...styles, strong: true}));
        }else if(node.nodeName === "EM") {
            return noClasses(...contentSpansToRichtextSpans(meta, node.childNodes, {...styles, emphasis: true}));
        }else if(node.nodeName === "DEL") {
            return noClasses(...contentSpansToRichtextSpans(meta, node.childNodes, {...styles, strikethrough: true}));
        }else if(node.nodeName === "CODE") {
            return noClasses(rt.code(node.textContent ?? "ERRNOCODE"));
        }else if(node.nodeName === "SPAN") {
            const res_nodes = Array.from(node.childNodes).flatMap(child => contentSpanToRichtextSpan(meta, child, styles));

            if(eatClass("md-spoiler-text")) {
                return noClasses(rt.spoiler(...res_nodes));
            }

            return noClasses(...res_nodes);
        }
        return [rt.error("<"+node.nodeName+">", {node, html: node.outerHTML})];
    }
    return [rt.error("Unsupported Node", node)];
}

function setupGenMeta(content: string): [GenMeta, NodeListOf<ChildNode>] {
    const parsed_v = document.createElement("div");
    parsed_v.innerHTML = content; // safe, scripts won't execute and this won't be displayed directly on the screen
    const gen_meta: GenMeta = {};
    return [gen_meta, parsed_v.childNodes];
}

export function parseContentHTML(html: string): Generic.Richtext.Paragraph[] {
    return childNodesToRichtextParagraphs(...setupGenMeta(html));
}