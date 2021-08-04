import { createMemo, createSignal, For, JSX, Match, Switch } from "solid-js";
import { elButton, LinkStyle, previewLink, unsafeLinkToSafeLink } from "../app";
import type * as Generic from "../types/generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import { classes, getClient, getSettings, Icon, ShowBool, ShowCond, switchKind, SwitchKind } from "../util/utils_solid";
import { Flair, TimeAgo } from "./author_pfp";
import { Body } from "./body";
import { A, LinkButton, PreviewableLink, UserLink } from "./links";
export * from "../util/interop_solid";

const generic_linkstyle_mappings: {
    [key in Generic.Richtext.LinkStyle]: LinkStyle
} = {'link': "normal", 'pill-empty': "pill-empty"};
function RichtextLink(props: {rts: Generic.Richtext.LinkSpan}): JSX.Element {
    // TODO display links with no text
    // used to do this: el("span").atxt("«no text»").adto(reslink);
    // but that doesn't work in many conditions
    const styleIsLink = () => (props.rts.style ?? "link") === "link";
    return <span title={props.rts.title}><Switch>
        <Match when={props.rts.is_user_link != null && props.rts.is_user_link}>{color_hash => (
            <UserLink color_hash={color_hash} href={props.rts.url}>
                <RichtextSpans spans={props.rts.children} />
            </UserLink>
        )}</Match>
        <Match when={props.rts.is_user_link == null && styleIsLink()}>
            <PreviewableLink href={props.rts.url}><RichtextSpans spans={props.rts.children} /></PreviewableLink>
        </Match>
        <Match when={props.rts.is_user_link == null && !styleIsLink()}>
            <LinkButton
                href={props.rts.url}
                style={generic_linkstyle_mappings[props.rts.style ?? "link"]}
            ><RichtextSpans spans={props.rts.children} /></LinkButton>
        </Match>
    </Switch></span>;
}

function RichtextSpan(props: {span: Generic.Richtext.Span}): JSX.Element {
    return <SwitchKind item={props.span}>{{
        text: (text) => <span classList={{
            'font-bold': text.styles.strong,
            'italic': text.styles.emphasis,
            'line-through': text.styles.strikethrough,
            'align-top': text.styles.superscript,
            'text-xs': text.styles.superscript,
            'whitespace-pre-wrap': true,
        }}>{text.text}</span>,
        link: (link) => <RichtextLink rts={link} />,
        br: () => <br />,
        spoiler: (spoiler) => {
            // TODO what if the spoiler contained a button
            // so like
            // <span><button title="click to reveal" /><Content pointer-events:none opacity:0 /></span>
            const [opened, setOpened] = createSignal(false);
            return <span
                class="relative bg-spoiler-color-hover rounded"
            >
                <ShowBool when={!opened()}>
                    <button
                        class={"absolute top-0 left-0 bottom-0 right-0 w-full h-full "
                            +"rounded bg-spoiler-color hover:bg-spoiler-color-hover cursor-pointer"
                        }
                        title="Click to reveal spoiler"
                        on:click={() => setOpened(true)}
                    ></button>
                </ShowBool>
                <span
                    class={classes(
                        "rounded",
                        "transition-opacity",
                        "bg-spoiler-color-revealed",
                        opened() ? "" : "opacity-0 invisible",
                    )}
                >
                    <RichtextSpans spans={spoiler.children} />
                </span>
            </span>;
        },
        emoji: (emoji) => <img class="w-4 h-4 object-contain inline-block" src={emoji.url} title={emoji.name} />,
        flair: (flair) => <Flair flairs={[flair.flair]} />,
        time_ago: (time) => <TimeAgo start={time.start} />,
        error: (err) => <SolidToVanillaBoundary getValue={(hsc, client) => {
            return elButton("error").atxt(err.text).onev("click", e => {
                console.log(err.value);
            });
        }} />,
        code: (code) => <code class="bg-gray-200 p-1 rounded text-gray-800">{code.text}</code>,
    }}</SwitchKind>;
}

export function RichtextSpans(props: {spans: Generic.Richtext.Span[]}): JSX.Element {
    return <For each={props.spans}>{span => <RichtextSpan span={span}/>}</For>;
}

function RichtextParagraph(props: {paragraph: Generic.Richtext.Paragraph}): JSX.Element {
    return <SwitchKind item={props.paragraph}>{{
        paragraph: (pgph) => <p><RichtextSpans spans={pgph.children} /></p>,
        body: (body) => <Body body={body.body} autoplay={false} />,
        heading: (heading) => {
            // <Dynamic> can work for this. they need different classes though so idk.
            const content = () => <RichtextSpans spans={heading.children} />;
            if(heading.level === 1) return <h1 class="text-3xl text-gray-900 font-black">{content()}</h1>;
            if(heading.level === 2) return <h2 class="text-2xl text-gray-900 font-bold">{content()}</h2>;
            if(heading.level === 3) return <h3 class="text-xl text-gray-900 font-semibold">{content()}</h3>;
            if(heading.level === 4) return <h4 class="text-lg text-gray-900 font-medium">{content()}</h4>;
            if(heading.level === 5) return <h5 class="text-base text-gray-600 font-normal">{content()}</h5>;
            return <h6 class="text-sm text-gray-600 font-normal underline">{content()}</h6>;
        },
        horizontal_line: () => <div class="py-2"><div class="w-full h-2px bg-gray-400 rounded"></div></div>,
        blockquote: (bquote) => <blockquote class="border-l-2 border-gray-600 text-gray-600 pl-3">
            <RichtextParagraphs content={bquote.children} />
        </blockquote>,
        list: (list) => {
            // "list_item"/"tight_list_item" is not real
            // non-tight list items containing eg text and a sublist might not be tight
            // instead, check over the list and see if it should be 
            const isTight = createMemo(() => {
                return list.children.every(item => {
                    if(item.kind === "tight_list_item") return true;
                    if(item.children.length === 1) return true;
                    return false;
                    // note this is not quite right -
                    // a list containing a paragraph of text and another list might be tight.
                });
            });

            const listContent = (): JSX.Element => {
                return <For each={list.children}>{child => (
                    <li classList={{tight: isTight()}}>
                        <SwitchKind item={child}>{{
                            list_item: (content) => <RichtextParagraphs content={content.children} tight={isTight()} />,
                            tight_list_item: (content) => <div classList={{'my-2': !isTight()}}>
                                <RichtextSpans spans={content.children} />
                            </div>,
                        }}</SwitchKind>
                    </li>
                )}</For>;
            };
            if(list.ordered) return <ol class="list-decimal pl-4">{listContent()}</ol>;
            return <ul class="list-disc pl-4">{listContent()}</ul>;
        },
        code_block: (code) => <pre class="bg-gray-200 p-2 rounded text-gray-800">
            <ShowCond when={code.lang}>{lang => <div class="font-sans">
                <span class="bg-gray-100 p-1 inline-block rounded-sm">lang={lang}</span>
            </div>}</ShowCond>
            <code>{code.text}</code>
        </pre>,
        table: (table) => <table>
            <thead><tr>
                <For each={table.headings}>{heading => (
                    <th align={heading.align}><RichtextSpans spans={heading.children} /></th>
                )}</For>
            </tr></thead>
            <tbody><For each={table.children}>{child => <tr>
                <For each={child}>{(col, i) => (
                    <td align={table.headings[i()]?.align}><RichtextSpans spans={col.children} /></td>
                )}</For>
            </tr>}</For></tbody>
        </table>,
    }}</SwitchKind>;
}

export function RichtextParagraphs(props: {
    content: readonly Generic.Richtext.Paragraph[],
    tight?: boolean,
}): JSX.Element {
    const settings = getSettings();
    return <For each={props.content}>{paragraph => <>
        <div classList={{'my-2': !(props.tight ?? false)}}>
            <RichtextParagraph paragraph={paragraph} />
        </div>
        <ShowBool when={settings.link_helpers.value() === "show"}>
            <For each={extractLinks(paragraph)}>{link => {
                const client = getClient();
                const linkPreview: () => {
                    visible: () => boolean,
                    toggleVisible: () => void,
                    body: Generic.Body,
                } | undefined = createMemo(() => {
                    const body = previewLink(client(), link.url, {});
                    if(!body) return undefined;
                    const [visible, setVisible] = createSignal(false);
                    return {visible, toggleVisible: () => setVisible(v => !v), body};
                });
                const human = createMemo((): {link: string, external: boolean} => {
                    const res = unsafeLinkToSafeLink(client().id, link.url);
                    if(res.kind === "link") {
                        return {link: res.url, external: res.external};
                    }else return {link: "error", external: true};
                });
                return <div class="my-2">
                    <A
                        class={classes(
                            "p-2 px-4",
                            "block",
                            "bg-body rounded-xl",
                            linkPreview()?.visible() ?? false ? "rounded-b-none" : "",
                        )}
                        href={link.url}
                        onClick={linkPreview() ? () => {
                            linkPreview()!.toggleVisible();
                        } : undefined}
                    >
                        <div class="max-1-line">
                            <ShowCond when={linkPreview()}>{v => <>{v.visible() ? "▾ " : "▸ "}</>}</ShowCond>
                            {link.title}
                        </div>
                        <ShowBool when={!(linkPreview()?.visible() ?? false)}>
                            <div class="max-1-line break-all font-light text-gray-800 dark:text-gray-400">
                                <ShowBool when={!linkPreview() && human().external}>
                                    <ExternalIcon />{" "}
                                </ShowBool>
                                {human().link}
                            </div>
                        </ShowBool>
                    </A>
                    <ShowCond when={linkPreview()}>{preview => <ShowBool when={preview.visible()}>
                        <div class=""><Body body={preview.body} autoplay={true} /></div>
                        <A
                            class={classes(
                                "p-2 px-4",
                                "block",
                                "bg-body rounded-xl rounded-t-none",
                            )}
                            href={link.url}
                        >
                            <div class="max-1-line break-all font-light text-gray-800 dark:text-gray-400">
                                <ShowBool when={human().external}>
                                    <ExternalIcon />{" "}
                                </ShowBool>
                                {human().link}
                            </div>
                        </A>
                    </ShowBool>}</ShowCond>
                </div>;
            }}</For>
        </ShowBool>
    </>}</For>;
}

function ExternalIcon(): JSX.Element {
    return <div class="inline-block"><Icon size="icon-sm" icon={{class: "icon-external", label: "External"}} /></div>;
}

type Link = {
    title: string,
    url: string,
};
function extractLinks(paragraph: Generic.Richtext.Paragraph): Link[] {
    return switchKind(paragraph, {
        paragraph: par => extractSpanLinks(par.children),
        body: () => [],
        heading: heading => extractSpanLinks(heading.children),
        horizontal_line: () => [],
        blockquote: () => [],
        list: list => list.children.flatMap(child => {
            if(child.kind === "tight_list_item") return extractSpanLinks(child.children);
            return [];
        }),
        code_block: () => [],
        table: table => [
            ...table.headings.flatMap(heading => extractSpanLinks(heading.children)),
            ...table.children.flatMap(c => c.flatMap(b => extractSpanLinks(b.children))),
        ],
    });
}
function extractSpanLinks(spans: Generic.Richtext.Span[]): Link[] {
    return spans.flatMap(span => switchKind(span, {
        link: (link) => [{
            title: spansToText(link.children),
            url: link.url,
        }],
        error: () => [],
        text: () => [],
        br: () => [],
        spoiler: spoil => extractSpanLinks(spoil.children),
        emoji: () => [],
        flair: () => [],
        time_ago: () => [],
        code: () => [],
    }));
}
function spansToText(spans: Generic.Richtext.Span[]): string {
    return spans.map(span => switchKind(span, {
        link: lnk => spansToText(lnk.children),
        error: emsg => "(Error "+emsg.text+")",
        text: txt => txt.text,
        br: () => "\n",
        spoiler: spoil => ">!"+spansToText(spoil.children)+"!<",
        emoji: emoji => ":"+emoji.name+":",
        flair: () => "(flair)",
        time_ago: () => "(time ago)",
        code: code => code.text,
    })).join("");
}