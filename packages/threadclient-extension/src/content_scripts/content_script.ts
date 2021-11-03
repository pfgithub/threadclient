// import { onMessage } from "webext-bridge";
import browser from "webextension-polyfill";
import "windi.css";
import { showRedirectNotice } from "./threadclient_redirect_notice";

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
void (async () => {
    if(!location.hostname.endsWith(".reddit.com") && location.hostname !== "reddit.com") {
        return; // nothing to do
    }

    console.info("[vitesse-webext] Hello world from content script");

    // communication example: send previous tab title from background page
    // onMessage("tab-prev", ({ data }: {data: {title: string}}) => {
    //     console.log(`[vitesse-webext] Navigate from page "${data.title}"`);
    // });

    // mount component to context window
    const container = document.createElement("div");

    container.setAttribute("style", `
        position: fixed;
        bottom: 0;
        right: 0;
        max-height: 100vh;
        overflow-y: auto;
        z-index: 1000000;
    `);

    const root = document.createElement("div");
    root.setAttribute("data-tc", "tc-data");
    // in firefox at least, closed is just as easy to debug. not sure what this is for?
    const shadow_dom = container.attachShadow({ mode: __DEV__ ? "open" : "closed" });
    const style_el = document.createElement("link");
    style_el.setAttribute("rel", "stylesheet");
    style_el.setAttribute("href", browser.runtime.getURL("dist/contentScripts/style.css"));
    shadow_dom.appendChild(style_el);
    shadow_dom.appendChild(root);
    document.body.appendChild(container);

    showRedirectNotice(shadow_dom);
})();