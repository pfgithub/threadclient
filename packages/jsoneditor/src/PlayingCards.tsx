import { createSignal, JSX, onCleanup, onMount } from "solid-js";
import { insert } from "solid-js/web";
import { anBool, anCommitUndoGroup, anCreateUndoGroup, AnNode, anNumber, anRoot, anSetReconcile, anUndo } from "./app_data";
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
    const [draggingCleanupFn, setDraggingCleanupFn] = createSignal<(() => void) | undefined>(undefined);
    onCleanup(() => draggingCleanupFn()?.());

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
            'transition': [
                "0.1s transform",
                ...(draggingCleanupFn() ? "0.1s top, 0.1s left" : []),
            ].join(","),
            'width': "10%",
        }}
        onPointerDown={initial_ev => {
            if(!initial_ev.isPrimary) return;
            if(draggingCleanupFn()) throw new Error("double primary pointer down");

            initial_ev.preventDefault();
            initial_ev.stopPropagation();

            const undo_group = anCreateUndoGroup();

            anSetReconcile(props.token.dragging, () => true, {undo_group});
            anSetReconcile(props.token.upd, () => Date.now(), {undo_group}); // {'@operation': "date-now"}

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
                        x: Math.min(1.0, Math.max(0.0, elem_start_pt[0] + diff_pt[0])),
                        y: Math.min(1.0, Math.max(0.0, elem_start_pt[1] + diff_pt[1])),
                    };
                }, {undo_group});
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
                draggingCleanupFn()?.();

                anCommitUndoGroup(anRoot(props.token), undo_group);
            }, {signal: as} as any);
            document.addEventListener("pointercancel", e => {
                if(e.pointerId !== initial_ev.pointerId) return;
                e.preventDefault();
                e.stopPropagation();

                draggingCleanupFn()?.();

                anUndo(anRoot(props.token), undo_group);
            }, {signal: as} as any);

            setDraggingCleanupFn(() => () => {
                setDraggingCleanupFn(undefined);
                ac.abort();
                anSetReconcile(props.token.dragging, () => false, {undo_group});
            });

            // onpointermove
            // onpointerup
            // onpointercancel
        }}
    >
        <div>
            <img class="w-full" src={"data:image/svg+xml;base64,"+btoa(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="360" height="540">
  <g transform="translate(-151.42857,-248.08929)" id="layer1">
    <g transform="translate(151.42857,-264.27291)" id="g3106">
      <rect width="359" height="539" rx="29.944447" ry="29.944447" x="0.5" y="512.86218" id="rect6472" style="fill:#ffffff;stroke:#000000;stroke-width:0.99999976"/>
      <g transform="translate(5,22.36218)" id="g3076" style="fill:#000000;fill-opacity:1">
        <path d="m 10,80 -5,7 0,7 5,-7 0,43 5,0 0,-50 -5,0 z" transform="translate(0,440)" id="rect3156-5-0" style="fill:#000000;fill-opacity:1;stroke:none"/>
        <path d="m 30,520.00002 c -5.54,0 -10,4.46 -10,10 l 0,30 c 0,5.54 4.46,10 10,10 5.54,0 10,-4.46 10,-10 l 0,-30 c 0,-5.54 -4.46,-10 -10,-10 z m 0,5 c 2.77,0 5,2.23 5,5 l 0,30 c 0,2.77 -2.23,5 -5,5 -2.77,0 -5,-2.23 -5,-5 l 0,-30 c 0,-2.77 2.23,-5 5,-5 z" id="rect3158-7-9" style="fill:#000000;fill-opacity:1;stroke:none"/>
      </g>
      <g transform="matrix(-1,0,0,-1,355,1542.3622)" id="g3076-0" style="fill:#000000;fill-opacity:1">
        <path d="m 10,80 -5,7 0,7 5,-7 0,43 5,0 0,-50 -5,0 z" transform="translate(0,440)" id="rect3156-5-0-9" style="fill:#000000;fill-opacity:1;stroke:none"/>
        <path d="m 30,520.00002 c -5.54,0 -10,4.46 -10,10 l 0,30 c 0,5.54 4.46,10 10,10 5.54,0 10,-4.46 10,-10 l 0,-30 c 0,-5.54 -4.46,-10 -10,-10 z m 0,5 c 2.77,0 5,2.23 5,5 l 0,30 c 0,2.77 -2.23,5 -5,5 -2.77,0 -5,-2.23 -5,-5 l 0,-30 c 0,-2.77 2.23,-5 5,-5 z" id="rect3158-7-9-4" style="fill:#000000;fill-opacity:1;stroke:none"/>
      </g>
      <path d="m 32.5,630.36218 c 1,2 3.5,5 6,5 4.5,0 6.5,-4 6.5,-9 0,-5 -2,-9.5 -6.5,-9.5 -2.5,0 -4,2.5 -5.5,4 -0.5,0.5 -1,0 -0.5,-0.5 1.5,-1.5 4,-5.5 4,-9 0,-4 -2.5,-9 -6.5,-9 -4,0 -6.5,5 -6.5,9 0,3.5 2.5,7.5 4,9 0.5,0.5 0,1 -0.5,0.5 -1.5,-1.5 -3,-4 -5.5,-4 -4.5,0 -6.5,4.5 -6.5,9.5 0,5 2,9 6.5,9 2.5,0 5,-3 6,-5 0.5,-0.5 0.5,0 0.5,0.5 -0.5,4 -0.5,5 -1,8 -0.5,3 -2,8.5 -2,8.5 2.5,-1 7.5,-1 10,0 0,0 -1.5,-5.5 -2,-8.5 -0.5,-3 -0.5,-4 -1,-8 0,-0.5 0,-1 0.5,-0.5 z" id="path3037-1" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 332.5,934.36218 c 1,-2 3.5,-5 6,-5 4.5,0 6.5,4 6.5,9 0,5 -2,9.5 -6.5,9.5 -2.5,0 -4,-2.5 -5.5,-4 -0.5,-0.5 -1,0 -0.5,0.5 1.5,1.5 4,5.5 4,9 0,4 -2.5,9 -6.5,9 -4,0 -6.5,-5 -6.5,-9 0,-3.5 2.5,-7.5 4,-9 0.5,-0.5 0,-1 -0.5,-0.5 -1.5,1.5 -3,4 -5.5,4 -4.5,0 -6.5,-4.5 -6.5,-9.5 0,-5 2,-9 6.5,-9 2.5,0 5,3 6,5 0.5,0.5 0.5,0 0.5,-0.5 -0.5,-4 -0.5,-5 -1,-8 -0.5,-3 -2,-8.5 -2,-8.5 2.5,1 7.5,1 10,0 0,0 -1.5,5.5 -2,8.5 -0.5,3 -0.5,4 -1,8 0,0.5 0,1 0.5,0.5 z" id="path3037-1-1" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 95,613.36218 c 2,4 7,10 12,10 9,0 13,-8 13,-18 0,-10 -4,-19 -13,-19 -5,0 -8,5 -11,8 -1,1 -2,0 -1,-1 3,-3 8,-11 8,-18 0,-8 -5,-18 -13,-18 -8,0 -13,10 -13,18 0,7 5,15 8,18 1,1 0,2 -1,1 -3,-3 -6,-8 -11,-8 -9,0 -13,9 -13,19 0,10 4,18 13,18 5,0 10,-6 12,-10 1,-1 1,0 1,1 -1,8 -1,10 -2,16 -1,6 -4,17 -4,17 5,-2 15,-2 20,0 0,0 -3,-11 -4,-17 -1,-6 -1,-8 -2,-16 0,-1 0,-2 1,-1 z" id="path3037" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 275,613.36218 c 2,4 7,10 12,10 9,0 13,-8 13,-18 0,-10 -4,-19 -13,-19 -5,0 -8,5 -11,8 -1,1 -2,0 -1,-1 3,-3 8,-11 8,-18 0,-8 -5,-18 -13,-18 -8,0 -13,10 -13,18 0,7 5,15 8,18 1,1 0,2 -1,1 -3,-3 -6,-8 -11,-8 -9,0 -13,9 -13,19 0,10 4,18 13,18 5,0 10,-6 12,-10 1,-1 1,0 1,1 -1,8 -1,10 -2,16 -1,6 -4,17 -4,17 5,-2 15,-2 20,0 0,0 -3,-11 -4,-17 -1,-6 -1,-8 -2,-16 0,-1 0,-2 1,-1 z" id="path3037-7" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 185,673.36218 c 2,4 7,10 12,10 9,0 13,-8 13,-18 0,-10 -4,-19 -13,-19 -5,0 -8,5 -11,8 -1,1 -2,0 -1,-1 3,-3 8,-11 8,-18 0,-8 -5,-18 -13,-18 -8,0 -13,10 -13,18 0,7 5,15 8,18 1,1 0,2 -1,1 -3,-3 -6,-8 -11,-8 -9,0 -13,9 -13,19 0,10 4,18 13,18 5,0 10,-6 12,-10 1,-1 1,0 1,1 -1,8 -1,10 -2,16 -1,6 -4,17 -4,17 5,-2 15,-2 20,0 0,0 -3,-11 -4,-17 -1,-6 -1,-8 -2,-16 0,-1 0,-2 1,-1 z" id="path3037-4" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 95,733.36218 c 2,4 7,10 12,10 9,0 13,-8 13,-18 0,-10 -4,-19 -13,-19 -5,0 -8,5 -11,8 -1,1 -2,0 -1,-1 3,-3 8,-11 8,-18 0,-8 -5,-18 -13,-18 -8,0 -13,10 -13,18 0,7 5,15 8,18 1,1 0,2 -1,1 -3,-3 -6,-8 -11,-8 -9,0 -13,9 -13,19 0,10 4,18 13,18 5,0 10,-6 12,-10 1,-1 1,0 1,1 -1,8 -1,10 -2,16 -1,6 -4,17 -4,17 5,-2 15,-2 20,0 0,0 -3,-11 -4,-17 -1,-6 -1,-8 -2,-16 0,-1 0,-2 1,-1 z" id="path3037-0" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 275,733.36218 c 2,4 7,10 12,10 9,0 13,-8 13,-18 0,-10 -4,-19 -13,-19 -5,0 -8,5 -11,8 -1,1 -2,0 -1,-1 3,-3 8,-11 8,-18 0,-8 -5,-18 -13,-18 -8,0 -13,10 -13,18 0,7 5,15 8,18 1,1 0,2 -1,1 -3,-3 -6,-8 -11,-8 -9,0 -13,9 -13,19 0,10 4,18 13,18 5,0 10,-6 12,-10 1,-1 1,0 1,1 -1,8 -1,10 -2,16 -1,6 -4,17 -4,17 5,-2 15,-2 20,0 0,0 -3,-11 -4,-17 -1,-6 -1,-8 -2,-16 0,-1 0,-2 1,-1 z" id="path3037-9" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 95,831.36218 c 2,-4 7,-10 12,-10 9,0 13,8 13,18 0,10 -4,19 -13,19 -5,0 -8,-5 -11,-8 -1,-1 -2,0 -1,1 3,3 8,11 8,18 0,8 -5,18 -13,18 -8,0 -13,-10 -13,-18 0,-7 5,-15 8,-18 1,-1 0,-2 -1,-1 -3,3 -6,8 -11,8 -9,0 -13,-9 -13,-19 0,-10 4,-18 13,-18 5,0 10,6 12,10 1,1 1,0 1,-1 -1,-8 -1,-10 -2,-16 -1,-6 -4,-17 -4,-17 5,2 15,2 20,0 0,0 -3,11 -4,17 -1,6 -1,8 -2,16 0,1 0,2 1,1 z" id="path3037-488" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 275,831.36218 c 2,-4 7,-10 12,-10 9,0 13,8 13,18 0,10 -4,19 -13,19 -5,0 -8,-5 -11,-8 -1,-1 -2,0 -1,1 3,3 8,11 8,18 0,8 -5,18 -13,18 -8,0 -13,-10 -13,-18 0,-7 5,-15 8,-18 1,-1 0,-2 -1,-1 -3,3 -6,8 -11,8 -9,0 -13,-9 -13,-19 0,-10 4,-18 13,-18 5,0 10,6 12,10 1,1 1,0 1,-1 -1,-8 -1,-10 -2,-16 -1,-6 -4,-17 -4,-17 5,2 15,2 20,0 0,0 -3,11 -4,17 -1,6 -1,8 -2,16 0,1 0,2 1,1 z" id="path3037-2" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 185,891.36218 c 2,-4 7,-10 12,-10 9,0 13,8 13,18 0,10 -4,19 -13,19 -5,0 -8,-5 -11,-8 -1,-1 -2,0 -1,1 3,3 8,11 8,18 0,8 -5,18 -13,18 -8,0 -13,-10 -13,-18 0,-7 5,-15 8,-18 1,-1 0,-2 -1,-1 -3,3 -6,8 -11,8 -9,0 -13,-9 -13,-19 0,-10 4,-18 13,-18 5,0 10,6 12,10 1,1 1,0 1,-1 -1,-8 -1,-10 -2,-16 -1,-6 -4,-17 -4,-17 5,2 15,2 20,0 0,0 -3,11 -4,17 -1,6 -1,8 -2,16 0,1 0,2 1,1 z" id="path3037-45" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 95,951.3622 c 2,-4 7,-10 12,-10 9,0 13,8 13,18 0,10 -4,19 -13,19 -5,0 -8,-5 -11,-8 -1,-1 -2,0 -1,1 3,3 8,11 8,18 0,8 -5,18 -13,18 -8,0 -13,-10 -13,-18 0,-7 5,-15 8,-18 1,-1 0,-2 -1,-1 -3,3 -6,8 -11,8 -9,0 -13,-9 -13,-19 0,-10 4,-18 13,-18 5,0 10,6 12,10 1,1 1,0 1,-1 -1,-8 -1,-10 -2,-16 -1,-6 -4,-17.00002 -4,-17.00002 5,2 15,2 20,0 0,0 -3,11.00002 -4,17.00002 -1,6 -1,8 -2,16 0,1 0,2 1,1 z" id="path3037-5" style="fill:#000000;fill-opacity:1;stroke:none"/>
      <path d="m 275,951.3622 c 2,-4 7,-10 12,-10 9,0 13,8 13,18 0,10 -4,19 -13,19 -5,0 -8,-5 -11,-8 -1,-1 -2,0 -1,1 3,3 8,11 8,18 0,8 -5,18 -13,18 -8,0 -13,-10 -13,-18 0,-7 5,-15 8,-18 1,-1 0,-2 -1,-1 -3,3 -6,8 -11,8 -9,0 -13,-9 -13,-19 0,-10 4,-18 13,-18 5,0 10,6 12,10 1,1 1,0 1,-1 -1,-8 -1,-10 -2,-16 -1,-6 -4,-17.00002 -4,-17.00002 5,2 15,2 20,0 0,0 -3,11.00002 -4,17.00002 -1,6 -1,8 -2,16 0,1 0,2 1,1 z" id="path3037-17" style="fill:#000000;fill-opacity:1;stroke:none"/>
    </g>
  </g>
</svg>`)} />
        </div>
    </div>;
    // https://commons.wikimedia.org/wiki/Category:SVG_English_pattern_playing_cards
}

export default function PlayingCards(props: {node: AnNode<PlayingCards>}): JSX.Element {
    const [containerWidth, setContainerWidth] = createSignal<number>(100);

    return <div class="space-y-2"><div class="w-full bg-gray-700 relative overflow-hidden" style={{
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