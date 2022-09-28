import type * as Generic from "api-types-generic";
import { JSX } from "solid-js";
import { createMergeMemo, SwitchKind } from "tmeta-util-solid";
import { navigate } from "../page1_routing";
import { isModifiedEvent, unsafeLinkToSafeLink } from "../tc_helpers";
import { getSettings } from "../util/utils_solid";

export type ClickAction = {
    url: string,
    client_id: string, // TODO get rid of this. it should be the client's responsability to include client_id in its links.
    mode?: undefined | "navigate" | "replace",
    page?: undefined | (() => (Generic.Page2 | undefined)),
    onClick?: undefined | JSX.EventHandler<HTMLElement, MouseEvent>,
} | JSX.EventHandler<HTMLElement, MouseEvent> | "TODO";
export default function Clickable(props: {
    class: string, // would be nice if the clickable could be display:contents. unfortunately, that's not supported yet.

    /// preventDefault can be called in here if you want and it will cancel the onclick
    beforeClick?: undefined | JSX.EventHandler<HTMLElement, MouseEvent>,
    action: ClickAction,
    
    children: JSX.Element,
    disabled?: undefined | boolean,

    btnref?: undefined | ((el: HTMLElement) => void),
}): JSX.Element {
    const link_value = createMergeMemo(() => {
        if(typeof props.action !== "object") return ({kind: "button"} as const);
        return unsafeLinkToSafeLink(props.action.client_id, props.action.url);
    }, {key: null, merge: true});
    const linkValue = () => link_value.data;
    const settings = getSettings();
    const onclick: JSX.EventHandler<HTMLElement, MouseEvent> = event => {
        const link = linkValue();
        props.beforeClick?.(event);
    
        if(link.kind === "link" && link.external && typeof props.action === "object" && !props.action.onClick) {
            return;
        }

        event.stopPropagation();
        if (
            !event.defaultPrevented && // beforeClick prevented default
            event.button === 0 && // ignore everything but left clicks
            !isModifiedEvent(event) // ignore clicks with modifier keys
        ) {
            event.preventDefault();
            if(typeof props.action !== "object") {
                if(props.action === "TODO") return alert("TODO");
                return props.action(event);
            }
            if(props.action.onClick) {
                return props.action.onClick(event);
            }
            const l_link = link.kind === "link" ? link : null;
            if(l_link == null) return alert("E_LINK_HREF_EXPECT_NAVIGATE");
            navigate({path: l_link.url, page: props.action.page?.(), mode: props.action.mode});
        }
    };
    return <SwitchKind item={linkValue()}>{{
        error: (error) => <a
            class={props.class + " error"}
            title={error.title}
            onclick={onclick}
            ref={v => props.btnref?.(v)}
        >{props.children}</a>,
        mailto: (mailto) => <span
            ref={v => props.btnref?.(v)}
            title={mailto.title}
            onclick={onclick}
        >{props.children}</span>,
        link: (link) => <a
            class={props.class}
            href={link.url}
            {...link.external ? settings.links() === "new_tab" ? {
                target: "_blank",
                rel: "noopener noreferrer",
            } : {rel: "noopener noreferrer"} : {}}
            onclick={onclick}
            ref={v => props.btnref?.(v)}
        >{props.children}</a>,
        button: () => <button
            class={props.class}
            onclick={onclick}
            children={props.children}
            ref={v => props.btnref?.(v)}
            disabled={props.disabled}
        />
    }}</SwitchKind>;
}