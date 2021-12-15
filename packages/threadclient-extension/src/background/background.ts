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

            if(details.originUrl === undefined) {
                return; // navigating by manually entering the url
            }

            const origin_url = new URL(details.originUrl);
            if(origin_url.hostname === "thread.pfg.pw"
            || origin_url.hostname === "reddit.com"
            || origin_url.hostname.endsWith(".reddit.com")) {
                return;
            }

            // TODO: don't redirect if threadclient doesn't support the page
            
            return { redirectUrl: "https://thread.pfg.pw/"+details.url };
        }

        return;
    },
    { urls: ["*://*.reddit.com/*"] },
    ["blocking"],
);

browser.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        if(details.method !== "POST") return;

        console.log("GOT WEB REQUEST1:", details.url, details);

        const url = new URL(details.url);

        if(url.hostname === "gql.reddit.com") {
            const origin_url = new URL(details.originUrl ?? "https://example.com/");
            if(origin_url.hostname !== "reddit.com" && !origin_url.hostname.endsWith(".reddit.com")) {
                return; // ignore requests from eg:
                // - thread.pfg.pw (it's not useful to take a token from ourself)
                // - other sites if for whatever reason they wanted to send a request to
                //   gql.reddit.com with a fake token
            }

            const authorization = (details.requestHeaders ?? [])
                .find(header => header.name === "Authorization")
            ;
            if(!authorization) return;

            const token = authorization.value;//.replace(/^Bearer /, "");
            if(token == null || token.length === 0) return;

            console.log("Got GQL Token:", token);

            const prev_token = localStorage.getItem("gql_token");
            if(prev_token === token) return; // no change needed

            localStorage.setItem("gql_token", token);

            // might be a good idea to request consent from the user
            // eg:
            // - if they've just gone to reddit.com, show a notification like
            //   "allow threadclient to see if you have unread messages?"
            // or if they get here from a link in threadclient, assume they gave consent.
            // or if there is already a previous token, assume they gave consent.
        }
    },
    { urls: ["https://gql.reddit.com/*"] },
    ["requestHeaders"],//, "extraHeaders"], // nonblocking
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