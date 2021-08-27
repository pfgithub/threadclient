import type { JSX } from "solid-js";
import { LinkButton } from "./links";

export function Homepage(props: {_?: undefined}): JSX.Element {
    return <div class="flex justify-center flex-row">
        <div class="w-full max-w-prose">
            <div class="bg-white p-5 sm:m-5 sm:p-10 shadow sm:rounded-xl">
                <header>
                    <h1 class="text-3xl sm:text-5xl font-black">ThreadReader</h1>
                    <h2 class="text-base font-light text-gray-800 dark:text-gray-400">
                        A client for Reddit and Mastodon
                    </h2>
                </header>
                <div class="mt-10"></div>
                <main>
                    <p>Try for <LinkButton href="/reddit" style="normal">Reddit</LinkButton></p>
                    <p>Try for <LinkButton href="/mastodon" style="normal">Mastodon</LinkButton></p>
                </main>
                <div class="mt-10"></div>
                <footer>
                    <p class="text-gray-800 dark:text-gray-400">
                        <LinkButton href="/settings" style="action-button">Settings</LinkButton> ·{" "}
                        <LinkButton
                            href="https://github.com/pfgithub/threadclient"
                            style="action-button"
                        >Github</LinkButton> ·{" "}
                        <LinkButton
                            href="https://github.com/pfgithub/threadclient/blob/main/privacy.md"
                            style="action-button"
                        >Privacy</LinkButton>
                    </p>
                </footer>
                <div class="mt-2"></div>
            </div>
        </div>
    </div>;
}