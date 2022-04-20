import { RadioGroup, RadioGroupLabel, RadioGroupOption } from "solid-headless";
import { createEffect, createMemo, For, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { uuid } from "../router";
import createExclusiveFlipSelector from "./createExclusiveFlipSelector";

export default function ToggleButton<T>(props: {
    value: T,
    setValue: (nv: T | undefined) => void,
    choices: [data: T, text: JSX.Element][], // or we can use a typesafe children instead
}): JSX.Element {
    // huh, it looks like this mess shouldn't be necessary.
    // https://github.com/solidjs/solid/issues/947
    // headless seems to ssupport any value of T already
    type CMV = {
        fwd: Map<T, string>,
        rev: Map<string, T>,
    };
    const choiceMap = createMemo((prev: CMV | undefined): CMV => {
        const fwd = new Map();
        for(const choice of props.choices) {
            fwd.set(choice[0], prev?.fwd.get(choice[0]) ?? uuid());
        }
        const rev = new Map([...fwd.entries()].map(nt => [nt[1], nt[0]] as const));
        return {fwd, rev};
    }, undefined);

    const itmkey = (itm: T) => choiceMap().fwd.get(itm);
    const mainvalue = createMemo(() => itmkey(props.value));

    createEffect(() => {
        console.log("[!]MAINVALUE IS", mainvalue(), "CHOICES:", choiceMap());
    });

    const ef = createExclusiveFlipSelector(() => mainvalue());

    return <RadioGroup
        value={mainvalue()}
        onChange={(nv: string | undefined) => {
            props.setValue(nv != null ? choiceMap().rev.get(nv) : undefined);
            return nv;
        }}
    >
        {/*there's supposed to be a <RadioGroupLabel> here but we don't have one*/
        }
        <div class="flex flex-row flex-wrap gap-1 rounded-md bg-slate-400 dark:bg-zinc-700 p-1 shadow-inner">
            <For each={props.choices}>{choice => <>
                <RadioGroupOption
                    value={itmkey(choice[0])}
                    class={"block relative px-2 group select-none cursor-pointer"}
                >
                    <Show if={ef.if(itmkey(choice[0]))}>
                        <div
                            ref={ef.ref}
                            class="
                                absolute top-0 left-0 w-full h-full
                                rounded-md bg-slate-100 dark:bg-zinc-500 shadow
                                group-focus-visible-outline-default
                            "
                        />
                    </Show>
                    <RadioGroupLabel class="cursor-pointer relative z-1">{choice[1]}</RadioGroupLabel>
                </RadioGroupOption>
            </>}</For>
        </div>
    </RadioGroup>;
}