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

    const grantPermission = (client: string) => {
        runTask((async () => {
            await ensurePermission(client);
            // Refresh settings after granting permission so the UI updates
            const newSettings = await sendMessage("get-settings", {});
            props.update(newSettings);
        })(), { label: `grant permission ${client}` });
    };

    const handleToggle = (client: string | null, feature: string, desired: boolean, inverted: boolean = false) => {
        runTask((async () => {
            if (client) await ensurePermission(client);
            setFeature(feature, inverted ? !desired : desired);
        })(), { label: `toggle ${feature}` });
    };

    const resetSettings = () => {
        if (!confirm("Are you sure you want to reset all settings? This cannot be undone.")) return;
        runTask(sendMessage("reset-settings", {}).then(props.update), { label: "reset settings" });
    };

    return (
        <div class="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
            <div class="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <h1 class="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">ThreadClient Extension</h1>

                {/* Reddit Section */}
                <section class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all hover:shadow-md">
                    <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-orange-50/50 dark:bg-orange-500/10 flex items-center gap-3">
                        <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Reddit <a href="https://www.reddit.com" class="text-slate-400 dark:text-slate-500 text-sm font-normal ml-1 hover:underline">reddit.com</a></h2>
                    </div>
                    <Show 
                        if={hasPermission("reddit")}
                        fallback={
                            <div class="px-6 py-8 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900">
                                <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    ThreadClient Extension needs permission to access Reddit to enable these features.
                                </p>
                                <button
                                    onClick={() => grantPermission("reddit")}
                                    class="px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                                >
                                    Grant Permission
                                </button>
                            </div>
                        }
                    >
                        <ul class="divide-y divide-slate-100 dark:divide-slate-800/50">
                            <SettingRow
                                title="Auto-Redirect to ThreadClient"
                                description="Automatically open Reddit links in ThreadClient."
                                checked={hasFeature("reddit:redirect")}
                                onChange={(val) => handleToggle("reddit", "reddit:redirect", val)}
                                theme="reddit"
                            />
                            <SettingRow
                                title="Show Redirect Prompt"
                                description="Show a prompt to navigate to ThreadClient while browsing Reddit."
                                checked={!hasFeature("reddit:no-manual-redirect")}
                                onChange={(val) => handleToggle("reddit", "reddit:no-manual-redirect", val, true)}
                                theme="reddit"
                            />
                            <SettingRow
                                title="Fix S-Links"
                                description="Enables support for short links (reddit.com/s/...) in ThreadClient."
                                checked={!hasFeature("reddit:no-s-link")}
                                onChange={(val) => handleToggle("reddit", "reddit:no-s-link", val, true)}
                                theme="reddit"
                            />
                        </ul>
                    </Show>
                </section>

                {/* Hacker News Section */}
                <section class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all hover:shadow-md">
                    <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-500/10 flex items-center gap-3">
                        <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Hacker News <a href="https://news.ycombinator.com" class="text-slate-400 dark:text-slate-500 text-sm font-normal ml-1 hover:underline">news.ycombinator.com</a></h2>
                    </div>
                    <Show 
                        if={hasPermission("hackernews")}
                        fallback={
                            <div class="px-6 py-8 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900">
                                <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    ThreadClient needs permission to access Hacker News to enable these features.
                                </p>
                                <button
                                    onClick={() => grantPermission("hackernews")}
                                    class="px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                                >
                                    Grant Permission
                                </button>
                            </div>
                        }
                    >
                        <ul class="divide-y divide-slate-100 dark:divide-slate-800/50">
                            <SettingRow
                                title="Auto-Redirect to ThreadClient"
                                description="Automatically open HackerNews links in ThreadClient."
                                checked={hasFeature("hackernews:redirect")}
                                onChange={(val) => handleToggle("hackernews", "hackernews:redirect", val)}
                                theme="hn"
                            />
                            <SettingRow
                                title="Show Redirect Prompt"
                                description="Show a prompt to navigate to ThreadClient while browsing HackerNews."
                                checked={!hasFeature("hackernews:no-manual-redirect")}
                                onChange={(val) => handleToggle("hackernews", "hackernews:no-manual-redirect", val, true)}
                                theme="hn"
                            />
                        </ul>
                    </Show>
                </section>

                {/* Advanced Section */}
                <section class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all hover:shadow-md">
                    <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center gap-3">
                        <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Advanced Settings</h2>
                    </div>
                    <ul class="divide-y divide-slate-100 dark:divide-slate-800/50">
                        <SettingRow
                            title="Developer Mode"
                            checked={hasFeature("dev")}
                            onChange={(val) => handleToggle(null, "dev", val)}
                            theme="default"
                        />
                    </ul>
                    
                    {/* Danger Zone */}
                    <div class="px-6 py-5 bg-red-50/50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/30 flex items-center justify-between">
                        <div class="flex flex-col pr-4">
                            <span class="text-sm font-semibold text-red-900 dark:text-red-400">Reset All Settings</span>
                            <span class="text-sm text-red-700/80 dark:text-red-400/70 mt-0.5">Restore your preferences and permissions to default.</span>
                        </div>
                        <button
                            onClick={resetSettings}
                            class="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-500/20 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 whitespace-nowrap active:scale-95"
                        >
                            Reset Defaults
                        </button>
                    </div>
                </section>

                {/* Developer Raw JSON */}
                <Show if={hasFeature("dev")}>
                    <div class="bg-[#0d1117] border border-slate-700 rounded-2xl shadow-xl overflow-hidden mt-8">
                        <div class="px-4 py-2 border-b border-slate-800 bg-[#161b22] flex items-center gap-2">
                            <div class="flex gap-1.5">
                                <div class="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                                <div class="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                                <div class="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                            </div>
                            <span class="text-xs font-mono text-slate-400 ml-2">raw_config.json</span>
                        </div>
                        <div class="p-4 overflow-auto max-h-96">
                            <pre class="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                                <code>{JSON.stringify(props.current, (key, value) => {
                                    if (value instanceof Set) return [...value];
                                    return value;
                                }, 2)}</code>
                            </pre>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
}

function SettingRow(props: {
    title: string,
    description?: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    theme?: "reddit" | "hn" | "default"
}): JSX.Element {
    
    // Determine active colors based on section theme
    const activeRingColor = 
        props.theme === 'reddit' ? 'focus:ring-orange-500' : 
        props.theme === 'hn' ? 'focus:ring-amber-500' : 
        'focus:ring-indigo-500';
        
    const activeBgColor = 
        props.theme === 'reddit' ? 'bg-orange-600 dark:bg-orange-500' : 
        props.theme === 'hn' ? 'bg-amber-500 dark:bg-amber-500' : 
        'bg-indigo-600 dark:bg-indigo-500';

    return (
        <li class="flex items-center justify-between py-4 px-6 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
            <div class="flex flex-col pr-8">
                <span class="text-sm font-medium text-slate-900 dark:text-slate-200 group-hover:text-black dark:group-hover:text-white transition-colors">{props.title}</span>
                <Show if={!!props.description}>
                    <span class="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-snug">{props.description}</span>
                </Show>
            </div>
            
            <button
                type="button"
                role="switch"
                aria-checked={props.checked}
                onClick={() => props.onChange(!props.checked)}
                class={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${activeRingColor} ${props.checked ? activeBgColor : 'bg-slate-200 dark:bg-slate-700'}`}
            >
                <span class="sr-only">Toggle {props.title}</span>
                <span
                    class={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${props.checked ? 'translate-x-5' : 'translate-x-0'}`}
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
                <div class="min-h-screen flex flex-col gap-4 items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                    <svg class="animate-spin h-8 w-8 text-indigo-600 dark:text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span class="text-sm font-medium animate-pulse">Loading preferences...</span>
                </div>
            }
        >
            <Options current={value()!} update={setValue} />
        </Show>
    );
}

render(() => <OptionsLoader />, document.getElementById("main") ?? document.body);