import { createEffect, createSignal, JSX, onCleanup } from "solid-js";
import { Button, Buttons } from "./components";
import { uuid } from "./uuid";

export default function CopyUUIDButton(): JSX.Element {
    const [copied, setCopied] = createSignal(false);
    createEffect(() => {
        if(copied()) {
            const to = setTimeout(() => {
                setCopied(false);
            }, 1000);
            onCleanup(() => clearTimeout(to));
        }
    });
    return <Buttons>
        <Button
            disabled={copied()}
            onClick={() => void navigator.clipboard.writeText(uuid()).then(() => setCopied(true))}
            // .catch(setCopied(false))
        >
            {copied() ? "✓ Copied" : "Copy New UUID"}
        </Button>
    </Buttons>;
}