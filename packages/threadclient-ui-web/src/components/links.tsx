import type * as Generic from "api-types-generic";
import { createMemo, createSignal, JSX } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { isModifiedEvent, LinkStyle, link_styles_v, navigate, previewLink, unsafeLinkToSafeLink } from "../app";
import { getRandomColor, rgbToString, seededRandom } from "../darken_color";
import { ShowAnimate } from "./animation";
import { Body } from "./body";
export * from "../util/interop_solid";

export function PreviewableLink(props: {
    href: string,
    client_id: string,
    children: JSX.Element,
    allow_preview: boolean,
}): JSX.Element {
    const linkPreview: () => {
        visible: () => boolean,
        setVisible: (a: boolean) => void,
        body: Generic.Body,
    } | undefined = createMemo(() => {
        if(!props.allow_preview) return undefined;
        const body = previewLink(props.href, {});
        if(!body) return undefined;
        const [visible, setVisible] = createSignal(false);
        return {visible, setVisible, body};
    });

    return <>
        <LinkButton
            client_id={props.client_id}
            href={props.href}
            style={linkPreview() ? "previewable" : "normal"}
            onClick={linkPreview() ? () => {
                const lp = linkPreview()!;
                lp.setVisible(!lp.visible());
            } : undefined}
        >
            {props.children}
            <Show when={linkPreview()}>{preview_opts => <>
                {" "}{preview_opts.visible() ? "▾" : "▸"}
            </>}</Show>
        </LinkButton>
        <Show when={linkPreview()}>{preview_opts => (
            <ShowAnimate when={preview_opts.visible()}>
                <Body autoplay={true} body={preview_opts.body} />
            </ShowAnimate>
        )}</Show>
    </>;
}

export function A(props: {
    href?: undefined | string,
    class: string,
    client_id: string,
    onClick?: undefined | JSX.EventHandler<HTMLElement, MouseEvent>,
    /// preventDefault can be called in here if you want and it will cancel the onclick
    onClickNoPreventDefault?: undefined | JSX.EventHandler<HTMLElement, MouseEvent>,
    children: JSX.Element,
    btnref?: undefined | ((el: HTMLElement) => void),
    disabled?: undefined | boolean,
}): JSX.Element {
    const linkValue = createMemo(() => {
        if(props.href == null) return ({kind: "none"} as const);
        return unsafeLinkToSafeLink(props.client_id, props.href);
    });
    return <SwitchKind item={linkValue()}>{{
        error: (error) => <a
            class={props.class + " error"}
            title={error.title}
            onclick={(e) => {
                e.stopPropagation();
                alert(props.href);
            }}
            ref={v => props.btnref?.(v)}
        >{props.children}</a>,
        mailto: (mailto) => <span
            ref={v => props.btnref?.(v)}
            title={mailto.title}
        >{props.children}</span>,
        link: (link) => <a
            class={props.class}
            href={link.url}
            {...link.external ? {
                target: "_blank",
                rel: "noopener noreferrer",
            } : {}}
            onclick={event => {
                // onclick is not allowed to be observable so always add it
                if(!props.onClick && !props.onClickNoPreventDefault) {
                    return;
                }

                props.onClickNoPreventDefault?.(event);
                event.stopPropagation();
                if (
                    !event.defaultPrevented && // onClick prevented default
                    event.button === 0 && // ignore everything but left clicks
                    !isModifiedEvent(event) // ignore clicks with modifier keys
                ) {
                    event.preventDefault();
                    if(props.onClick) return props.onClick(event);
                    navigate({path: link.url});
                }
            }}
            ref={v => props.btnref?.(v)}
        >{props.children}</a>,
        none: () => <button
            class={props.class}
            onclick={(event) => {
                props.onClickNoPreventDefault?.(event);
                if(!event.defaultPrevented) props.onClick?.(event);
            }}
            children={props.children}
            ref={v => props.btnref?.(v)}
            disabled={props.disabled}
        />
    }}</SwitchKind>;
}

export function LinkButton(props: {
    href: string,
    style: LinkStyle,
    client_id: string,
    onClick?: undefined | (() => void),
    children: JSX.Element,
}): JSX.Element {
    return <A
        client_id={props.client_id}
        class={link_styles_v[props.style]+" outline-default"}
        href={props.href}
        onClick={props.onClick}
    >{props.children}</A>;
}

export function UserLink(props: {
    href: string,
    client_id: string,
    color_hash: string,
    children: JSX.Element,
}): JSX.Element {
    const getStyle = () => {
        const [author_color, author_color_dark] = getRandomColor(seededRandom(props.color_hash.toLowerCase()));
        return  {
            '--light-color': rgbToString(author_color),
            '--dark-color': rgbToString(author_color_dark),
        };
    };
    return <span style={getStyle()}>
        <LinkButton style="userlink" href={props.href} client_id={props.client_id}>
            {props.children}
        </LinkButton>
    </span>;
}