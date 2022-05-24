import { createSignal, For, JSX, onCleanup, onMount } from "solid-js";

type ReadOpts = {
    onProgress?: undefined | ((progress: string) => void),
};
type Term = {
    // print: (msg: string) => TermLine,
    // update: (line: TermLine, msg: string) => void,
    print: (line: JSX.Element) => void,
    read: (opts?: undefined | ReadOpts) => Promise<string>,
};

async function adventureGame(t: Term): Promise<void> {
    t.print(<Line>You are standing in a forest.</Line>);
    while(true) {
        const [printcmd, setPrintcmd] = createSignal<string>("");
        t.print(<Line class="bg-zinc-900">[What to do?] {printcmd()}</Line>);
        const v = (await t.read({
            onProgress: q => void setPrintcmd(q),
        })).split(" ");
        setPrintcmd(v.join(" ")+"");

        if(v[0] === "look") {
            t.print(<Line>There are quite a few trees</Line>);
        }else if(v[0] === "help") {
            t.print(<Line>Commands: `look`, `exit`</Line>);
        }else if(v[0] === "exit") {
            t.print(<Line>Goodbye.</Line>);
            break;
        }else{
            t.print(<Line>I'm not sure what you mean. `help` for help.</Line>);
        }
    }
}

async function app(t: Term): Promise<void> {
    while(true) {
        const [printcmd, setPrintcmd] = createSignal<string>("");
        t.print(<Line class="bg-zinc-900">~/t/g/7/tmp$ {printcmd()}</Line>);
        const text = await t.read({
            onProgress: v => void setPrintcmd(v),
        });
        setPrintcmd(text);

        if(text === "adventure") {
            try {
                await adventureGame(t);
            }catch(er) {
                const e = er as Error;
                t.print(<Line>Adventure game errored: {e.toString() + "\n" + e.stack}</Line>);
            }
        }else if(text === "exit") {
            t.print(<Line>Goodbye.</Line>);
            break;
        }else {
            t.print(<Line>Command not found: `{text}`</Line>);
        }
    }
}

type HMRData = {
    '@term-app-hmr-data'?: undefined | string[],
};
function hmrview(): string[] {
    const hd = window as unknown as HMRData;
    return (hd["@term-app-hmr-data"] ??= []);
}

function Line(props: {
    class?: undefined | string,
    children: JSX.Element,
}): JSX.Element {
    return <div class={props.class + " px-2 whitespace-pre-wrap"} ref={el => {
        onMount(() => {
            // ok wow this is so much better than the horrible .style.opacity .offsetHeight .style.opacity thing
            // I need to find everything using `.offsetHeight` and switch it to this animations api
            el.animate([
                {opacity: 0},
                {opacity: 1}
            ], {
                duration: 200,
                iterations: 1,
            });
            //
        });
    }}>
        {props.children}
    </div>;
}

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

    const [lines, setLines] = createSignal<{itm: JSX.Element}[]>([]);

    const waiting_reads: string[] = [...hmrview()];
    const waiting_cbs: ({
        complete: (v: string) => void,
        progress: (v: string) => void,
    })[] = [];
    const emitRead = (msg: string) => {
        hmrview().push(msg);

        const wcb = waiting_cbs.shift();
        if(wcb != null) {
            wcb.complete(msg);
            return;
        }
        waiting_reads.push(msg);
        return;
    };
    const awaitRead = async (opts?: undefined | ReadOpts): Promise<string> => {
        const wr = waiting_reads.shift();
        if(wr != null) return wr;
        const res = await new Promise<string>(r => waiting_cbs.push({
            complete: r,
            progress: v => {
                opts?.onProgress?.(v);
            },
        }));
        return res;
    };

    const term: Term = {
        print: (msg) => {
            setLines(v => {
                return [...v, {itm: msg}];
            });
        },
        read: async (opts) => {
            return awaitRead(opts);
        },
    };
    app(term).then(r => {
        term.print("App exited.");
    }).catch((e: Error) => {
        term.print("App errored: "+e.toString()+"\n"+e.stack);
    });
    // on cleanup: send a cancel signal

    return <div class="bg-hex-000 h-screen py-2" style={{
        'font-family': "Verdana",
    }}>
        <For each={lines()}>{line => <>
            {line.itm}
        </>}</For>
        <div class="pt-2 px-2">
            <input class="block w-full border border-hex-fff rounded-md px-1" ref={el => {
                onMount(() => {
                    el.focus();
                });
            }} onKeyDown={e => {
                if(e.code === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    emitRead(e.currentTarget.value);
                    e.currentTarget.value = "";
                }
            }} onInput={e => {
                const wcb0 = waiting_cbs[0];
                wcb0?.progress(e.currentTarget.value);
            }} />
        </div>
        <div class="pt-2 px-2">
            <button class="border border-hex-fff rounded-md px-1" onClick={() => {
                hmrview().pop();
                props.reloadSelf();
            }}>
                dbg:undo
            </button>
        </div>
    </div>;
}