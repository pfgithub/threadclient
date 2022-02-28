import { createEffect, createRoot, JSX, onCleanup, onMount } from "solid-js";

export default function Debugtool(props: {
    observe_root: HTMLElement,
}): JSX.Element {
    let nodes_go_here!: HTMLDivElement;

    const renderChange = (rect: DOMRect, time: number) => {
        createRoot(dispose => {
            const h = ((time / 10) % 360) |0;
            const anim_time = 1000;
            setTimeout(() => dispose(), anim_time); // ontraisitionend wasn't triggering?
            const new_node = <div
                style={{
                    position: "fixed",
                    top: rect.top + "px",
                    left: rect.left + "px",
                    width: rect.width + "px",
                    height: rect.height + "px",
                    'z-index': 2147483647,
    
                    'transition': anim_time+"ms opacity",
                }}
                class="opacity-100"
                ref={el => {
                    onMount(() => {
                        requestAnimationFrame(() => {
                            el.style.opacity = "0";
                        })
                    });
                }}
            >
                <div
                    class={[
                        "w-full h-full border-box",
                        "border-4",
                    ].join(" ")}
                    style={{
                        'border-color': "hsl("+h+", 100%, 50%)",
                    }}
                />
            </div> as HTMLDivElement;

            nodes_go_here.appendChild(new_node);
            onCleanup(() => new_node.remove());
        });
    };

    const onAddNode = (node: Node, time: number) => {
        if(node instanceof Element) {
            renderChange(node.getBoundingClientRect(), time);
        }else if(node instanceof Text) {
            const range = document.createRange();
            range.selectNode(node);
            renderChange(range.getBoundingClientRect(), time);
        }else{
            console.log("EBADNODE", node);
        }
    };
    createEffect(() => {
        const observer = new MutationObserver((mutations_list) => {
            const time = Date.now();
            const touched_nodes: Set<Node> = new Set();
            for(const mutation of mutations_list) {
                if(mutation.type === "attributes") {
                    touched_nodes.add(mutation.target);
                }else if(mutation.type === "childList") {
                    mutation.addedNodes.forEach(node => touched_nodes.add(node));
                    // [!] we should actually add the node and all its children
                    //     (excluding text node children - just the parent node is)
                    //     (enough. no reason to waste lots of performance getting bounds
                    //      for individual text ranges.)
                }else if(mutation.type === "characterData") {
                    touched_nodes.add(mutation.target);
                }
            }
            touched_nodes.forEach(node => onAddNode(node, time));
        });

        observer.observe(props.observe_root, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true,
        });
        onCleanup(() => observer.disconnect());
    })
    return <div
        ref={nodes_go_here}
        aria-hidden
        class="pointer-events-none"
    />;
}