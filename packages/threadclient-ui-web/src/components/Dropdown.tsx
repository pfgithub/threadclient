import { createEffect, createSignal, JSX, on, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Show } from "tmeta-util-solid";
import { classes } from "../util/utils_solid";
import { animationTime } from "./animation";
import Button from "./Button";

// huh we can createsignal(undefined, {equals: false})
const [closeDropdowns, setCloseDropdowns] = createSignal(Symbol());
export function closeAllDropdowns(): void {
    setCloseDropdowns(Symbol());
}

export default function Dropdown(props: {
    label: JSX.Element | ((open: () => boolean) => JSX.Element),
    children: JSX.Element,
}): JSX.Element {
    type Position = {
        rect: DOMRect,
        scroll: [number, number],
    };
    const [position, setPosition] = createSignal<Position>({
        rect: new DOMRect(0, 0, 0, 0),
        scroll: [0, 0],
    });
    const [target, setTargetRaw] = createSignal<boolean>(false);
    const [animating, setAnimating] = createSignal<boolean>(false);

    const setTarget = (nvr: boolean | ((pv: boolean) => boolean)) => {
        setTargetRaw(pv => {
            const nv = typeof nvr === "boolean" ? nvr : nvr(pv);
            if(pv !== nv) setAnimating(true);
            return nv;
        });
    };

    createEffect(on(closeDropdowns, () => {
        setTarget(false);
    }, {defer: true}));

    let node1!: HTMLElement;

    // while open:
    // - add a focus watcher
    // - if the user ever moves focus outside of the button | global overlay node:
    //   - close the menu
    // reminder:
    // - when you open the menu, focus should be moved to the menu
    // - if you close the menu with escape or by tabbing out, focus should be returned
    //   to the button.

    // TODO:
    // add portals for our tab thing
    // like div tabindex="0" nodes that onfocus focus another node.

    // ok I'm not sure if I can do that without ending up with some extra focus
    // slots

    // what I can probably do is capture the tab key press and teleport the focus
    // https://a11y-guidelines.orange.com/en/web/components-examples/dropdown-menu/#
    // that one cheats, it has the menu right next to the thing in dom
    // whereas mine is like halfway across the page in dom
    // https://www.w3.org/WAI/tutorials/menus/flyout/
    // ok:
    // - the button should have aria-haspopup
    // - the button should have aria-expanded={target()}
    // ok that wasn't very useful

    // https://github.com/exogen/react-tab-portal/blob/master/src/utils.js
    // ok I want that focusBefore/focusAfter fn
    // unfortunately
    // https://www.npmjs.com/package/tabbable have to do some sketchy stuff

    // {target() ? "▴" : "▾"}

    return <>
        <Button btnref={v => node1 = v} onClick={e => {
            const button_rect = e.target.getBoundingClientRect();
            setPosition({
                rect: button_rect,
                scroll: [window.scrollX, window.scrollY],
                closing: false,
            });
            setTarget(v => !v);
        }}>
            {typeof props.label === "function" ? props.label(target) : props.label}
        </Button>
        <Show if={target() || animating()}>{(() => {
            let node2!: HTMLDivElement;

            let tabin1!: HTMLDivElement;

            const [showFocusRing, setShowFocusRing] = createSignal(false);

            createEffect(() => {
                // ok last time I did this I'm pretty sure I started with focus
                // but then switched to click? I'm not sure why. I guess I'm about
                // to find out.
                //
                // answer: nodes that aren't focusable don't get focused when you click
                // them.

                const documentEvhl = (e: FocusEvent) => {
                    let parentv: HTMLElement | null = e.target as HTMLElement | null;
                    while(parentv) {
                        if(parentv === node1) return;
                        if(parentv === node2) return;
                        parentv = parentv.parentElement;
                    }
                    setTarget(false);
                };

                // oh I can switch this to use an abortsignal now to auto-remove the listener
                // that's a December 2021 feature though so I'm not going to try using it yet.
                document.addEventListener("click", documentEvhl, {capture: true, passive: false});
                onCleanup(() => document.removeEventListener("click", documentEvhl, {capture: true}));
            });

            const node = document.createElement("div");
            document.body.appendChild(node);
            onCleanup(() => {
                node.remove();
            });

            return <><div
                tabindex="0"
                onfocus={() => tabin1.focus()}
            /><Portal mount={node}>
                <div ontransitionend={() => {
                    setAnimating(false);
                }} ref={n => {
                    node2 = n;

                    n.style.transformOrigin = "top right";

                    const setTransition = () => {
                        const anim_time = animationTime() / 2;
                        n.style.transition = anim_time+"s opacity, "
                        +anim_time+"s transform";
                    };
                    const setHidden = () => {
                        n.style.transform = "scale(0.95)";
                        n.style.opacity = "0";
                        setTransition();
                        n.style.transitionTimingFunction = "ease-in";
                    };
                    const setVisible = () => {
                        n.style.transform = "";
                        n.style.opacity = "";
                        setTransition();
                        n.style.transitionTimingFunction = "ease-out";
                    };
                    setHidden();

                    createEffect(() => {
                        const value = target();
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                if(value) {
                                    setVisible();
                                }else{
                                    setHidden();
                                }
                            });
                        });
                    });

                    createEffect(() => {
                        if(showFocusRing()) {
                            n.style.outline = "1px dotted var(--outline-color)";
                        }else{
                            n.style.outline = "";
                        }
                    });
                }} class={classes(
                    "absolute",
                )} style={{
                    'top': (position().rect.bottom + position().scroll[1])+"px",

                    '--dbtn-target-pos': position().rect.right + "px",
                    '--dbtn-max-width': "24rem",
                    '--dbtn-padding': "1rem",
                    '--dbtn-left': "max("
                        +"calc(var(--dbtn-target-pos) - var(--dbtn-max-width)),"
                        +"calc(0px + var(--dbtn-padding))"
                    +")",

                    'left': "var(--dbtn-left)",
                    'right': "calc(100vw - min("
                        +"calc(var(--dbtn-left) + var(--dbtn-max-width)),"
                        +"100vw - var(--dbtn-padding))"
                    +")",

                    'z-index': 1000000000,
                }}>
                    <div tabindex="0" onfocus={() => {
                        node1.focus();
                    }} />
                    <div tabindex="0" ref={tabin1} onfocusin={() => {
                        setShowFocusRing(true);
                    }} onfocusout={() => {
                        setShowFocusRing(false);
                    }} />
                    <div class="bg-gray-100 p-1 rounded-lg">{props.children}</div>
                    <div tabindex="0" onfocus={() => {
                        setTarget(false);
                        node1.focus();
                    }} />
                </div>
            </Portal></>;
        })()}</Show>
    </>;
}