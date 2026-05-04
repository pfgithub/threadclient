import { JSX, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { sendMessage } from "webext-bridge";

declare module "solid-js" {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    namespace JSX {
        interface CustomEvents {
            click: MouseEvent;
            // event delegation doesn't seem to work inside closed shadow roots?
        }
    }
}

// const a = <div class="alert w-400px <sm:w-auto <sm:left-0"></div>;

const [currentURL, setCurrentURL] = createSignal(location.href);

window.addEventListener("locationchange", () => {
    setCurrentURL(location.href);
});

export function showNotifications(
    shadow_dom: Node,
    close: () => void,
    client: string,
): (() => void) {
    let no_ask_again: HTMLInputElement | undefined;
    
    return render(() => <>
        <div class="font-sans w-[calc(100vw-2rem)] sm:w-[400px] bg-zinc-900 border border-zinc-700/60 text-zinc-100 rounded-xl shadow-2xl m-4 p-5 flex flex-col gap-4">
            
            <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-2.5">
                    <div class="bg-blue-500/20 text-blue-400 p-1.5 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"></path>
                            <path d="m21 3-9 9"></path>
                            <path d="M15 3h6v6"></path>
                        </svg>
                    </div>
                    <h3 class="text-base font-semibold m-0">View on ThreadClient?</h3>
                </div>
                
                <div class="flex items-center gap-1 -mr-1 -mt-1">
                    <button 
                        class="text-zinc-400 hover:text-zinc-100 bg-transparent hover:bg-zinc-800 rounded-md p-1.5 cursor-pointer"
                        aria-label="Settings"
                        title="Extension Settings"
                        on:click={() => {
                            sendMessage("open-settings",{}).catch(console.error);
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                    </button>

                    <button 
                        class="text-zinc-400 hover:text-zinc-100 bg-transparent hover:bg-zinc-800 rounded-md p-1.5 cursor-pointer"
                        aria-label="Close notification"
                        on:click={() => {
                            // ignore no_ask_again if you press the close button
                            close();
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18"></path>
                            <path d="m6 6 12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <div>
                <label class="flex items-center gap-2.5 text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer w-fit select-none">
                    <input 
                        type="checkbox" 
                        ref={el => {no_ask_again = el}} 
                        class="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer" 
                    /> 
                    Don't ask again
                </label>
            </div>

            <div class="flex items-center justify-end gap-2.5 mt-1">
                <button 
                    class="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-lg cursor-pointer"
                    on:click={() => {
                        if (no_ask_again?.checked) {
                            sendMessage("set-features", {
                                set: ["redirect:no-ask"],
                                unset: [],
                            }).catch(console.error);
                        }
                        close();
                    }}
                >
                    No
                </button>
                <a 
                    class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md hover:shadow-lg cursor-pointer no-underline inline-flex items-center gap-1.5"
                    href={"https://thread.pfg.pw/#" + currentURL()} 
                    on:click={() => {
                        if (no_ask_again?.checked) {
                            // these should be one message todo
                            sendMessage("set-features", {
                                set: [],
                                unset: ["redirect:no-click-link", "redirect:no-type-url"],
                            }).catch(console.error);
                        }
                    }}
                >
                    Redirect
                </a>
            </div>
            
        </div>
    </>, shadow_dom);
}