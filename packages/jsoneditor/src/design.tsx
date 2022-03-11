import { batch, createEffect, createSignal, For, JSX, onCleanup } from "solid-js";

// ok so:
// Ideally we find a library that does this because dom animations are horribly painful
//
// basically we're recreating this mess:
// - github:pfgithub/scpl-actions master src/parameters/ShortcutsDictionaryParameter.tsx
//
// so:
// - the dragged item we move around with transform
// - as we drag, we need to measure the initial positions of items above and below it
//   relative to the page
// - as soon as it passes halfway through an item, we tell that item to shift down by
//   the height of the dragged item
// - as soon as it passes the full way through the item, we have to measure the next
//   one and store it
// - never do any measurements of an item that has already been measured
// - once we drop the item, physically move the dom node (aka setItems(…)) and transition
//   everything
//
// ok for now we're not going to worry about being resistent to new items getting added
// while dragging.

// we need to seperate a node that can be transformed from
// ok while dragging we can make every node pointer events none
// and then have fake wrapper nodes that stay in position

// so the real nodes get transformed and they are inside the wrapper node that just stores
// position

// ok let's do it

// final goals are we want a nice list but we also want this generic enough to be able to
// use it for the richtext editor

// for now it'll be pretty specific but eventually it will be abstracted more. we don't
// want to abstract too early before we even know how it will work

//

// ok we'll not use drag and drop yet
// - should we? we could use drag and drop with the wrapper elemenst as the drop
//   handlers
// yeah ok we won't

// [!]NOTES for next time:
//    - so we need to be able to drop the item
//      - we'll find out if the <For> keeps state or not. it should I hope.
//    - 


const drop_spot_symbol = Symbol();
type DropHolder = {
    [drop_spot_symbol]: {
        owner: symbol,
        index: number,
    },
};

function isDropHolder(v: unknown): v is DropHolder & HTMLElement {
    return v != null && typeof v === "object" && drop_spot_symbol in v;
}

function DraggableList(): JSX.Element {
    const list_symbol = Symbol();
    const [items, setItems] = createSignal(new Array(30).fill(0).map((_, i) => ({key: "" + i})));
    const [dragging, setDragging] = createSignal<null | {
        item: number,
        hovering: number,
        height: number,
    }>(null, {equals: (a, b) => {
        if(!a || !b) return a === b;
        return a.item === b.item && a.hovering === b.hovering && a.height === b.height;
    }});
    return <div>
        <For each={items()}>{(item, index) => {
            let wrapper_el!: HTMLDivElement;
            let viewer_el!: HTMLDivElement;
            let cleanFn: (() => void) | undefined;
            let [selfDragging, setSelfDragging] = createSignal(false);
            onCleanup(() => {
                cleanFn?.();
            });
            return <div class="pt-2 first:pt-0" ref={(el) => {
                wrapper_el = el;
                createEffect(() => (el as unknown as DropHolder)[drop_spot_symbol] = {
                    owner: list_symbol,
                    index: index(),
                });
            }}><div
                ref={el => {
                    viewer_el = el;
                    createEffect(() => {
                        el.style.pointerEvents = dragging() ? "none" : "";
                    });
                    createEffect(() => {
                        if(selfDragging()) {
                            el.style.transition = "";
                            return;
                        }
                        el.style.transition = "0.2s transform";
                        const drag = dragging();
                        if(!drag) {
                            el.style.transform = "";
                            return;
                        }
                        const self = index();
                        if(drag.item > self) {
                            if(drag.hovering <= self) {
                                el.style.transform = "translateY("+drag.height+"px)";
                                return;
                            }
                        }else{
                            if(drag.hovering >= self) {
                                el.style.transform = "translateY(-"+drag.height+"px)";
                                return;
                            }
                        }
                        el.style.transform = "";
                    });
                }}
                class="bg-gray-700 rounded-md flex flex-row flex-wrap"
            >
                <div class="flex-1 p-2">
                    Collapsed Item {item.key} (state: {Math.random()})
                    <div style={{height: (Math.random() * 10 |0) + "px"}} />
                </div>
                <button
                    class="px-4 hover:bg-gray-500 rounded-md"
                    onPointerDown={e => {
                        if(!e.isPrimary) return; // ignore
                        if(dragging()) return;
                        e.preventDefault();

                        const rect = wrapper_el.getBoundingClientRect();

                        const updateDragging = (hover_idx: number) => {
                            setDragging({
                                item: index(),
                                hovering: hover_idx,
                                height: rect.height,
                            });
                        };
                        setSelfDragging(true);
                        updateDragging(index());
                        
                        let start_pos_x = e.pageX;
                        let start_pos_y = e.pageY;

                        const ptrmove = (e: PointerEvent) => batch(() => {
                            if(!e.isPrimary) return;
                            e.preventDefault();
                            e.stopImmediatePropagation();

                            console.log(e.pageY, start_pos_y);

                            const pos_x = e.pageX - start_pos_x;
                            const pos_y = e.pageY - start_pos_y;
                            viewer_el.style.transform = "translate("+pos_x+"px, "+pos_y+"px)";

                            if(isDropHolder(e.target) && e.target[drop_spot_symbol].owner === list_symbol) {
                                updateDragging(e.target[drop_spot_symbol].index);
                            }else{
                                updateDragging(index());
                            }
                        });
                        const ptrup = (e: PointerEvent) => batch(() => {
                            if(!e.isPrimary) return;
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            unregister();
                        });
                        document.addEventListener("pointermove", ptrmove, {capture: true});
                        document.addEventListener("pointerup", ptrup, {capture: true});
                        const unregister = () => batch(() => {
                            setDragging(null);
                            setSelfDragging(false);
                            document.removeEventListener("pointermove", ptrmove, {capture: true});
                            document.removeEventListener("pointerup", ptrup, {capture: true});
                            cleanFn = undefined;
                        });
                        if(cleanFn) throw new Error("attempt to double register fn");
                        cleanFn = unregister;
                    }}
                >≡</button>
            </div></div>;
        }}</For>
    </div>;
}

export default function Design(): JSX.Element {
    return <div>
        <DraggableList />
    </div>;
}