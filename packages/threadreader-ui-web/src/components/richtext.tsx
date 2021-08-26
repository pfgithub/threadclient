import "prism-themes/themes/prism-atom-dark.css"; // vsc dark is missing markdown styles
import { createEffect, createMemo, createSignal, For, JSX, Match, onCleanup, Switch } from "solid-js";
import { elButton, LinkStyle, previewLink, unsafeLinkToSafeLink } from "../app";
import type * as Generic from "api-types-generic";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import {
    classes, getClient, getSettings, Icon, ShowBool,
    ShowCond, switchKind, SwitchKind, TimeAgo, ToggleColor,
} from "../util/utils_solid";
import { animateHeight } from "./animation";
import { Flair } from "./page2";
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
        code_block: (code) => <CodeBlock text={code.text} default_language={code.lang ?? null} />,
        table: (table) => <table>
            <thead><tr>
                <For each={table.headings}>{heading => (
                    <th class={alignment[heading.align ?? "none"]}><RichtextSpans spans={heading.children} /></th>
                )}</For>
            </tr></thead>
            <tbody><For each={table.children}>{child => <tr>
                <For each={child}>{(col, i) => (
                    <td class={alignment[table.headings[i()]?.align ?? "none"]}>
                        <RichtextSpans spans={col.children} />
                    </td>
                )}</For>
            </tr>}</For></tbody>
        </table>,
    }}</SwitchKind>;
}

const alignment = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
    none: "",
} as const;


// I'm sure there's a better way to handle this
// it's not quite something I can do with a suspense
const [prism, setPrism] = createSignal<undefined | typeof import("./prismjs")>(undefined);
let prism_loading = false;
function fetchPrism() {
    if(!prism() || prism_loading) {
        prism_loading = true;
        import("./prismjs").then(r => setPrism(r)).catch(e => {
            alert("error loading syntax highlighter");
            prism_loading = false;
            console.log(e);
        });
    }
}

export function CodeBlock(props: {
    text: string,
    default_language: string | null,
}): JSX.Element {
    const [language, setLanguage] = createSignal(props.default_language);
    createEffect(() => setLanguage(props.default_language));

    const [highlighted, setHighlighted] = createSignal<null | string>(null);

    const [menuOpen, setMenuOpen] = createSignal(false);

    createEffect(() => {
        if(language() != null || menuOpen()) {
            fetchPrism();
        }
    });
    createEffect(() => {
        let active = true;
        onCleanup(() => active = false);
        setHighlighted(null);
        if(prism() && language() != null) {
            prism()!.highlight(props.text, language() ?? "plaintext").then(r => {
                if(active) {
                    setHighlighted(r);
                    if(r == null) {
                        console.log("syn hl language not supported", language());
                    }
                }
            }).catch(e => {
                console.log(e);
                alert("error highlighting");
            });
        }
    });

    return <pre tabindex="0" class={classes([
        "bg-gray-200 p-2 rounded text-gray-800",
        "relative",
        "group",
        "outline-default",
        "language-"+(language() ?? "none"),
        "!whitespace-pre-wrap",
    ])}>
        <div class={classes([
            "absolute",
            "top-0 right-0",
            "transition-opacity",
            "opacity-0",
            "group-hover:opacity-100",
            "group-focus:opacity-100",
            "focus:opacity-100",
            "bg-gray-100 rounded",
            "p-2 px-3",
        ])}>
            <ShowBool when={!!prism() && menuOpen()} fallback={
                <button
                    class={classes([
                        "font-sans",
                    ])}
                    onclick={() => {
                        setMenuOpen(v => !v);
                    }}
                >
                    {language() ?? "None"} {menuOpen() ? "▴" : "▾"}
                </button>
            }>
                {/*The <></> wrapper is required to work around that firefox whitesoace-pre bug*/}
                <select class="block" oninput={e => {
                    const value = e.currentTarget.value;
                    if(value === "null") setLanguage(null);
                    else setLanguage(value);
                }}>
                    <option value="null">None</option>
                    <For each={
                        prism()!.listLanguages().sort((a, b) => a.localeCompare(b))
                    }>{lang => (
                        <option value={lang}>{lang}</option>
                    )}</For>
                </select>
            </ShowBool>
        </div>
        <ShowCond when={highlighted()} fallback={
            /* !whitespace-pre-wrap is required here due to a weird issue
            in the browser where somehow the less important white-space: pre
            that in devtools is striked out is somehow used instead of
            the pre-wrap. this occurs in both firefox and chrome so it
            might be some weird spec thing? */
            <code class="!whitespace-pre-wrap">{props.text}</code>
        }>{hl => <>
            <div innerHTML={hl} />
        </>}</ShowCond>
    </pre>;
}

// TODO support thumbnails
// previewLink should give a thumbnail back somehow
// eg for youtube videos, it's an image `https://img.youtube.com/vi/${id}/default.jpg`
export function MobileLinkPreview(props: {link: Link}): JSX.Element {
    const settings = getSettings();
    const client = getClient();
    const linkPreview: () => {
        visible: () => boolean,
        toggleVisible: () => void,
        body: Generic.Body,
    } | undefined = createMemo(() => {
        const body = previewLink(client(), props.link.url, {});
        if(!body) return undefined;
        const [visible, setVisible] = createSignal(false);
        return {visible, toggleVisible: () => setVisible(v => !v), body};
    });
    const human = createMemo((): {link: string, external: boolean} => {
        const res = unsafeLinkToSafeLink(client().id, props.link.url);
        if(res.kind === "link") {
            return {link: res.url, external: res.external};
        }else return {link: "error", external: true};
    });

    const [previewOpen, setPreviewOpen] = createSignal<{open: boolean, temporary: boolean}>(
        {open: false, temporary: false},
    );
    return <div class="my-2">
        <ToggleColor>{color => <A
            class={classes(
                "p-2 px-4",
                "block",
                color, "rounded-xl",
                previewOpen().open ? "rounded-b-none" : "",
            )}
            href={props.link.url}
            onClick={linkPreview() ? () => {
                linkPreview()!.toggleVisible();
            } : undefined}
        >
            <div class="max-lines max-lines-1">
                <ShowCond when={linkPreview()}>{v => <>{v.visible() ? "▾ " : "▸ "}</>}</ShowCond>
                {props.link.title}
            </div>
            <ShowBool when={!previewOpen().open || previewOpen().temporary}>
                <div style={{display: previewOpen().open ? "none" : "block"}}>
                    <div class="max-lines max-lines-1 break-all font-light text-gray-800 dark:text-gray-400">
                        <ShowBool when={!linkPreview() && human().external}>
                            <ExternalIcon />{" "}
                        </ShowBool>
                        {human().link}
                    </div>
                </div>
            </ShowBool>
        </A>}</ToggleColor>
        <ShowCond when={linkPreview()}>{preview => <><div ref={v => animateHeight(
            v, settings, preview.visible, (state, rising, temporary) => {
                setPreviewOpen({open: state || rising, temporary});
            },
        )}>
            <ShowBool when={previewOpen().open || previewOpen().temporary}>
                <div style={{display: previewOpen().open ? "block" : "none"}}>
                    <Body body={preview.body} autoplay={true} />
                </div>
            </ShowBool>
        </div><ShowBool when={previewOpen().open || previewOpen().temporary}>
            <div style={{display: previewOpen().open ? "block" : "none"}}>
                <ToggleColor>{color => <A
                    class={classes(
                        "p-2 px-4",
                        "block",
                        color, "rounded-xl rounded-t-none",
                    )}
                    href={props.link.url}
                >
                    <div class="max-1-line break-all font-light text-gray-800 dark:text-gray-400">
                        <ShowBool when={human().external}>
                            <ExternalIcon />{" "}
                        </ShowBool>
                        {human().link}
                    </div>
                </A>}</ToggleColor>
            </div>
        </ShowBool></>}</ShowCond>
    </div>;
}

export function RichtextParagraphs(props: {
    content: readonly Generic.Richtext.Paragraph[],
    tight?: undefined | boolean,
}): JSX.Element {
    const settings = getSettings();
    return <For each={props.content}>{paragraph => <>
        <div classList={{'my-2': !(props.tight ?? false)}}>
            <RichtextParagraph paragraph={paragraph} />
        </div>
        <ShowBool when={settings.link_helpers.value() === "show"}>
            <For each={extractLinks(paragraph)}>{link => (
                <MobileLinkPreview link={link} />
            )}</For>
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