import { createMemo, createSignal, JSX } from "solid-js";
import { isModifiedEvent, LinkStyle, link_styles_v, navigate, previewLink, unsafeLinkToSafeLink } from "../app";
import { getRandomColor, rgbToString, seededRandom } from "../darken_color";
import type * as Generic from "api-types-generic";
import { getClient, ShowCond, SwitchKind } from "../util/utils_solid";
import { ShowAnimate } from "./animation";
import { Body } from "./body";
export * from "../util/interop_solid";

export function PreviewableLink(props: {href: string, children: JSX.Element}): JSX.Element {
    const client = getClient();

    const linkPreview: () => {
        visible: () => boolean,
        setVisible: (a: boolean) => void,
        body: Generic.Body,
    } | undefined = createMemo(() => {
        const body = previewLink(client(), props.href, {});
        if(!body) return undefined;
        const [visible, setVisible] = createSignal(false);
        return {visible, setVisible, body};
    });

    return <>
        <LinkButton href={props.href} style={linkPreview() ? "previewable" : "normal"} onClick={linkPreview() ? () => {
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
    onClick?: () => void,
    children: JSX.Element,
}): JSX.Element {
    const client = getClient();
    const linkValue = createMemo(() => unsafeLinkToSafeLink(client().id, props.href));
    return <SwitchKind item={linkValue()}>{{
        error: (error) => <a class={props.class + " error"} title={error.title} on:click={(e) => {
            e.stopPropagation();
            alert(props.href);
        }}>{props.children}</a>,
        mailto: (mailto) => <span title={mailto.title}>{props.children}</span>,
        link: (link) => <a
            class={props.class} href={link.url} target="_blank" rel="noopener noreferrer"
            on:click={(!link.external || props.onClick) ? event => {
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
    onClick?: () => void,
    children: JSX.Element,
}): JSX.Element {
    return <A class={link_styles_v[props.style]} href={props.href} onClick={props.onClick}>{props.children}</A>;
}

export function UserLink(props: {href: string, color_hash: string, children: JSX.Element}): JSX.Element {
    const getStyle = () => {
        const [author_color, author_color_dark] = getRandomColor(seededRandom(props.color_hash.toLowerCase()));
        return  {
            '--light-color': rgbToString(author_color),
            '--dark-color': rgbToString(author_color_dark),
        };
    };
    return <span style={getStyle()}><LinkButton style="userlink" href={props.href}>{props.children}</LinkButton></span>;
}