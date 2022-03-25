import { JSX } from "solid-js";
import { AnNode, anSetReconcile, anString, JSON } from "../app_data";
import { Button, Buttons } from "../components";
import { asObject } from "../guards";
import { AnFor, Collapsible, StringEditor } from "../Schemaless";
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

    link_categories: Ar<null>,
};
export type OrganizerRoot = {
    all_categories: Ar<Category>,
    all_items: Ar<Item>,
};

function Category(props: {id: string, root: AnNode<OrganizerRoot>}): JSX.Element {
    const node = props.root.all_categories[props.id]!;
    return <Collapsible anchor={node} preview={<>
        {anString(node.description)}
    </>}>
        <div class="space-y-2">
            <StringEditor node={node.description} />
            <AnFor node={node.link_categories}>{(__, key) => <>
                <Category id={key} root={props.root} />
            </>}</AnFor>
            <Buttons>
                <Button onClick={() => {
                    anSetReconcile(node.link_categories, pv => {
                        return {...asObject(pv) as {[key: string]: null} ?? {}, [uuid()]: null};
                    });
                }}>+ Add Category</Button>
                <Button>+ Add Item</Button>
            </Buttons>
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