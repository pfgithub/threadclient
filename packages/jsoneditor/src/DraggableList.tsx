import {
    Accessor, batch, createContext, createEffect, createMemo,
    createSignal, For, JSX, onCleanup, Setter, untrack, useContext,
} from "solid-js";

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

    margin_top: number,
    margin_bottom: number,
};
type SelfDragging = null | {x: number, y: number};

export function DraggableList(props: {
    items: string[],
    wrapper_class: string,
    nodeClass: (selfIsDragging: () => boolean) => string,
    setItems: (cb: (prev: string[]) => string[]) => void,
    children: (
        key: string,
        dragging: Accessor<boolean>,
        index: Accessor<number>,
        anyDragging: Accessor<boolean>,
    ) => JSX.Element,
}): JSX.Element {
    const list_symbol = Symbol();
    const [dragging, setDragging] = createSignal<Dragging>(null, {equals: (a, b) => {
        if(!a || !b) return a === b;
        return a.item === b.item && a.hovering === b.hovering && a.height === b.height;
    }});
    const isDragging = createMemo(() => dragging() != null);
    const [flipState, setFlipState] = createSignal(0);
    let container_el!: HTMLDivElement;
    return <div style={{
        'padding-top': (dragging()?.margin_top ?? 0) + "px",
        'padding-bottom': (dragging()?.margin_bottom ?? 0) + "px",
    }} ref={container_el}><For each={props.items}>{(key, index) => {
        let wrapper_el!: HTMLDivElement;
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
                    createEffect(() => {
                        el.style.pointerEvents = dragging() ? "none" : "";
                    });
                    let stored_rect: DOMRect | null = null;
                    el.style.transformOrigin = "top";
                    createEffect(() => {
                        const flip_state = flipState();
                        if(flip_state === 1 || flip_state === 3) {
                            if(el.style.transform !== "" || flip_state === 3) {
                                stored_rect = el.getBoundingClientRect();
                                el.style.transition = "";
                                el.style.transform = "";
                            }else{
                                stored_rect = null;
                                el.style.transition = "";
                            }
                            return;
                        }else if(flip_state === 2) {
                            if(stored_rect) {
                                const current_rect = el.getBoundingClientRect();
                                const diff_x = stored_rect.x - current_rect.x;
                                const diff_y = stored_rect.y - current_rect.y;
                                const diff_w = stored_rect.width / current_rect.width;
                                const diff_h = stored_rect.height / current_rect.height;
                                el.style.transition = "";
                                el.style.transform = [
                                    "translate("+diff_x+"px, "+diff_y+"px)",
                                    "scale("+diff_w+", "+diff_h+")",
                                    //^ not sure if that looks good.
                                    // ok yeah I think it looks really bad
                                ].join(" ");
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
                <drag_state.Provider value={{
                    selfIsDragging,
                    
                    dragging,
                    setDragging,

                    get wrapper_el() {return wrapper_el},
                    get container_el() {return container_el},

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
                    {untrack(() => props.children(
                        key,
                        selfIsDragging,
                        index,
                        isDragging,
                    ))}
                </drag_state.Provider>
            </div>
        </div>;
    }}</For></div>;
}

const drag_state = createContext<{
    selfIsDragging: () => boolean,

    dragging: Accessor<Dragging>,
    setDragging: Setter<Dragging>,

    wrapper_el: HTMLElement,
    container_el: HTMLElement,

    index: () => number,

    selfDragging: Accessor<SelfDragging>,
    setSelfDragging: Setter<SelfDragging>,

    list_symbol: symbol,

    flipState: Accessor<number>,
    setFlipState: Setter<number>,

    setItems: (nv: (pv: string[]) => string[]) => void,

    cleanFn: (() => void) | undefined,
}>();

function scale(value: number, m0: [min: number, max: number], m1: [min: number, max: number]): number {
    return (((value - m0[0]) / m0[1]) * m1[1]) + m1[0];
}

export function DragButton(props: {
    class: string,
    children: JSX.Element,
}) {
    const state = useContext(drag_state);
    if(!state) throw new Error("dragbutton used outside of draggable");
    return <button
        class={props.class}
        style={{
            "touch-action": "none",
        }}
        onPointerDown={initial_ev => {
            if(!initial_ev.isPrimary) return; // ignore
            if(state.dragging()) return;
            initial_ev.preventDefault();

            const updateDragging = (hover_idx: number) => {
                const rect = state.wrapper_el.getBoundingClientRect();
                state.setDragging({
                    item: state.index(),
                    hovering: hover_idx,
                    height: rect.height,

                    margin_top: mtop,
                    margin_bottom: mbottom,
                });
            };
            state.setSelfDragging({x: 0, y: 0});
            
            const start_pos_x = initial_ev.pageX;
            const start_pos_y = initial_ev.pageY;

            const container_old_rect = state.container_el.getBoundingClientRect();
            const item_old_rect = state.wrapper_el.getBoundingClientRect();
            const prevent_scroll_extra_height = container_old_rect.height;
            let mtop = 0;
            let mbottom = prevent_scroll_extra_height;
            state.setFlipState(3);
            updateDragging(state.index());
            // item may have resized
            const container_new_rect = state.container_el.getBoundingClientRect();
            const item_new_rect = state.wrapper_el.getBoundingClientRect();
            // rescale relative cursor pos and add offset
            const src_pos = initial_ev.clientY - item_old_rect.top;
            const dest_pos = scale(src_pos,
                [0, item_old_rect.height],
                [0, item_new_rect.height],
            );
            mtop = (item_old_rect.top - item_new_rect.top) + (src_pos - dest_pos);
            mbottom = container_old_rect.height - (container_new_rect.height - prevent_scroll_extra_height) - mtop;
            updateDragging(state.index());
            state.setFlipState(2);

            state.setFlipState(0);

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
                if(drag_target) {// && drag_target.hovering !== self) {
                    // perform the following steps

                    // ok cool this works
                    // but it would be nice if the 

                    // 1. send a signal asking anyone involved to measure
                    //    themselves, then clear their transition and
                    //    transform
                    state.setFlipState(3);
                    
                    // 2. setItems() (the dom will update immediately)
                    const target = drag_target.hovering;
                    state.setItems(prev => {
                        const dup = [...prev];
                        const value = dup.splice(self, 1); // delete self
                        dup.splice(target, 0, ...value);
                        return dup;
                    });

                    const initial_pos = state.wrapper_el.getBoundingClientRect();
                    const initial_moff = e.clientY - initial_pos.top;

                    state.setDragging(null);

                    // scroll page to make mouse cursor roughly match
                    const final_pos = state.wrapper_el.getBoundingClientRect();
                    const final_moff = scale(initial_moff, [0, initial_pos.height], [0, final_pos.height]);
                    document.documentElement.scrollTop -= (
                        initial_pos.top - final_pos.top
                    ) + (initial_moff - final_moff);

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