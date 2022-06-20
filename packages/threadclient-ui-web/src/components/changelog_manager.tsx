import { untrack, JSX } from "solid-js";
import { render } from "solid-js/web";
import { localStorageSignal, Show } from "tmeta-util-solid";
import { getSettings } from "../util/utils_solid";
import Clickable from "./Clickable";
import { InternalIconRaw } from "./Icon";

const current_version = "-N02c8ctxITU-BqvlytL";

function isPreChangelogUser(): boolean {
    // if the user has used threadclient before changelogs were introduced
    return localStorage.getItem("seen-page1") === "true";
}

const [lsVersion, setLsVersion] = localStorageSignal("tc-latest-viewed-changelog-version");
function shouldShowBanner(): boolean {
    const ls_version = lsVersion();
    if(ls_version == null) return (console.warn("E_NO_LS_VERSION_IN_CHECK_UPDATED"), false);
    if(current_version > ls_version) {
        // changelogs are available
        return true;
    }
    return false;
}

export function hideChangelog(): void {
    setLsVersion(current_version);
}

export function renderChangelogBannerIfNeeded(inel: HTMLElement): void {
    // don't show the banner to new users
    if(untrack(() => lsVersion()) == null) {
        if(isPreChangelogUser()) setLsVersion("\x00"); // is it safe to have a null character in localstorage?
        else setLsVersion(current_version);
    }

    const settings = getSettings();

    // show the banners
    // huh this is going to render above the navbar on mobile. kind of funny.
    render(() => <Show if={settings.changelog() === "show" && shouldShowBanner()}>
        <Banner />
    </Show>, inel);
}

function Banner(): JSX.Element {
    // https://tailwindui.com/components/marketing/elements/banners
    return <div class="bg-indigo-600">
      <div class="mx-auto max-w-7xl py-3 px-3 sm:px-6 lg:px-8">
        <div class="flex flex-wrap items-center justify-between">
          <div class="flex w-0 flex-1 items-center">
            <span class="flex rounded-lg bg-indigo-800 p-2">
              <InternalIconRaw class="fa-solid fa-bullhorn" label="Update" />
            </span>
            <p class="ml-3 truncate font-medium text-rwhite">
              ThreadClient was updated
            </p>
          </div>
          <div class="order-3 mt-2 w-full flex-shrink-0 sm:order-2 sm:mt-0 sm:w-auto">
            <Clickable action={{url: "/changelog", client_id: "shell"}} class={`
                flex items-center justify-center
                rounded-md border border-transparent
                bg-rwhite px-4 py-2 text-sm font-medium text-indigo-600 shadow-sm
                hover:bg-indigo-50
            `} beforeClick={() => hideChangelog()}>Show Changelog</Clickable>
          </div>
          <div class="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
            <Clickable class={`
                -mr-1 flex rounded-md p-2 hover:bg-indigo-500
                focus:outline-none focus:ring-2 focus:ring-rwhite sm:-mr-2
            `} action={() => hideChangelog()}>
              <InternalIconRaw class="fa-solid fa-x" label="Close" />
            </Clickable>
          </div>
        </div>
      </div>
    </div>;    
}