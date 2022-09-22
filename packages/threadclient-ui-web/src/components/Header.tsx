import * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { bioRender } from "../page1";
import { SolidToVanillaBoundary } from "./LinkHelper";
import { ClientPostOpts } from "./Post";

export default function Header(props: {
    header: Generic.RedditHeader,
    opts: ClientPostOpts,
}): JSX.Element {
    return <div>
        <SolidToVanillaBoundary getValue={(hsc) => {
            const resdiv = document.createElement("div");
            const res = bioRender(props.header, resdiv);
            res.defer(hsc);
            return resdiv;
        }} />
    </div>;
}