import type * as Generic from "api-types-generic";
import { createMemo, createSignal, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { LinkStyle, link_styles_v, previewLink } from "../app";
import { getRandomColor, rgbToString, seededRandom } from "../darken_color";
import { ShowAnimate } from "./animation";
import { Body } from "./body";
import Clickable, { ClickAction } from "./Clickable";
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
            style={linkPreview() ? "previewable" : "normal"}
            action={{
                url: props.href,
                client_id: props.client_id,
                onClick: linkPreview() ? () => {
                    const lp = linkPreview()!;
                    lp.setVisible(!lp.visible());
                } : undefined,
            }}
        >
            {props.children}
            <Show when={linkPreview()}>{preview_opts => <>
                {" "}{preview_opts.visible() ? "▾" : "▸"}
            </>}</Show>
        </LinkButton>
        <Show when={linkPreview()}>{preview_opts => (
            <ShowAnimate if={preview_opts.visible()}>
                <Body autoplay={true} body={preview_opts.body} />
            </ShowAnimate>
        )}</Show>
    </>;
}

export function LinkButton(props: {
    style: LinkStyle,
    children: JSX.Element,
    action: ClickAction,
}): JSX.Element {
    return <Clickable
        action={props.action}
        class={link_styles_v[props.style]+" outline-default"}
    >{props.children}</Clickable>;
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
        <LinkButton style="userlink" action={{url: props.href, client_id: props.client_id}}>
            {props.children}
        </LinkButton>
    </span>;
}