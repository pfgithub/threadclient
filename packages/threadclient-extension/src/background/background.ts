import { sendMessage } from "webext-bridge";
import browser from "webextension-polyfill";
// import { sendMessage, onMessage } from "webext-bridge";

// only on dev mode
// @ts-expect-error
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

        const origin_url = new URL(details.originUrl ?? "https://example.com/");
        if(origin_url.hostname === "reddit.com" || origin_url.hostname.endsWith(".reddit.com")) {
            const authorization = (details.requestHeaders ?? [])
                .find(header => header.name === "Authorization")
            ;
            if(!authorization) return;

            const token = authorization.value;//.replace(/^Bearer /, "");
            if(token == null || token.length === 0) return;

            const prev_token = localStorage.getItem("gql_token");
            if(prev_token === token) return; // no change needed

            localStorage.setItem("gql_token", token);

            // might be a good idea to request consent from the user
            // eg:
            // - if they've just gone to reddit.com, show a notification like
            //   "allow threadclient to see if you have unread messages?"
            // or if they get here from a link in threadclient, assume they gave consent.
            // or if there is already a previous token, assume they gave consent.

            return; // no changes to make.
        }else if(origin_url.hostname === "thread.pfg.pw" || (allowDev() && origin_url.hostname === "localhost")) {
            // add the token to the request

            const token = localStorage.getItem("gql_token");
            if(token == null || token.length === 0) return {
                cancel: true,
            };

            (details.requestHeaders ??= []).push({
                name: "Authorization",
                value: token, // already says "Bearer"
            });

            return {
                requestHeaders: details.requestHeaders,
            };
        }else{
            return;
        }
    },
    { urls: ["https://gql.reddit.com/*"] },
    ["blocking", "requestHeaders"],//, "extraHeaders"],
    // for *.reddit.com origin, this should be nonblocking.
    // for thread.pfg.pw origin, this should be blocking.
);

function allowDev(): boolean {
    // return localStorage.getItem("allow-dev") === "true";
    return true;
}

browser.webRequest.onHeadersReceived.addListener(
    (details) => {
        console.log("xt", "onHeadersReceived", details.originUrl);
        const origin_url = new URL(details.originUrl ?? "https://example.com/");
        console.log("xt", origin_url);
        console.log("xt", origin_url.hostname);
        if(origin_url.hostname === "thread.pfg.pw" || (allowDev() && origin_url.hostname === "localhost")) {
            console.log("xt");
            details.responseHeaders ??= [];
            let location: string | null = null;
            details.responseHeaders = details.responseHeaders.filter(h => {
                if(h.name.toLowerCase() === "Access-Control-Allow-Origin".toLowerCase()) {
                    return false;
                }
                if(h.name.toLowerCase() === "Access-Control-Expose-Headers".toLowerCase()) {
                    return false;
                }
                if(h.name.toLowerCase() === "Location".toLowerCase()) {
                    location = h.value ?? "bad-utf8";
                    return false;
                }
                if(h.name.toLowerCase() === "Report-To".toLowerCase()) {
                    return false;
                }
                return true;
            });
            details.responseHeaders.push({
                name: "Access-Control-Allow-Origin",
                value: origin_url.origin,
            });
            details.responseHeaders.push({
                name: "Access-Control-Expose-Headers",
                value: "X-ThreadClient-Extension",
            });
            details.responseHeaders.push({
                name: "X-ThreadClient-Extension",
                value: "1",
            });

            if (location) {
                const resolved = new URL(location, details.url);
                if (resolved.hostname === "www.reddit.com") {
                    // cross-origin redirect; adjust
                    // for s-links.
                    resolved.hostname = "oauth.reddit.com";
                    resolved.pathname += ".json";
                }
                details.responseHeaders.push({
                    name: "Location",
                    value: resolved.toString(),
                });
            }

            return {
                responseHeaders: details.responseHeaders,
            };
        }else{
            console.log("xt", "fail", details.responseHeaders);
            return;
        }
    },
    { urls: ["https://gql.reddit.com/*", "https://oauth.reddit.com/*"] },
    ["blocking", "responseHeaders"],
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