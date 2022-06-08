import startGestureWatcher from "./touch_events";

const cleanup_fns: (() => void)[] = [];

if(import.meta.hot) {
    import.meta.hot.dispose(() => {
        [...cleanup_fns].reverse().forEach(fn => fn());
    });
}

function onCleanup(cleanupFn: (() => void)) {
    cleanup_fns.push(cleanupFn);
}

// TODO: this can be done in a serviceworker
function mockURL(url: string): string {
    return "http://localhost:3772/mock/" + url;
}
() => mockURL;

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
onCleanup(() => {
    canvas.remove();
});

const err_el = document.createElement("div");
err_el.style.display = "none";
err_el.style.backgroundColor = "red";
err_el.style.color = "white";
err_el.style.height = "100%";
err_el.style.pointerEvents = "none";
const eech = document.createElement("div");
eech.style.padding = "1rem";
eech.style.position = "fixed";
eech.style.top = "0";
eech.style.left = "0";
eech.style.right = "0";
eech.style.bottom = "0";
eech.style.transformOrigin = "top left";
eech.style.willChange = "transform";
eech.style.display = "flex";
eech.style.alignItems = "center";
eech.style.justifyContent = "center";
eech.style.fontSize = "3vw";
eech.innerHTML = "<div>The page is zoomed. Zoom out to continue.</div>";
err_el.appendChild(eech);
document.body.appendChild(err_el);

const stylel = document.createElement("style");
stylel.textContent = `
html:not(.e-zoomed), html:not(.e-zoomed) > body {
    touch-action: none;
    overflow-y: hidden;
}
`;
document.head.appendChild(stylel);

let disable_ev_lsn = false;

function onVisualViewportChange() {
    const value = visualViewport.scale < 0.999 || visualViewport.scale > 1.001;
    document.documentElement.classList.toggle("e-zoomed", value);
    canvas.style.display = value ? "none" : "";
    err_el.style.display = value ? "" : "none";
    disable_ev_lsn = value;

    const offset_left = visualViewport.offsetLeft;
    const offset_top = visualViewport.offsetTop;
    eech.style.transform = "translate(" + offset_left + "px," + offset_top + "px) " + "scale(" + 1/visualViewport.scale + ")";
}

visualViewport.addEventListener("resize", onVisualViewportChange);
visualViewport.addEventListener("scroll", onVisualViewportChange);
onCleanup(() => {
    visualViewport.removeEventListener("resize", onVisualViewportChange);
    visualViewport.removeEventListener("scroll", onVisualViewportChange);
    document.documentElement.classList.remove("e-zoomed");
    disable_ev_lsn = true;
    // cleanupGesRec();
});

let transform = new DOMMatrixReadOnly();

function screenToWorldPos(spx: number, spy: number): {x: number, y: number} {
    const res = transform.inverse().transformPoint({x: spx, y: spy});
    return {x: res.x, y: res.y};
}

// window.udm = (cb) => {transform = cb(transform)};

window.addEventListener("wheel", e => {
    if(disable_ev_lsn) return;
    e.preventDefault();

    // there is no reason to ever do this, but here is skew
    //    // transform = new DOMMatrixReadOnly().translate(e.clientX, e.clientY).skewY(-e.deltaY / 10).multiply(
    //    //     new DOMMatrixReadOnly().translate(-e.clientX, -e.clientY).multiply(transform),
    //    // );
    if(e.ctrlKey) {
        // scale
        const wheel = -e.deltaY / 60;
        const zoom = Math.pow(1 + Math.abs(wheel)/2 , wheel > 0 ? 1 : -1);

        const fsetx = e.clientX;
        const fsety = e.clientY;
        
        const cpos = screenToWorldPos(fsetx, fsety);

        transform = transform.scale(zoom);

        const fpos = screenToWorldPos(fsetx, fsety);

        transform = transform.translate(fpos.x - cpos.x, fpos.y - cpos.y);
        rerender();
    }else if(e.shiftKey) {
        transform = new DOMMatrixReadOnly().translate(e.clientX, e.clientY).rotate(-e.deltaY / 10).multiply(
            new DOMMatrixReadOnly().translate(-e.clientX, -e.clientY).multiply(transform),
        );
        rerender();
    }else{
        // pan
        transform = new DOMMatrixReadOnly().translate(-e.deltaX, -e.deltaY).multiply(transform);
        rerender();
    }
}, {passive: false});
window.addEventListener("pointerdown", e => {
    if(disable_ev_lsn) return;
    e.preventDefault();

    startGestureWatcher(e, {}, (gesture) => {
        console.log(gesture);
    }).then(r => {
        console.log("gesture finished");
    }).catch(er => {
        console.error(er);
    });
});
// const cleanupGesRec = recognizeGestures((ptr, ges) => {
//     if(disable_ev_lsn) return;
//     if(ptr === "mouse") return;

//     if(ges.kind === "pan") {
//         if(ges.points.length < 2) return;
//         // note: this is *incorrect*
//         // we should probably change recognizeGestures to have a start/update/end thing instead of this
//         const seclast = ges.points[ges.points.length - 2];
//         const last = ges.points[ges.points.length - 1];
//         const dx = seclast[0] - last[0];
//         const dy = seclast[1] - last[1];
//         transform = new DOMMatrixReadOnly().translate(-dx, -dy).multiply(transform);
//         rerender();
//     }else{
//         console.log("got unknown gesture", ptr, ges);
//     }
//     // for touchzoom:
//     // - set new scale based on distance between fingers
//     // - set new rotation based on angle between fingers
//     // - update transform (initial position of one finger - final position)
// });

const root_ctx = canvas.getContext("2d")!;

let new_frame_needed = false;
let new_frame_requested: null | number = null;
function rerender() {
    if(new_frame_requested != null) {
        new_frame_needed = true;
        return;
    }
    new_frame_needed = false;
    new_frame_requested = requestAnimationFrame(() => {
        new_frame_requested = null;
        if(new_frame_needed) {
            rerender();
        }
    });
    root_ctx.save();

    // ctx.fillStyle = "#18181B";
    root_ctx.fillStyle = "black";
    root_ctx.fillRect(0, 0, canvas.width, canvas.height);

    viewNode(view).render(root_ctx, 0, 0, canvas.width, canvas.height);
    // view.render(ctx);
}

interface Renderable {
    render(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void;
}

// https://github.com/WICG/canvas-formatted-text
// hmm. it's a really bad idea to try and do text in canvas
// we don't have any proper text metric stuff
// we don't have access to any unicode functions besides normalization
// it would be much nicer to use skia but I still can't get it to build
// I can also use cairo/pango but it's not super nice to work with

type NodeView<T> = {
    value: T,
} | (() => NodeView<T>);
function viewNode<T>(v: NodeView<T>): T {
    return typeof v === "function" ? viewNode(v()) : v.value;
}
function n<T>(v: T): NodeView<T> {
    return {value: v};
}

function PanView(props: {child: NodeView<Renderable>}): NodeView<Renderable> {
    return n({
        render(ctx, x, y, w, h) {
            ctx.save();
            ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
            viewNode(props.child).render(ctx, x, y, w, h);
    
            // ctx.fillStyle = "white";
            // const pos = screenToWorldPos(10, 10);
            // ctx.fillRect(pos.x, pos.y, 10, 10);
            
            ctx.restore();
        }
    });
}

function VLayout(props: {children: NodeView<NodeView<Renderable>[]>}): NodeView<Renderable> {
    return n({
        render(ctx, x, y, w, h) {
            for(const child of viewNode(props.children)) {
                viewNode(child).render(ctx, x, y, w, h);
            }
        }
    });
}

function ImageView(props: {alt: string, url: string, w: number, h: number}): NodeView<Renderable> {
    let img: null | HTMLImageElement = null;
    return n({
        render(ctx, x, y, w, h) {
            if(img == null) {
                img = document.createElement("img");
                img.src = props.url;
                img.onload = () => {
                    console.log("IMAGE LOADED!!");
                    // TODO update automatically
                };
            }
            
            ctx.save();
            ctx.fillStyle = "white";
            ctx.fillRect(x, y, props.w, props.h);
            ctx.drawImage(img, x, y, props.w, props.h);
            ctx.restore();
        },
    });
}

// vv TODO this can just be a flex view with
// - flex-wrap, center to baseline
// oh and also there's something about how line height is supposed to be calculated based on a
// baseline-to-baseline metric
function BodyView(props: {text: string}): NodeView<Renderable> {
    let text_metrics: null | TextMetrics = null;
    return n({
        render(ctx, x, y, w, h) {
            ctx.save();
            ctx.fillStyle = "white";
            ctx.font = "18px Inter var, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji";
            if(text_metrics == null) {
                text_metrics = ctx.measureText(props.text);
            }
            ctx.fillText(props.text, x, y);
            ctx.restore();
        },
    });
}

const view = PanView({get child() {
    return VLayout({get children() {return n([
        // <LabelView text="hi" />
        ImageView({alt: "alt text", w: 688, h: 1031, url: "https://images.unsplash.com/photo-1525824236856-8c0a31dfe3be?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=688&q=80"}),
        // <LabelView text="Text below" />
        BodyView({text: "The quick brown fox jumps over the lazy dog. Qwerty uiop asdf ghjkl zxcv bnm"}),
    ]);}});
}});

canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.display = "block";
canvas.style.objectFit = "none";
canvas.style.objectPosition = "top left";

// const view = new UIView();
// view.add(new UILabel("Test"));

if(!('requestIdleCallback' in window)) {
    window.requestIdleCallback = cb => (cb({
        didTimeout: false,
        timeRemaining: () => 0,
    }), 0);
    window.cancelIdleCallback = () => {/**/};
}
let rsic: undefined | number;
new ResizeObserver((itms) => {
    itms.forEach(itm => {
        if(itm.target === canvas) {
            if(rsic != null) cancelIdleCallback(rsic);
            rsic = requestIdleCallback(() => {
                canvas.width = itm.contentRect.width;
                canvas.height = itm.contentRect.height;
                rerender();
            }, {
                timeout: 500,
            });
        }
    });
}).observe(canvas);

function main() {
    rerender();
}

// const view2 = [
//     new ViewComponent([
//         new ButtonComponent(),
//     ]),
// ];

// oh actually why don't we just
// const view = [solid js array] and render that directly

main();


// ok the goal:
// - we'll make a "quick simple" retained ui thing
//   - quick simple as in it doesn't need nearly as many design decisions as trying to do
//     something like an immediate mode ui thing
// - we'll hook it up with a solid js like thing
