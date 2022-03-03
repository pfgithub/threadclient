import { children, createSelector, createSignal, For, untrack } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { Show } from "tmeta-util-solid";
import { object, setReconcile, State, StateObject } from "./app_data";
import { Button } from "./components";
import { ContextData, getState } from "./editor_data";
import { asObject, asString, isObject, isString } from "./guards";
import { RichtextEditor } from "./TextEditor";
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
                console.log("bad tabs child", v);
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

function linkRoot(cxd: ContextData, link: UUID): State {
    return cxd.state.getKey("data" as UUID).getKey(link);
}

function StringEditor(props: {state: State}): JSX.Element {
    return <div>
        <Show
            if={isString(props.state())}
            fallback={(
                <Button onClick={() => setReconcile(props.state, () => "")}>Create String</Button>
            )}
        >
            <input
                type="text"
                class="w-full bg-gray-700 rounded-sm px-1"
                value={asString(props.state()) ?? ""}
                // onChange here maybe?
                onInput={e => setReconcile(props.state, () => e.currentTarget.value)}
            />
        </Show>
    </div>;
}

/// -------------------
/// -------------------
/// ---[ user code ]---
/// -------------------
/// -------------------

const person_link = "<!>person" as UUID; 

function PersonEditor(props: {state: State}): JSX.Element {
    return <ObjectEditor state={props.state}>{obj => <>
        <HeadingValue title="name">
            <StringEditor state={obj["<!>name" as UUID]} />
        </HeadingValue>
        <HeadingValue title="description">
            <StringEditor state={obj["<!>description" as UUID]} />
        </HeadingValue>
        <HeadingValue title="attributes">
            TODO
        </HeadingValue>
        <HeadingValue title="tags">
            TODO
        </HeadingValue>
    </>}</ObjectEditor>;
}

function Demo1Editor(props: {state: State}): JSX.Element {
    const cxd = getState();
    return <ObjectEditor state={props.state}>{obj => <>
        <div class="space-y-2">
            <HeadingValue title="people">
                <ObjectEditor state={linkRoot(cxd, person_link)}>{alllinks => <>
                    <Tabs>
                        <For each={Object.keys(alllinks)}>{link_key => <>
                            <Tab title={link_key}>
                                <PersonEditor state={alllinks[link_key as UUID]} />
                            </Tab>
                        </>}</For>
                    </Tabs>
                </>}</ObjectEditor>
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

// [!] if I'm going to be doing schemaless I need typed State values.
//     like State should know that it should be an object containing these
//     fields and stuff.

// basically it won't allow you to getkey a field that doesn't exist
// but it's not saying that the actual structure is guarenteed to match what the
// types say. the helper functions will still return null | [actual value] but what
// will be fun is eg asString on a thing expected to be object could error

// basically state will have a <T> thing and also links you define will have <T>
// to say what should be in them

export default function Schemaless(props: {state: State}): JSX.Element {
    return <ObjectEditor state={props.state}>{obj => <>
        <Tabs>
            <Tab title="demo1">
                <Demo1Editor state={obj["<!>demo1" as UUID]} />
            </Tab>
            <Tab title="rebind">
                rebind
            </Tab>
            <Tab title="clicker">
                clicker
            </Tab>
            <Tab title="text_editor">
                <RichtextEditor state={obj["<!>text_editor" as UUID]} />
            </Tab>
            <Tab title="schema">
                schema
            </Tab>
        </Tabs>
    </>}</ObjectEditor>;
}