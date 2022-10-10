import { JSX, useContext } from "solid-js";
import { goal_provider } from "./noreload_symbols";
import { distUnit } from "./units";

export type GoalContext = {
    pt: number,
    pb: number,
    pl: number,
    pr: number,
};

export function Goal(props: {
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

export function Content(props: {children: JSX.Element}): JSX.Element {
    const parent_goal = useContext(goal_provider);
    return <div style={{
        'padding': `${distUnit(parent_goal.pt)} ${distUnit(parent_goal.pr)} ${distUnit(parent_goal.pb)} ${distUnit(parent_goal.pl)}`,
    }}>
        <goal_provider.Provider value={{pt: 0, pb: 0, pl: 0, pr: 0}}>
            {props.children}
        </goal_provider.Provider>
    </div>;
}