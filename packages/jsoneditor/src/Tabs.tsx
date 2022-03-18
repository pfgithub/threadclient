import { createSelector, For, JSX, Signal, untrack } from "solid-js";
import { createTypesafeChildren, Show } from "tmeta-util-solid";
import { Button, Buttons } from "./components";

type Tab = {
    key: string,
    buttonComponent: (props: {
        key: string,
        selected: boolean,
        setSelected(cb: (pv: boolean) => string | null): void,
    }) => JSX.Element,
    children: JSX.Element,
};
const TabRaw = createTypesafeChildren<Tab>();
export function Tabs(props: {
    children: JSX.Element,
    selection: Signal<string | null>, // [!] not reactive
}): JSX.Element {
    const [selection, setSelection] = props.selection;
    const isSelected = createSelector(selection);

    const tabs = TabRaw.useChildren(() => props.children);

    return <div>
        <Buttons>
            <For each={tabs()}>{tab => <>
                {untrack(() => tab.buttonComponent({
                    get key() {
                        return tab.key;
                    },
                    get selected() {
                        return isSelected(tab.key);
                    },
                    setSelected(cb) {
                        setSelection(v => {
                            return cb(v === tab.key);
                        });
                    },
                }))}
            </>}</For>
        </Buttons>
        <Show when={selection()}>{selxn => <div class="mt-2">
            {(() => {
                const res = tabs().find(tab => tab.key === selxn);
                if(!res) return "*Tab closed*";
                return res.children;
            })()}
        </div>}</Show>
    </div>;
}
let unused_key = 0;
export function Tab<T>(props: {
    title: JSX.Element,
    key: string,
    children: JSX.Element,
} | {
    title: JSX.Element,
    key: string,
    data: T,
    children: (v: T) => JSX.Element,
} | {
    title: JSX.Element,
    onClick: () => string | null,
}): JSX.Element {
    // no {...} support in props
    if('onClick' in props) return <TabRaw
        key={"" + ++ unused_key}
        buttonComponent={(btnprops) => {
            return <Button
                onClick={() => {
                    btnprops.setSelected(() => props.onClick());
                }}
                active={false}
            >
                {props.title}
            </Button>;
        }}
        children={<>[ENEVER]</>}
    />;
    return <TabRaw
        key={props.key}
        buttonComponent={btnprops => {
            return <Button
                onClick={(() => btnprops.setSelected(v => v ? null : btnprops.key))}
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