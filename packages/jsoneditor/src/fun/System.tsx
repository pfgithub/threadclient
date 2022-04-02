import { createSignal, JSX, onCleanup } from "solid-js";
import { Button, Buttons } from "../components";

function Horizontal(props: {
    gap?: undefined | null | "gap-2",
    children?: undefined | JSX.Element,
}): JSX.Element {
    return <div class={"flex flex-wrap flex-row "+props.gap}>
        {props.children}
    </div>;
}
function Spacer(): JSX.Element {
    return <div class="flex-1" />;
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

export default function System(): JSX.Element {
    return <div class="h-full">
        <div class="p-2 bg-gray-800">
            <Horizontal gap="gap-2">
                <Buttons>
                    <Button>Menu</Button>
                </Buttons>
                <Spacer />
                <Clock />
            </Horizontal>
        </div>
    </div>;
}