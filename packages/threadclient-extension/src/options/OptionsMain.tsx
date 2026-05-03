import { createEffect, createMemo, createSignal, JSX } from "solid-js";
import { render } from "solid-js/web";
import { ClickAction, localStorageSignal, runTask, Show, showError, UserCancelError } from "tmeta-util-solid";
import { sendMessage } from "webext-bridge";
import browser from "webextension-polyfill";
import { ExtensionSettings } from "../shim";
import { per_client_permissions } from "../all";
// import browser from "webextension-polyfill";

function Options(props: {current: ExtensionSettings, update: (settings: ExtensionSettings) => void}): JSX.Element {
    const [gqlToken, setGqlToken] = localStorageSignal("gql_token");

    const chatIndicatorsEnabled = () => gqlToken() != null && gqlToken()!.startsWith("Bearer ");

    const hasFeature = (name: string) => props.current.features.has(name);
    const hasPermission = (name: string) => props.current.permissions.has(name);
    const setFeature = (name: string, value: boolean) => {
        runTask(sendMessage("set-feature", {name, value}).then(props.update), {label: "update settings"});
    };
    const ensurePermission = async (client: string): Promise<void> => {
        if (hasPermission(client)) return;
        const resp = await browser.permissions.request(per_client_permissions.get(client) ?? {});
        if (!resp) throw new UserCancelError();
    };

    return <div class="m-4">
        <h1>ThreadClient Extension Options</h1>
        <h2>Redirect to ThreadClient</h2>
        <ul>
            <li><CheckSetting
                checked={hasPermission("reddit") && hasFeature("reddit:redirect")}
                action={() => runTask((async () => {
                    await ensurePermission("reddit");
                    setFeature("reddit:redirect", !hasFeature("reddit:redirect"));
                })(), {label: "s-link"})}
                label="Reddit (reddit.com)"
            /></li>
            <li><CheckSetting
                checked={hasPermission("hackernews") && hasFeature("hackernews:redirect")}
                action={() => runTask((async () => {
                    await ensurePermission("hackernews");
                    setFeature("hackernews:redirect", !hasFeature("hackernews:redirect"));
                })(), {label: "s-link"})}
                label="Hacker News (news.ycombinator.com)"
            /></li>
        </ul>
        <h2>Features</h2>
        <ul>
            <li><CheckSetting
                checked={hasPermission("reddit") && !hasFeature("reddit:no-s-link")}
                action={() => runTask((async () => {
                    await ensurePermission("reddit");
                    setFeature("reddit:no-s-link", !hasFeature("reddit:no-s-link"));
                })(), {label: "s-link"})}
                label="Reddit S-Link Fix"
            /></li>
        </ul>
        <h2>Ask to Redirect</h2>
        <ul>
            <li><CheckSetting
                checked={hasPermission("reddit") && !hasFeature("reddit:no-manual-redirect")}
                action={() => runTask((async () => {
                    await ensurePermission("reddit");
                    setFeature("reddit:no-manual-redirect", !hasFeature("reddit:no-manual-redirect"));
                })(), {label: "s-link"})}
                label="Reddit (reddit.com)"
            /></li>
            <li><CheckSetting
                checked={hasPermission("hackernews") && !hasFeature("hackernews:no-manual-redirect")}
                action={() => runTask((async () => {
                    await ensurePermission("hackernews");
                    setFeature("hackernews:no-manual-redirect", !hasFeature("hackernews:no-manual-redirect"));
                })(), {label: "s-link"})}
                label="Hacker News (news.ycombinator.com)"
            /></li>
        </ul>
        <h2>Advanced</h2>
        <ul>
            <li><ClickAction class="underline" action={() => {
                if (!confirm("reset all settings?")) return;
                runTask(sendMessage("reset-settings", {}).then(props.update), {label: "reset settings"});
            }}>Reset all settings</ClickAction></li>
            <li><CheckSetting
                checked={hasFeature("dev")}
                action={() => {
                    setFeature("dev", !hasFeature("dev"));
                }}
                label="Developer Mode"
            /></li>
        </ul>
        <Show if={hasFeature("dev")}>
            <pre><code>{JSON.stringify(props.current, (key, value) => {
                if (value instanceof Set) return [...value];
                return value;
            })}</code></pre>
        </Show>
    </div>;
}

function OptionsLoader(): JSX.Element {
    const [value, setValue] = createSignal<ExtensionSettings | null>(null);
    createEffect(() => {
        sendMessage("get-settings", {}).then(r => setValue(r)).catch(showError);
    });
    return <Show if={value() != null} fallback={"Loading settings…"}><Options current={value()!} update={r => {
        setValue(r);
    }} /></Show>;
}

function CheckSetting(props: {
    checked: boolean, action: ClickAction, label: JSX.Element,
}): JSX.Element {
    return <ClickAction action={props.action} class="">
        <FakeCheckbox checked={props.checked} /> {props.label}
    </ClickAction>;
}

function FakeCheckbox(props: {checked: boolean}): JSX.Element {
    return <div class={"inline-block rounded-sm outline outline-black outline-1 w-3 h-3 border-white border-1 " + (props.checked ? "bg-black" : "")} aria-label={props.checked ? "Checked" : "Unchecked"}></div>
}

render(() => <OptionsLoader />, document.getElementById("main") ?? document.body);
