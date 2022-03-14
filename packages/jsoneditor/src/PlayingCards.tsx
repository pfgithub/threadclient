import { createSignal, JSX, onCleanup, onMount } from "solid-js";
import { insert } from "solid-js/web";
import { anBool, AnNode, anNumber, anSetReconcile } from "./app_data";
import { Buttons, Button } from "./components";
import { AnFor } from "./Schemaless";
import { uuid } from "./uuid";

type Token = {
    // coords of center
    pos: {x: number, y: number},
    dragging: boolean,

    upd: number, // z index value = Date.now() (set to server time value if using a server TODO)
};
type PlayingCards = {
    tokens: {[key: string]: Token},
};

type Test = Parameters<(typeof document)["addEventListener"]>;

function toZIndex(number: number): number {
    // good enough for now but everything will get stuck on top when the time
    // rolls over the 32 bit integer mark
    //
    // so basically we have to make some messy signal thing to put all times onto
    // one scale and sort them

    // this should:
    // - add the current time to 
    // - onCleanup() remove it
    // - return a signal of the index of the number

    return number % 2**32 - 2**31;
}

function Token(props: {token: AnNode<Token>, width: number, container: HTMLElement}): JSX.Element {
    let cleanup_fn: (() => void) | undefined;
    onCleanup(() => cleanup_fn?.());

    return <div
        class="bg-gray-500 border-[2px] border-gray-900"
        style={{
            'position': "absolute",
            'top': (anNumber(props.token.pos.y) ?? 0) * 100 + "%",
            'left': (anNumber(props.token.pos.x) ?? 0) * 100 + "%",
            'transform-origin': "top left",
            'transform': anBool(props.token.dragging) ? "scale(1.2) translate(-50%, -50%)" : "translate(-50%, -50%)",
            'padding': (0.005) * 100 + "%",
            'z-index': toZIndex(anNumber(props.token.upd) ?? 0),
        }}
        onPointerDown={initial_ev => {
            if(!initial_ev.isPrimary) return;
            if(cleanup_fn) throw new Error("double primary pointer down");

            initial_ev.preventDefault();
            initial_ev.stopPropagation();

            anSetReconcile(props.token.dragging, () => true);
            anSetReconcile(props.token.upd, () => Date.now()); // {'@operation': "date-now"}

            const pxToPt = (px: [number, number]): [number, number] => {
                const container_rect = props.container.getBoundingClientRect();
                return [
                    (px[0] - container_rect.x) / container_rect.width,
                    (px[1] - container_rect.y) / container_rect.height,
                ];
            }

            const elem_start_pt = [anNumber(props.token.pos.x) ?? 0, anNumber(props.token.pos.y) ?? 0];
            const mouse_start_pt = pxToPt([initial_ev.clientX, initial_ev.clientY]);

            const ac = new AbortController();
            const as = ac.signal;

            function moveElement(e: PointerEvent): void {
                const mouse_new_pt = pxToPt([e.clientX, e.clientY]);;
                const diff_pt = [mouse_new_pt[0] - mouse_start_pt[0], mouse_new_pt[1] - mouse_start_pt[1]];
                anSetReconcile(props.token.pos, () => {
                    return {
                        x: elem_start_pt[0] + diff_pt[0],
                        y: elem_start_pt[1] + diff_pt[1],
                    };
                });
            }

            document.addEventListener("pointermove", e => {
                if(e.pointerId !== initial_ev.pointerId) return;
                e.preventDefault();
                e.stopPropagation();

                moveElement(e);
            }, {signal: as} as any);
            document.addEventListener("pointerup", e => {
                if(e.pointerId !== initial_ev.pointerId) return;
                e.preventDefault();
                e.stopPropagation();

                moveElement(e);
                cleanup_fn?.();
            }, {signal: as} as any);
            document.addEventListener("pointercancel", e => {
                if(e.pointerId !== initial_ev.pointerId) return;
                e.preventDefault();
                e.stopPropagation();

                anSetReconcile(props.token.pos, () => {
                    return {
                        x: elem_start_pt[0],
                        y: elem_start_pt[1],
                    };
                });

                cleanup_fn?.();
            }, {signal: as} as any);

            cleanup_fn = () => {
                cleanup_fn = undefined;
                ac.abort();
                anSetReconcile(props.token.dragging, () => false);
            };

            // onpointermove
            // onpointerup
            // onpointercancel
        }}
    >
        <div>My node!</div>
    </div>;
}

export default function PlayingCards(props: {node: AnNode<PlayingCards>}): JSX.Element {
    const [containerWidth, setContainerWidth] = createSignal<number>(100);

    return <div class="space-y-2"><div class="w-full bg-gray-700 relative" style={{
        'aspect-ratio': "16 / 9",
        'touch-action': "none",
        'font-size': containerWidth() / 100.0 + "px",
    }} ref={el => {
        const updsize = () => {
            setContainerWidth(el.offsetWidth);
        };
        onMount(() => {
            new ResizeObserver(updsize).observe(el);
            updsize();
            insert(el, <AnFor node={props.node.tokens}>{token => <Token
                token={token}
                width={containerWidth()}
                container={el}
            />}</AnFor>);
        });
    }} /><Buttons>
        <Button onClick={() => {
            anSetReconcile(props.node.tokens[uuid()], () => {
                return {
                    pos: {
                        x: 0.5,
                        y: 0.5,
                    },
                    dragging: false,

                    upd: Date.now(),
                };
            });
        }}>+ Add Card</Button>
    </Buttons></div>;
}

// huh we could have special symbols
// eg for a counter we could say anSetReconcile(counter.value, () => incrementByOne())
// that would write in the action itself to read the current value and add one
// so if two people click '+' at the same time, the counter increments twice