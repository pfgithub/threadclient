import { createSignal, Index, JSX, onCleanup, onMount } from "solid-js";

type TermLine = symbol & {__is_term_line: TermLine};
type Term = {
    print: (msg: string) => TermLine,
    update: (line: TermLine, msg: string) => void,
    read: () => Promise<string>,
};

async function adventureGame(t: Term): Promise<void> {
    t.print("You are standing in a forest.");
    while(true) {
        const printline = t.print("[What to do?]");
        const v = (await t.read()).split(" ");
        t.update(printline, "[What to do?] " + v.join(" ")+"");
        if(v[0] === "look") {
            t.print("There are quite a few trees");
        }else if(v[0] === "help") {
            t.print("Commands: `look`, `exit`");
        }else if(v[0] === "exit") {
            t.print("Goodbye.");
            break;
        }else{
            t.print("I'm not sure what you mean. `help` for help.");
        }
    }
}

async function app(t: Term): Promise<void> {
    while(true) {
        const l1 = t.print("~/t/g/7/tmp$");
        const text = await t.read();
        t.update(l1, "~/t/g/7/tmp$ "+text);

        if(text === "adventure") {
            try {
                await adventureGame(t);
            }catch(er) {
                const e = er as Error;
                t.print("Adventure game errored: "+e.toString()+"\n"+e.stack);
            }
        }else if(text === "exit") {
            t.print("Goodbye.");
            break;
        }else {
            t.print("Command not found: `"+text+"`");
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

    const [lines, setLines] = createSignal<string[]>([]);

    const waiting_reads: string[] = [...hmrview()];
    const waiting_cbs: ((v: string) => void)[] = [];
    const emitRead = (msg: string) => {
        hmrview().push(msg);

        const wcb = waiting_cbs.shift();
        if(wcb != null) {
            wcb(msg);
            return;
        }
        waiting_reads.push(msg);
        return;
    };
    const awaitRead = async (): Promise<string> => {
        const wr = waiting_reads.shift();
        if(wr != null) return wr;
        return await new Promise(r => waiting_cbs.push(r));
    };

    const term: Term = {
        print: (msg) => {
            let resl!: number;
            setLines(v => {
                resl = v.length;
                return [...v, msg];
            });
            return resl as unknown as TermLine;
        },
        update: (line, msg) => {
            setLines(v => {
                const vdup = [...v];
                vdup[line as unknown as number] = msg;
                return vdup;
            });
        },
        read: async () => {
            return awaitRead();
        },
    };
    app(term).then(r => {
        term.print("App exited.");
    }).catch((e: Error) => {
        term.print("App errored: "+e.toString()+"\n"+e.stack);
    });
    // on cleanup: send a cancel signal

    return <div class="bg-hex-000 h-screen p-2" style={{
        'font-family': "Verdana",
    }}>
        <Index each={[...lines().entries()]}>{line => <>
            <div class="whitespace-pre-wrap" ref={el => {
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
                {line()[1]}
            </div>
        </>}</Index>
        <input class="block w-full mt-2 border border-hex-fff rounded-md px-1" ref={el => {
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
        }} />
        <div class="mt-2">
            <button class="border border-hex-fff rounded-md px-1" onClick={() => {
                hmrview().pop();
                props.reloadSelf();
            }}>
                dbg:undo
            </button>
        </div>
    </div>;
}