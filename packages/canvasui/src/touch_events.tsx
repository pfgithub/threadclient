// TRACKING iOS SAFARI BUGS:
//
// https://bugs.webkit.org/show_bug.cgi?id=239014
// - when this is fixed, remove this block: `if(CSS.supports("-webkit-touch-callout: none")) {`

type PointerInfo = {
    id: number,
    start_pos: [number, number],
    current_pos: [number, number],
};

type Gesture = {
    kind: "undecided",
    pointers: PointerInfo[],
} | {
    kind: "pan",
    initial_axis: "x" | "y" | "zoom" | "rotate",
    pointers: PointerInfo[],
} | {
    kind: "multifinger_tap_ended",
    pointers: PointerInfo[],
    // tapping with three fingers and releasing one counts as a multifinger tap. no more gestures
    // should be sent after you do this.
};

type GestureEvent = {
    kind: "pan-x" | "pan-y" | "zoom" | "rotate",
    // start: [[number, number], [number, number]],
    // end: [[number, number], [number, number]],
    // transform: DOMMatrixReadOnly(),
} | {
    kind: "tap" | "hold",
    pos: [number, number],
    fingers: number,
};

type GestureCfg = {
    _todo?: undefined,
    // TODO: consider putting stuff like:
    // - restrict to only look at touches within a certain node
    // - other things

    // eg:
    // - should one finger pan or drag?
    // - should one finger be allowed to tap or should it drag immediately and dragcancel if failed
    // - should inertia be simulated on pan events

    // also TODO: trackpad gesture events. browsers don't generate very good trackpad events
    // so this won't be great.
};

/*
if any finger has moved 10px from its start location, choose the event:
- two fingers: mark it as zoom. TODO: detect rotate
- one finger, less than 15° from the x axis: mark as x axis
- one finger, any other direction: mark as y axis
Regardless of event initial_axis, always send values for translate, zoom, and rotate.
If an event starts as a pan and a second finger is added, use it to zoom. A third finger should be ignored.
*/

let watcher_running = false;

// vv call this when you get a "pointerdown" event
// [!]REMINDER: make sure to put touch-action: none (or similar) based on what you need
//  - eg if you're making a list and you want to be able to swipe items on the list, make it
//    touch-action: pan-y. also note that on ios you need a hacky workaround otherwise it's broken.
export default async function startGestureWatcher(
    initial_event: PointerEvent,
    cfg: GestureCfg,
    evhl: (ev: GestureEvent) => void,
): Promise<void> {
    if(initial_event.pointerType !== "touch") return;

    if(watcher_running) {
        throw new Error("error; another gesture watcher is already running. todo: kill it or something.");
        return;
    }
    watcher_running = true;

    let current_touch_gesture: Gesture | null = null;

    let onComplete!: (() => void);

    const onPointerDown = (e: PointerEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if(e.pointerType !== "touch") return;

        if(CSS.supports("-webkit-touch-callout: none")) {
            const screen_width = window.innerWidth;
            const x = e.clientX;
            const v = Math.min(Math.abs(x), Math.abs(screen_width - x));
            if(v < 50) return;
        }

        if(current_touch_gesture == null) {
            current_touch_gesture = {
                kind: "undecided",
                pointers: [],
            };
        }
        current_touch_gesture.pointers.push({
            id: e.pointerId,
            start_pos: [e.clientX, e.clientY],
            current_pos: [e.clientX, e.clientY],
        });
    };
    const onPointerMove = (e: PointerEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if(e.pointerType !== "touch") return;

        if(current_touch_gesture == null) return;
        current_touch_gesture.pointers = current_touch_gesture.pointers.map(ptr => {
            if(ptr.id === e.pointerId) {
                return {...ptr, current_pos: [e.clientX, e.clientY]};
            }
            return ptr;
        });
    };
    const onPointerUp = (e: PointerEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if(current_touch_gesture == null) return;

        if(current_touch_gesture.kind === "undecided") {
            current_touch_gesture = {
                kind: "multifinger_tap_ended",
                pointers: current_touch_gesture.pointers,
            };
            evhl({
                kind: "tap",
                pos: [initial_event.clientX, initial_event.clientY],
                fingers: current_touch_gesture.pointers.length,
            });
        }

        current_touch_gesture.pointers = current_touch_gesture.pointers.filter(ptr => ptr.id !== e.pointerId);

        if(current_touch_gesture?.pointers.length === 0) {
            onComplete();
        }
    };
    const onPointerCancel = (e: PointerEvent) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if(current_touch_gesture == null) return;
        
        current_touch_gesture.pointers = current_touch_gesture.pointers.filter(ptr => ptr.id !== e.pointerId);

        if(current_touch_gesture?.pointers.length === 0) {
            onComplete();
        }
    };
    onPointerDown(initial_event);
    document.addEventListener("pointerdown", onPointerDown, {capture: true});
    document.addEventListener("pointermove", onPointerMove, {capture: true});
    document.addEventListener("pointerup", onPointerUp, {capture: true});
    document.addEventListener("pointercancel", onPointerCancel, {capture: true});

    await new Promise(r => {
        onComplete = () => r(undefined);
    });

    watcher_running = false;
    document.removeEventListener("pointerdown", onPointerDown, {capture: true});
    document.removeEventListener("pointermove", onPointerMove, {capture: true});
    document.removeEventListener("pointerup", onPointerUp, {capture: true});
    document.removeEventListener("pointercancel", onPointerCancel, {capture: true});

    return;
}