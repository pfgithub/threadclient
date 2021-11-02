import { is_firefox, isForbiddenUrl } from "../env";
import browser from "webextension-polyfill";

// Firefox fetch files from cache instead of reloading changes from disk,
// hmr will not work as Chromium based browser
browser.webNavigation.onCommitted.addListener(({ tabId: tab_id, frameId: frame_id, url }) => {
    // Filter out non main window events.
    if (frame_id !== 0) return;

    if (isForbiddenUrl(url)) return;

    // inject the latest scripts
    browser.tabs.executeScript(tab_id, {
        file: `${is_firefox ? "" : "."}/dist/contentScripts/index.global.js`,
        runAt: "document_end",
    }).catch(error => console.error(error));
});