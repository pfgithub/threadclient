// import { onMessage } from "webext-bridge";
import browser from "webextension-polyfill";
import "windi.css";
import { showNotifications } from "./threadclient_redirect_notice";

export type NotificationsType = {
    ask_to_redirect: boolean, // only allow one visible max.
    // consider using sessionstorage to hide this if you're navigating.
    // oh jk, sessionstorage lasts across page reloads nvm
};

export function main(client: string) {
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

    const unregister = showNotifications(shadow_dom, () => {
        unregister();
        root.remove();
        sessionStorage.setItem("tc-closed", "true");
    }, client);
}
