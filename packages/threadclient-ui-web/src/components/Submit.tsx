import type * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { ClientPostOpts } from "./Post";

export default function Submit(props: {
    submit: Generic.Submit.SubmitPost,
    opts: ClientPostOpts,
}): JSX.Element {
    return <div>TODO submit</div>;
}