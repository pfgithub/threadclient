import {JSX} from "solid-js";
import * as Generic from "api-types-generic";

// click a link to focus it
// - * adds a history breadcrumb
export default function ExplorerView(props: {
    pivot: Generic.Link<Generic.Post>,
}): JSX.Element {
    return <div>
        explorer view
    </div>;
}