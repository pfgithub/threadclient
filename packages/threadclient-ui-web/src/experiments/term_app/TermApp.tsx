import { createSignal, For, JSX, onCleanup, onMount } from "solid-js";
import { Show } from "tmeta-util-solid";

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

async function projectsApp(t: Term): Promise<void> {
    while(true) {
        const [printcmd, setPrintcmd] = createSignal<string>("");
        t.print(<Line class="bg-zinc-900">/projects$ {printcmd()}</Line>);
        const v = (await t.read({
            onProgress: q => void setPrintcmd(q),
        })).split(" ");
        setPrintcmd(v.join(" ")+"");

        if(v[0] === "ls") {
            if(v[1] == null) {
                t.print(<Line>current/ past/</Line>);
            }else if(v[1] === "current") {
                t.print(<div class="m-2"><div class="bg-slate-300 text-slate-900">
                    <div class="max-w-screen-lg mx-auto">
                        <div class="p-4">
                            <h2 class="font-black text-3xl my-3">Current Projects</h2>
                            <p class="mb-3">Large projects I'm working on right now</p>
                            <div class="my-2 flex flex-col sm:flex-row hover:shadow-md bg-slate-100 hover:bg-hex-fff">
                                <div class="sm:w-40 sm:h-auto flex-none overflow-hidden" aria-hidden="true">
                                    <a rel="noopener" target="" tabindex="-1" href="/projects/interpunct_bot">
                                        <img
                                            src="https://pfg.pw/icons/interpunct_img.png"
                                            alt="" class="w-full h-full object-cover " width="960" height="600"
                                        />
                                    </a>
                                </div>
                                <div class="p-4 flex flex-col z-10 relative">
                                    <h3>
                                        <a
                                            rel="noopener" target="_blank" class="font-black hover:underline"
                                            href="https://pfg.pw/projects/interpunct_bot"
                                        >inter·punct bot</a>
                                    </h3>
                                    <div class="mb-2 mt-1">
                                        A bot for the chat service <a
                                            href="https://discord.com"
                                            class="hover:underline text-blue-900"
                                            target="_blank" rel="noopener"
                                        >Discord</a> that adds many features including games such as Checkers and
                                        Paper Soccer and moderator functions such as a ticketing system and a way for
                                        moderators to give people roles faster using emojis.
                                    </div>
                                    <div class="font-light text-sm">
                                        <a
                                            href="https://www.typescriptlang.org/" class="hover:underline"
                                            target="_blank" rel="noopener"
                                        >Typescript</a> • <a
                                            href="https://nodejs.org/en/" class="hover:underline"
                                            target="_blank" rel="noopener"
                                        >NodeJS</a> • <a
                                            href="https://discord.js.org/" class="hover:underline"
                                            target="_blank" rel="noopener"
                                        >discord.js</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div></div>);
            }else{
                t.print(<Line>file not found</Line>);
            }
        }else if(v[0] === "exit") {
            t.print(<Line>Exiting</Line>);
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
        }else if(text === "projects") {
            try {
                await projectsApp(t);
            }catch(er) {
                const e = er as Error;
                t.print(<Line>Projects app errored: {e.toString() + "\n" + e.stack}</Line>);
            }
        }else if(text === "showanimtest") {
            const target_msg = "Here is some text. I'm trying out animating it in";
            const [animvalue, setAnimvalue] = createSignal("");
            const updatep = (p: number): void=> {
                if(p >= 1) return void setAnimvalue(target_msg);
                setAnimvalue([...target_msg].map(v => {
                    if(v === " ") return v;
                    if(Math.random() > p) return "!";
                    return v;
                }).join(""));
            };
            const replay = () => {
                updatep(0);
                setTimeout(() => {
                    updatep(0.2);
                    setTimeout(() => {
                        updatep(0.4);
                        setTimeout(() => {
                            updatep(0.6);
                            setTimeout(() => {
                                updatep(0.8);
                                setTimeout(() => {
                                    updatep(1.0);
                                }, 40);
                            }, 40);
                        }, 40);
                    }, 40);
                }, 40);
            };
            replay();
            t.print(<Line>
                {animvalue()}
                <Show if={animvalue() === target_msg}>
                    {" "}<button onClick={() => {
                        replay();
                    }} class="underline" ref={v => {
                        onMount(() => {
                            v.style.opacity = "0";
                            setTimeout(() => {
                                v.style.opacity = "1";
                                v.animate([
                                    {opacity: 0},
                                    {opacity: 1},
                                ], {
                                    duration: 200,
                                    iterations: 1,
                                });
                            }, 500);
                        });
                    }}>Replay</button>
                </Show>
            </Line>);
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
    return <div class={props.class + " px-2 whitespace-pre-wrap"}>
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
    }} ref={el => {
        onMount(() => {
            // ok wow this is so much better than the horrible .style.opacity .offsetHeight .style.opacity thing
            // I need to find everything using `.offsetHeight` and switch it to this animations api
            el.animate([
                {opacity: 1},
                {opacity: 0},
                {opacity: 1},
            ], {
                duration: 200,
                iterations: 1,
            });
            //
        });
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