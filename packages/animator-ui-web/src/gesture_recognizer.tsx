// couldn't find how to do what I want with hammer js

// how it should work:
// events:
// - draw
//    start, move, end, cancel
//    : passes you a list of screen points and pressures. you map over
//      them and turn them into world coordinates
//    : starts the moment you touch the screen, cancels if another gesture
//      is recognized
// - touchzoom
//    start, move, end, cancel
//    : starts when there are two fingers. passes you the points of the two
//      fingers and the starting points.
//    : might be nice for it to have a slight delay just so the screen doesn't
//      scale a bit and then cancel
// - two finger tap / three finger tap / …
//    tap
//    : called when there is a two finger tap. this is sent on touchup if the
//      touch is shorter than a certain length

// TODO add the eslint rule no unnamed constants

export type EventPoint = [x: number, y: number, pressure: number];
export type GestureEvent = {kind: "none"} | {
    kind: "draw",
    points: EventPoint[],
    commit: boolean,
} | {
    kind: "touchzoom",
    start: [EventPoint, EventPoint],
    end: [EventPoint, EventPoint],
    commit: boolean,
} | {
    kind: "tap",
    points: EventPoint[],
};

export function recognizeGestures(onEvent: (id: string, event: GestureEvent) => void): () => void {
    const cleanup: (() => void)[] = [];

    type Point = {time: number, point: EventPoint};
    type Pointer = {
        points: Map<number, Point[]>,
    };
    const pointers = new Map<string, Pointer>();
    const getPointerMap = (type: string) => {
        const submap = pointers.get(type);
        if(!submap || submap.points.size === 0) {
            const setv: Pointer = {
                points: new Map(),
            };
            pointers.set(type, setv);
            return setv;
        }
        return submap;
    };
    const earliestPointer = (pointer: Pointer): number => {
        return [...pointer.points.values()]
            .map(value => value[0]!.time)
            .reduce((t, a) => Math.min(t, a), Infinity)
        ;
    };
    const eventToPoint = (e: PointerEvent): EventPoint => {
        return [e.pageX, e.pageY, e.pressure];
    };
    const size = (e: Point[]) => {
        let min_x = e[0]!.point[0];
        let max_x = e[0]!.point[0];
        let min_y = e[0]!.point[1];
        let max_y = e[0]!.point[1];
        for(const {point} of e) {
            if(point[0] < min_x) min_x = point[0];
            if(point[0] > max_x) max_x = point[0];
            if(point[1] < min_y) min_y = point[1];
            if(point[1] > max_y) max_y = point[1];
        }
        return (max_x - min_x) + (max_y - min_y);
    };
    const eventFromMap = (map: Pointer, opts: {commit: boolean}): GestureEvent => {
        if(map.points.size === 0) return {kind: "none"};

        const earliest = earliestPointer(map);
        const relevant = [...map.points.values()];
        const latest = relevant.reduce((t, a) => Math.max(t, a[0]!.time), 0);

        // send a tap event if the touch was <200ms in time
        if(opts.commit
            && earliest > Date.now() - 200
            && relevant.length > 1
            && !relevant.map(size).some(item => item > 10)
        ) {
            return {kind: "tap", points: relevant.map(rel => rel[0]!.point)};
        }
        // send a draw event if there is one relevant pointer
        if(relevant.length === 1) {
            return {
                kind: "draw",
                points: relevant[0]!.map(pt => pt.point),
                ...opts,
            };
        }
        const first_touch = relevant.map(ptr => {
            const idx = ptr.findIndex(point => point.time >= latest);
            if(idx === -1) return ptr[ptr.length - 1]!;
            return ptr[idx]!;
        });
        // send a zoom event if there are two relevant pointers
        if(relevant.length === 2) {
            return {
                kind: "touchzoom",
                start: first_touch.map(itm => itm.point) as [EventPoint, EventPoint],
                end: relevant.map(itm => itm[itm.length - 1]!.point) as [EventPoint, EventPoint],
                ...opts,
            };
        }
        // send nothing for 3‥ fingers
        return {kind: "none"};
    };

    document.documentElement.classList.add("no-interact");
    cleanup.push(() => document.documentElement.classList.remove("no-interact"));

    const onpointerdown = (e: PointerEvent) => {
        e.preventDefault();

        const pmap = getPointerMap(e.pointerType);
        const earliest = earliestPointer(pmap);

        if(Date.now() > earliest + 200) {
            return;
        }

        pmap.points.set(e.pointerId, [{time: Date.now(), point: eventToPoint(e)}]);

        onEvent(e.pointerType, eventFromMap(pmap, {commit: false}));
    };
    document.addEventListener("pointerdown", onpointerdown);
    cleanup.push(() => document.removeEventListener("pointerdown", onpointerdown));


    const onpointermove = (e: PointerEvent) => {
        const pmap = getPointerMap(e.pointerType);
        const prev = pmap.points.get(e.pointerId);
        if(prev) { // an active pointer might be deleted if it was used in a completed gesture
            e.preventDefault();

            prev.push({time: Date.now(), point: eventToPoint(e)});

            onEvent(e.pointerType, eventFromMap(pmap, {commit: false}));
        }
    };
    document.addEventListener("pointermove", onpointermove);
    cleanup.push(() => document.removeEventListener("pointermove", onpointermove));

    const onpointerup = (e: PointerEvent) => {
        e.preventDefault();

        const pmap = getPointerMap(e.pointerType);

        if(!pmap.points.has(e.pointerId)) return;

        const result = eventFromMap(pmap, {commit: true});

        pointers.delete(e.pointerType);

        onEvent(e.pointerType, result);
    };
    document.addEventListener("pointerup", onpointerup);
    cleanup.push(() => document.removeEventListener("pointerup", onpointerup));

    const onpointercancel = (e: PointerEvent) => {
        const pmap = getPointerMap(e.pointerType);
        if(!pmap.points.has(e.pointerId)) return;
        pmap.points.delete(e.pointerId);
        
        onEvent(e.pointerType, eventFromMap(pmap, {commit: false}));
    };
    document.addEventListener("pointercancel", onpointercancel);
    cleanup.push(() => document.removeEventListener("pointercancel", onpointercancel));

    const oncontextmenu = (e: Event) => {
        e.preventDefault();
    };
    document.addEventListener("contextmenu", oncontextmenu);
    cleanup.push(() => document.removeEventListener("pointercancel", oncontextmenu));

    return () => cleanup.forEach(itm => itm());
}