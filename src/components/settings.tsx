import { createSignal, For, JSX } from "solid-js";
import { availableForOfflineUse, link_styles_v, menuButtonStyle, updateAvailable, updateSW } from "../app";
import { ClientProvider, ComputeProperty, getSettings, ShowBool, ShowCond } from "../util/utils_solid";
import { ClientContent, TopLevelWrapper } from "./author_pfp";
import { variables } from "virtual:_variables";
import { RichtextParagraphs } from "./richtext";
import { rt } from "../types/generic";
export * from "../util/interop_solid";

function SettingsSection(props: {title: string, children?: JSX.Element}): JSX.Element {
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
        <ShowBool when={updateAvailable()}>
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
        </ShowBool>
    </p>;
}

function SettingPicker<T extends string>(props: {
    setting: ComputeProperty<T>,
    options: (T | undefined)[],
    name: (a: T | undefined) => string,
}): JSX.Element {
    return <div>
        <For each={props.options}>{option => <>
            <button
                class={menuButtonStyle(props.setting.compute.override() === option)}
                onclick={() => {
                    props.setting.compute.setOverride(option);
                }}
            >
                <ShowCond when={option}
                    fallback={
                        <>{props.name(undefined)} ({props.name(props.setting.compute.base())})</>
                    }
                >{opt => <>
                    {props.name(opt)}
                </>}</ShowCond>
            </button>
        </>}</For>
    </div>;
}

export function SettingsPage(props: {_?: undefined}): JSX.Element {
    return <div class="client-wrapper"><div class="display-comments-view">
        <SettingsSection title="Color Scheme">
            <SettingPicker
                setting={getSettings().color_scheme}
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
                setting={getSettings().author_pfp}
                options={["on", "off", undefined]}
                name={v => ({
                    on: "On",
                    off: "Off",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <div class="bg-body rounded-xl max-w-xl" style={{'padding': "10px", 'margin-top': "10px"}}>
                <ClientProvider client={{
                    id: "reddit",
                    getThread: () => {throw new Error("no")},
                    act: () => {throw new Error("no")},
                    previewReply: () => {throw new Error("no")},
                    sendReply: () => {throw new Error("no")},
                    loadMore: () => {throw new Error("no")},
                    loadMoreUnmounted: () => {throw new Error("no")},
                }}>
                    <ClientContent listing={{
                        kind: "post",

                        title: null,
                        author: {
                            name: "pfg___",
                            color_hash: "pfg___",
                            link: "/u/pfg___",
                            pfp: {
                                url: "https://www.redditstatic.com/avatars/avatar_default_02_FF8717.png",
                                hover: "https://www.redditstatic.com/avatars/avatar_default_02_FF8717.png",
                            },
                        },
                        show_replies_when_below_pivot: {
                            default_collapsed: false,
                        },
                        body: {
                            kind: "richtext",
                            content: [{kind: "paragraph", children: [
                                {kind: "text", text: "This is an example comment!", styles: {}},
                            ]}],
                        },
                    }} opts={{
                        clickable: false,
                        replies: null,
                        at_or_above_pivot: false,
                        is_pivot: false,
                        top_level: true,
                    }} />
                </ClientProvider>
            </div>
        </SettingsSection>
        <SettingsSection title="Update Notices">
            <SettingPicker
                setting={getSettings().update_notifications}
                options={["on", "off", undefined]}
                name={v => ({
                    on: "On",
                    off: "Off",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <p class="my-4">
                Show a notice when an update is available. Updates are installed
                automatically after closing all ThreadReader tabs and refreshing the
                page twice, or manually by clicking the Update button on an Update notice.
            </p>
            <UpdateStatus />
        </SettingsSection>
        <SettingsSection title="Link Helpers">
            <SettingPicker
                setting={getSettings().link_helpers}
                options={["show", "hide", undefined]}
                name={v => ({
                    show: "Show",
                    hide: "Hide",
                    default: "Default",
                } as const)[v ?? "default"]}
            />
            <ClientProvider client={{
                id: "",
                getThread: () => {throw new Error("no")},
                act: () => {throw new Error("no")},
                previewReply: () => {throw new Error("no")},
                sendReply: () => {throw new Error("no")},
                loadMore: () => {throw new Error("no")},
                loadMoreUnmounted: () => {throw new Error("no")},
            }}>
                <RichtextParagraphs content={[
                    rt.p(
                        rt.txt("Optionally show link helpers to make it easier to click small links"),
                    ),
                    rt.p(
                        rt.txt("I put a small link "),
                        rt.link("/settings", {}, rt.txt("here")),
                        rt.txt(" to demo the functionality."),
                    ),
                    rt.p(
                        rt.txt("There are some more "),
                        rt.link("https://i.redd.it/p0y4mrku6xh61.png", {}, rt.txt("small links")),
                        rt.txt(" in "),
                        rt.link("https://en.wikipedia.org/wiki/Special:Random", {}, rt.txt("this")),
                        rt.txt(" paragraph."),
                    ),
                ]} />
            </ClientProvider>
        </SettingsSection>
        <SettingsSection title="Custom Video Controls">
            <SettingPicker
                setting={getSettings().custom_video_controls}
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
            <div class="bg-body rounded-xl max-w-xl" style={{'padding': "10px", 'margin-top': "10px"}}>
                <ClientProvider client={{
                    id: "n/a",
                    getThread: () => {throw new Error("no")},
                    act: () => {throw new Error("no")},
                    previewReply: () => {throw new Error("no")},
                    sendReply: () => {throw new Error("no")},
                    loadMore: () => {throw new Error("no")},
                    loadMoreUnmounted: () => {throw new Error("no")},
                }}>
                    <ClientContent listing={{
                        kind: "post",

                        title: {text: "Video Example", body_collapsible: {default_collapsed: true}},
                        author: null,
                        show_replies_when_below_pivot: false,
                        body: {
                            kind: "video",
                            gifv: false,
                            source: {
                                kind: "video",
                                thumbnail: "https://commondatastorage.googleapis.com/"
                                + "gtv-videos-bucket/sample/images/BigBuckBunny.jpg",
                                sources: [
                                    {
                                        url: "https://broken-link/",
                                        quality: "1080p",
                                    },
                                    {
                                        url: "https://commondatastorage.googleapis.com/"
                                        + "gtv-videos-bucket/sample/BigBuckBunny.mp4",
                                        quality: "720p",
                                    },
                                    {
                                        url: "https://broken-link/",
                                        quality: "480p",
                                    },
                                ],
                            },
                        },
                    }} opts={{
                        clickable: false,
                        replies: null,
                        at_or_above_pivot: false,
                        is_pivot: false,
                        top_level: true,
                    }} />
                </ClientProvider>
            </div>
        </SettingsSection>
        <SettingsSection title="Developer Options">
            <h3 class="text-md font-light text-gray-600">Page Version</h3>
            <SettingPicker
                setting={getSettings().page_version}
                options={["1", "2", undefined]}
                name={v => ({
                    '1': "V1",
                    '2': "V2",
                    'default': "Default",
                } as const)[v ?? "default"]}
            />
        </SettingsSection>
    </div></div>;
    // TODO display:
    // - if the app is ready for offline use
    // - only show the "update now" button if an update is available
    // - improve the version name (maybe display the latest commit hash or smth)
}
