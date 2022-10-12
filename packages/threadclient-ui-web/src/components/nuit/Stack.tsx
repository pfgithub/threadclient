import {createMemo, createSignal, For, JSX, Signal, useContext} from "solid-js";
import { Show } from "tmeta-util-solid";
import { goal_provider, StackChildRaw } from "./noreload_symbols";
import { distUnit } from "./units";

export type StackChild = {
    kind: "item",
    fullscreen: boolean,
    fillrem: boolean,
    content: JSX.Element,
};

export function Stack(props: {dir: "v" | "h", gap?: undefined | number, children: JSX.Element}): JSX.Element {
    const children = StackChildRaw.useChildren(() => props.children);

    const parent_goals = useContext(goal_provider);
    const maxpmain = () => props.dir === "v" ? (
        Math.min(parent_goals.pt, parent_goals.pb)
    ) : (
        Math.min(parent_goals.pl, parent_goals.pr)
    );
    const gapmain = () => props.gap ?? 0;

    // a bit of a mess because we want to know information about the item above and below the
    // target item without rerendering n² times
    // - cleanup instructions:
    //   - ChInfo describes the object to render
    //   - StackData describes all the info required to calculate values for ChInfo
    //   - we should make a fn to, given a StackChild and SackData, return a ChInfo made of getters
    //   - we should abstract out the WeakMap handling into a tool specifically designed for these signal caches
    //     because we need them all the time. it could even possibly use a map with explicit removal.
    type ChInfo = {
        pbefore: number, // child.fullscreen ? above_fullscreen ? props.gap : max() : 0
        pafter: number, // !child.fullscreen && child.below_fullscreen ? props.gap : 0
        fullscreen: boolean,
        fillrem: boolean,
        content: JSX.Element,
    };
    type StackData = {above_fullscreen: Signal<boolean>, below_fullscreen: Signal<boolean>};
    const ch_map = new WeakMap<StackChild, ChInfo>();
    const addCh = (v: StackChild): ChInfo => {
        const existsv = ch_map.get(v);
        if(existsv != null) return existsv;
        const data = getData(v);
        const res: ChInfo = {
            get pbefore() {return !v.fullscreen ? data.above_fullscreen[0]() ? maxpmain() : gapmain() : 0},
            get pafter() {return !v.fullscreen ? data.below_fullscreen[0]() ? maxpmain() : 0 : 0},
            get fullscreen() {return v.fullscreen},
            get fillrem() {return v.fillrem},
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
        const childrenv = children() ?? [];
        for(const [i, item] of childrenv.entries()) {
            const prev = childrenv[i - 1] ?? null;
            const next = childrenv[i + 1] ?? null;
            updateData(item, prev, next);
            res.push(addCh(item));
        }
        return res;
    });

    return <div class={"flex " + (props.dir === "v" ? "flex-col" : "flex-row flex-wrap") + " "}>
        <For each={chWithInfo()}>{child => {
            return <>
                <Show if={child.pbefore != 0}>
                    <div style={props.dir === "v" ? {'padding-top': distUnit(child.pbefore)} : {'padding-left': distUnit(child.pbefore)}} />
                </Show>
                <div class={child.fillrem ? "flex-1 " + (props.dir === "v" ? " h-0 " : " w-0 ") : (props.dir === "v" ? " w-auto " : " h-auto ")}>
                    <goal_provider.Provider value={{
                        get pt() {if(props.dir === "v") if(child.fullscreen) return parent_goals.pt; else return 0; else return parent_goals.pt},
                        get pb() {if(props.dir === "v") if(child.fullscreen) return parent_goals.pb; else return 0; else return parent_goals.pb},
                        get pl() {if(props.dir === "v") return parent_goals.pl; else if(child.fullscreen) return parent_goals.pl; else return 0},
                        get pr() {if(props.dir === "v") return parent_goals.pr; else if(child.fullscreen) return parent_goals.pr; else return 0},
                    }}>
                        {child.content}
                    </goal_provider.Provider>
                </div>
                <Show if={child.pafter != 0}>
                    <div style={props.dir === "v" ? {'padding-top': distUnit(child.pafter)} : {'padding-left': distUnit(child.pafter)}} />
                </Show>
            </>;
        }}</For>    
    </div>;
}
/// fullscreen objects do not combine mt/mb of surrounding elements.
export function Item(props: {fullscreen?: undefined | boolean, fillrem?: undefined | boolean, children: JSX.Element}): JSX.Element {
    return <StackChildRaw
        kind="item"
        fullscreen={props.fullscreen ?? false}
        fillrem={props.fillrem ?? false}
        content={props.children}
    />
}
// /// for specifying a custom gap between two nodes. the max of all gaps between two nodes will
// /// be used as the final gap size. eg I1 gap-2 gap-4 gap-2 I2 : gap-4 will be used
// function Igap(): JSX.Element {
//     // return <StackChildRaw kind="igap" />;
//     return <></>;
// }