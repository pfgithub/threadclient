import { createSignal, For, JSX, onCleanup, onMount } from "solid-js";
import { Show } from "tmeta-util-solid";
import { A } from "../../components/links";

type ReadOpts = {
    onProgress?: undefined | ((progress: string) => void),
};
type Term = {
    // print: (msg: string) => TermLine,
    // update: (line: TermLine, msg: string) => void,
    print: (line: JSX.Element) => void,
    read: (opts?: undefined | ReadOpts) => Promise<string>,
    suggest: (msg: string) => void,
};

function ChatLink(props: {t: Term, to: string, children: JSX.Element}): JSX.Element {
    return <A class="underline" onClick={() => {
        props.t.suggest(props.to);
    }}>{props.children}</A>;
}

/*

You're walking through a forest. Not really paying attention. Suddenly, you step on something metal.

$> look
You're standing in a forest. There is a trapdoor under your foot, camoflauged by rust and leaves.

$> look trapdoor
It's a metal trapdoor. {cleared ? Even with the leaves cleared off, the rust still blends it in to the forest floor. : It
is covered in leaves and rust, making it blend in with the the forest floor.}

$> open trapdoor
{cleared ? You clear off the leafcover and : You} open the trapdoor. {opened ? It clearly hasn't seen use in quite some
time, as you have to break bits of rusted metal. }

$> look trapdoor
You peer through the trapdoor. There is a small square passageway made of concrete with a rusty
metal ladder built into one wall. It is too dark to see where it leads.

$> close trapdoor
You close the trapdoor.

$> go trapdoor
{!open ? exec `open trapdoor`}
{!seen ? exec `look trapdoor`}
You make your way onto the ladder. It is a tight space, you're lucky you aren't claustrophobic. Climbing
down the ladder, you frequently scrape your back against the other wall.

As you get further down, it becomes harder to see. With how the sound is reacting, as you go down
the ladder, you suddenly feel like the shaft has expanded. It feels huge.

When you reach the bottom, you cannot see but you feel like you're standing on a metal catwalk. There
are hand railings on the side. It leads south.

You can go: Up, South.

$> look
You are standing on a metal catwalk with hand railings on the side. It feels rusty. The catwalk leads
South, and the ladder you came down is North.

*/


type Entity<T> = {
    state: T,
    actions: {
        open?: undefined | ((self: Entity<T>, t: Term, g: AdventureGame) => void),
        look?: undefined | ((self: Entity<T>, t: Term, g: AdventureGame) => void),
        go?: undefined | ((self: Entity<T>, t: Term, g: AdventureGame) => void),
    },
};
function entity<T>(desc: Entity<T>): Entity<T> {
    return desc;
}

type AdventureGame = typeof adventure_game;

const player = entity({
    state: {in: "room"},
    actions: {},
});
const adventure_game = {
    player,
    underground: {
        main_lights: false,
    },
};
const map = {
    forest: {
        entities: {
            trapdoor: entity({
                state: {cleared: false, rust_broken: false, open: false, looked_inside: false},
                actions: {
                    open: (self, t) => {
                        const s = self.state;
                        if(s.open) {
                            return t.print(<Line>It's already open</Line>);
                        }
                        // t.print(<PlaySound sound="trapdoor_open.mp3" />)

                        t.print(<Line>
                            {s.cleared ? "You clear the leafcover off and" : "You"} open the trapdoor.{s.rust_broken ? <>
                                {" "}It clearly hasn't seen use in quite some time, as it takes a bit of force to break through
                                the years of rust.
                            </> : ""}
                        </Line>);
                        s.cleared = true;
                        s.rust_broken = true;
                    },
                    look: (self, t, g) => {
                        if(self.state.open) {
                            return t.print(<Line>
                                You peer through the trapdoor. There is a small square passageway made of concrete
                                with a rusty metal ladder built into one wall.{g.underground.main_lights ? <>
                                    {" "}It is too dark to see where it leads.
                                </> : null}
                            </Line>);
                        }else{
                            return t.print(<Line>
                                It's a metal trapdoor. {self.state.cleared ? <>Even with the leaves cleared off, the
                                rust still makes it blend in to the forest floor.</> : <>It is covered in leaves and
                                rust, making it blend in with the the forest floor.</>}
                            </Line>);
                        }
                    },
                },
            }),
        },
    },
};
() => map;

const adventure: {[key: string]: {id: typeof key,
    look?: undefined | ((t: Term) => void),
    go?: undefined | (() => string),
    objects?: undefined | (() => {[key: string]: string}),
}} = {
    'forest': {id: "forest",
        look: t => t.print(<Line>
            You are standing in a forest.{"\n"}
            There are quite a few trees.{"\n"}
            You see a <ChatLink t={t} to={"open trapdoor"}>Trapdoor</ChatLink>.
        </Line>),
        objects: () => ({
            trapdoor: "$forest$trapdoor",
        }),
    },
    '$forest$trapdoor': {id: "$forest$trapdoor",
        look: t => t.print(<Line>
            It's a trapdoor. Rusted. Looks like it's been here a while.
        </Line>),
        go: () => "passage",
    },
    'passage': {id: "passage",
        look: t => t.print(<Line>
            It's a passage.
        </Line>),
    },
};

async function adventureGame(t: Term): Promise<void> {
    let location_name = "forest";

    const devObj = (id: string) => {
        const res = adventure[id];
        if(res == null) throw new Error("not exists: "+res);
        return res;
    };
    const userObj = (name: string) => {
        const loc = devObj(location_name);
        if(name === "") return loc;
        const obj = loc.objects?.()[name];
        if(obj != null) return devObj(obj);
        return null;
    };

    while(true) {
        const [printcmd, setPrintcmd] = createSignal<string>("");
        t.print(<Line class="bg-zinc-900">[What to do?] {printcmd()}</Line>);
        const v = (await t.read({
            onProgress: q => void setPrintcmd(q),
        })).split(" ");
        setPrintcmd(v.join(" ")+"");
        // (for error msgs):
        // TODO: make that one ephemeral and when you send your next thing it should delete it
        // eg we could update printcmd with an error and call read again

        // oh actually we could do validation on the thing you input and not allow you to send until it's
        // valid

        if(v[0] === "look") {
            const object = v.slice(1).join(" ");
            const obj = userObj(object);
            if(obj == null) {
                t.print(<Line class="text-red-500">Not found?</Line>);
            }else if(obj.look) {
                obj.look(t);
            }else{
                t.print(<Line>You can't look at that.</Line>);
            }
        }else if(v[0] === "go") {
            const object = v.slice(1).join(" ");
            const obj = userObj(object);
            if(obj == null) {
                t.print(<Line class="text-red-500">Not found?</Line>);
            }else if(obj.go) {
                location_name = obj.go();
            }else{
                t.print(<Line>You can't go there.</Line>);
            }
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


function VCursor(): JSX.Element {
    return <div class="inline relative">
        <div class={`
            absolute inline-block w-[2px] text-transparent select-none transform translate-x-[-50%]
            rounded-md bg-blue-400
        `}>.</div>
    </div>;
}
async function editor(t: Term): Promise<void> {
    type TES = {
        file: string,
        crs: number,
        prev_lyn_slash: boolean,
    };

    function readUntil(nextChar: () => string | undefined, until: string | undefined): string {
        const res: string[] = [];
        while(true) {
            const nc = nextChar();
            if(nc == null) break;
            if(nc === until) break;
            res.push(nc);
        }
        return res.join("");
    }
    const commands: {[key: string]: (g: TES, arg: string) => undefined | JSX.Element} = {
        'insert': (g, arg) => {
            const ins_txt = arg;
            g.file = g.file.substring(0, g.crs) + ins_txt + g.file.substring(g.crs);
            g.crs += ins_txt.length;
            return undefined;
        },
        'start': g => {
            g.crs = 0;
            return undefined;
        },
        'end': g => {
            g.crs = g.file.length;
            return undefined;
        },
        'line-above': g => {
            let nl = g.file.lastIndexOf("\n", g.crs - 1);
            if(nl === -1) nl = 0;
            g.file = g.file.substring(0, nl) + "\n" + g.file.substring(nl);
            g.crs = nl === 0 ? nl : nl + 1;
            return undefined;
        },
        'line-below': g => {
            let nl = g.file.indexOf("\n", g.crs + 1);
            if(nl === -1) nl = g.file.length;
            g.file = g.file.substring(0, nl) + "\n" + g.file.substring(nl);
            g.crs = nl + 1;
            return undefined;
        },

        'cursor-left': g => {
            g.crs = Math.max(g.crs - 1, 0);
            return undefined;
        },
        'cursor-right': g => {
            g.crs = Math.max(g.crs + 1, 0);
            return undefined;
        },
    };

    function exec(v: string, g: TES): JSX.Element | undefined {
        const nextChar = (() => {
            let i = 0;
            const chars = [...v];
            return () => {
                return chars[i++];
            };
        })();
    
        while(true) {
            const nc = nextChar();
            if(nc == null) return;
            let next_line_slash = false;
            const exec_cmd = (() => {
                if(nc === "[") {
                    const cmd = readUntil(nextChar, "]");
                    return cmd;
                }
                if(nc === "/") {
                    next_line_slash = true;
                    return "insert: " + (g.prev_lyn_slash ? "\n" : "") + readUntil(nextChar, undefined);
                }
                if(nc === "g") {
                    const sc = nextChar();
                    if(sc === "g") return "start";
                    return "error: bad-g-command: `"+sc+"`";
                }
                if(nc === "G") return "end";
                if(nc === "O") return "line-above";
                if(nc === "o") return "line-below";
                if(nc === "w") return "cursor-right: word";
                if(nc === "b") return "cursor-left: word";
                if(nc === "h") return "cursor-left: grapheme-cluster";
                if(nc === "j") return "cursor-down";
                if(nc === "k") return "cursor-up";
                if(nc === "l") return "cursor-right: grapheme-cluster";
                if(nc === "l") return "line-below";
                return "error: bad-char: `"+nc+"`";
            })();
            g.prev_lyn_slash = next_line_slash;
            if(exec_cmd === "exit") {
                throw new Error("exit");
            }
            const [eca, ...ecrest] = exec_cmd.split(": ");
            const ecarg = ecrest.join(": ");
            const cmd = commands[eca ?? ""];
            if(cmd == null) {
                return <Line class="text-red-500">Error: Command not found: [{eca}]</Line>;
            }
            const res = cmd(g, ecarg);
            if(res != null) return res;
        }
    }

    const gtes: TES = {
        file: "",
        crs: 0,
        prev_lyn_slash: false,
    };
    while(true) {
        const [gv, setGv] = createSignal<string | TES>(gtes);
        const [ers, setErs] = createSignal<JSX.Element>(null);
        t.print(<>
            <Show when={(() => {
                const g = gv();
                if(typeof g === "string") return null;
                return g;
            })()} fallback={<>
                <Line class="bg-zinc-900">
                    {"$ "+gv()}
                </Line>
            </>}>{g => (
                <Line>
                    {g.file.substring(0, g.crs)}
                    <VCursor />
                    {g.file.substring(g.crs)}
                </Line>
            )}</Show>
            {ers()}
        </>);
        const v = (await t.read({
            onProgress: q => {
                const ng = {...gtes};
                setErs(exec(q, ng));
                setGv(ng);
            },
        }));
        setGv(v);
        
        t.print(exec(v, gtes));
    }
    return;
}

async function app(t: Term): Promise<void> {
    /*
    <div class="m-2"><div class="bg-slate-300 text-slate-900">
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
    </div></div>
    */
    type Bys = {
        previewDisplay?: undefined | (() => JSX.Element),
    };
    type Dir = Bys & {
        kind: "dir",
        files: {[key: string]: Dir | Fyl},
    };
    type Fyl = Bys & {
        kind: "fyl",
    };
    const dir = (files: {[key: string]: Dir | Fyl}): Dir => ({kind: "dir", files});
    const ipbotprvdsp = () => <div class="m-2"><div class="bg-slate-300 text-slate-900">
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
    </div></div>;
    const dirstructure = dir({
        projects: dir({
            current: dir({
                interpunct_bot: {
                    kind: "fyl",
                    previewDisplay: ipbotprvdsp,
                },
                threadreader: dir({}), // todo rename to threadclient and redirect the old url
            }),
            past: dir({}),
        }),
    });

    let cwd: string[] = [];

    function getitm(path: string[]): Dir | Fyl | undefined {
        let v: Dir | Fyl = dirstructure;
        for(const ntry of path) {
            if(v.kind === "dir") {
                if(Object.hasOwn(v.files, ntry)) {
                    v = v.files[ntry]!;
                    continue;
                }
            }
            return undefined;
        }
        return v;
    }
    function pathjoin(a: string[], b: string[]): string[] {
        const res = [...a];
        for(const itm of b) {
            if(itm === "..") {
                res.pop();
            }else if(itm === ".") {
                continue;
            }else if(itm === "") {
                continue;
            }else{
                res.push(itm);
            }
        }
        return res;
    }
    function userpath(user: string): string[] {
        const vsplit = user.split("/");
        if(vsplit.length > 1 && vsplit[0] === "") return pathjoin([], vsplit);
        return pathjoin(cwd, vsplit);
    }

    // TODO: set the URL of the page we're on to match the cwd

    while(true) {
        const [printcmd, setPrintcmd] = createSignal<string>("");
        t.print(<Line class="bg-zinc-900">https://pfg.pw/{cwd.join("/")}$ {printcmd()}</Line>);
        const v = (await t.read({
            onProgress: q => void setPrintcmd(q),
        })).split(" ");
        setPrintcmd(v.join(" ")+"");

        if(v[0] === "ls") {
            const what = [...v.slice(1)].join(" ");
            const fyl = getitm(userpath(what));
            const itms: [
                string, Dir | Fyl,
            ][] = fyl == null ? [] : fyl.kind === "dir" ? Object.entries(fyl.files) : [
                ["?", fyl],
            ];
            for(const [name, itm] of itms) {
                t.print(itm.previewDisplay ? itm.previewDisplay() : <Line>
                    {name}{itm.kind === "dir" ? "/" : ""}
                </Line>);
            }
        }else if(v[0] === "cd") {
            const what = [...v.slice(1)].join(" ");
            const path = userpath(what);
            const fyl = getitm(path);
            if(fyl?.kind !== "dir") {
                t.print(<Line>Not found</Line>);
                continue;
            }
            cwd = path;
        }else if(v[0] === "exit") {
            t.print(<Line>Exiting</Line>);
            break;
        }else if(v[0] === "pwd") {
            t.print(<Line>/{cwd.join("/")}</Line>);
        }else if(v[0] === "adventure") {
            try {
                await adventureGame(t);
            }catch(er) {
                const e = er as Error;
                t.print(<Line>Adventure game errored: {e.toString() + "\n" + e.stack}</Line>);
            }
        }else if(v[0] === "edit") {
            try {
                await editor(t);
            }catch(er) {
                const e = er as Error;
                t.print(<Line>Text editor errored: {e.toString() + "\n" + e.stack}</Line>);
            }
        }else if(v[0] === "showanimtest") {
            const target_msg = "Here is some text. I'm trying out animating it in";
            const [animvalue, setAnimvalue] = createSignal("");
            const updatep = (p: number): void=> {
                if(p >= 1) return void setAnimvalue(target_msg);
                setAnimvalue([...target_msg].map(q => {
                    if(q === " ") return q;

                    // ok I'd rather for each char we start at ' ' and then upgrade it randomly
                    // so like ' ' → '.' → '$' → 'a'
                    // but we never go backwards

                    const picks = ["@", "$", "#", "^", "&"];
                    const char = picks[(Math.random() * picks.length) |0]!;
                    const picks2 = ["", " ", "!", ".", ",", "*", "-"];
                    const char2 = picks2[(Math.random() * picks2.length) |0]!;
                    if(Math.random() > p) return Math.random() < p ? char : char2;
                    return q;
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
                    }} class="underline" ref={q => {
                        onMount(() => {
                            q.style.opacity = "0";
                            setTimeout(() => {
                                q.style.opacity = "1";
                                q.animate([
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
        }else{
            t.print(<Line>I'm not sure what you mean. `help` for help.</Line>);
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
    return <div class={props.class + " px-2 whitespace-pre-wrap font-mono"} style={{
        // 'font-family': "Verdana",
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

    let inputref!: HTMLInputElement;
    const term: Term = {
        print: (msg) => {
            setLines(v => {
                return [...v, {itm: msg}];
            });
        },
        read: async (opts) => {
            return awaitRead(opts);
        },
        suggest: (msg) => {
            inputref.value = msg;
            inputref.focus();
        },
    };
    app(term).then(r => {
        term.print("App exited.");
    }).catch((e: Error) => {
        term.print("App errored: "+e.toString()+"\n"+e.stack);
    });
    // on cleanup: send a cancel signal

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
        <For each={lines()}>{line => <>
            {line.itm}
        </>}</For>
        <div class="pt-2 px-2">
            <input class="block w-full border border-hex-fff rounded-md px-1" ref={el => {
                inputref = el;
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
    </div></div>;
}