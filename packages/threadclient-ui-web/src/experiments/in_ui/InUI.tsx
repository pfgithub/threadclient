import { JSX, onCleanup, onMount } from "solid-js";

function base64encode(v: Uint8Array): string {
	return btoa(String.fromCharCode(...v));
}
function base64decode(v: string): Uint8Array {
    return Uint8Array.from(atob(v), c => c.charCodeAt(0));
}
async function symmetricKeygen(): Promise<string> {
    const key = await crypto.subtle.generateKey({name: "AES-GCM", length: 256}, true, ["encrypt", "decrypt"]);
    return base64encode(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}
async function symmetricEncrypt(key: string, msg: string) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    // [!] do not use the same IV twice
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        await crypto.subtle.importKey("raw", base64decode(key), {
            name: "AES-GCM",
        }, false, ["encrypt", "decrypt"]),
        new TextEncoder().encode(msg),
    ) as ArrayBuffer;

    return base64encode(new Uint8Array([...iv, ...new Uint8Array(encrypted)]));
}
async function symmetricDecrypt(key: string, emsg: string) {
    const dec = [...base64decode(emsg)];
    if(dec.length < 12) throw new Error("EBADENCRYPTEDMESSAGE");
    const iv = new Uint8Array(dec.slice(0, 12));
    const encrypted = new Uint8Array(dec.slice(12));
    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv,
        },
        await crypto.subtle.importKey("raw", base64decode(key), {
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

export default function TermApp(props: {
    reloadSelf: () => void,
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
            <div>
                <div class="bg-zinc-700 inline-block p-2 px-4 rounded-3xl whitespace-pre-wrap max-w-md">
                    Lorem ipsum dolor sit amet
                </div>
            </div>
            <div class="text-right">
                <div class="bg-blue-700 inline-block p-2 px-4 rounded-3xl whitespace-pre-wrap max-w-md">
                    Amnesty consequtor
                </div>
            </div>
            <div class="text-right">
                <div class="bg-blue-700 inline-block p-2 px-4 rounded-3xl whitespace-pre-wrap max-w-md">
                    I don't know lorem ipsum
                </div>
            </div>
        </div>
    </div></div>;
}