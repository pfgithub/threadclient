import { Accessor, createEffect, JSX, onCleanup, untrack } from "solid-js";
import "./Nuit.scss";

/*
vertical:
*/

// we'll start with very explicit and then we'll upgrade to the more implicit <C vertical mx-4 /> stuff
// maybe we even use some kind of wrapper so <C> can be implemented cleanly only
// having to account for the explicit things

export type DistanceUnit = number;

export type NuitProps = ({
    kind: "vertical",

    // TODO: mx my m
    mt: DistanceUnit,
    mb: DistanceUnit,
    ml: DistanceUnit,
    mr: DistanceUnit,
    gap: DistanceUnit,
} | {
    kind: "color",
    class: string,
} | {
    kind?: undefined,
}) & {children?: undefined | JSX.Element};

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

function dynamicAttribute(node: HTMLElement, name: string, value: Accessor<string | null>): void {
    createEffect(() => {
        const v = value();
        if(v != null) {
            node.style.setProperty(name, v);
        }else{
            node.style.removeProperty(name);
        }
    });
    onCleanup(() => node.style.removeProperty(name));
}
function dynamicDistanceUnitAttribute(node: HTMLElement, name: string, value: Accessor<DistanceUnit>): void {
    dynamicAttribute(node, name, () => "" + (value() / 4) + "rem");
}

export function C(props: NuitProps): JSX.Element {
    return <div ref={itm => {
        createEffect(() => {
            const kind = props.kind;
            itm.classList.add("C-"+kind);
            onCleanup(() => itm.classList.remove("C-"+kind));
            if(kind === "vertical") {
                dynamicDistanceUnitAttribute(itm, "--c-ml", () => props.ml);
                dynamicDistanceUnitAttribute(itm, "--c-mr", () => props.mr);
                dynamicDistanceUnitAttribute(itm, "--c-mb", () => props.mb);
                dynamicDistanceUnitAttribute(itm, "--c-mt", () => props.mt);
                dynamicDistanceUnitAttribute(itm, "--c-gap", () => props.gap);
            }else if(kind === "color") {
                createEffect(() => {
                    itm.setAttribute("class", "C-"+kind + " " + props.class);
                });
                onCleanup(() => itm.removeAttribute("class"));
            }
        });
    }}>{props.children}</div>;
}

function Viewfullscreen(props: {
    children: (content: (props: {children: JSX.Element}) => JSX.Element) => JSX.Element,
}): JSX.Element {
    const Contentv = (props2: {children: JSX.Element}): JSX.Element => {
        return <>{props2.children}</>;
    };
    return <>{untrack(() => props.children(Contentv))}</>;
}

/*
what we want:
<C vertical m-4 gap-2>
    "One"
    "Two"
    [bg-zinc-500] "Three"
    "Four"
    "Five"
→
4du
    4du "One" 4du
2du
    4du "Two" 4du
4du
    zinc-500 background [
        4du
                4du "Three" 4du
        4du
    ]
4du
    4du "Four" 4du
2du
    4du "Five" 4du
4du
*/

/*
    return <C kind="vertical" mt={4} mb={4} ml={4} mr={4} gap={0}>
        <C>one</C>
        <C>two</C>
        <Viewfullscreen>{Content => (
            <C kind="color" class="bg-zinc-500">
                <Content>three</Content>
            </C>
        )}</Viewfullscreen>
        <C>four</C>
        <C>five</C>
    </C>;
*/


// the goal of Nuit is to put all padding and margin at the last possible moment
export default function Nuit(): JSX.Element {
    return <>
        <div class="max-w-xl mx-auto bg-zinc-800 my-4 rounded-lg">
            <div class="py-4 space-y-4">
                <div class="px-4 text-lg font-bold">Object Title</div>
            </div>
            <div class="bg-zinc-500">
                <div class="p-4">image</div>
            </div>
        </div>
        <div class="max-w-xl mx-auto bg-zinc-800 my-4 rounded-lg">
            <div class="py-4 space-y-4">
                <div class="px-4 text-lg font-bold">Object Title</div>
            </div>
            <div class="py-4 space-y-4">
                <div class="px-4">Richtext Content</div>
                <div class="px-4">Paragraph two</div>
                <div class="px-4">Paragraph three</div>
                <div class="bg-zinc-500">
                    <div class="p-4">Embedded Image</div>
                </div>
                <div class="px-4">Paragraph four</div>
                <div>
                    <div class="overflow-auto"><div class="w-max"><div class="px-4"><table>
                        <tbody>
                            <tr>
                                <th>T</th>
                                <th>a</th>
                                <th>b</th>
                                <th>l</th>
                                <th>e</th>
                            </tr>
                            <tr>
                                <td>Embedded</td>
                                <td>table</td>
                                <td>example</td>
                                <td>table</td>
                                <td>sample</td>
                                <td>lots</td>
                                <td>of</td>
                                <td>rows</td>
                                <td>on</td>
                                <td>our</td>
                                <td>sample</td>
                                <td>table</td>
                                <td>example</td>
                            </tr>
                        </tbody>
                    </table></div></div></div>
                </div>
                <div class="px-4">Paragraph five</div>
            </div>
        </div>
    </>;
}