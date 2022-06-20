import { createEffect, createSignal, For, JSX, onCleanup, onMount, Setter, untrack } from "solid-js";
import { Show } from "tmeta-util-solid";
import Clickable from "../../components/Clickable";
import { seededRandom } from "../../darken_color";

type ReadOpts = {
    onProgress?: undefined | ((progress: string) => void),
};
type Term = {
    // print: (msg: string) => TermLine,
    // update: (line: TermLine, msg: string) => void,
    print: (line: JSX.Element) => void,
    read: (opts?: undefined | ReadOpts) => Promise<string>,
    execute: (msg: string) => void,
};

function ChatLink(props: {t: Term, to: string, children: JSX.Element}): JSX.Element {
    return <Clickable class="underline" action={() => {
        props.t.execute(props.to);
    }}>{props.children}</Clickable>;
}

/*

You're walking through a forest. Not really paying attention. Suddenly, you step on something metal.

$> look
You're standing in a forest. There is a trapdoor under your foot, camoflauged by rust and leaves.

$> look trapdoor
It's a metal trapdoor. {cleared ? Even with the leaves cleared off, the rust still blends it in to the forest floor. : It
is covered in leaves and rust, making it blend in with the the forest floor.} You're not sure if you would have
seen it had you not stepped on it.

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

const adventure_player = entity({
    state: {in: "room"},
    actions: {},
});
const adventure_game = {
    player: adventure_player,
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

// ok here's a fun concept
// - you are a robot
// - the commands you type are the same commands you can use in other robots
// so at first you only have one robot
// - but you can program macro functions basically that will help you get set up
// and then you can start making basic robots to eg sit on a resource and mine for example
//
// ok there needs to be a reason you can't just macro everything at all times
// - there has to be some kind of resource you need for every step the world advances by
// - what if we just make it so if you execute a macro you have to press next through every step or smth
//
// also once you have multiple robots it could be cool if two robots weren't allowed to stand in the
// same tile

// ok gameplay:
// - right now you can craft a pickaxe and an axe
// - the pickaxe will let you mine stone
// - the axe will let you chop down the rebar tree and get its branch

// what's something you have to do | something you have to work towards?

// what if we could somehow build like in yourworldoftext?
// - that could be fun. needs a map though
// - might be better for a prebuilt world of some kind

// tile: "|" "_"*11 "|" "\n" ("|" x*11 "|") * 5
const art = {
    // design key: "L25qbG5kamFrbGNkYWNkc2Fjbg=="
    battery_acid_lake: [
        "  ~        ",
        "     ~   ~ ",
        " ~     ~   ",
        "    ~      ",
        "  ~     ~  ",
    ],
    tree: [
        "     ] ][  ",
        "   ] ][/   ",
        "    \\][    ",
        "     ][    ",
        "     ][    ",
    ],
    stone_deposit: [
        "           ",
        " o      O  ",
        "   o Oo    ",
        "    o      ",
        "       oO  ",
    ],
    grass: [
        "           ",
        "           ",
        "      \\|/  ",
        "           ",
        " \\|/       ",
    ],
};
() => art;

type TileEarthLayer = {
    kind: "stone_deposit",
    ore_remaining: number,
    stones_remaining: number,
} | {
    kind: "grass",
} | {
    kind: "battery_acid_lake",
    count_remaining: number,
} | {
    kind: "rebar_tree",
    branches_remaining: number,
};
type WorldItem = "stone" | "rebar_rod" | "stone_rebar_pickaxe" | "stone_rebar_axe";
type WorldTile = {
    pos: [number, number],
    earth: TileEarthLayer,
    item?: undefined | WorldItem,
};
type WorldEntity = {
    pos: [number, number],
    features: {
        eyes: boolean,
        wheels: boolean,
    },
    inventory: {
        left_hand: null | WorldItem,
        right_hand: null | WorldItem,
    },
};
async function worldGame(t: Term): Promise<void> {
    const map_internal = new Map<`${number},${number}`, WorldTile>();

    function mapGet([x, y]: Vec2): WorldTile {
        const v = `${x},${y}` as const;
        const rng = seededRandom(v);
        const value = map_internal.get(v);
        if(value != null) return value;
        const tile: WorldTile = {
            pos: [x, y],
            earth: rng() > 0.2 || (x === 0 && y === 0) ? {
                kind: "grass",
            } : rng() > 0.5 ? {
                kind: "rebar_tree",
                branches_remaining: ((rng() * 3) + 5) |0,
            } : {
                kind: "stone_deposit",
                stones_remaining: ((rng() * 4) + 2) |0,
                ore_remaining: ((rng() * 100) + 100) |0,
            },
        };
        map_internal.set(v, tile);
        return tile;
    }

    type Vec2 = [x: number, y: number];
    function vec2add(a: Vec2, b: Vec2): Vec2 {
        return [a[0] + b[0], a[1] + b[1]];
    }

    const player: WorldEntity = {
        pos: [0, 0],
        features: {
            eyes: true,
            wheels: true,
        },
        inventory: {
            left_hand: null,
            right_hand: null,
        },
    };

    function holding(v: WorldItem): boolean {
        return player.inventory.left_hand === v || player.inventory.right_hand === v;
    }
    function hasspace(): boolean {
        return player.inventory.left_hand == null || player.inventory.right_hand == null;
    }
    function pickup(item: WorldItem) {
        if(player.inventory.left_hand == null) {
            player.inventory.left_hand = item;
        }else if(player.inventory.right_hand == null) {
            player.inventory.right_hand = item;
        }else{
            throw new Error("no space to insert");
        }
    }

    // TODO: maybe you can put some things in eg a battery acid lake but not others
    // so we can return what classes of thing the tile has space for
    function tilehasspace(tile: WorldTile): boolean {
        if(tile.item != null) return false;
        if(tile.earth.kind === "battery_acid_lake") return false;
        if(tile.earth.kind === "stone_deposit") return false;
        if(tile.earth.kind === "rebar_tree") return false;
        return true;
    }
    function tiledrop(tile: WorldTile, item: WorldItem) {
        if(tile.item != null) throw new Error("bad drop point");
        tile.item = item;
    }

    function godir(dir: Vec2): void {
        const target = vec2add(player.pos, dir);
        const tile = mapGet(target);
        if(!tilehasspace(tile)) {
            return t.print(<Line class="text-red-500">You can't stand there</Line>);
        }
        player.pos = target;
    }

    const dirs: {[key in "w" | "a" | "s" | "d"]: Vec2} = {
        w: [0, -1],
        a: [-1, 0],
        s: [0, 1],
        d: [1, 0],
    };
    function isdir(a: string): a is "w" | "a" | "s" | "d" {
        return a === "w" || a === "s" || a === "a" || a === "d";
    }

    function printtile(tile: WorldTile): string {
        if(tile.item != null) {
            return "item: " + printitem(tile.item);
        }
        if(tile.earth.kind === "stone_deposit") return (
            "stone deposit ("+tile.earth.stones_remaining+" stones, "+tile.earth.ore_remaining+" ore remain)"
        );
        if(tile.earth.kind === "battery_acid_lake") return (
            "battery acid lake ("+tile.earth.count_remaining+" drops remain)"
        );
        if(tile.earth.kind === "grass") return (
            "grass"
        );
        if(tile.earth.kind === "rebar_tree") return (
            "rebar tree ("+tile.earth.branches_remaining+" branches remain)"
        );
        return "EBADTILE";
    }
    function printmini(tile: WorldTile): string {
        if(tile.item != null) return "#";
        if(tile.earth.kind === "stone_deposit") return "o";
        if(tile.earth.kind === "battery_acid_lake") return "~";
        if(tile.earth.kind === "grass") return ",";
        if(tile.earth.kind === "rebar_tree") return "]";
        return "?";
    }
    function printitem(item: WorldItem | null): string {
        if(item == null) return "nothing";
        return item;
    }

    let setSectionInteractive: null | Setter<false> = null;

    while(true) {
        const [printcmd, setPrintcmd] = createSignal("");
        const [printdone, setPrintDone] = createSignal(false);
        const [sectionInteractive, nsi] = createSignal(true);
        t.print(<>
            <Line class="bg-zinc-900">[What to do?] {printcmd()}</Line>
            {!printdone() ? <Line class="text-zinc-400">
                You are holding:{"\n"}
                l:{"  "} {printitem(player.inventory.left_hand)}{"\n"}
                {"  "}r: {printitem(player.inventory.right_hand)}{"\n"}
                {"\n"}
                You are standing in {mapGet(player.pos).earth.kind}.{"\n"}
                {"   "}↑w:{"   "} {printtile(mapGet(vec2add(player.pos, [0, -1])))}{"\n"}
                ←a:{"   "}{"   "} {printtile(mapGet(vec2add(player.pos, [-1, 0])))}{"\n"}
                {"   "}{"   "}→d: {printtile(mapGet(vec2add(player.pos, [1, 0])))}{"\n"}
                {"   "}↓s:{"   "} {printtile(mapGet(vec2add(player.pos, [0, 1])))}{"\n"}
                {false as true ? <>
                    {"\n"}
                    {new Array(9).fill([]).map(([,], y) => {y -= 4;
                        return new Array(9).fill([]).map(([,], x) => {x -= 4;
                            // TODO: raytrace to the player pos to see if you can actually see the tile or not
                            if(x === 0 && y === 0) return "Y";
                            return printmini(mapGet(vec2add(player.pos, [x, y])));
                        }).join(" ");
                    }).join("\n")}
                </> : null}
            </Line> : null}
        </>);
        const v = (await t.read({
            onProgress: q => void setPrintcmd(q),
        })).split(" ");
        setSectionInteractive?.(false);
        setSectionInteractive = nsi;
        setPrintcmd(v.join(" ")+"");
        setPrintDone(true);
        
        // TODO: if you click a link from an error, we should rewrite the previous command even
        // = delete the previous lines and write again
        // that should happen any time you try again after an error probably
        const LinkCmd = (props: {cmd: string, children: JSX.Element}) => (
            <button
                title={props.cmd}
                class={sectionInteractive() ? "underline" : "!opacity-100 cursor-default"}
                disabled={!sectionInteractive()}
                onClick={() => sectionInteractive() && t.execute(props.cmd)}
            >
                {props.children}
            </button>
        );

        if(v[0] != null && isdir(v[0])) {
            godir(dirs[v[0]]);
        }else if(v[0] === "e") {
            if(v[1] != null && isdir(v[1])) {
                // 1. check if either hand contains a pickaxe (you need a pickaxe to mine)
                const minetarget = vec2add(player.pos, dirs[v[1]]);
                const minetile = mapGet(minetarget);
                if(minetile.item != null) {
                    if(hasspace()) {
                        pickup(minetile.item);
                        minetile.item = undefined;
                    }else{
                        t.print(<Line>You are holding stuff in both hands</Line>);
                    }
                }else if(minetile.earth.kind === "stone_deposit") {
                    if(hasspace()) {
                        if(minetile.earth.stones_remaining > 0) {
                            minetile.earth.stones_remaining -= 1;
                            pickup("stone");
                        }else{
                            t.print(<Line>No stones left to pick up</Line>);
                        }
                    }else{
                        t.print(<Line>You're holding things in both hands</Line>);
                    }
                }else if(minetile.earth.kind === "rebar_tree") {
                    if(hasspace()) {
                        if(minetile.earth.branches_remaining > 0) {
                            minetile.earth.branches_remaining -= 1;
                            pickup("rebar_rod");
                        }else{
                            t.print(<Line>No rods left to take</Line>);
                        }
                    }else{
                        t.print(<Line>You're holding things in both hands</Line>);
                    }
                }else{
                    t.print(<Line>Cannot harvest that</Line>);
                }
            }else{
                t.print(<Line>Usage: e [w|a|s|d]</Line>);
            }
        // vv instead of 'mine a' maybe 'l a' saying 'use «left hand» on «a» direction'
        }else if(v[0] === "mine") {
            if(v[1] != null && isdir(v[1])) {
                // 1. check if either hand contains a pickaxe (you need a pickaxe to mine)
                const minetarget = vec2add(player.pos, dirs[v[1]]);
                const minetile = mapGet(minetarget);
                if(minetile.earth.kind === "stone_deposit") {
                    if(holding("stone_rebar_pickaxe")) {
                        if(hasspace()) {
                            if(minetile.earth.ore_remaining > 0) {
                                minetile.earth.ore_remaining -= 1;
                                pickup("stone");
                            }else{
                                t.print(<Line>No stones left to mine</Line>);
                            }
                        }else{
                            t.print(<Line>You're holding things in both hands</Line>);
                        }
                    }else{
                        t.print(<Line>You need a pickaxe to mine</Line>);
                    }
                }else{
                    t.print(<Line>Cannot mine that</Line>);
                }
            }else{
                t.print(<Line>Usage: mine [w|a|s|d]</Line>);
            }
        }else if(v[0] === "craft") {
            const torecipestr = (a: WorldItem | null, b: WorldItem | null): string => {
                return [a ?? "" as const, b ?? "" as const].sort().join(",");
            };
            const recipes: {[key: string]: WorldItem[]} = {
                [torecipestr("stone", "rebar_rod")]: [
                    "stone_rebar_pickaxe",
                    "stone_rebar_axe",
                ],
            };
            const this_recipe = torecipestr(player.inventory.left_hand, player.inventory.right_hand);
            const target = recipes[this_recipe];
            if(!Object.hasOwn(recipes, this_recipe) || target == null) {
                t.print(<Line>You can't craft anything with what you're holding</Line>);
            }else{
                const targetitm = v[1];
                const q = target.find(m => m === targetitm);
                if(q == null) {
                    t.print(<Line>Usage: craft [
                        <For each={target}>{(itm, i) => <>
                            {i() !== 0 ? "|" : ""}
                            <LinkCmd cmd={"craft "+itm}>{itm}</LinkCmd>
                        </>}</For>    
                    ]</Line>);
                }else{
                    player.inventory.left_hand = null;
                    player.inventory.right_hand = null;
                    pickup(q);
                }
            }
        }else if(v[0] === "drop") {
            const hand = v[1] === "l" ? v[1] : v[1] === "r" ? v[1] : null;
            if(hand != null && v[2] != null && isdir(v[2])) {
                const dropto = mapGet(vec2add(player.pos, dirs[v[2]]));
                const handv = hand === "l" ? "left_hand" : "right_hand";
                if(player.inventory[handv] != null) {
                    if(tilehasspace(dropto)) {
                        const object = player.inventory[handv];
                        player.inventory[handv] = null;
                        tiledrop(dropto, object!);
                    }else{
                        t.print(<Line class="text-red-500">There's something in the way</Line>);
                    }
                }else{
                    t.print(<Line class="text-red-500">You're not holding anything in {handv}</Line>);
                }
            }else{
                t.print(<Line class="text-red-500">Usage: `drop [l|r] [w|a|s|d]`</Line>);
            }
        }else if(v[0] === "help") {
            t.print(<Line>TODO help</Line>);
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

    let setSectionInteractive: null | Setter<false> = null;

    while(true) {
        const [printcmd, setPrintcmd] = createSignal<string>("");
        t.print(<Line class="bg-zinc-900">https://pfg.pw/{cwd.join("/")}$ {printcmd()}</Line>);
        const v = (await t.read({
            onProgress: q => void setPrintcmd(q),
        })).split(" ");
        setSectionInteractive?.(false);
        const [sectionInteractive, nsi] = createSignal(true);
        setSectionInteractive = nsi;
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
                // alternatively: `inert="true" filter:grayscale(100%)`
                const filename = name + (itm.kind === "dir" ? "/" : "");
                t.print(itm.previewDisplay ? <div
                    ref={el => {
                        // note: only works in chrome right now but it's nightly on firefox so it should
                        // come out soon: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert
                        // oh and it's in an unreleased safari so it should come out soon there too
                        createEffect(() => {
                            if(sectionInteractive()) {
                                el.removeAttribute("inert");
                                el.style.filter = "";
                            }else{
                                el.setAttribute("inert", "true");
                                el.style.filter = "grayscale(100%)";
                            }
                        });
                    }}
                >{untrack(() => itm.previewDisplay!())}</div> : <Line>
                    <Clickable action={() => {
                        if(!sectionInteractive()) return;
                        t.execute("cd /"+ pathjoin(userpath(what), [filename]).join("/"));
                    }} class={sectionInteractive() ? "underline" : "cursor-arrow"}>
                        {filename}
                    </Clickable>
                </Line>);
                // ^ TODO: that link should be to a file and should always have interactivity while in this screen
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
        }else if(v[0] === "world") {
            try {
                await worldGame(t);
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
    setSectionInteractive?.(false);
    setSectionInteractive = null;
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
            background-color: #000 !important;
        }
    `;
    onCleanup(() => {
        sel.remove();
    });
    document.body.appendChild(sel);

    const history: string[] = [];

    const [lines, setLines] = createSignal<{itm: JSX.Element}[]>([]);

    const waiting_reads: string[] = [];
    const waiting_cbs: ({
        complete: (v: string) => void,
        progress: (v: string) => void,
    })[] = [];
    const emitRead = (msg: string) => {
        if(history[history.length - 1] !== msg) history.push(msg);
        hmrview().push(msg);

        const wcb = waiting_cbs.shift();
        if(wcb != null) {
            wcb.complete(msg);
            return;
        }
        waiting_reads.push(msg);
        return;
    };
    for(const item of hmrview().splice(0, hmrview().length)) {
        emitRead(item);
    }
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
        execute: (msg) => {
            emitRead(msg);
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
                if(e.code === "ArrowUp") {
                    // TODO if there's a value already, we can do the fish thing and search it
                    // TODO we should have some temp history entry that lets you something or other
                    // TODO todo
                    e.currentTarget.value = history[history.length - 1] ?? "";
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
            <button class="border border-hex-fff rounded-md px-1" onClick={() => {
                if(!confirm("really clear?")) return;
                hmrview().splice(0, hmrview().length);
                props.reloadSelf();
            }}>
                dbg:clr
            </button>
        </div>
    </div></div>;
}