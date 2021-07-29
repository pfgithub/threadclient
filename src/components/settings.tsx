import { createSignal, JSX } from "solid-js";
import { availableForOfflineUse, link_styles_v, menuButtonStyle, updateAvailable, updateSW } from "../app";
import { ClientProvider, getSettings, ShowBool } from "../util/utils_solid";
import { ClientContent, TopLevelWrapper } from "./author_pfp";
import { variables } from "virtual:_variables";
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
        {"\n"}
        <ShowBool when={updateAvailable()}>
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

export function SettingsPage(props: {_?: undefined}): JSX.Element {
    const {color_scheme, author_pfp, update_notifications: update_notices, custom_video_controls} = getSettings();

    return <div class="client-wrapper"><div class="display-comments-view">
        <SettingsSection title="Color Scheme">
            <button class={menuButtonStyle(color_scheme.compute.override() === "light")} onclick={() => {
                color_scheme.compute.setOverride("light");
            }}>Light</button>
            <button class={menuButtonStyle(color_scheme.compute.override() === "dark")} onclick={() => {
                color_scheme.compute.setOverride("dark");
            }}>Dark</button>
            <button class={menuButtonStyle(color_scheme.compute.override() === undefined)} onclick={() => {
                color_scheme.compute.setOverride(undefined);
            }}>System Default ({{light: "Light", dark: "Dark"}[color_scheme.compute.base()]})</button>
        </SettingsSection>
        <SettingsSection title="Profile Images">
            <button class={menuButtonStyle(author_pfp.compute.override() === "on")} onclick={() => {
                author_pfp.compute.setOverride("on");
            }}>On</button>
            <button class={menuButtonStyle(author_pfp.compute.override() === "off")} onclick={() => {
                author_pfp.compute.setOverride("off");
            }}>Off</button>
            <button class={menuButtonStyle(author_pfp.compute.override() === undefined)} onclick={() => {
                author_pfp.compute.setOverride(undefined);
            }}>Default ({{on: "On", off: "Off"}[author_pfp.compute.base()]})</button>
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
            <button class={menuButtonStyle(update_notices.compute.override() === "on")} onclick={() => {
                update_notices.compute.setOverride("on");
            }}>On</button>
            <button class={menuButtonStyle(update_notices.compute.override() === "off")} onclick={() => {
                update_notices.compute.setOverride("off");
            }}>Off</button>
            <button class={menuButtonStyle(update_notices.compute.override() === undefined)} onclick={() => {
                update_notices.compute.setOverride(undefined);
            }}>Default ({{on: "On", off: "Off"}[update_notices.compute.base()]})</button>
            <p class="my-4">
                Show a notice when an update is available. Updates are installed
                automatically after closing all ThreadReader tabs and refreshing the
                page twice, or manually by clicking the Update button on an Update notice.
            </p>
            <UpdateStatus />
        </SettingsSection>
        <SettingsSection title="Custom Video Controls">
            <button class={menuButtonStyle(custom_video_controls.compute.override() === "custom")} onclick={() => {
                custom_video_controls.compute.setOverride("custom");
            }}>Custom</button>
            <button class={menuButtonStyle(custom_video_controls.compute.override() === "browser")} onclick={() => {
                custom_video_controls.compute.setOverride("browser");
            }}>Browser</button>
            <button class={menuButtonStyle(custom_video_controls.compute.override() === undefined)} onclick={() => {
                custom_video_controls.compute.setOverride(undefined);
            }}>Default ({{custom: "Custom", browser: "Browser"}[custom_video_controls.compute.base()]})</button>
            <p class="my-4">
                Custom video controls are currently work in progress. Once
                they are complete, they will be enabled by default.
            </p>
        </SettingsSection>
    </div></div>;
    // TODO display:
    // - if the app is ready for offline use
    // - only show the "update now" button if an update is available
    // - improve the version name (maybe display the latest commit hash or smth)
}
