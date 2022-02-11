import { rt } from "api-types-generic";
import { createSignal, For, JSX } from "solid-js";
import { Show } from "tmeta-util-solid";
import { variables } from "virtual:_variables";
import { availableForOfflineUse, link_styles_v, menuButtonStyle, updateAvailable, updateSW } from "../app";
import { ComputeProperty, getSettings } from "../util/utils_solid";
import { ShowAnimate } from "./animation";
import { ClientContent, TopLevelWrapper } from "./page2";
import { RichtextParagraphs } from "./richtext";
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
    return <div>
        <For each={props.options}>{option => <>
            <button
                class={menuButtonStyle(props.setting.compute.override() === option)}
                aria-checked={props.setting.compute.override() === option}
                onclick={() => {
                    props.setting.compute.setOverride(option);
                }}
            >
                <Show when={option}
                    fallback={
                        <>{props.name(undefined)} ({props.name(props.setting.compute.base())})</>
                    }
                >{opt => <>
                    {props.name(opt)}
                </>}</Show>
            </button>
        </>}</For>
    </div>;
}

export function SettingsPage(props: {_?: undefined}): JSX.Element {
    const [showDevSettings, setShowDevSettings] = createSignal(false);
    const settings = getSettings();

    return <main class="client-wrapper"><div class="display-comments-view">
        <SettingsSection title="Color Scheme">
            <SettingPicker
                setting={settings.color_scheme}
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
                setting={settings.author_pfp}
                options={["on", "off", undefined]}
                name={v => ({
                    on: "On",
                    off: "Off",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <TopLevelWrapper restrict_w>
                <ClientContent listing={{
                    kind: "post",

                    title: null,
                    author: {
                        name: "pfg___",
                        client_id: "reddit",
                        color_hash: "pfg___",
                        link: "/u/pfg___",
                        pfp: {
                            url: "https://www.redditstatic.com/avatars/avatar_default_02_FF8717.png",
                            hover: "https://www.redditstatic.com/avatars/avatar_default_02_FF8717.png",
                        },
                    },
                    collapsible: {default_collapsed: false},
                    show_replies_when_below_pivot: true,
                    body: {
                        kind: "richtext",
                        content: [{kind: "paragraph", children: [
                            {kind: "text", text: "This is an example comment!", styles: {}},
                        ]}],
                    },
                }} opts={{
                    clickable: false,
                    frame: null,
                    replies: null,
                    client_id: "",
                    at_or_above_pivot: false,
                    is_pivot: false,
                }} />
            </TopLevelWrapper>
        </SettingsSection>
        <SettingsSection title="Update Notices">
            <SettingPicker
                setting={settings.update_notifications}
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
        <SettingsSection title="Link Helpers">
            <SettingPicker
                setting={settings.link_helpers}
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
                setting={settings.custom_video_controls}
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
            <TopLevelWrapper restrict_w>
                <ClientContent listing={{
                    kind: "post",

                    title: {text: "Video Example"},
                    collapsible: {default_collapsed: true},
                    show_replies_when_below_pivot: false,
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
                    clickable: false,
                    frame: null,
                    client_id: "n/a",
                    replies: null,
                    at_or_above_pivot: false,
                    is_pivot: false,
                }} />
            </TopLevelWrapper>
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
            <ShowAnimate when={settings.motion.value() === "full"}>
                <div><For each={[0, 0.1, 0.2, 0.3, undefined]}>{option => {
                    const setting = settings.animation_time;
                    const name = (v: number | undefined) => {
                        if(v == null) return "Default";
                        return "" + v + "s";
                    };
                    return <button
                        class={menuButtonStyle(setting.compute.override() === option)}
                        onclick={() => {
                            setting.compute.setOverride(option);
                        }}
                    >
                        <Show when={option}
                            fallback={
                                <>{name(undefined)} ({name(setting.compute.base())})</>
                            }
                        >{opt => <>
                            {name(opt)}
                        </>}</Show>
                    </button>;
                }}</For></div>
                <SettingPicker
                    setting={settings.animation_dev_mode}
                    options={["none", "shift_slow", undefined]}
                    name={v => ({
                        none: "None",
                        shift_slow: "Shift to Slow Animation",
                        default: "Default",
                    } as const)[v ?? "default"]}
                />
            </ShowAnimate>
            <TopLevelWrapper restrict_w>
                <ClientContent listing={{
                    kind: "post",

                    title: {text: "Motion Example"},
                    collapsible: {default_collapsed: false},
                    show_replies_when_below_pivot: true,
                    body: {
                        kind: "richtext",
                        content: [
                            rt.p(rt.txt("Click the collapse button to the left to see an example")),
                        ],
                    },
                }} opts={{
                    clickable: false,
                    frame: null,
                    client_id: "n/a",
                    replies: null,
                    at_or_above_pivot: false,
                    is_pivot: false,
                }} />
            </TopLevelWrapper>
        </SettingsSection>
        <SettingsSection title="Developer Options">
            <p class="my-2">
                Leave all these default. Changing these will break things.{" "}
            </p>
            <ShowAnimate
                when={showDevSettings()}
                fallback={<button
                    class={link_styles_v["outlined-button"]}
                    onclick={() => setShowDevSettings(true)}
                >Show Anyway</button>}
            >
                <h3 class="text-lg font-light text-gray-600">Page Version</h3>
                <SettingPicker
                    setting={settings.page_version}
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
                <h3 class="text-lg font-light text-gray-600">Cors Proxy</h3>
                <SettingPicker
                    setting={settings.cors_proxy}
                    options={["on", "off", undefined]}
                    name={v => ({
                        'on': "On",
                        'off': "Off",
                        'default': "Default",
                    } as const)[v ?? "default"]}
                />
                <p class="my-2">
                    Uses a proxy to bypass CORS restrictions. This will allow
                    for improved rendering of twitter link previews and enable
                    scrubbing in animated gifs.
                </p>
            </ShowAnimate>
        </SettingsSection>
    </div></main>;
    // TODO display:
    // - if the app is ready for offline use
    // - only show the "update now" button if an update is available
    // - improve the version name (maybe display the latest commit hash or smth)
}
