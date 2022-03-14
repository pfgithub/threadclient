import { JSX } from "solid-js";
import { AnNode } from "./app_data";
import { Settings as SettingsTy } from "./editor_data";
import { BoolEditor, HeadingValue } from "./Schemaless";

export default function Settings(props: {node: AnNode<SettingsTy>}): JSX.Element {
    return <div class="space-y-2">
        <HeadingValue title="highlight updates">
            <BoolEditor node={props.node.highlight_updates} />
        </HeadingValue>
    </div>;
}