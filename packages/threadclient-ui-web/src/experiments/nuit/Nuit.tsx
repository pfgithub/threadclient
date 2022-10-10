import { Accessor, createContext, createEffect, createMemo, createSignal, For, JSX, onCleanup, Signal, untrack, useContext } from "solid-js";
import { createTypesafeChildren, Show } from "tmeta-util-solid";
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

type GoalContext = {
    pt: number,
    pb: number,
    pl: number,
    pr: number,
};
const default_goal: GoalContext = {
    pt: 0,
    pb: 0,
    pl: 0,
    pr: 0,
};
const goal_provider = createContext<GoalContext>(default_goal);
// content goal size
function Goal(props: {
    pt: number,
    pb: number,
    pl: number,
    pr: number,
    // `p-${number}`: number // Reflect.ownKeys on props probably isn't tracked with solid js so this
    // could work but only for the first run - if you need dynamic, you would have to use the real props
    children: JSX.Element,
}): JSX.Element {
    const parent_goal = useContext(goal_provider);
    return <goal_provider.Provider value={{
        get pt() {return props.pt},
        get pb() {return props.pb},
        get pl() {return props.pl},
        get pr() {return props.pr},
    }}>
        {props.children}
    </goal_provider.Provider>;
}
function distUnit(num: number): string {
    return `${num * 0.25}rem`;
}
function Content(props: {children: JSX.Element}): JSX.Element {
    const parent_goal = useContext(goal_provider);
    return <div style={{
        'padding': `${distUnit(parent_goal.pt)} ${distUnit(parent_goal.pr)} ${distUnit(parent_goal.pb)} ${distUnit(parent_goal.pl)}`,
    }}>
        <goal_provider.Provider value={{pt: 0, pb: 0, pl: 0, pr: 0}}>
            {props.children}
        </goal_provider.Provider>
    </div>;
}
/*
hmm. stack is weird.
- Image
  [gap]
- [ml] text [mr]
  [gap]
- [ml] text [mr]
  [gap]
- Image
  [gap]
- [ml] text [mr]
  [mb]

is that possible?
maybe if stacks contain stack children and stack children
can say if they are fullscreen or not
*/
type StackChild = {
    fullscreen: boolean,
    content: JSX.Element,
};
const StackChildRaw = createTypesafeChildren<StackChild>();
function Stack(props: {children: JSX.Element}): JSX.Element {
    const children = StackChildRaw.useChildren(() => props.children);
    // a bit of a mess because we want to know information about the item above and below the
    // target item without rerendering n² times
    type ChInfo = {
        above_fullscreen: boolean,
        below_fullscreen: boolean,
        fullscreen: boolean,
        content: JSX.Element,
    };
    // vv we can merge these and put the signal in chinfo instead of doing two of the messy map things
    type StackData = {above_fullscreen: Signal<boolean>, below_fullscreen: Signal<boolean>};
    const ch_map = new WeakMap<StackChild, ChInfo>();
    const addCh = (v: StackChild): ChInfo => {
        const existsv = ch_map.get(v);
        if(existsv != null) return existsv;
        const data = getData(v);
        const res: ChInfo = {
            get above_fullscreen() {return data.above_fullscreen[0]()},
            get below_fullscreen() {return data.below_fullscreen[0]()},
            get fullscreen() {return v.fullscreen},
            get content() {return v.content},
        };
        ch_map.set(v, res);
        return res;
    };
    const are_edges_fullscreen = true;
    const getData = (v: StackChild): StackData => {
        const val = data_map.get(v);
        if(val == null) {
            const nv: StackData = {
                above_fullscreen: createSignal(are_edges_fullscreen),
                below_fullscreen: createSignal(are_edges_fullscreen),
            };
            data_map.set(v, nv);
            return nv;
        }
        return val;
    };
    const updateData = (v: StackChild, prev: StackChild | null, next: StackChild | null) => {
        const q = getData(v);
        q.above_fullscreen[1](prev?.fullscreen ?? are_edges_fullscreen);
        q.below_fullscreen[1](next?.fullscreen ?? are_edges_fullscreen);
    }; 
    const data_map = new WeakMap<StackChild, StackData>();
    const chWithInfo = createMemo((): ChInfo[] => {
        // !: keep the object reference the same across updates to prevent unneeded rerenders
        // !: update the data map thing
        const res: ChInfo[] = [];
        const childrenv = children();
        for(const [i, item] of childrenv.entries()) {
            const prev = childrenv[i - 1] ?? null;
            const next = childrenv[i + 1] ?? null;
            updateData(item, prev, next);
            res.push(addCh(item));
        }
        return res;
    });
    // useChildren(props.children)
    // loop over children
    // display with the correct goals

    // target goals:
    // - for fullscreen objects, make no change to goals
    // - for non-fullscreen objects:
    //   - remove the top and bottom margin goals
    //   - insert a gap above equal to min(top, bottom)
    //   - if(below_fullscreen): insert a gap below equal to min(top, bottom)
    return <div>
        <For each={chWithInfo()}>{child => {
            const parent_goals = useContext(goal_provider);
            const gap = () => Math.min(parent_goals.pt, parent_goals.pb);
            return <goal_provider.Provider value={{
                get pt() {if(child.fullscreen) return parent_goals.pt; else return 0},
                get pb() {if(child.fullscreen) return parent_goals.pb; else return 0},
                get pl() {return parent_goals.pl},
                get pr() {return parent_goals.pr},
            }}>
                <Show if={!child.fullscreen}>
                    <div style={{'padding-top': distUnit(gap())}} />
                </Show>
                {child.content}
                <Show if={!child.fullscreen && child.below_fullscreen}>
                    <div style={{'padding-bottom': distUnit(gap())}} />
                </Show>
            </goal_provider.Provider>;
        }}</For>    
    </div>;
}
/// fullscreen objects do not combine mt/mb of surrounding elements.
function Item(props: {fullscreen?: undefined | boolean, children: JSX.Element}): JSX.Element {
    return <StackChildRaw fullscreen={props.fullscreen ?? false} content={props.children} />
}

// the goal of Nuit is to put all padding and margin at the last possible moment
export default function Nuit(): JSX.Element {
    return <div class="max-w-xl mx-auto">
        <div class="my-4 bg-zinc-800 rounded-lg">
            <Goal pt={4} pb={4} pl={4} pr={4}>
                <Stack>
                    <Item fullscreen>
                        <Content>
                            <div class="px-4 text-lg font-bold">Object Title</div>
                        </Content>
                    </Item>
                    <Item>
                        <Content>Richtext Content</Content>
                    </Item>
                    <Item>
                        <Content>Paragraph two</Content>
                    </Item>
                    <Item>
                        <Content>Paragraph three</Content>
                    </Item>
                    <Item fullscreen>
                        <div class="bg-zinc-500 h-32">
                            <Content>Embedded Image</Content>
                        </div>
                    </Item>
                    <Item>
                        <Content>Paragraph four</Content>
                    </Item>
                    <Item>
                        <div class="overflow-auto">
                            <div class="w-max">
                                <Content>
                                    <table>
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
                                    </table>
                                </Content>
                            </div>
                        </div>
                    </Item>
                </Stack>
            </Goal>
        </div>
        <div class="bg-zinc-800 my-4 rounded-lg">
            <div class="py-4 space-y-4">
                <div class="px-4 text-lg font-bold">Object Title</div>
            </div>
            <div class="bg-zinc-500 rounded-b-lg">
                <div class="p-4">image</div>
            </div>
        </div>
        <div class="bg-zinc-800 my-4 rounded-lg">
            <div class="py-4 space-y-4">
                <div class="px-4 text-lg font-bold">Object Title</div>
            </div>
            <div class="py-4 space-y-4">
                <div class="px-4">Richtext Content</div>
                <div class="px-4">Paragraph two</div>
                <div class="px-4">Paragraph three</div>
                <div class="bg-zinc-500 h-32">
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
    </div>;
}