import browser from "webextension-polyfill";
// import { sendMessage, onMessage } from "webext-bridge";

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

// automatic redirect
// TODO only when enabled + with permission
browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.type !== "main_frame" || details.method !== "GET") {
            return;
        }

        const url = new URL(details.url);
        if(url.hostname === "reddit.com" || url.hostname.endsWith(".reddit.com")) {
            // don't redirect if we got here from a link on threadclient or
            // a link on reddit.com
            if(details.originUrl !== undefined) {
                const origin_url = new URL(details.originUrl);
                if(origin_url.hostname === "thread.pfg.pw"
                || origin_url.hostname === "reddit.com"
                || origin_url.hostname.endsWith(".reddit.com")) {
                    return;
                }
            }

            // TODO: don't redirect if threadclient doesn't support the page
            
            return { redirectUrl: "https://thread.pfg.pw/"+details.url };
        }
        return;
    },
    { urls: ["<all_urls>"] },
    ["blocking"],
);

// communication example: send previous tab title from background page
// see shim.d.ts for type declaration
// browser.tabs.onActivated.addListener(({ tabId: tab_id }) => {
//     void (async () => {
//         if (!previous_tab_id) {
//             previous_tab_id = tab_id;
//             return;
//         }
    
//         let tab: Tabs.Tab;
    
//         try {
//             tab = await browser.tabs.get(previous_tab_id);
//             previous_tab_id = tab_id;
//         } catch {
//             return;
//         }
    
//         // eslint-disable-next-line no-console
//         console.log("previous tab", tab);
//         await sendMessage("tab-prev", { title: "???" }, { context: "content-script", tabId: tab_id });
//     })();
// });

// onMessage("get-current-tab", () => {
//     void (async () => {
//         try {
//             const tab = await browser.tabs.get(previous_tab_id);
//             return {
//                 title: tab?.title,
//             };
//         } catch {
//             return {
//                 title: undefined,
//             };
//         }
//     });
// });