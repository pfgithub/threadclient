import { JSX } from "solid-js";


/*
vertical:
*/

export type NuitProps = {
    kind: "vertical",
} | {
    kind?: undefined,
};

// vertical:
// grid
// margin_left: 1rem, main_content: 1fr, margin_right: 1rem
// * how to collapse padding into eachother
// var(--margin-top: ), var(--margin-bottom: )

// grid gl-2 gr-2

/*
for vertical, it uses a grid along with variables for padding
all children except children with the C-fullscreen class are set mt-[gap] mb-[gap]
first:mt-[top_margin] last:mb-[bottom_margin] pl-[gap] pr-[gap]

using '.C-vertical > *:not(.C-fullscreen)' to not require the children to do anything special
*/

export function C(props: NuitProps): JSX.Element {
    return <div class={"C-"+props.kind}></div>;
}

export default function Nuit(): JSX.Element {
    return <C kind="vertical"></C>;
}