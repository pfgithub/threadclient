import React from "react";
import { JSX } from "solid-js";
import { menuButtonStyle } from "../app";
import { ClientProvider, getSettings } from "../util/utils_solid";
import { ClientContent, TopLevelWrapper } from "./author_pfp_solid";
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

export function SettingsPage(props: {_?: undefined}): JSX.Element {
    const {color_scheme, author_pfp} = getSettings();

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
            }}>Default (On)</button>
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
    </div></div>;
}
