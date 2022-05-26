import { Accessor, createEffect, createSelector, createSignal, untrack } from "solid-js";
import { animationTime } from "./animation";

export default function createExclusiveFlipSelector<T>(state: Accessor<T>): {
    ref: (item: HTMLElement) => void,
    if: (v: T) => boolean,
} {
    const props = {
        get value() {
            return state();
        }
    };
    const [prevValue, setPrevValue] = createSignal(untrack(() => props.value));
    const selector = createSelector(state);
    const prevSelector = createSelector(prevValue);
    
    const [shape, setShape] = createSignal<HTMLElement | null>(null);

    createEffect<HTMLElement | null>(arg0 => {
        const prev_shape = arg0;
        const next_shape = shape();
        const current_value = untrack(() => props.value);

        if(prev_shape != null && next_shape != null && next_shape !== prev_shape) untrack(() => {
            const prev_pos = prev_shape.getBoundingClientRect();
            const new_pos = next_shape.getBoundingClientRect();

            // transition new element

            const diff_x = prev_pos.x - new_pos.x;
            const diff_y = prev_pos.y - new_pos.y;
            // const fi_r = new_pos.width - prev_pos.width;
            // const fi_b = new_pos.height - prev_pos.height;
            const diff_w = prev_pos.width / new_pos.width;
            const diff_h = prev_pos.height / new_pos.height;

            next_shape.animate([{
                'transform': [
                    "translate("+diff_x+"px, "+diff_y+"px)",
                    "scale("+diff_w+", "+diff_h+")",
                ].join(" "),
                'transformOrigin': "top left",
            }, {
                'transformOrigin': "top left",
            }], {
                duration: (animationTime() / 2) * 1000,
                easing: "ease-out",
            });
        });

        setPrevValue(() => current_value); // delete old element

        return next_shape;
    }, null);

    return {
        if: v => selector(v) || prevSelector(v),
        ref: itm => setShape(itm),
    };
}