import { Color, Icon as IconType } from "api-types-generic";
import { JSX, Accessor, createMemo } from "solid-js";
import { colorBackground } from "./color";
import Icon from "./Icon";

type Stop = {
    icon: IconType,
    // no label as SwipeActions are not available to screenreader users
    color: Color,
    onActivate: () => void,
};

// TODO: make this using jsx elements
// <SwipeActionSet left={<Stop icon="" color="" onActivate={} /> right={…} />
// this loses some type safety but adds support for dynamic values without a complete rerender
export default function swipeActionSet(props: {
    left_stop: Stop,
    right_stop: Stop,
}): {
    background: (offset: Accessor<number>) => JSX.Element,
    onRelease: (offset: number) => void,
} {
    return {
        background: value => {
            const stop = createMemo(() => value() < 0 ? props.right_stop : props.left_stop);
            const isRightSide = createMemo(() => value() < 0);
            const stop1Activated = createMemo(() => Math.abs(value()) > 100);
            // consider making a bounce animation when the user drags past the stop
            // kinda complicated, you have to detect the rising edge of a boolean and then
            // `.transition = ""` `.transform = scale(1.5)` `.offsetWidth` `.transition = "0.1s transform"`
            //
            // might be able to do it by triggering a css animation actually. that should work. i'll do that
            return <div class={
                colorBackground(stop().color, stop1Activated()) + " w-full h-full relative"
            }>
                <div class="absolute w-100px h-full flex items-center justify-center" style={{
                    ...isRightSide() ? {right: "-100px"} : {left: "-100px"},
                    transform: "translateX("+(value())+"px)",
                }}>
                    <div class={stop1Activated() ? "bounceanim" : ""}>
                        <Icon
                            icon={stop().icon}
                            bold={stop1Activated()}
                            label={null}
                        />
                    </div>
                </div>
            </div>;
        },
        onRelease: value => {
            if(value < -100) {
                props.right_stop.onActivate();
            }
            if(value > 100) {
                props.left_stop.onActivate();
            }
        },
    };
}