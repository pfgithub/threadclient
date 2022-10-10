import { createContext } from "solid-js";
import { createTypesafeChildren } from "tmeta-util-solid";
import { GoalContext } from "./Margin";
import type { StackChild } from "./Stack";

export const StackChildRaw = createTypesafeChildren<StackChild>();

const default_goal: GoalContext = {pt: 0, pb: 0, pl: 0, pr: 0};
export const goal_provider = createContext<GoalContext>(default_goal);

if(import.meta.hot) {
    // TODO move const nodecontext into its own file and only do this there
    import.meta.hot.accept((new_module) => {
        alert("cannot reload symbols.");
    });
}