import { createEffect, createSignal, JSX } from "solid-js";
import { render } from "solid-js/web";
import { runTask, Show, showError, UserCancelError } from "tmeta-util-solid";
import { sendMessage } from "webext-bridge";
import browser from "webextension-polyfill";
import { ExtensionSettings } from "../shim";
import { per_client_permissions } from "../all";

function Options(props: { current: ExtensionSettings, update: (settings: ExtensionSettings) => void }): JSX.Element {
    const hasFeature = (name: string) => props.current.features.has(name);
    const hasPermission = (name: string) => props.current.permissions.has(name);
    
    const setFeature = (name: string, value: boolean) => {
        runTask(sendMessage("set-feature", { name, value }).then(props.update), { label: `update ${name}` });
    };

    const ensurePermission = async (client: string): Promise<void> => {
        if (hasPermission(client)) return;
        const resp = await browser.permissions.request(per_client_permissions.get(client) ?? {});
        if (!resp) throw new UserCancelError();
    };

    // Helper to streamline ensuring permission and toggling setting states
    const handleToggle = (client: string | null, feature: string, desired: boolean, inverted: boolean = false) => {
        runTask((async () => {
            if (client) await ensurePermission(client);
            // If inverted, a 'checked' UI state corresponds to an absent feature flag (false)
            setFeature(feature, inverted ? !desired : desired);
        })(), { label: `toggle ${feature}` });
    };

    const resetSettings = () => {
        if (!confirm("Are you sure you want to reset all settings? This cannot be undone.")) return;
        runTask(sendMessage("reset-settings", {}).then(props.update), { label: "reset settings" });
    };

    return (
        <div class="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 font-sans text-slate-900">
            <div class="max-w-3xl mx-auto space-y-8">
                <div>
                    <h1 class="text-3xl font-bold tracking-tight text-slate-900">ThreadClient Options</h1>
                    <p class="mt-2 text-sm text-slate-500">Manage your redirection behavior and advanced preferences.</p>
                </div>

                <section class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                        <h2 class="text-lg font-semibold text-slate-800">Reddit (reddit.com)</h2>
                    </div>
                    <ul class="divide-y divide-slate-100">
                        <SettingRow
                            title="Auto-Redirect to ThreadClient"
                            description="When you click a Reddit link, redirect to ThreadClient."
                            checked={hasPermission("reddit") && hasFeature("reddit:redirect")}
                            onChange={(val) => handleToggle("reddit", "reddit:redirect", val)}
                        />
                        <SettingRow
                            title="Show Redirect Prompt"
                            description="Show a prompt to navigate to ThreadClient while on Reddit."
                            checked={hasPermission("reddit") && !hasFeature("reddit:no-manual-redirect")}
                            onChange={(val) => handleToggle("reddit", "reddit:no-manual-redirect", val, true)}
                        />
                        <SettingRow
                            title="Fix S-Links"
                            description="Fixes ThreadClient to support links to reddit.com/s/..."
                            checked={hasPermission("reddit") && !hasFeature("reddit:no-s-link")}
                            onChange={(val) => handleToggle("reddit", "reddit:no-s-link", val, true)}
                        />
                    </ul>
                </section>

                <section class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                        <h2 class="text-lg font-semibold text-slate-800">Hacker News (news.ycombinator.com)</h2>
                    </div>
                    <ul class="divide-y divide-slate-100">
                        <SettingRow
                            title="Auto-Redirect to ThreadClient"
                            description="When you click a HackerNews link, redirect to ThreadClient."
                            checked={hasPermission("hackernews") && hasFeature("hackernews:redirect")}
                            onChange={(val) => handleToggle("hackernews", "hackernews:redirect", val)}
                        />
                        <SettingRow
                            title="Show Redirect Prompt"
                            description="Show a prompt to navigate to HackerNews while on Reddit."
                            checked={hasPermission("hackernews") && !hasFeature("hackernews:no-manual-redirect")}
                            onChange={(val) => handleToggle("hackernews", "hackernews:no-manual-redirect", val, true)}
                        />
                    </ul>
                </section>

                <section class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                        <h2 class="text-lg font-semibold text-slate-800">Advanced</h2>
                    </div>
                    <ul class="divide-y divide-slate-100">
                        <SettingRow
                            title="Developer Mode"
                            checked={hasFeature("dev")}
                            onChange={(val) => handleToggle(null, "dev", val)}
                        />
                        <li class="flex items-center justify-between py-5 px-6 hover:bg-slate-50 transition-colors">
                            <div class="flex flex-col pr-4">
                                <span class="text-sm font-medium text-slate-900">Reset All Settings</span>
                                <span class="text-sm text-slate-500">Restore your preferences and permissions to their default states.</span>
                            </div>
                            <button
                                onClick={resetSettings}
                                class="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 whitespace-nowrap"
                            >
                                Reset All
                            </button>
                        </li>
                    </ul>
                </section>

                <Show if={hasFeature("dev")}>
                    <div class="bg-slate-900 rounded-2xl shadow-sm overflow-hidden text-slate-300 p-6">
                        <h3 class="text-xs font-mono text-slate-500 mb-4 uppercase tracking-wider">Raw Configuration Object</h3>
                        <pre class="text-xs font-mono overflow-auto whitespace-pre-wrap">
                            <code>{JSON.stringify(props.current, (key, value) => {
                                if (value instanceof Set) return [...value];
                                return value;
                            }, 2)}</code>
                        </pre>
                    </div>
                </Show>
            </div>
        </div>
    );
}

// Reusable List Row with a built-in toggle switch
function SettingRow(props: {
    title: string,
    description?: string,
    checked: boolean,
    onChange: (checked: boolean) => void
}): JSX.Element {
    return (
        <li class="flex items-center justify-between py-5 px-6 hover:bg-slate-50 transition-colors">
            <div class="flex flex-col pr-8">
                <span class="text-sm font-medium text-slate-900">{props.title}</span>
                <Show if={!!props.description}><span class="text-sm text-slate-500 mt-0.5">{props.description}</span></Show>
            </div>
            
            <button
                type="button"
                role="switch"
                aria-checked={props.checked}
                onClick={() => props.onChange(!props.checked)}
                classList={{
                    'bg-indigo-600': props.checked,
                    'bg-slate-200': !props.checked,
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2': true
                }}
            >
                <span class="sr-only">Toggle {props.title}</span>
                <span
                    classList={{
                        'translate-x-5': props.checked,
                        'translate-x-0': !props.checked,
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out': true
                    }}
                />
            </button>
        </li>
    );
}

function OptionsLoader(): JSX.Element {
    const [value, setValue] = createSignal<ExtensionSettings | null>(null);
    createEffect(() => {
        sendMessage("get-settings", {}).then(r => setValue(r)).catch(showError);
    });
    
    return (
        <Show 
            if={value() != null} 
            fallback={
                <div class="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
                    <span class="animate-pulse">Loading preferences...</span>
                </div>
            }
        >
            <Options current={value()!} update={setValue} />
        </Show>
    );
}

render(() => <OptionsLoader />, document.getElementById("main") ?? document.body);