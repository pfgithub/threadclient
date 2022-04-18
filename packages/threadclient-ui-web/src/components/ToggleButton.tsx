import { RadioGroup, RadioGroupLabel, RadioGroupOption } from "solid-headless";
import { For, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import createExclusiveFlipSelector from "./createExclusiveFlipSelector";

export default function ToggleButton<T extends string>(props: {
    value: T | undefined,
    setValue: (nv: T | undefined) => string | undefined,
    choices: [id: T, text: JSX.Element][], // or we can use a typesafe children instead
}): JSX.Element {
    const ef = createExclusiveFlipSelector(() => props.value);

    return <RadioGroup
        value={props.value as string | undefined}
        onChange={(nv: string | undefined) => props.setValue(nv as T | undefined)}
    >
        {/*there's supposed to be a <RadioGroupLabel> here but we don't have one*/
        }
        <div class="flex flex-row gap-1 rounded-md bg-slate-400 dark:bg-zinc-700 p-1 shadow-inner">
            <For each={props.choices}>{choice => <>
                <RadioGroupOption
                    value={choice[0]}
                    class={"block relative px-2 group select-none cursor-pointer"}
                >
                    <Show if={ef.if(choice[0])}>
                        <div
                            ref={ef.ref}
                            class="
                                absolute top-0 left-0 w-full h-full
                                rounded-md bg-slate-100 dark:bg-zinc-500 shadow
                                group-focus-visible-outline-default
                            "
                        />
                    </Show>
                    <RadioGroupLabel class="relative z-1">{choice[1]}</RadioGroupLabel>
                </RadioGroupOption>
            </>}</For>
        </div>
    </RadioGroup>;
}