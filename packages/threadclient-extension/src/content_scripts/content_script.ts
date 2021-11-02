import { onMessage } from "webext-bridge";
import browser from "webextension-polyfill";

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
(() => {
    console.info("[vitesse-webext] Hello world from content script");

    // communication example: send previous tab title from background page
    onMessage("tab-prev", ({ data }: {data: {title: string}}) => {
        console.log(`[vitesse-webext] Navigate from page "${data.title}"`);
    });

    // mount component to context window
    const container = document.createElement("div");
    const root = document.createElement("div");
    const style_el = document.createElement("link");
    // in firefox at least, 
    const shadow_dom = container.attachShadow({ mode: __DEV__ ? "open" : "closed" });
    style_el.setAttribute("rel", "stylesheet");
    style_el.setAttribute("href", browser.runtime.getURL("dist/contentScripts/style.css"));
    shadow_dom.appendChild(style_el);
    shadow_dom.appendChild(root);
    document.body.appendChild(container);

    root.appendChild(document.createTextNode("hi from content script!"));
})();