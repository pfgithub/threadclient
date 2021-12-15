// import { onMessage } from "webext-bridge";
import { createSignal } from "solid-js";
import browser from "webextension-polyfill";
import "windi.css";
import { showNotifications } from "./threadclient_redirect_notice";

export type NotificationsType = {
    ask_to_redirect: boolean; // only allow one visible max.
    // consider using sessionstorage to hide this if you're navigating.
    // oh jk, sessionstorage lasts across page reloads nvm
};

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
    const shadow_dom = container.attachShadow({ mode: "closed" });
    const style_el = document.createElement("link");
    style_el.setAttribute("rel", "stylesheet");
    style_el.setAttribute("href", browser.runtime.getURL("dist/contentScripts/style.css"));
    shadow_dom.appendChild(style_el);
    shadow_dom.appendChild(root);
    document.body.appendChild(container);

    const [notifications, setNotifications] = createSignal<NotificationsType>({
        ask_to_redirect: false,
    });

    if(location.pathname.startsWith("/chat")) {
        // don't show a redirect notice, we don't support chat.
    }else{
        // TODO check if the page is supported in threadclient by exporting the
        // actual router data.
        setNotifications(v => ({
            ...v,
            ask_to_redirect: true,
        }));
    }
    showNotifications(shadow_dom, notifications, setNotifications);
})();