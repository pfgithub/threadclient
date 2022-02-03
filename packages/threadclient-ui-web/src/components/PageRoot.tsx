import type * as Generic from "api-types-generic";
import {
    For, JSX
} from "solid-js";
import { getWholePageRootContext } from "../util/utils_solid";
import { createMergeMemo } from "./createMergeMemo";
import { CollapseData, flatten } from "./flatten";
import PageFlatItem from "./PageFlatItem";

export type ClientPageProps = {
    pivot: Generic.Link<Generic.Post>,
};
export default function ClientPage(props: ClientPageProps): JSX.Element {
    // [!] we'll want to fix this up and make it observable and stuff
    // now that page2 is ready to be properly observable, flatten should be too.

    const collapse_data: CollapseData = {
        map: new Map(),
    };

    const hprc = getWholePageRootContext();

    const view = createMergeMemo(() => {
        console.log("Reloading data!");
        return flatten(props.pivot, {
            collapse_data,
            content: hprc.content(),
        });
    }, {key: "id", merge: true});

    return <div class="m-4 <sm:mx-0">
        <For each={view.data.body}>{item => (
            <PageFlatItem
                item={/*@once*/item}
                collapse_data={/*@once*/collapse_data}
            />
        )}</For>
    </div>;
}