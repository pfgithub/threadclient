import type * as Generic from "api-types-generic";
import { createEffect, createMemo, createSignal, For, JSX, Match, onCleanup, Switch, untrack } from "solid-js";
import { assertNever, switchKind } from "tmeta-util";
import { Show, SwitchKind, TimeAgo } from "tmeta-util-solid";
import { elButton, LinkStyle } from "../page1";
import { SolidToVanillaBoundary } from "../util/interop_solid";
import {
    classes, getSettings
} from "../util/utils_solid";
import { Body, summarizeBody } from "./body";
import { Flair } from "./Flair";
import LinkHelper from "./LinkHelper";
import { LinkButton, PreviewableLink, UserLink } from "./links";
import proxyURL from "./proxy_url";
export * from "../util/interop_solid";

const generic_linkstyle_mappings: {
    [key in Generic.Richtext.LinkStyle]: LinkStyle
} = {'link': "normal", 'pill-empty': "pill-empty"};
function RichtextLink(props: {rts: Generic.Richtext.LinkSpan}): JSX.Element {
    // TODO display links with no text
    // used to do this: el("span").atxt("«no text»").adto(reslink);
    // but that doesn't work in many conditions
    const styleIsLink = () => (props.rts.style ?? "link") === "link";
    const settings = getSettings();
    return <span title={props.rts.title}><Switch>
        <Match when={props.rts.is_user_link != null && props.rts.is_user_link}>{color_hash => (
            <UserLink client_id={props.rts.client_id} color_hash={color_hash} href={props.rts.url}>
                <RichtextSpans spans={props.rts.children} />
            </UserLink>
        )}</Match>
        <Match when={props.rts.is_user_link == null && styleIsLink()}>
            <PreviewableLink
                client_id={props.rts.client_id}
                href={props.rts.url}
                allow_preview={settings.linkHelpers() === "hide"}
            >
                <RichtextSpans spans={props.rts.children} />
            </PreviewableLink>
        </Match>
        <Match when={props.rts.is_user_link == null && !styleIsLink()}>
            <LinkButton
                action={{client_id: props.rts.client_id, url: props.rts.url}}
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
                <Show if={!opened()}>
                    <button
                        class={"absolute top-0 left-0 bottom-0 right-0 w-full h-full "
                            +"rounded bg-spoiler-color hover:bg-spoiler-color-hover cursor-pointer"
                        }
                        title="Click to reveal spoiler"
                        onclick={() => setOpened(true)}
                    ></button>
                </Show>
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
        emoji: (emoji) => {
            // VV todo: improve this panel
            // instead of what it is right now, it should be a panel that animates in and you can move your
            // hover over to it and it will stay up
            // this might exist as part of headlessui already
            let imgel!: HTMLImageElement | undefined;
            const [hovering, setHovering] = createSignal(0);
            let cleanfn: (() => void) | null = null;
            const showHoverEl = (): (() => void) | null => {
                if(imgel == null) return () => void 0;
                if(emoji.hover == null) return () => void 0;
                const bcr = imgel.getBoundingClientRect();
                const elem = el("div").styl({
                    'position': "fixed",
                    'top': (bcr.top + bcr.height) + "px",
                    'left': (bcr.left + (bcr.width / 2) - emoji.hover.w / 2) + "px",
                    'width': emoji.hover.w + "px",
                    'z-index': "100000000",
                }).adch(
                    el("img").attr({
                        src: proxyURL(emoji.hover.url),
                        width: `${emoji.hover.w}`,
                        height: `${emoji.hover.h}`,
                    }),
                ).adch(
                    el("div").adch(
                        el("div").atxt(emoji.name).clss("font-bold"),
                    ).adch(
                        el("div").atxt(emoji.hover.description),
                    ).clss("mt-2 bg-slate-100 dark:bg-zinc-800 border border-b-0 border-r-0 border-slate-500 shadow-md dark:border-zinc-500 rounded-md p-2")
                );
                document.body.appendChild(elem);
                elem.animate([
                    {transform: "scale(0.5)", transformOrigin: "top center", opacity: "0.0"},
                    {transform: "scale(1.0)", transformOrigin: "top center", opacity: "1.0"},
                ], {
                    duration: 100,
                    iterations: 1,
                    easing: "ease-out",
                });
                return () => {
                    elem.animate([
                        {transform: "scale(1.0)", transformOrigin: "top center", opacity: "1.0"},
                        {transform: "scale(0.5)", transformOrigin: "top center", opacity: "0.0"},
                    ], {
                        duration: 100,
                        iterations: 1,
                        easing: "ease-in",
                    }).finished.then(() => {
                        elem.remove();
                    }).catch(() => {
                        elem.remove();
                    });
                };
            };
            createEffect(() => {
                if(hovering() === 2) {
                    if(cleanfn == null) cleanfn = showHoverEl();
                }else{
                    cleanfn?.();
                    cleanfn = null;
                }
            });
            return <img
                ref={imgel}
                class="w-4 h-4 object-contain inline-block"
                src={proxyURL(emoji.url)}
                title={emoji.name}
                onMouseEnter={() => {
                    setHovering(1);
                    setTimeout(() => hovering() === 1 && setHovering(2), 500);
                }}
                onMouseLeave={() => setHovering(0)}
            />;
        },
        flair: (flair) => <Flair flairs={[flair.flair]} />,
        time_ago: (time) => <TimeAgo start={time.start} />,
        error: (err) => <SolidToVanillaBoundary getValue={hsc => {
            return elButton("error").atxt(err.text).onev("click", e => {
                console.log(err.value);
            });
        }} />,
        code: (code) => <code class="bg-slate-200 dark:bg-zinc-700 p-1 rounded">{code.text}</code>,
    }}</SwitchKind>;
}

export function RichtextSpans(props: {spans: Generic.Richtext.Span[]}): JSX.Element {
    return <For each={props.spans}>{span => <RichtextSpan span={span}/>}</For>;
}

export function RichtextParagraph(props: {paragraph: Generic.Richtext.Paragraph}): JSX.Element {
    return <SwitchKind item={props.paragraph}>{{
        paragraph: (pgph) => <p><RichtextSpans spans={pgph.children} /></p>,
        body: (body) => <Body body={body.body} autoplay={false} />,
        heading: (heading) => {
            // <Dynamic> can work for this. they need different classes though so idk.
            const content = () => <RichtextSpans spans={heading.children} />;
            if(heading.level === 1) return <h1 class="text-3xl font-black">{content()}</h1>;
            if(heading.level === 2) return <h2 class="text-2xl font-bold">{content()}</h2>;
            if(heading.level === 3) return <h3 class="text-xl font-semibold">{content()}</h3>;
            if(heading.level === 4) return <h4 class="text-lg font-medium">{content()}</h4>;
            if(heading.level === 5) return <h5
                class="text-base text-slate-500 dark:text-zinc-400 font-normal"
            >{content()}</h5>;
            return <h6 class="text-sm text-slate-500 dark:text-zinc-400 font-normal underline">{content()}</h6>;
        },
        horizontal_line: () => <div class="py-2">
            <hr class="w-full border-t-2 border-slate-500 dark:border-zinc-400 rounded" />
        </div>,
        blockquote: (bquote) => <blockquote class="border-l-2 border-slate-500 dark:border-zinc-400 pl-3">
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
                return <For each={list.children}>{(child, i) => (
                    <li class="flex flex-row gap-2 items-baseline">
                        <div>
                            {list.ordered ? `${i()+1}. ` : "- "}
                        </div>
                        <div class="flex-1 w-0">
                            <SwitchKind item={child}>{{
                                list_item: (content) => <RichtextParagraphs
                                    content={content.children}
                                    tight={isTight()}
                                />,
                                tight_list_item: (content) => <div classList={{'my-2': !isTight()}}>
                                    <RichtextSpans spans={content.children} />
                                </div>,
                            }}</SwitchKind>
                        </div>
                    </li>
                )}</For>;
            };
            const listclass = "list-none";
            if(list.ordered) return <ol class={listclass}>{listContent()}</ol>;
            return <ul class={listclass}>{listContent()}</ul>;
        },
        code_block: (code) => <CodeBlock text={code.text} default_language={code.lang ?? null} />,
        // * ideally we do the fancy thing where the table scrolls off -mx-4 px-4
        // but we can't do that because css
        // - we have to restructure:
        //   - posts do not have px-4
        //   - bodies are responsible for applying px-4 themselves
        //   - all other richtext kinds apply px-4
        table: (table) => <div><div class="overflow-x-auto max-w-full" style={{
            '-webkit-overflow-scrolling': "touch",
        }}><table class="w-max">
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
        </table></div></div>,
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
        Promise.all([
            import("./prismjs"),
            untrack(() => getSettings().colorScheme()) === "dark" ? (
                // not sure how to dynamically toggle these at runtime so live with it
                import("prism-themes/themes/prism-atom-dark.css")
                ) : (
                import("prism-themes/themes/prism-duotone-light.css")
            ),
        ]).then(([r]) => setPrism(r)).catch(e => {
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
    const allowHighlighted = () => props.text.length < 10_000;

    const [menuOpen, setMenuOpen] = createSignal(false);

    createEffect(() => {
        if(language() != null || menuOpen()) {
            fetchPrism();
        }
    });
    createEffect(() => {
        if(!allowHighlighted()) return; // skip syn hl

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
        "!bg-slate-200 !dark:bg-zinc-700 p-2 !rounded-md text-slate-900 dark:text-zinc-100",
        "relative",
        "group",
        "outline-default",
        "language-"+(language() ?? "none"),
        "!whitespace-pre-wrap",
    ])}>
        <Show if={allowHighlighted()}><div class={classes([
            "absolute",
            "top-0 right-0",
            "transition-opacity",
            "opacity-0",
            "group-hover:opacity-100",
            "group-focus:opacity-100",
            "focus:opacity-100",
            "bg-slate-400 dark:bg-zinc-600 text-slate-100 dark:text-zinc-100 rounded-md",
            "p-2 px-3",
        ])}>
            <Show if={!!prism() && menuOpen()} fallback={
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
            </Show>
        </div></Show>
        <Show when={highlighted()} fallback={
            /* !whitespace-pre-wrap is required here due to a weird issue
            in the browser where somehow the less important white-space: pre
            that in devtools is striked out is somehow used instead of
            the pre-wrap. this occurs in both firefox and chrome so it
            might be some weird spec thing? */
            <code class="!whitespace-pre-wrap">{props.text}</code>
        }>{hl => <>
            <div innerHTML={hl} />
        </>}</Show>
    </pre>;
}

export function RichtextParagraphs(props: {
    content: readonly Generic.Richtext.Paragraph[],
    tight?: undefined | boolean,
}): JSX.Element {
    const settings = getSettings();
    return <div class={props.tight ?? false ? "" : "space-y-2"}>
        <For each={props.content}>{paragraph => <>
            <RichtextParagraph paragraph={paragraph} />
            <Show if={settings.linkHelpers() === "show"}>
                <For each={extractLinks(paragraph)}>{link => (
                    <LinkHelper link={link} />
                )}</For>
            </Show>
        </>}</For>
    </div>;
}

export function RichtextDocument(props: {
    content: readonly Generic.Richtext.Paragraph[],
}): JSX.Element {
    // if there is a lot of content, add a "reader mode" button
    return <RichtextParagraphs content={props.content} />;
}

type Link = {
    title: string,
    url: string,
    client_id: string,
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
            title: summarizeSpans(link.children),
            url: link.url,
            client_id: link.client_id,
        }],
        error: () => [],
        text: () => [],
        br: () => [],
        // TODO don't display until the spoiler is revealed or something
        spoiler: spoil => extractSpanLinks(spoil.children),
        emoji: () => [],
        flair: () => [],
        time_ago: () => [],
        code: () => [],
    }));
}
export function summarizeParagraphs(paragraphs: readonly Generic.Richtext.Paragraph[]): string {
    return paragraphs.map(paragraph => switchKind(paragraph, {
        paragraph: par => summarizeSpans(par.children),
        body: body => summarizeBody(body.body),
        heading: heading => summarizeSpans(heading.children),
        horizontal_line: hr => "---",
        blockquote: bquote => summarizeParagraphs(bquote.children),
        list: list => list.children.map((child, i) => {
            const bullet = list.ordered ? ("" + i + ". ") : "• ";
            if(child.kind === "tight_list_item") return bullet + summarizeSpans(child.children);
            if(child.kind === "list_item") return bullet + summarizeParagraphs(child.children);
            assertNever(child);
        }).join("\n"),
        code_block: code => code.text,
        table: () => "[table]",
    })).join("\n");
}
export function summarizeSpans(spans: readonly Generic.Richtext.Span[]): string {
    return spans.map(span => switchKind(span, {
        link: lnk => summarizeSpans(lnk.children),
        error: emsg => "[error]",
        text: txt => txt.text,
        br: () => "\n",
        spoiler: spoil => "[spoiler]", //">!"+summarizeSpans(spoil.children)+"!<",
        emoji: emoji => ":"+emoji.name+":",
        flair: () => "[flair]",
        time_ago: () => "[time ago]",
        code: code => code.text,
    })).join("");
}