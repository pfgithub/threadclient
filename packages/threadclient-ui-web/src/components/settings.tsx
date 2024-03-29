import * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { createEffect, createSignal, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { variables } from "virtual:_variables";
import { link_styles_v } from "../page1";
import { availableForOfflineUse, updateAvailable, updateSW } from "../router";
import { ComputeProperty, getSettings } from "../util/utils_solid";
import { ShowAnimate } from "./animation";
import Clickable from "./Clickable";
import { LinkButton } from "./links";
import { ClientContent, CrosspostWrapper, TopLevelWrapper } from "./page2";
import { RichtextParagraphs } from "./richtext";
import ToggleButton from "./ToggleButton";
export * from "../util/interop_solid";

function SettingsSection(props: {title: string, children?: undefined | JSX.Element}): JSX.Element {
    return (
        <section>
            <TopLevelWrapper>
                <h2 class="text-2xl font-black">{props.title}</h2>
                {props.children}
            </TopLevelWrapper>
        </section>
    );
}

function UpdateStatus(): JSX.Element {
    const [updating, setUpdating] = createSignal(false);

    return <p class="my-4 whitespace-pre-wrap">
        Current Version: {variables.version.trim()} ({variables.build_time})
        {"\n"}
        Available for Offline Use: {availableForOfflineUse() ? "yes" : "maybe"}
        <Show if={updateAvailable()}>
            {"\n"}
            An update is available.{" "}
            <button
                class={link_styles_v["outlined-button"]}
                disabled={updating()}
                onclick={() => {
                    setUpdating(true);
                    updateSW(true).then(() => {
                        setUpdating(false);
                    }).catch(e => {
                        setUpdating(false);
                        console.log(e);
                        alert("Error updating");
                    });
                }}
            >Update Now</button>
        </Show>
    </p>;
}

export function SettingPicker<T extends string>(props: {
    setting: ComputeProperty<T>,
    options: (T | undefined)[],
    name: (a: T | undefined) => string,
}): JSX.Element {
    return <div class="inline-block">
        <ToggleButton
            value={props.setting.override()}
            setValue={nv => props.setting.setOverride(nv)}
            choices={props.options.map(option => [
                option, 
                <Show when={option}
                    fallback={
                        <>{props.name(undefined)} ({props.name(props.setting.base())})</>
                    }
                >{opt => <>
                    {props.name(opt)}
                </>}</Show>,
            ])}
        />
    </div>;
}

export default function SettingsPage(props: {_?: undefined}): JSX.Element {
    const [showDevSettings, setShowDevSettings] = createSignal(false);
    const settings = getSettings();

    return <main class="client-wrapper"><div class="display-comments-view">
        <SettingsSection title="Color Scheme">
            <SettingPicker
                setting={settings.colorScheme}
                options={["light", "dark", undefined]}
                name={v => ({
                    light: "Light",
                    dark: "Dark",
                    default: "System Default",
                } as const)[v ?? "default"]}
            />
        </SettingsSection>
        <SettingsSection title="Profile Images">
            <SettingPicker
                setting={settings.authorPfp}
                options={["on", "off", undefined]}
                name={v => ({
                    on: "On",
                    off: "Off",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <CrosspostWrapper>
                <ClientContent content={{
                    kind: "post",

                    title: null,
                    author: {
                        name: "pfg___",
                        client_id: "reddit",
                        color_hash: "pfg___",
                        link: "/u/pfg___",
                        pfp: {
                            url: "https://www.redditstatic.com/avatars/avatar_default_02_FF8717.png",
                        },
                    },
                    collapsible: {default_collapsed: false},
                    body: {
                        kind: "richtext",
                        content: [{kind: "paragraph", children: [
                            {kind: "text", text: "This is an example comment!", styles: {}},
                        ]}],
                    },
                }} opts={{
                    frame: null,
                    client_id: "",
                    flat_frame: null,
                    id: null,
                }} />
            </CrosspostWrapper>
        </SettingsSection>
        <SettingsSection title="Update Notices">
            <SettingPicker
                setting={settings.updateNotifications}
                options={["on", "off", undefined]}
                name={v => ({
                    on: "On",
                    off: "Off",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <p class="my-4">
                Show a notice when an update is available. Updates are installed
                automatically after closing all ThreadClient tabs and refreshing the
                page twice, or manually by clicking the Update button on an Update notice.
            </p>
            <UpdateStatus />
        </SettingsSection>
        <SettingsSection title="Changelog">
            <SettingPicker
                setting={settings.changelog}
                options={["show", "hide", undefined]}
                name={v => ({
                    show: "Show",
                    hide: "Hide",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <p class="my-4">
                Show a banner at the top of the page when a changelog is available.{" "}
                <Clickable class="text-blue-500 hover:underline" action={{url: "/changelog", client_id: "shell"}}>Past changelogs</Clickable>
            </p>
        </SettingsSection>
        <SettingsSection title="Link Helpers">
            <SettingPicker
                setting={settings.linkHelpers}
                options={["show", "hide", undefined]}
                name={v => ({
                    show: "Show",
                    hide: "Hide",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <RichtextParagraphs content={[
                rt.p(
                    rt.txt("Optionally show link helpers to make it easier to click small links"),
                ),
                rt.p(
                    rt.txt("I put a small link "),
                    rt.link({id: ""}, "/settings", {}, rt.txt("here")),
                    rt.txt(" to demo the functionality."),
                ),
                rt.p(
                    rt.txt("There are some more "),
                    rt.link({id: ""}, "https://i.redd.it/p0y4mrku6xh61.png", {}, rt.txt("small links")),
                    rt.txt(" in "),
                    rt.link({id: ""}, "https://en.wikipedia.org/wiki/Special:Random", {}, rt.txt("this")),
                    rt.txt(" paragraph."),
                ),
            ]} />
        </SettingsSection>
        <SettingsSection title="Custom Video Controls">
            <SettingPicker
                setting={settings.customVideoControls}
                options={["browser", "custom", undefined]}
                name={v => ({
                    browser: "Browser",
                    custom: "Custom",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <p class="my-4">
                Custom video controls are currently work in progress. Once
                they are complete, they will be enabled by default.
            </p>
            <CrosspostWrapper>
                <ClientContent content={{
                    kind: "post",

                    title: {text: "Video Example"},
                    collapsible: {default_collapsed: true},
                    body: {
                        kind: "video",
                        gifv: false,
                        aspect: 16 / 9,
                        source: {
                            kind: "video",
                            thumbnail: "https://commondatastorage.googleapis.com/"
                            + "gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
                            sources: [
                                {
                                    url: "https://commondatastorage.googleapis.com/"
                                    + "gtv-videos-bucket/sample/BigBuckBunny.mp4",
                                    quality: "720p",
                                },
                            ],
                        },
                    },
                }} opts={{
                    frame: null,
                    client_id: "n/a",
                    flat_frame: null,
                    id: null,
                }} />
            </CrosspostWrapper>
        </SettingsSection>
        <SettingsSection title="Image Galleries">
            <SettingPicker
                setting={settings.galleryDisplay}
                options={["fullscreen", "inline", undefined]}
                name={v => ({
                    fullscreen: "Fullscreen",
                    inline: "Inline",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <p class="my-4">
                Chooses if image galleries should display in fullscreen or inline. Note
                that not all galleries are supported for fullscreen display.
            </p>
            <CrosspostWrapper>
                <ClientContent content={{
                    kind: "post",

                    title: {text: "Gallery Example"},
                    collapsible: {default_collapsed: true},
                    body: {
                        kind: "gallery",
                        images: new Array(20).fill(0).map((__, i): Generic.GalleryItem => ({
                            thumb: "https://picsum.photos/seed/"+(i + 1)+"/140/140.jpg",
                            aspect: 1.0,
                            body: {
                                kind: "captioned_image",
                                w: 650,
                                h: 365,
                                url: "https://picsum.photos/seed/"+(i + 1)+"/650/365.jpg",
                            },
                        })),
                    },
                }} opts={{
                    frame: null,
                    client_id: "n/a",
                    flat_frame: null,
                    id: null,
                }} />
            </CrosspostWrapper>
        </SettingsSection>
        <SettingsSection title="Animations">
            <SettingPicker
                setting={settings.motion}
                options={["full", "reduce", undefined]}
                name={v => ({
                    full: "All Motion",
                    reduce: "Reduce Motion",
                    default: "System Default",
                } as const)[v ?? "default"]}
            />
            <ShowAnimate if={settings.motion() === "full"}>
                <div class="my-2"><div class="inline-block"><ToggleButton
                    value={settings.animationTime.override()}
                    setValue={nv => settings.animationTime.setOverride(nv)}
                    choices={[
                        [0, "0s"],
                        [0.1, "0.1s"],
                        [0.2, "0.2s"],
                        [0.3, "0.3s"],
                        [undefined, <>Default {settings.animationTime.base()}s</>],
                    ]}
                /></div></div>
                <SettingPicker
                    setting={settings.animationDevMode}
                    options={["none", "shift_slow", undefined]}
                    name={v => ({
                        none: "None",
                        shift_slow: "Shift to Slow Animation",
                        default: "Default",
                    } as const)[v ?? "default"]}
                />
            </ShowAnimate>
            <div class="my-2" />
            <CrosspostWrapper>
                <ClientContent content={{
                    kind: "post",

                    title: {text: "Motion Example"},
                    collapsible: {default_collapsed: false},
                    body: {
                        kind: "richtext",
                        content: [
                            rt.p(rt.txt("Click the collapse button to the left to see an example")),
                        ],
                    },
                }} opts={{
                    frame: null,
                    client_id: "n/a",
                    flat_frame: null,
                    id: null,
                }} />
            </CrosspostWrapper>
        </SettingsSection>
        <SettingsSection title="Signature">
            <textarea
                class="w-full bg-slate-300 dark:bg-zinc-900 p-2 placeholder-slate-500 dark:placeholder-slate-400"
                rows={4}
                value={settings.signature()}
                onInput={v => {
                    settings.signature.setOverride(v.currentTarget.value || undefined);
                }}
                placeholder={"~ Sent from my Samsung Smart Fridge"}
            />
            <p class="my-4">
                Set a signature to be added to the end of all your posts. TODO:
                You should be able to specify signatures per-account rather than
                globally. This would also allow showing a preview of what the signature
                will look lile. TODO: show a preview editor here. that will be doable
                once this is per-account because accounts will be associated with a
                client.
            </p>
        </SettingsSection>
        <SettingsSection title="External Links">
            <SettingPicker
                setting={settings.links}
                options={["new_tab", "same_tab", undefined]}
                name={v => ({
                    new_tab: "New Tab",
                    same_tab: "Same Tab",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <p class="my-4">
                Chooses if external links should be opened in a new tab or in the same
                tab as ThreadClient.{" "}
                <LinkButton action={{url: "https://www.google.com/", client_id: "n/a"}} style="normal">
                    Example Link
                </LinkButton>
            </p>
        </SettingsSection>
        <SettingsSection title="Developer Options">
            <p class="my-2">
                Leave all these default. Changing these will break things.{" "}
            </p>
            <ShowAnimate
                if={showDevSettings()}
                fallback={<button
                    class={link_styles_v["outlined-button"]}
                    onclick={() => setShowDevSettings(true)}
                >Show Anyway</button>}
            >
                <div class="mb-6" />
                <h3 class="mt-6 text-sm uppercase font-bold text-slate-600 dark:text-zinc-400">Page Version</h3>
                <SettingPicker
                    setting={settings.pageVersion}
                    options={["1", "2", undefined]}
                    name={v => ({
                        '1': "V1",
                        '2': "V2",
                        'default': "Default",
                    } as const)[v ?? "default"]}
                />
                <p class="my-2">
                    Uses the new page2 renderer.
                </p>
                <h3 class="mt-6 text-sm uppercase font-bold text-slate-600 dark:text-zinc-400">Highlight Updates</h3>
                <SettingPicker
                    setting={settings.dev.highlightUpdates}
                    options={["on", "off", undefined]}
                    name={v => ({
                        'on': "On",
                        'off': "Off",
                        'default': "Default",
                    } as const)[v ?? "default"]}
                />
                <h3 class="mt-6 text-sm uppercase font-bold text-slate-600 dark:text-zinc-400">Log Buttons</h3>
                <SettingPicker
                    setting={settings.dev.showLogButtons}
                    options={["on", "off", undefined]}
                    name={v => ({
                        'on': "On",
                        'off': "Off",
                        'default': "Default",
                    } as const)[v ?? "default"]}
                />
                <h3 class="mt-6 text-sm uppercase font-bold text-slate-600 dark:text-zinc-400">Proxy URL</h3>
                {/*<ToggleButton  'None' | 'localhost:3772' | 'Custom' */}
                <input
                    class="w-full bg-slate-300 dark:bg-zinc-900 p-2 placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder={"http://localhost:9090/mock/"}
                    ref={el => {
                        createEffect(() => {
                            el.value = settings.dev.mockRequests() ?? "";
                        });
                    }}
                    onChange={v => {
                        settings.dev.mockRequests.setOverride(v.currentTarget.value || undefined);
                    }}
                />
            </ShowAnimate>
        </SettingsSection>
    </div></main>;
    // TODO display:
    // - if the app is ready for offline use
    // - only show the "update now" button if an update is available
    // - improve the version name (maybe display the latest commit hash or smth)
}
