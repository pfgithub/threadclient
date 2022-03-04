import { createEffect, createRoot, JSX, onCleanup, onMount } from "solid-js";

// TODO:
// consider rendering with react devtools drawBoxAroundElement
// https://github.com/pfgithub/domframework/blob/master/demo/src/drawBoxAroundElement.js

export default function Debugtool(props: {
    observe_root: HTMLElement,
}): JSX.Element {
    let nodes_go_here!: HTMLDivElement;
    
    const opts = {
        text_node_highlighting: true,
    };

    const renderChange = (winsz: [number, number], rect: DOMRect, time: number) => {
        if(rect.bottom < 0 || rect.right < 0 || rect.left > winsz[0] || rect.top > winsz[1]) {
            return; // skip
        }
        // const top = Math.max(rect.top - 4, 0);
        // const left = Math.max(rect.left - 4, 0);
        // const width = Math.min(rect.left + rect.width + 8, winsz[0]) - rect.left;
        // const height = Math.min(rect.bottom + rect.height + 8, winsz[0]) - rect.bottom;
        let top = rect.top;
        let left = rect.left;
        let width = rect.width;
        let height = rect.height;
        if(width < 8) {
            const diff = 8 - width;
            left -= diff;
            width += diff * 2;
        }
        if(height < 8) {
            const diff = 8 - height;
            top -= diff;
            height += diff * 2;
        }
        createRoot(dispose => {
            const h = ((time / 10) % 360) |0;
            const anim_time = 1000;
            const new_node = <div
                ontransitionend={e => {
                    if(e.target !== e.currentTarget) return;
                    dispose();
                }}
                style={{
                    'position': "fixed",
                    'top': top + "px",
                    'left': left + "px",
                    'width': width + "px",
                    'height': height + "px",
                    'z-index': 2147483647,
                    'opacity': 100,
    
                    'transition': anim_time+"ms opacity",
                }}
                ref={el => {
                    onMount(() => {
                        // https://stackoverflow.com/questions/24148403/trigger-css-transition-on-appended-element
                        el.offsetWidth;
                        el.style.opacity = "0";
                    });
                }}
            >
                <div
                    style={{
                        'width': "100%",
                        'height': "100%",
                        'box-sizing': "border-box",
                        'border': "1px solid hsl("+h+", 100%, 50%)",
                    }}
                />
            </div> as HTMLDivElement;

            nodes_go_here.appendChild(new_node);
            onCleanup(() => new_node.remove());
        });
    };

    const onAddNode = (ssz: [number, number], node: Node, time: number) => {
        if(node instanceof Element) {
            renderChange(ssz, node.getBoundingClientRect(), time);
        }else if(node instanceof Text) {
            const range = document.createRange();
            range.selectNode(node);
            renderChange(ssz, range.getBoundingClientRect(), time);
        }else if(node instanceof Comment) {
            // ignore
        }else{
            console.log("EBADNODE", node);
        }
    };
    createEffect(() => {
        const observer = new MutationObserver((mutations_list) => {
            // const time = Date.now();
            const touched_nodes: Set<Node> = new Set();
            const addNodeList = (node_list: NodeList) => {
                node_list.forEach(node => {
                    touched_nodes.add(node);
                    addNodeList(node.childNodes);
                });
            };
            for(const mutation of mutations_list) {
                if(mutation.type === "attributes") {
                    touched_nodes.add(mutation.target);
                }else if(mutation.type === "childList") {
                    addNodeList(mutation.addedNodes);
                }else if(mutation.type === "characterData") {
                    touched_nodes.add(mutation.target);
                }
            }
            if(!opts.text_node_highlighting) {
                for(const node of [...touched_nodes]) {
                    if(node instanceof Text) {
                        if(node.parentNode) touched_nodes.add(node.parentNode);
                        touched_nodes.delete(node);
                    }
                }
            }
            const ssz: [number, number] = [window.innerWidth, window.innerHeight];
            touched_nodes.forEach(node => onAddNode(ssz, node, Date.now()));
        });

        observer.observe(props.observe_root, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true,
        });
        onCleanup(() => observer.disconnect());
    });
    return <div
        ref={nodes_go_here}
        aria-hidden
        style={{
            'pointer-events': "none",
        }}
    />;
}