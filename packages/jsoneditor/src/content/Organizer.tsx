import { createSignal, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { AnNode, anSetReconcile, anString, JSON } from "../app_data";
import { Button, Buttons } from "../components";
import { asObject } from "../guards";
import { AnFor, Collapsible, SetForceCollapse, StringEditor } from "../Schemaless";
import { uuid } from "../uuid";

type Ar<T extends JSON> = {[key: string]: T}; 

type Category = {
    description: string,

    link_categories: Ar<null>,
    link_items: Ar<null>,
};
type Item = {
    title: string,
    description: string,
    image: {hash: string, ext: string},
    url: string,

    // link_categories: Ar<null>, // TODO: two way linking
};
export type OrganizerRoot = {
    all_categories: Ar<Category>,
    all_items: Ar<Item>,
};

function Item(props: {id: string, root: AnNode<OrganizerRoot>}): JSX.Element {
    const node = props.root.all_items[props.id]!;
    return <Collapsible anchor={node} preview={<>
        {anString(node.title)}
    </>}>
        <div class="flex flex-row gap-2 flex-wrap">
            <div
                // TODO should be a drop area for files
                class="block w-20 h-20 bg-gray-900 rounded-md hover:opacity-50"
                onclick={() => {
                    const newv = prompt("Image URL", anString(node.image.hash) ?? "");
                    if(newv != null) anSetReconcile(node.image.hash, () => newv);
                }}
                children={<img
                    src={anString(node.image.hash) ?? ""}
                    class="max-w-full max-h-full rounded-md m-auto"
                />}
            />
            <div class="flex-1 space-y-2">
                <StringEditor node={node.title} />
                <StringEditor node={node.description} long />
                <div class="flex flex-row gap-2 flex-wrap">
                    <div>URL: </div>
                    <div class="flex-1"><StringEditor node={node.url} /></div>
                </div>
            </div>
        </div>    
    </Collapsible>;
}

function Category(props: {id: string, root: AnNode<OrganizerRoot>}): JSX.Element {
    const node = props.root.all_categories[props.id]!;
    const [editing, setEditing] = createSignal(false);
    return <Collapsible anchor={node} preview={<>
        {anString(node.description)}
    </>}>
        <div class="space-y-2">
            <div class="flex flex-row gap-2 flex-wrap">
                <div class="flex-1"><StringEditor node={node.description} /></div>
                <Buttons>
                    <Button onClick={() => setEditing(v => !v)}>{editing() ? "Done" : "Edit"}</Button>
                </Buttons>
            </div>
            <SetForceCollapse value={editing()}>
                <AnFor node={node.link_categories}>{(__, key) => <>
                    <Category id={key} root={props.root} />
                </>}</AnFor>
                <AnFor node={node.link_items}>{(__, key) => <>
                    <Item id={key} root={props.root} />
                </>}</AnFor>
            </SetForceCollapse>
            <Show if={editing()}
                // TODO these look horrible we want a nicer way to insert them
            ><Buttons>
                <Button onClick={() => {
                    anSetReconcile(node.link_categories, pv => {
                        return {...asObject(pv) as {[key: string]: null} ?? {}, [uuid()]: null};
                    });
                }}>+ Add Category</Button>
                <Button onClick={() => {
                    anSetReconcile(node.link_items, pv => {
                        return {...asObject(pv) as {[key: string]: null} ?? {}, [uuid()]: null};
                    });
                }}>+ Add Item</Button>
            </Buttons></Show>
        </div>    
    </Collapsible>;
}

export default function Organizer(props: {
    node: AnNode<OrganizerRoot>,
}) {
    return <div>
        <Category id={"@ROOT"} root={props.node} />
    </div>;
}