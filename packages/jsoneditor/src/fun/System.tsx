import { createSignal, For, JSX, onCleanup, untrack } from "solid-js";
import { createMutable } from "solid-js/store";
import { Button, Buttons } from "../components";

function Horizontal(props: {
    gap?: undefined | null | "gap-2",
    children?: undefined | JSX.Element,
}): JSX.Element {
    return <div class={"flex flex-wrap flex-row "+props.gap}>
        {props.children}
    </div>;
}
function Vertical(props: {
    gap?: undefined | null | "gap-2",
    children?: undefined | JSX.Element,
}): JSX.Element {
    return <div class={"flex flex-col "+props.gap}>
        {props.children}
    </div>;
}
function Spacer(props: {
    children?: undefined | JSX.Element,
}): JSX.Element {
    return <div class="flex-1" children={props.children} />;
}
function Child(props: {
    children?: undefined | JSX.Element,
}): JSX.Element {
    return <div children={props.children} />;
}

// TODO this can be a panel application
function Clock(): JSX.Element {
    const [now, setNow] = createSignal(Date.now());
    const updateTimeout = (): NodeJS.Timeout => {
        // [!] this assumes that Intl.DateTimeFormat returns a string that changes
        //     every minute. DateTimeFormat doesn't provide a way to see how many ms
        //     until the next/previous change.
        const now_ms = Date.now();
        setNow(now_ms);
        const next_min = new Date(now_ms);
        next_min.setMinutes(next_min.getUTCMinutes() + 1);
        next_min.setSeconds(0);
        next_min.setMilliseconds(0);
        const diff = next_min.getTime() - now_ms + 10;
        return setTimeout(() => timeout = updateTimeout(), diff);
    };
    let timeout = updateTimeout();
    onCleanup(() => {
        clearTimeout(timeout);
    });

    return <span>
        {(() => {
            const time = new Date(now());
            return new Intl.DateTimeFormat(undefined, {
                timeStyle: "short",
            }).format(time);
        })()}
    </span>;
}

function launchFileExplorer(system: System) {
    system.wm.createWindow(() => "Files App", () => <FileExplorer />);
}

function FileExplorer(): JSX.Element {
    return <div>
        <div class="p-2">
            Files
        </div>
    </div>;
}

type Window = {
    owner: AppID,
    id: WindowID,
    center_x: number,
    center_y: number,
    width: number,
    height: number,
    bring_to_front: number,
    title: () => string,
    app: () => JSX.Element,
};

type AppID = symbol & {__is_app_id: true};
type WindowID = symbol & {__is_window_id: true};
type WM = {
    createWindow(
        title: () => string,
        content: () => JSX.Element,
    ): WindowID,
    // or we can be fun and do `wm.post(() => <><Window>…</Window><NavbarItem>…</NavbarItem></>)
};

type System = {
    wm: WM,
    // other things need permission
};

export default function System(): JSX.Element {
    const [windows, setWindows] = createSignal<Window[]>([]);
    let bring_to_front = 0;

    const openFileExplorer = () => {
        const app_id = Symbol() as AppID;
        launchFileExplorer({
            wm: {
                createWindow(title, content) {
                    const window_id = Symbol() as WindowID;
                    setWindows(w => [...w, createMutable<Window>({
                        owner: app_id,
                        id: window_id,
                        center_x: 0.50,
                        center_y: 0.50,
                        width: 0.30,
                        height: 0.30,
                        bring_to_front: ++bring_to_front,
                        title,
                        app: content,
                    })]);
                    return window_id;
                },
            },
        });
    };

    openFileExplorer();

    return <div class="h-full relative">
        <div class="p-2 bg-gray-800">
            <Horizontal gap="gap-2">
                <Child>
                    <Buttons>
                        <Button onClick={openFileExplorer}>Files</Button>
                    </Buttons>
                </Child>
                <Spacer />
                <Child>
                    <Clock />
                </Child>
            </Horizontal>
        </div>
        <For each={windows()}>{window => <>
            <div class="absolute bg-gray-800 rounded-md overflow-hidden" style={{
                left: (window.center_x * 100)+"%",
                top: (window.center_y * 100)+"%",
                width: (window.width * 100)+"%",
                height: (window.width * 100)+"%",
                transform: "translate(-50%, -50%)",
            }}>
                <Vertical>
                    <Child>
                        <div class="bg-gray-700">
                            <Horizontal>
                                <Child>
                                    <div class="h-full px-2 p-1">
                                        {window.title}
                                    </div>
                                </Child>
                                <Spacer />
                                <Child>
                                    <button class={[
                                        "block h-full px-2 p-1 bg-gray-600",
                                    ].join(" ")} onClick={() => {
                                        // animate the window closed and then
                                        // delete it from the list
                                        // (preferably delete first and then)
                                        // (animate but we need an actual)
                                        // (low level rendering api for that)
                                        setWindows(ws => ws.filter(w => w !== window));
                                    }}>x</button>
                                </Child>
                            </Horizontal>
                        </div>
                    </Child>
                    <Spacer>
                        {untrack(() => window.app())}
                    </Spacer>
                </Vertical>
            </div>
        </>}</For>
    </div>;
}