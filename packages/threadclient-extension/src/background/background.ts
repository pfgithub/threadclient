import { resolveThreadClientSupportedURL } from "tmeta-util";
import { onMessage } from "webext-bridge";
import browser, { storage } from "webextension-polyfill";
import { ExtensionSettings } from "../shim";
import { all_optional_origins, all_optional_permissions } from "../all";
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
    browser.runtime.openOptionsPage().catch(console.error);
});

// automatic redirect
// TODO only when enabled + with permission
browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.type !== "main_frame" || details.method !== "GET") {
            return;
        }

        // TODO: we should reuse unsafeLinkToSafeLink here
        const resolved = resolveThreadClientSupportedURL(details.url);
        if(resolved != null) {
            if (!settings_cache?.features.has(`${resolved.client}:redirect`)) return; // automatic redirect on this url is disabled
            // don't redirect if we got here from a link on threadclient or
            // a link on reddit.com

            if(details.originUrl === undefined) {
                return; // navigating by manually entering the url
            }

            const origin_url = new URL(details.originUrl);
            const origin_resolved = resolveThreadClientSupportedURL(details.originUrl);
            if (origin_url.hostname === "thread.pfg.pw") {
                // so if you click a raw! link on threadclient, it links out
                return;
            }
            if (origin_resolved?.client === resolved.client) {
                // so if you click a reddit link on reddit, it stays on reddit
                // but if you click a hackernews link on reddit, it goes to threadclient
                return;
            }

            // TODO: don't redirect if threadclient doesn't support the page
            return { redirectUrl: "https://thread.pfg.pw/"+details.url };
        }

        return;
    },
    { urls: [...all_optional_origins] },
    ["blocking"],
);

function allowDev(): boolean {
    // return localStorage.getItem("allow-dev") === "true";
    return true;
}

browser.webRequest.onHeadersReceived.addListener(
    (details) => {
        // console.log("xt", "onHeadersReceived", details.originUrl);
        const origin_url = new URL(details.originUrl ?? "https://example.com/");
        // console.log("xt", origin_url);
        // console.log("xt", origin_url.hostname);
        if(origin_url.hostname === "thread.pfg.pw" || (allowDev() && origin_url.hostname === "localhost")) {
            // console.log("xt");
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
                    resolved.search = "?s=" + encodeURIComponent(resolved.toString());
                    resolved.hostname = "oauth.reddit.com";
                    resolved.pathname = "/api/needs_captcha.json";
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
            // console.log("xt", "fail", details.responseHeaders);
            return;
        }
    },
    { urls: ["https://gql.reddit.com/*", "https://oauth.reddit.com/*"] },
    ["blocking", "responseHeaders"],
);

browser.permissions.onAdded.addListener(queueUpdateSettings);
browser.permissions.onRemoved.addListener(queueUpdateSettings);
browser.storage.onChanged.addListener(queueUpdateSettings);
let settings_cache: ExtensionSettings | undefined;

async function updateSettings(): Promise<void> {
    const features_req = storage.local.get(["features"]);
    const perms_req = browser.permissions.getAll();
    const features = await features_req;
    const perms = await perms_req;

    const features_set = new Set<string>(features["features"]?.split(",") ?? []);
    const permissions = new Set<string>();
    const origins = new Set(perms?.origins ?? []);
    if (origins.has("*://*.reddit.com/*")) permissions.add("reddit");
    if (origins.has("*://news.ycombinator.com/*")) permissions.add("hackernews");

    settings_cache = {
        features: features_set,
        permissions,
    };
}
let updating = false;
let update_again = false;
let update_listeners: (() => void)[] = [];
function queueUpdateSettings(): void {
    if (updating) {
        update_again = true;
        return;
    }
    updating = true;
    updateSettings().then(() => {
        updating = false;
        if (update_again) {
            update_again = false;
            queueUpdateSettings();
        } else {
            // done, announce
            for (const listener of update_listeners.splice(0, update_listeners.length)) {
                listener();
            }
        }
    });
}
async function getSettings(): Promise<ExtensionSettings> {
    queueUpdateSettings();
    await new Promise<void>(r => update_listeners.push(r));
    return settings_cache!;
}
onMessage("reset-settings", async (): Promise<ExtensionSettings> => {
    await storage.local.remove(["features"]);
    await browser.permissions.remove({permissions: [...all_optional_permissions], origins: [...all_optional_origins]});
    // browser.permissions.remove(); // TODO
    return await getSettings();
});
onMessage("get-settings", async (): Promise<ExtensionSettings> => {
    return await getSettings();
});
onMessage("set-feature", async (opts): Promise<ExtensionSettings> => {
    const features_req = storage.local.get(["features"]);
    const features_value = await features_req;
    const features = new Set<string>(features_value["features"]?.split(",") ?? []);
    if (opts.data.value) {
        features.add(opts.data.name);
    } else {
        features.delete(opts.data.name);
    }
    await storage.local.set({features: features.size === 0 ? undefined : [...features].join(",")});
    return await getSettings();
});

queueUpdateSettings();

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