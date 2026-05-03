import { JSX } from "solid-js";
import { render } from "solid-js/web";
import { resolveThreadClientSupportedURL } from "tmeta-util";
import { Show } from "tmeta-util-solid";
import browser from "webextension-polyfill";

function Popup(props: { tab?: browser.Tabs.Tab }): JSX.Element {
    const supported = resolveThreadClientSupportedURL(props.tab?.url ?? "");
    const currentUrl = props.tab?.url ?? "";

    return (
        <div class="w-64 p-4 bg-white dark:bg-slate-900 flex flex-col gap-3 font-sans antialiased text-slate-800 dark:text-slate-200">
            
            {/* Header Area */}
            <div class="text-center border-b border-slate-200 dark:border-slate-700 pb-3 mb-1">
                <h1 class="text-base font-bold tracking-tight">ThreadClient</h1>
            </div>

            {/* Primary Action */}
            <Show 
                if={supported != null} 
                fallback={
                    <a 
                        href={`https://thread.pfg.pw/#shell/find-threads?u=${encodeURIComponent(currentUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex flex-col items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white transition-colors bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                    >
                        <div>Find Discussions</div>
                    </a>
                }
            >
                <a 
                    href={`https://thread.pfg.pw/#${currentUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white transition-colors bg-emerald-600 rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                    Open in ThreadClient
                </a>
            </Show>

            {/* Secondary Action */}
            <button 
                onClick={() => {
                    void browser.runtime.openOptionsPage();
                    window.close();
                }}
                class="flex items-center justify-center w-full px-4 py-2 text-sm font-medium transition-colors rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
                Options
            </button>
            
        </div>
    );
}

browser.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
        render(() => <Popup tab={tabs[0]} />, document.getElementById("main") ?? document.body);
    })
    .catch(e => {
        console.error(e);
        // Tailwind styled error state in case the query fails
        const errorDiv = document.createElement("div");
        errorDiv.className = "w-64 p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 font-sans";
        errorDiv.textContent = `Error: ${e.toString()}`;
        document.body.appendChild(errorDiv);
    });