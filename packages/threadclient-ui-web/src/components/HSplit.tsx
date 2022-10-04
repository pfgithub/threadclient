import { JSX } from "solid-js";
import {
    classes
} from "../util/utils_solid";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const HSplit = {
    Container(props: {
        dir: "left" | "right",
        vertical: "top" | "center" | "bottom" | "baseline",
        children: JSX.Element,
        gap?: undefined | "2",
    }): JSX.Element {
        return <div class={classes(
            "flex flex-wrap",
            ({
                top: "items-start",
                center: "items-center",
                bottom: "items-end",
                baseline: "items-baseline",
            } as const)[props.vertical],
            props.dir === "right" ? "justify-end" : "",
            props.gap === "2" ? "gap-2" : "",
        )}>
            {props.children}
        </div>;
    },
    Child(props: {
        vertical?: undefined | "top" | "center" | "bottom",
        fullwidth?: undefined | boolean,
        children: JSX.Element,
    }): JSX.Element {
        return <div class={classes(
            ({
                top: "self-start",
                center: "self-center",
                bottom: "self-end",
                none: "",
            } as const)[props.vertical ?? "none"],
            props.fullwidth ?? false ? "flex-1 w-0" : "",
        )}>{props.children}</div>;
    },
};