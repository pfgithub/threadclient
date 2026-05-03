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

function Notification(props: {children: JSX.Element}): JSX.Element {
    return <div class="text-base font-sans w-400px <sm:w-auto <sm:left-0 bg-black text-white rounded-md shadow-md m-4 p-4">
        {props.children}
    </div>;
}

export function showNotifications(
    shadow_dom: Node,
    close: () => void,
    client: string,
): (() => void) {
    let no_ask_again: HTMLInputElement | undefined;
    // consider thread.pfg.pw/#https://…
    // apparently the # isn't sent to the webserver which is kinda neat
    return render(() => <>
        <Notification>
            <div>
                <label>
                    <input type="checkbox" ref={el => {no_ask_again = el}} /> Don't ask again
                </label>
            </div>
            <a class="text-blue-500 hover:underline" href={"https://thread.pfg.pw/"+currentURL()} on:click={() => {
                if (no_ask_again?.checked) {
                    sendMessage("set-feature", {name: `${client}:redirect`, value: true}).catch(console.error);
                }
            }}>
                Redirect to ThreadClient
            </a>{" "}
            <button on:click={() => {
                if (no_ask_again?.checked) {
                    sendMessage("set-feature", {name: `${client}:no-manual-redirect`, value: true}).catch(console.error);
                }
                close();
            }}>Close</button>
        </Notification>
    </>, shadow_dom);
}