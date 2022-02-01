import type * as Generic from "api-types-generic";
import { createMemo, createSignal, JSX } from "solid-js";
import { ShowCond, SwitchKind } from "tmeta-util-solid";
import { isModifiedEvent, LinkStyle, link_styles_v, navigate, previewLink, unsafeLinkToSafeLink } from "../app";
import { getRandomColor, rgbToString, seededRandom } from "../darken_color";
import { ShowAnimate } from "./animation";
import { Body } from "./body";
export * from "../util/interop_solid";

export function PreviewableLink(props: {
    href: string,
    client_id: string,
    children: JSX.Element,
}): JSX.Element {
    const linkPreview: () => {
        visible: () => boolean,
        setVisible: (a: boolean) => void,
        body: Generic.Body,
    } | undefined = createMemo(() => {
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
        } : undefined}>
            {props.children}
            <ShowCond when={linkPreview()}>{preview_opts => <>
                {" "}{preview_opts.visible() ? "▾" : "▸"}
            </>}</ShowCond>
        </LinkButton>
        <ShowCond when={linkPreview()}>{preview_opts => (
            <ShowAnimate when={preview_opts.visible()}>
                <Body autoplay={true} body={preview_opts.body} />
            </ShowAnimate>
        )}</ShowCond>
    </>;
}

export function A(props: {
    href: string,
    class: string,
    client_id: string,
    onClick?: undefined | (() => void),
    children: JSX.Element,
}): JSX.Element {
    const linkValue = createMemo(() => unsafeLinkToSafeLink(props.client_id, props.href));
    return <SwitchKind item={linkValue()}>{{
        error: (error) => <a class={props.class + " error"} title={error.title} onclick={(e) => {
            e.stopPropagation();
            alert(props.href);
        }}>{props.children}</a>,
        mailto: (mailto) => <span title={mailto.title}>{props.children}</span>,
        link: (link) => <a
            class={props.class} href={link.url} target="_blank" rel="noopener noreferrer"
            onclick={(!link.external || props.onClick) ? event => {
                event.stopPropagation();
                if (
                    !event.defaultPrevented && // onClick prevented default
                    event.button === 0 && // ignore everything but left clicks
                    !isModifiedEvent(event) // ignore clicks with modifier keys
                ) {
                    event.preventDefault();
                    if(props.onClick) return props.onClick();
                    navigate({path: link.url});
                }
            } : undefined}
        >{props.children}</a>,
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