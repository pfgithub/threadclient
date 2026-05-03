import { JSX, createSignal } from "solid-js";
import { render } from "solid-js/web";
import { sendMessage } from "webext-bridge";

declare module "solid-js" {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    namespace JSX {
        interface CustomEvents {
            click: MouseEvent;
            // event delegation doesn't seem to work inside closed shadow roots?
        }
    }
}

// const a = <div class="alert w-400px <sm:w-auto <sm:left-0"></div>;

const [currentURL, setCurrentURL] = createSignal(location.href);

window.addEventListener("locationchange", () => {
    setCurrentURL(location.href);
});

export function showNotifications(
    shadow_dom: Node,
    close: () => void,
    client: string,
): (() => void) {
    let no_ask_again: HTMLInputElement | undefined;
    return render(() => <>
        <div class="text-base font-sans w-400px <sm:w-auto <sm:left-0 bg-black text-white rounded-md shadow-md m-4 p-4">
            <div class="flex items-start">
                <div class="flex-1">
                    View on ThreadClient?
                </div>
                <button class="px-2" on:click={() => {
                    // ignore no_ask_again if you press the close button
                    close();
                }}>x</button>
            </div>
            <div>
                <label>
                    <input type="checkbox" ref={el => {no_ask_again = el}} /> Don't ask again for {client}
                </label>
            </div>
            <div class="flex items-center justify-end gap-3 mt-1">
                <button on:click={() => {
                    if (no_ask_again?.checked) {
                        sendMessage("set-feature", {name: `${client}:no-manual-redirect`, value: true}).catch(console.error);
                    }
                    close();
                }}>No</button>
                <a class="text-blue-500 hover:underline" href={"https://thread.pfg.pw/#"+currentURL()} on:click={() => {
                    if (no_ask_again?.checked) {
                        sendMessage("set-feature", {name: `${client}:redirect`, value: true}).catch(console.error);
                    }
                }}>
                    Redirect
                </a>
            </div>
        </div>
    </>, shadow_dom);
}