import { resolveThreadClientSupportedURL } from "tmeta-util/src/urls";

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
void (async () => {
    if (sessionStorage.getItem("tc-closed")) return;
    const resolution = resolveThreadClientSupportedURL(location.href);
    if (resolution) (await import("./content_script_main")).main(resolution.client);
})();