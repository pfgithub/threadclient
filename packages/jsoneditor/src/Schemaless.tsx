import { createSelector, For, JSX, untrack } from "solid-js";
import { Show } from "tmeta-util-solid";
import {
    anBool, anCommitUndoGroup, anCreateUndoGroup, anKeys, AnNode,
    anRoot, anSetReconcile, anSetReconcileIncomplete, anString,
    UndoGroup
} from "./app_data";
import { Button, Buttons } from "./components";
import { DragButton, DraggableList } from "./DraggableList";
import { asObject, unreachable } from "./guards";
import { Tab, Tabs } from "./Tabs";
import { Richtext, RichtextEditor } from "./TextEditor";
import { getUIState } from "./ui_state";
import { uuid } from "./uuid";

export function HeadingValue(props: {
    title: string,
    children?: undefined | JSX.Element,
}): JSX.Element {
    return <div>
        <div>{props.title}</div>
        <div class="pl-2 border-l-[0.5rem] border-gray-700">
            {props.children}
        </div>
    </div>;
}

export function StringEditor(props: {node: AnNode<string>}): JSX.Element {
    let undo_group: UndoGroup | null = null;
    return <div>
        <Show
            if={anString(props.node) != null}
            fallback={<Buttons>
                <Button onClick={() => anSetReconcile(props.node, () => "")}>Create String</Button>
            </Buttons>}
        >
            <input
                type="text"
                class="w-full bg-gray-700 rounded-sm px-1"
                value={anString(props.node) ?? ""}
                // onChange here maybe?
                onInput={e => {
                    if(!undo_group) {
                        undo_group = anCreateUndoGroup();
                        anCommitUndoGroup(anRoot(props.node), undo_group);
                    }
                    anSetReconcile(props.node, () => e.currentTarget.value, {undo_group});
                }}
                onChange={() => {
                    undo_group = null;
                }}
            />
        </Show>
    </div>;
}

export function BoolEditor(props: {node: AnNode<boolean>}): JSX.Element {
    const selector = createSelector(() => anBool(props.node));
    return <Buttons>
        <Button
            onClick={() => anSetReconcileIncomplete(props.node, v => v === true ? null : true)}
            active={selector(true)}
        >On</Button>
        <Button
            onClick={() => anSetReconcileIncomplete(props.node, v => v === false ? null : false)}
            active={selector(false)}
        >Off</Button>
    </Buttons>;
}

export function AnFor<T>(props: {
    node: AnNode<{[key: string]: T}>,
    children: (node: AnNode<T>, key: string, root: AnNode<{[key: string]: T}>) => JSX.Element,
}): JSX.Element {
    return <For each={anKeys(props.node)}>{key => <>
        {(() => {
            const root = props.node; // tracks props.node
            const node = root[key]!; // doesn't track anything
            return untrack(() => props.children(node, key, root));
        })()}
    </>}</For>;
}

function ListEditor<T>(props: {
    node: AnNode<{[key: string]: T}>,
    children: (node: AnNode<T>) => JSX.Element,
}): JSX.Element {
    return <div><DraggableList
        items={anKeys(props.node)}
        setItems={cb => {
            anSetReconcile(props.node, v => {
                const pv = asObject(v) ?? {};
                const nv = cb(Object.keys(pv));
                return Object.fromEntries(nv.map(key => [key, pv[key]! as T]));
            });
        }}
        wrapper_class="pt-2 first:pt-0"
        nodeClass={() => ""}
    >{(key, dragging) => {
        return <div class={"transition-opacity " + (dragging() ? "opacity-80 rounded-md relative shadow-md" : "")}>
            <Show if={dragging()}>
                <div class="absolute w-full h-full p-2 -mt-2 -ml-2 box-content bg-gray-900 rounded-md"></div>
            </Show>
            <div class={"flex flex-row flex-wrap gap-2 "+(dragging() ? "relative z-10" : "")}>
                <DragButton class={"p-2 rounded-md "+(dragging() ? "bg-gray-500" : "bg-gray-700")}>≡</DragButton>
                {(() => {
                    const node = props.node;
                    return untrack(() => props.children(node[key]!));
                })}
            </div>
        </div>;
    }}</DraggableList></div>;
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

function PersonEditor(props: {node: AnNode<Person>}): JSX.Element {
    return <>
        <HeadingValue title="name">
            <StringEditor node={props.node.name} />
        </HeadingValue>
        <HeadingValue title="description">
            <StringEditor node={props.node.description} />
        </HeadingValue>
        <HeadingValue title="attributes">
            TODO
        </HeadingValue>
        <HeadingValue title="tags">
            TODO
        </HeadingValue>
    </>;
}

function Demo1Editor(props: {node: AnNode<Demo1>}): JSX.Element {
    return <>
        <div class="space-y-2">
            <HeadingValue title="people">
                <Tabs selection={getUIState(props.node, "-MyT2dMV6gueGDtP8Pjk", () => null)}>
                    <AnFor node={props.node.people}>{(person, key) => <>
                        <Tab key={key} title={anString(person.name) ?? key}>
                            <PersonEditor node={person} />
                        </Tab>
                    </>}</AnFor>
                    <Tab title={"+"} onClick={() => {
                        const new_id = uuid();
                        anSetReconcile(props.node.people, (v): {[key: string]: Person} => ({
                            ...(v != null && typeof v === "object" ? v : {}),
                            [new_id]: undefined as unknown as Person,
                        }));
                        return new_id;
                    }} />
                </Tabs>
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

// function With<T>(props: {value: T, children: (v: T) => JSX.Element})
// equivalent to <>{() => {const value = …; return untrack(() => )}}

function ButtonsEditor(props: {node: AnNode<{[key: string]: Button}>}): JSX.Element {
    return <div class="space-y-2">
        <ListEditor node={props.node}>{node => (
            <div class="space-y-2 flex-1">
                <StringEditor node={node.name} />
                <StringEditor node={node.id} />
            </div>
        )}</ListEditor>
        <Buttons><Button onClick={() => anSetReconcileIncomplete<Button>(props.node[uuid()]!, pv => {
            console.log("onclick", props.node, pv);
            if(pv != null) unreachable();
            return {};
        })}>+</Button></Buttons>
    </div>;
}

function RebindEditor(props: {node: AnNode<Rebind>}): JSX.Element {
    return <Tabs selection={getUIState(props.node, "-MyT2Tal3z7dM8rw3WCb", () => null)}>
        <Tab key="-MyOCtdMuvfiPHZ0GCN5" title="buttons" data={props.node.buttons}>{buttons => <>
            {/* TODO HSplit I think */}
            <Tabs selection={getUIState(buttons, "-MyT2W5uqBcPDOOicF6m", () => null)}>
                <Tab key="-MyOCyh-4puuqyb8l94D" title="input" data={buttons.input}>{input => <>
                    <ButtonsEditor node={input} />
                </>}</Tab>
                <Tab key="-MyOCzRenRGIaNHeiyOk" title="output" data={buttons.output}>{output => <>
                    <ButtonsEditor node={output} />
                </>}</Tab>
            </Tabs>
        </>}</Tab>
        <Tab key="-MyOCuTiivRBu_dkvEFN" title="scenes">
            pick default scene
        </Tab>
    </Tabs>;
}

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

export default function Schemaless(props: {node: AnNode<Schema>}): JSX.Element {
    return <>
        <Tabs selection={getUIState(props.node, "-MyT2DloSFkzpMNrgAWd", () => null)}>
            <Tab key="-MyOD-qlo6NuV_DvBe6p" title="demo1">
                <Demo1Editor node={props.node.demo1} />
            </Tab>
            <Tab key="-MyOD0x2OswdIjxAlZj-" title="rebind">
                <RebindEditor node={props.node.rebind} />
            </Tab>
            <Tab key="-MyOD25ohIuD1cYu9KP7" title="clicker">
                clicker
            </Tab>
            <Tab key="-MyOD455svt6gn_pnpsn" title="text_editor">
                <RichtextEditor node={props.node.text_editor} />
            </Tab>
            <Tab key="-MyOD5Bx2tHatgIAyvV2" title="schema">
                schema
            </Tab>
        </Tabs>
    </>;
}