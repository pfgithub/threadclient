import "@fortawesome/fontawesome-free/css/all.css";
import type * as Generic from "api-types-generic";
import { JSX } from "solid-js";

export function InternalIconRaw(props: {
    class: string,
    label: null | string,
}): JSX.Element {
    return <i
        class={props.class}
        aria-label={props.label ?? undefined}
        aria-hidden={props.label == null}
    />;
}
export function InternalIcon(props: {
    class?: undefined | string,
    tag: string,
    filled: boolean,
    label: null | string,
}): JSX.Element {
    return <InternalIconRaw
        class={props.class + " " + props.tag + " " + (props.filled ? "fas" : "far")}
        label={props.label}
    />;
}

const tag_from_icon_kind: {[key in Generic.Icon]: [
    free: boolean,
    tag: string, tag_pro?: undefined | string,
]} = {
    comments: [true, "fa-comment"],
    creation_time: [true, "fa-clock"],
    edit_time: [true, "fa-edit", "fa-pencil"],
    up_arrow: [false, "fa-arrow-up"],
    down_arrow: [false, "fa-arrow-down"],
    controversiality: [true, "fa-smile"],
    pinned: [false, "fa-thumbtack"],
    bookmark: [true, "fa-bookmark"],
    envelope: [true, "fa-envelope"],
    envelope_open: [true, "fa-envelope-open"],
    star: [true, "fa-star"],
    join: [true, "fa-plus-square"],
    heart: [true, "fa-heart"],
    code: [false, "fa-code"],
    link: [false, "fa-link"],
    eye: [true, "fa-eye"],
    reply: [false, "fa-reply"],
    chevron_up: [false, "fa-chevron-up"],
    chevron_down: [false, "fa-chevron-down"],
};

export default function Icon(props: {
    class?: string | undefined,
    icon: Generic.Icon, bold: boolean, label: null | string,
}): JSX.Element {
    return <InternalIcon
        class={props.class}
        tag={tag_from_icon_kind[props.icon][1]}
        filled={tag_from_icon_kind[props.icon][0] ? props.bold : true}
        label={props.label}
    />;
}