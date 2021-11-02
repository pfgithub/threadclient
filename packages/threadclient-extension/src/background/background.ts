import { sendMessage, onMessage } from "webext-bridge";
import browser, { Tabs } from "webextension-polyfill";

// only on dev mode
if (import.meta.hot) {
    // @ts-expect-error for background HMR
    import("/@vite/client");
    // load latest content script
    import("./content_script_hmr");
}

browser.runtime.onInstalled.addListener((): void => {
    // eslint-disable-next-line no-console
    console.log("Extension installed");
});

let previous_tab_id = 0;

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
browser.tabs.onActivated.addListener(({ tabId: tab_id }) => {
    void (async () => {
        if (!previous_tab_id) {
            previous_tab_id = tab_id;
            return;
        }
    
        let tab: Tabs.Tab;
    
        try {
            tab = await browser.tabs.get(previous_tab_id);
            previous_tab_id = tab_id;
        } catch {
            return;
        }
    
        // eslint-disable-next-line no-console
        console.log("previous tab", tab);
        await sendMessage("tab-prev", { title: "???" }, { context: "content-script", tabId: tab_id });
    })();
});

onMessage("get-current-tab", () => {
    void (async () => {
        try {
            const tab = await browser.tabs.get(previous_tab_id);
            return {
                title: tab?.title,
            };
        } catch {
            return {
                title: undefined,
            };
        }
    });
});