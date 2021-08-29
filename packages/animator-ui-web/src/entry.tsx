import "windi.css";
import "./style.css";

import { render } from "solid-js/web";
import AnimatorState from "./animator_state";
import { DefaultErrorBoundary } from "./error_boundary";

render(() => <DefaultErrorBoundary data={0}>
    <AnimatorState />
</DefaultErrorBoundary>, document.getElementById("app")!);