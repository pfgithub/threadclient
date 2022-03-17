import { createSelector, createSignal, For, JSX, untrack } from "solid-js";
import { createTypesafeChildren, Show } from "tmeta-util-solid";
import { Button, Buttons } from "./components";

type Tab = {
    buttonComponent: (props: {
        selected: boolean,
        setSelected(cb: (pv: boolean) => boolean): void,
    }) => JSX.Element,
    children: JSX.Element,
};
const TabRaw = createTypesafeChildren<Tab>();
export function Tabs(props: {
    children: JSX.Element,
}): JSX.Element {
    const [selection, setSelection] = createSignal<Tab | null>(null);
    const isSelected = createSelector(selection);

    const tabs = TabRaw.useChildren(() => props.children);

    return <div>
        <Buttons>
            <For each={tabs()}>{tab => <>
                {untrack(() => tab.buttonComponent({
                    get selected() {
                        return isSelected(tab);
                    },
                    setSelected(cb) {
                        setSelection(v => {
                            return cb(v === tab) ? tab : null;
                        });
                    },
                }))}
            </>}</For>
        </Buttons>
        <Show when={selection()}>{selxn => <div class="mt-2">
            {selxn.children}
        </div>}</Show>
    </div>;
}
export function Tab<T>(props: {
    title: JSX.Element,
    children?: JSX.Element,
    onClick?: () => void,
} | {
    title: JSX.Element,
    data: T,
    children: (v: T) => JSX.Element,
    onClick?: () => void,
}): JSX.Element {
    return <TabRaw
        buttonComponent={btnprops => {
            return <Button
                onClick={props.onClick ?? (() => btnprops.setSelected(v => !v))}
                active={btnprops.selected}
            >
                {props.title}
            </Button>;
        }}
        children={<>{(() => {
            if('data' in props) {
                const data = props.data;
                return untrack(() => props.children(data));
            }
            return untrack(() => props.children);
        })()}</>}
    />;
}