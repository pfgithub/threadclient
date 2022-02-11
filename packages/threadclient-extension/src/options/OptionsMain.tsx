import { JSX } from "solid-js";
import { render } from "solid-js/web";
import { localStorageSignal, Show } from "tmeta-util-solid";
// import browser from "webextension-polyfill";

function Section(opts: {title: string, children: JSX.Element}): JSX.Element {
    // todo generate h1, h2, … based on nesting
    return <>
        <h3 class="font-black text-xl">{opts.title}</h3>
        {opts.children}
    </>;
}

function Options(): JSX.Element {
    const [gqlToken] = localStorageSignal("gql_token");

    const chatIndicatorsEnabled = () => gqlToken() != null && gqlToken()!.startsWith("Bearer ");

    const [devMode, setDevMode] = localStorageSignal("allow-dev");

    return <div class="m-4">
        <Section title="Options">
            <p>"options loaded (dev: "+__DEV__+")"</p>
            <Section title="Chat Unread Indicators">
                <p>Chat indicators are {chatIndicatorsEnabled() ? "enabled" : "not enabled"}.</p>
                <Show if={chatIndicatorsEnabled()} fallback={
                    <p>
                        <a
                            href="https://www.reddit.com/#tc-chat-unread-indicators"
                            target="_blank" rel="noopener noreferrer"
                        >
                            Click Here
                        </a>
                        to enable chat unread indicators. Make sure to log in.
                    </p>
                }>
                    <p>
                        TODO add a button to test if chat unread indicators are working.
                    </p>
                </Show>
            </Section>
            <Section title="Developer Settings">
                <p>Dev mode is {devMode() === "true" ? "on" : "off"}.</p>
                <button onClick={() => {
                    setDevMode(devMode() === "true" ? null : "true");
                }}>{devMode() === "true" ? "disable" : "enable"} dev mode</button>
            </Section>
        </Section>
    </div>;
}

render(() => <Options />, document.getElementById("main") ?? document.body);
