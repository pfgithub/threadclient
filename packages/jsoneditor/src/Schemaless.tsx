import { children, createSelector, createSignal, For, untrack } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Show } from "tmeta-util-solid";
import { object, setReconcile, State, StateObject } from "./app_data";
import { Button } from "./components";
import { asObject, isObject } from "./guards";
import { UUID } from "./uuid";

function ObjectEditor(props: {
    state: State,
    children: (obj: StateObject) => JSX.Element,
}): JSX.Element {
    return <Show if={isObject(props.state())} fallback={(
      <div>
        <Button onClick={() => {
          setReconcile(props.state, () => object({}));
        }}>
            Create Object
        </Button>
        {" (value: "+props.state()+")"}
      </div>
    )}>
        {props.children(asObject(props.state())!)}
    </Show>;
}

const tabsym = Symbol("__is_tab");
type Tab = {
    [tabsym]: true,
    buttonComponent: (props: {
        selected: boolean,
        setSelected(cb: (pv: boolean) => boolean): void,
    }) => JSX.Element,
    children: JSX.Element,
};
function isTab(v: unknown): v is Tab {
    return v != null && typeof v === "object" && tabsym in v;
}
function Tabs(props: {
    children: JSX.Element,
}): JSX.Element {
    const [selection, setSelection] = createSignal<Tab | null>(null);
    const isSelected = createSelector(selection);

    const tabs = () => {
        let res = children(() => props.children)();
        if(!Array.isArray(res)) {
            res = [res];
        }
        return res.map((v: unknown) => {
            if(!isTab(v)) {
                throw new Error("tabs child is not tab");
            }
            return v;
        })
    };

    return <div>
        <div>
            <For each={tabs()}>{tab => (
                <>{untrack(() => tab.buttonComponent({
                    get selected() {
                        return isSelected(tab);
                    },
                    setSelected(cb) {
                        setSelection(v => {
                            return cb(v === tab) ? tab : null;
                        });
                    },
                }))}</>
            )}</For>
        </div>
        <Show when={selection()}>{selxn => <div class="mt-2">
            {selxn.children}
        </div>}</Show>
    </div>;
}
function Tab(props: {
    title: string,
    children: JSX.Element,
}): JSX.Element {
    const res: Tab = {
        [tabsym]: true,
        buttonComponent(btnprops) {
            return <Button
                onClick={() => btnprops.setSelected(v => !v)}
                active={btnprops.selected}
            >
                {props.title}
            </Button>;
        },
        children: <>{props.children}</>,
    };
    return res as unknown as JSX.Element;
}

function HeadingValue(props: {
    title: string,
    children?: JSX.Element,
}): JSX.Element {
    return <div>
        <div>{props.title}</div>
        <div class="pl-2 border-l-[0.5rem] border-gray-700">
            {props.children}
        </div>
    </div>;
}

function Demo1Editor(props: {state: State}): JSX.Element {
    return <ObjectEditor state={props.state}>{obj => <>
        <div class="space-y-2">
            <HeadingValue title="people">
                todo
            </HeadingValue>
            <HeadingValue title="root_person">
                todo
            </HeadingValue>
            <HeadingValue title="color">
                todo
            </HeadingValue>
        </div>
    </>}</ObjectEditor>;
}

export default function Schemaless(props: {state: State}): JSX.Element {
    return <ObjectEditor state={props.state}>{obj => <>
        <Tabs>
            <Tab title="demo1">
                <Demo1Editor state={props.state.getKey("<!>demo1" as UUID)} />
            </Tab>
            <Tab title="rebind">
                rebind
            </Tab>
            <Tab title="clicker">
                clicker
            </Tab>
            <Tab title="text_editor">
                text_editor
            </Tab>
            <Tab title="schema">
                schema
            </Tab>
        </Tabs>
    </>}</ObjectEditor>;
}