import { createEffect, createSignal, For, JSX, onCleanup, onMount } from "solid-js";
import { localStorageSignal } from "tmeta-util-solid";
import { A } from "../../components/links";

// note: I should probably compress all data before encrypting and decompress after. it's basically
// a binary blob already, I might as well
// unfortunately, CompressionStream() / DecompressionStream() are not supported in firefox or safari
// and I don't feel like adding a dependency
function base64encode(v: Uint8Array): string {
	return btoa(String.fromCharCode(...v));
}
function base64decode(v: string): Uint8Array {
    return Uint8Array.from(atob(v), c => c.charCodeAt(0));
}
async function symmetricKeygen(): Promise<Uint8Array> {
    const key = await crypto.subtle.generateKey({name: "AES-GCM", length: 256}, true, ["encrypt", "decrypt"]);
    return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}
async function symmetricEncrypt(key: Uint8Array, msg: string): Promise<Uint8Array> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    // [!] do not use the same IV twice
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        await crypto.subtle.importKey("raw", key, {
            name: "AES-GCM",
        }, false, ["encrypt", "decrypt"]),
        new TextEncoder().encode(msg),
    ) as ArrayBuffer;

    return new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
}
async function symmetricDecrypt(key: Uint8Array, emsg: Uint8Array): Promise<string> {
    const dec = [...emsg];
    if(dec.length < 12) throw new Error("EBADENCRYPTEDMESSAGE");
    const iv = new Uint8Array(dec.slice(0, 12));
    const encrypted = new Uint8Array(dec.slice(12));
    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv,
        },
        await crypto.subtle.importKey("raw", key, {
            name: "AES-GCM",
        }, false, ["encrypt", "decrypt"]),
        encrypted,
    ) as ArrayBuffer;

    return new TextDecoder().decode(decrypted);
}
() => [symmetricKeygen, symmetricEncrypt, symmetricDecrypt];
// wow, libsodium is so much nicer than crypto.subtle
// like look at how easy this is
// - https://doc.libsodium.org/public-key_cryptography/authenticated_encryption

function winset(k: string, v: unknown): void {
    (window as unknown as {[key: string]: unknown})[k] = v;
}
function winget<T>(k: string, defaultv: T): T {
    return (window as unknown as {[key: string]: T})[k] ??= defaultv;
}

const inui_content_encrypted = "tiYwBcc+TbgrF3a/ZjZcgg0pldlm3whn7xUAEUqASe0/F+hl2qYhM/kpex5hWSjL4AQAJ+j4ivQstkjHy+/z7aG6UBZQENGixHnbCrf+80QtkURFWDc=";
const [encryptionKey, setEncryptionKey] = localStorageSignal("--inui-compressor-key");

export default function TermAppMain(props: {
    reloadSelf: () => void,
}): JSX.Element {
    let inui_content: string | null = null;
    const [sel, setSel] = createSignal(winget<null | "term" | "encr">("--term-app-sel", null));
    createEffect(() => winset("--term-app-sel", sel()));
    const selTerm = () => {
        const encr_key = encryptionKey() ?? prompt("Passcode?");
        if(encr_key == null) return alert("Passcode required.");
        setEncryptionKey(encr_key);
        symmetricDecrypt(base64decode(encr_key), base64decode(inui_content_encrypted)).then(r => {
            inui_content = r;
            setSel("term");
        }).catch(e => {
            alert("decrypt error: "+e);
        });
    };
    if(sel() === "term") {
        setSel(null);
        selTerm();
    }
    return <>{
        sel() === "term" ? <InUI reloadSelf={props.reloadSelf} content={inui_content!} /> :
        sel() === "encr" ? <Encryptor /> :
        <div>
            <A class="underline" onClick={() => selTerm()}>term</A>
            {" "}
            <A class="underline" onClick={() => setSel("encr")}>encr</A>
        </div>
    }</>;
}

function CopyButton(props: {getValue: () => Promise<string>, children: JSX.Element}): JSX.Element {
    const [state, setState] = createSignal<0 | 1 | 2>(0);
    createEffect(() => {
        if(state() === 2) {
            const to = setTimeout(() => {
                setState(0);
            }, 1000);
            onCleanup(() => clearTimeout(to));
        }
    });
    return <button class="border rounded border-hex-fff px-2" onClick={() => {
        setTimeout(() => {
            if(state() === 0) setState(1);
        }, 100);
        props.getValue().then(value => {
            navigator.clipboard.writeText(value).then(() => {
                setState(2);
            }).catch(e => {
                setState(0);
                alert("copy error: "+e);
            });
        }).catch(e => {
            setState(0);
            alert("copy error: "+e);
        });
    }} disabled={state() !== 0}>
        {state() === 0 ? props.children : state() === 1 ? "Generating…" : "✓ Copied"}
    </button>;
}

function Encryptor(): JSX.Element {
    let value!: HTMLTextAreaElement;
    return <div class="max-w-lg mx-auto p-4 space-y-4">
        <div>
            <CopyButton getValue={async () => {return base64encode(await symmetricKeygen())}}>
                Keygen
            </CopyButton>
        </div>
        <label class="block">
            <div>Key</div>
            <input
                type="password"
                value={encryptionKey() ?? ""}
                onChange={e => void setEncryptionKey(e.currentTarget.value)}
                class="block w-full border border-hex-fff"
            />
        </label>
        <label class="block">
            <div>Value</div>
            <textarea ref={value} class="block w-full border border-hex-fff" />
        </label>
        <div class="space-x-2">
            <CopyButton
                getValue={async () => {
                    return base64encode(await symmetricEncrypt(
                        base64decode(encryptionKey() ?? ""),
                        value.value,
                    ));
                }}
            >
                Copy Encrypted
            </CopyButton>
            <button class="border rounded border-hex-fff px-2" onClick={() => {
                (async () => {
                    value.value = await symmetricDecrypt(
                        base64decode(encryptionKey() ?? ""),
                        base64decode(value.value),
                    );
                })().catch(e => {
                    alert("EDECRYPT:"+e);
                });
            }}>
                Decrypt
            </button>
        </div>
    </div>;
}

function InUI(props: {
    reloadSelf: () => void,
    content: string,
}): JSX.Element {
    const sel = document.createElement("style");
    sel.textContent = `
        html, body {
            margin-bottom: 0 !important;
            background-color: #000 !important;
        }
    `;
    onCleanup(() => {
        sel.remove();
    });
    document.body.appendChild(sel);

    return <div class="bg-hex-000 h-screen py-2" ref={el => {
        onMount(() => {
            // ok wow this is so much better than the horrible .style.opacity .offsetHeight .style.opacity thing
            // I need to find everything using `.offsetHeight` and switch it to this animations api
            el.animate([
                {backgroundColor: "#222"},
                {},
            ], {
                duration: 200,
                iterations: 1,
            });
        });
    }}><div ref={el => {
        onMount(() => {
            el.animate([
                {opacity: 0},
                {opacity: 1},
            ], {
                duration: 200,
                iterations: 1,
            });
        });
    }}>
        <div class="max-w-lg mx-auto p-4 flex flex-col gap-2">
            <For each={props.content.split("\n").filter(l => l)}>{line => {
                if(line.startsWith("[")) return <div>{line}</div>;
                if(line.startsWith("<")) {
                    return <div>
                        <div class="bg-zinc-700 inline-block p-2 px-4 rounded-3xl whitespace-pre-wrap max-w-md">
                            {line.substring(1)}
                        </div>
                    </div>;
                }
                if(line.startsWith(">")) {
                    return <div class="text-right">
                        <div class="bg-blue-700 inline-block p-2 px-4 rounded-3xl whitespace-pre-wrap max-w-md">
                            {line.substring(1)}
                        </div>
                    </div>;
                }
                return <div class="text-red-500">ERROR: {line}</div>;
            }}</For>
        </div>
    </div></div>;
}