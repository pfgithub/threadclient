import { JSX, createSignal, Accessor, Setter } from "solid-js";
import { render } from "solid-js/web";
import { NotificationsType } from "./content_script";
import { ShowBool } from "tmeta-util-solid";

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
    return <div class="w-400px <sm:w-auto <sm:left-0 bg-black text-white rounded-md shadow-md m-4 p-4">
        {props.children}
    </div>;
}

export function showNotifications(
    shadow_dom: Node,
    notifications: Accessor<NotificationsType>,
    setNotifications: Setter<NotificationsType>,
): void {
    // consider thread.pfg.pw/#https://…
    // apparently the # isn't sent to the webserver which is kinda neat
    render(() => <>
        <ShowBool when={notifications().ask_to_redirect}>
            <Notification>
                <a class="text-blue-500 hover:underline" href={"https://thread.pfg.pw/"+currentURL()}>
                    Redirect to ThreadClient
                </a>{" "}
                <button on:click={() => {
                    setNotifications(v => ({
                        ...v,
                        ask_to_redirect: false,
                    }));
                }}>Close</button>
            </Notification>
        </ShowBool>
    </>, shadow_dom);
}