import { createSelector, createSignal, For, untrack } from "solid-js";
import { JSX } from "solid-js/jsx-runtime";
import { createTypesafeChildren, Show } from "tmeta-util-solid";
import { Node } from "./app_data";
import { Button } from "./components";
import { getState } from "./editor_data";
import { asObject } from "./guards";
import { Richtext, RichtextEditor } from "./TextEditor";
import { uuid, UUID } from "./uuid";

const tabsym = Symbol("__is_tab");
type Tab = {
    buttonComponent: (props: {
        selected: boolean,
        setSelected(cb: (pv: boolean) => boolean): void,
    }) => JSX.Element,
    children: JSX.Element,
};
function isTab(v: unknown): v is Tab {
    return v != null && typeof v === "object" && tabsym in v;
}
const TabRaw = createTypesafeChildren<Tab>();
function Tabs(props: {
    children: JSX.Element,
}): JSX.Element {
    const [selection, setSelection] = createSignal<Tab | null>(null);
    const isSelected = createSelector(selection);

    const tabs = TabRaw.useChildren(() => props.children);

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
    title: JSX.Element,
    children?: JSX.Element,
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
        children={<>{props.children}</>}
    />;
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

function StringEditor(props: {node: Node<string>}): JSX.Element {
    return <div>
        <Show
            if={props.node.readString() != null}
            fallback={(
                <Button onClick={() => props.node.setReconcile(() => "")}>Create String</Button>
            )}
        >
            <input
                type="text"
                class="w-full bg-gray-700 rounded-sm px-1"
                value={props.node.readString() ?? ""}
                // onChange here maybe?
                onInput={e => props.node.setReconcile(() => e.currentTarget.value)}
            />
        </Show>
    </div>;
}

/// -------------------
/// -------------------
/// ---[ user code ]---
/// -------------------
/// -------------------

// v TODO
// const person_link: LinkType<ScObject<{[key: string]: Person}>> = {
//     uuid: "<!>person" as UUID,
// };

function PersonEditor(props: {node: Node<Person>}): JSX.Element {
    return <>
        <HeadingValue title="name">
            <StringEditor node={props.node.get("name")} />
        </HeadingValue>
        <HeadingValue title="description">
            <StringEditor node={props.node.get("description")} />
        </HeadingValue>
        <HeadingValue title="attributes">
            TODO
        </HeadingValue>
        <HeadingValue title="tags">
            TODO
        </HeadingValue>
    </>;
}

function Demo1Editor(props: {node: Node<Demo1>}): JSX.Element {
    const cxd = getState();
    return <>
        <div class="space-y-2">
            <HeadingValue title="people">
                <>
                    <Tabs>
                        <For each={props.node.get("people").readKeys()}>{link_key => <>
                            <Tab title={link_key}>
                                <PersonEditor node={props.node.get("people").get(link_key)} />
                            </Tab>
                        </>}</For>
                        <Tab title={"+"} onClick={() => {
                            props.node.get("people").setReconcile((v): {[key: string]: Person} => ({
                                ...(v != null && typeof v === "object" ? v : {}),
                                [uuid()]: undefined as any,
                            }));
                        }} />
                    </Tabs>
                </>
            </HeadingValue>
            <HeadingValue title="root_person">
                todo
            </HeadingValue>
            <HeadingValue title="color">
                todo
            </HeadingValue>
        </div>
    </>;
}

type Button = {
    name: string,
    id: string,
};
type Scene = {
    name: string,
    button_map: {[key: string]: Actions},
};
type Actions = {
    [key: string]: Action,
};
type Action = {
    __todo: string,
};
type Rebind = {
    buttons: {
        input: {[key: string]: Button},
        output: {[key: string]: Button},
    },
    scenes: {[key: string]: Scene},
    default_scene: string,
};

function RebindEditor(props: {node: Node<Rebind>}): JSX.Element {
    const cxd = getState();
    return <>TODO</>;
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

// ok so the idea herevv
// we will define schema types and then define the editor
// if we want to though, we will be able to make an AutoEditor that infers
// schema based on what you provide it.

type Person = {
    name: string,
    description: string,
};
type Demo1 = {
    people: {[key: string]: Person},
    // root_person: ScLink<typeof person_link>, // TODO
};
type Schema = {
    demo1: Demo1,
    rebind: Rebind,
    text_editor: Richtext,
};

export default function Schemaless(props: {node: Node<Schema>}): JSX.Element {
    return <>
        <Tabs>
            <Tab title="demo1">
                <Demo1Editor node={props.node.get("demo1")} />
            </Tab>
            <Tab title="rebind">
                <RebindEditor node={props.node.get("rebind")} />
            </Tab>
            <Tab title="clicker">
                clicker
            </Tab>
            <Tab title="text_editor">
                <RichtextEditor state={props.node.get("text_editor")} />
            </Tab>
            <Tab title="schema">
                schema
            </Tab>
        </Tabs>
    </>;
}