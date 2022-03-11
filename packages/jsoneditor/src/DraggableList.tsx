import { Accessor, batch, createContext, createEffect, createMemo, createSignal, For, JSX, onCleanup, Setter, untrack, useContext } from "solid-js";

// TODO items:
// - when you start dragging, we should collapse items into summaries. it is
//   incredibly unfun to try to drag something around if it covers half the screen and all
//   the other items in the list do too
//
// - we need to add keyboard support
//   - focus to grab
//   - up/down to move
//   - onClick to drop (space/enter)
//   - escape or focus out to cancel

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

type Dragging = null | {
    item: number,
    hovering: number,
    height: number,
};
type SelfDragging = null | {x: Number, y: number};

export function DraggableList(props: {
    items: string[],
    wrapper_class: string,
    nodeClass: (selfIsDragging: () => boolean) => string,
    setItems: (cb: (prev: string[]) => string[]) => void,
    children: (key: string, dragging: Accessor<boolean>) => JSX.Element,
}): JSX.Element {
    const list_symbol = Symbol();
    const [dragging, setDragging] = createSignal<Dragging>(null, {equals: (a, b) => {
        if(!a || !b) return a === b;
        return a.item === b.item && a.hovering === b.hovering && a.height === b.height;
    }});
    const [flipState, setFlipState] = createSignal(0);
    return <For each={props.items}>{(key, index) => {
        let wrapper_el!: HTMLDivElement;
        let viewer_el!: HTMLDivElement;
        let cleanFn: (() => void) | undefined;
        const [selfDragging, setSelfDragging] = createSignal<SelfDragging>(null);
        const selfIsDragging = createMemo(() => selfDragging() != null);
        onCleanup(() => {
            cleanFn?.();
        });
        return <div class={props.wrapper_class} ref={(el) => {
            wrapper_el = el;
            createEffect(() => (el as unknown as DropHolder)[drop_spot_symbol] = {
                owner: list_symbol,
                index: index(),
            });
            createEffect(() => {
                const dr = selfDragging();
                el.style.zIndex = dr ? "1" : "";
                el.style.position = dr ? "relative" : "";
            });
        }}>
            <div
                ref={el => {
                    viewer_el = el;
                    createEffect(() => {
                        el.style.pointerEvents = dragging() ? "none" : "";
                    });
                    let stored_rect: DOMRect | null = null;
                    createEffect(() => {
                        const flip_state = flipState();
                        if(flipState() === 1) {
                            if(el.style.transform !== "") {
                                stored_rect = el.getBoundingClientRect();
                                el.style.transition = "";
                                el.style.transform = "";
                            }else{
                                stored_rect = null;
                                el.style.transition = "";
                            }
                            return;
                        }else if(flipState() === 2) {
                            if(stored_rect) {
                                const current_rect = el.getBoundingClientRect();
                                const diff_x = stored_rect.x - current_rect.x;
                                const diff_y = stored_rect.y - current_rect.y;
                                el.style.transition = "";
                                el.style.transform = "translate("+diff_x+"px, "+diff_y+"px)";
                                stored_rect = null;
                                el.offsetHeight; // trigger reflow
                                el.style.transition = "0.2s transform ease-out";
                            }
                            return;
                        }
                        const self_dragging = selfDragging();
                        if(self_dragging) {
                            el.style.transition = "";
                            el.style.transform = "translate("+self_dragging.x+"px, "+self_dragging.y+"px)";
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
                class={props.nodeClass(selfIsDragging)}
            >
                <DragState.Provider value={{
                    selfIsDragging,
                    
                    dragging,
                    setDragging,

                    get wrapper_el() {return wrapper_el},

                    index,

                    selfDragging,
                    setSelfDragging,

                    list_symbol,

                    flipState,
                    setFlipState,

                    setItems: (v) => props.setItems(v),

                    set cleanFn(v) {cleanFn = v},
                    get cleanFn() {return cleanFn},
                }}>
                    {untrack(() => props.children(key, selfIsDragging))}
                </DragState.Provider>
            </div>
        </div>;
    }}</For>;
}

const DragState = createContext<{
    selfIsDragging: () => boolean,

    dragging: Accessor<Dragging>,
    setDragging: Setter<Dragging>,

    wrapper_el: HTMLElement,

    index: () => number,

    selfDragging: Accessor<SelfDragging>,
    setSelfDragging: Setter<SelfDragging>,

    list_symbol: symbol,

    flipState: Accessor<number>,
    setFlipState: Setter<number>,

    setItems: (nv: (pv: string[]) => string[]) => void,

    cleanFn: (() => void) | undefined,
}>();

export function DragButton(props: {
    class: (selfIsDragging: () => boolean) => string,
    children: JSX.Element,
}) {
    const state = useContext(DragState);
    if(!state) throw new Error("dragbutton used outside of draggable");
    return <button
        class={props.class(state.selfIsDragging)}
        style={{
            "touch-action": "none",
        }}
        onPointerDown={e => {
            if(!e.isPrimary) return; // ignore
            if(state.dragging()) return;
            e.preventDefault();

            const rect = state.wrapper_el.getBoundingClientRect();

            const updateDragging = (hover_idx: number) => {
                state.setDragging({
                    item: state.index(),
                    hovering: hover_idx,
                    height: rect.height,
                });
            };
            state.setSelfDragging({x: 0, y: 0});
            updateDragging(state.index());
            
            let start_pos_x = e.pageX;
            let start_pos_y = e.pageY;

            const updatePtr = (e: PointerEvent) => {
                const pos_x = e.pageX - start_pos_x;
                const pos_y = e.pageY - start_pos_y;
                state.setSelfDragging({x: pos_x, y: pos_y});

                // console.log(e.target);

                const target = document.elementFromPoint(e.clientX, e.clientY);

                if(isDropHolder(target) && target[drop_spot_symbol].owner === state.list_symbol) {
                    updateDragging(target[drop_spot_symbol].index);
                }else{
                    updateDragging(state.index());
                }
            };
            const onptrmove = (e: PointerEvent) => batch(() => {
                if(!e.isPrimary) return;
                e.preventDefault();
                e.stopImmediatePropagation();

                updatePtr(e);
            });
            const onptrup = (e: PointerEvent) => {
                if(!e.isPrimary) return;
                e.preventDefault();
                e.stopImmediatePropagation();

                updatePtr(e);

                const drag_target = state.dragging();
                const self = state.index();
                if(drag_target && drag_target.hovering !== self) {
                    // perform the following steps
                    // 1. send a signal asking anyone involved to measure
                    //    themselves, then clear their transition and
                    //    transform
                    state.setFlipState(1);
                    
                    // 2. setItems() (the dom will update immediately)
                    const target = drag_target.hovering;
                    state.setItems(prev => {
                        const dup = [...prev];
                        const value = dup.splice(self, 1); // delete self
                        dup.splice(target, 0, ...value);
                        return dup;
                    });

                    // 3. send a signal asking people to set up their
                    //    transforms
                    state.setFlipState(2);
                }

                batch(() => {
                    state.setFlipState(0);
                    unregister();
                });
            };
            const onptrcancel = (e: PointerEvent) => {
                if(!e.isPrimary) return;
                e.preventDefault();
                e.stopImmediatePropagation();

                batch(() => unregister());
            };
            document.addEventListener("pointermove", onptrmove, {capture: true});
            document.addEventListener("pointerup", onptrup, {capture: true});
            document.addEventListener("pointercancel", onptrcancel, {capture: true});
            const unregister = () => batch(() => {
                state.cleanFn = undefined;
                state.setDragging(null);
                state.setSelfDragging(null);
                document.removeEventListener("pointermove", onptrmove, {capture: true});
                document.removeEventListener("pointerup", onptrup, {capture: true});
                document.removeEventListener("pointercancel", onptrcancel, {capture: true});
            });
            if(state.cleanFn) throw new Error("attempt to double register fn");
            state.cleanFn = unregister;
        }}
    >
        {props.children}
    </button>;
}