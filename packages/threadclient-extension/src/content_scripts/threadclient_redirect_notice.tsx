import { createSignal } from "solid-js";
import { render } from "solid-js/web";

declare module "solid-js" {
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

export function showRedirectNotice(root: Node): void {
    render(() => <div class="w-400px <sm:w-auto <sm:left-0 bg-black text-white rounded-md shadow-md m-4 p-4">
        <a class="text-blue-500 hover:underline" href={"https://thread.pfg.pw/"+currentURL()}>
            Redirect to ThreadClient
        </a>{" "}
        <button on:click={() => alert("todo close this thing")}>Close</button>
    </div>, root);
}