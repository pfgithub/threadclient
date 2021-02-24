const rawsym = Symbol("raw");
export const raw = (string: string): {[rawsym]: string, toString: () => string} => ({[rawsym]: "" + string, toString: () => string});
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const templateGenerator = <InType>(helper: (str: InType) => string) => {
    type ValueArrayType = (InType | {[rawsym]: string})[];
    return (strings: TemplateStringsArray, ...values: ValueArrayType) => {
        const result: ({raw: string} | {val: InType})[] = [];
        (strings as TemplateStringsArray).forEach((string, i) => {
            result.push({raw: string});
            if(i < values.length) {
                const val = values[i];
                if(typeof val === "object" && rawsym in val) {
                    result.push({raw: (val as {[rawsym]: string})[rawsym]});
                }else{
                    result.push({val: val as InType});
                }
            }
        });
        const res = result.map(el => 'raw' in el ? el.raw : helper(el.val)).join("");
        return res;
    };
};
export const encodeURL = templateGenerator<string>(str => encodeURIComponent(str));

export const encodeQuery = (items: {[key: string]: string | null}): string => {
    let res = "";
    for(const [key, value] of Object.entries(items)) {
        if(value == null) continue;
        if(res) res += "&";
        res += encodeURL`${key}=${value}`;
    }
    return res;
};

export function escapeHTML(unsafe_html: string): string {
    return unsafe_html.replace(/[^a-zA-Z0-9. ]/giu, c => "&#"+c.codePointAt(0)+";");
    // might be a bit &#…; heavy for other languages
}

export const safehtml = templateGenerator((v: string) => escapeHTML(v));

export function assertNever(content: never): never {
    console.log("not never:", content);
    throw new Error("Expected never");
}

// URL Router

type UnionToIntersection<U> = 
    (U extends unknown ? (k: U)=>void : never) extends ((k: infer I)=>void) ? I : never
;

type BitTypeToValType<BitType extends RouteBitType> = BitType extends "any"
    ? string
    : BitType extends readonly (string | null)[]
    ? BitType[number]
    : BitType extends {kind: "starts-with", text: string}
    ? string
    : BitType extends "rest"
    ? string[]
    : BitType extends "optional"
    ? string | null
    : never
;

type BitToOpts<Bit extends RouteBit> = Bit extends string
// eslint-disable-next-line @typescript-eslint/ban-types
    ? {} // {} is okay here because it will get merged ({a: true} & {} & {b: false})
    : Bit extends {[key: string]: RouteBitType}
    ? {[key in keyof Bit]: BitTypeToValType<Bit[key]>}
    : "ERROR BAD"
;
type BitsToOpts<Bits extends readonly RouteBit[]> = UnionToIntersection<BitToOpts<Bits[number]>>;

type RouteBitType = "any" | readonly (string | null)[] | {kind: "starts-with", text: string} | "rest" | "optional";
type RouteBit = string | {[key: string]: RouteBitType};

export type BaseParentOpts = {query: {[key: string]: "unsupported"}, path: string};

type CleanTooltip<T> = T extends Record<string, unknown> ? { [k in keyof T] : T[k] } : "ERROR BAD TYPE"; // hack to clean up hover text

// TS 4.2 will allow (...bits: Bits, cb: …)
export type Router<ParentOpts extends BaseParentOpts, Out> = {
    with<Bits extends readonly RouteBit[]>(bits: Bits, cb: (urlr: Router<CleanTooltip<ParentOpts & BitsToOpts<Bits>>, Out>) => void): void,
    route<Bits extends readonly RouteBit[]>(bits: Bits, cb: (args: CleanTooltip<ParentOpts & BitsToOpts<Bits>>) => Out): void,
    catchall(cb: (args: ParentOpts) => Out): void,
    parse(path: string): Out | null,
    parseSub(opts: ParentOpts, path: string[]): Out | null,
};

// might be useful to convert opts to a more js-friendly type first
function checkMatch<ParentOpts extends BaseParentOpts, Bits extends readonly RouteBit[]>(
    opts: ParentOpts, path_in: string[], bits: Bits, cfg: {assert_end: boolean},
): {opts: CleanTooltip<ParentOpts & BitsToOpts<Bits>>, path: string[]} | null {
    const res_opts: {[key: string]: unknown} = {...opts};
    const path = [...path_in];

    for(const bit of bits) {
        if(typeof bit === "string") {
            const matchv = path.shift();
            if(matchv !== bit) return null;
        }else{
            const entries = Object.entries(bit);
            if(!entries[0] || entries.length !== 1) throw new Error("bad bit object");
            const [outname, bitv] = entries[0];

            if(bitv === "any") {
                const matchv = path.shift();
                if(matchv == null) return null;
                res_opts[outname] = matchv;
            }else if(bitv === "rest") {
                res_opts[outname] = path.splice(0);
            }else if(bitv === "optional") {
                res_opts[outname] = path.shift() ?? null;
            }else if(Array.isArray(bitv) || 'forEach' in bitv) { // not sure why tsc doesn't handle the array.isArray guard properly. it works in the language server
                const matchv = path.shift() ?? null;
                if(!bitv.includes(matchv)) return null;
                res_opts[outname] = matchv;
            }else if(bitv.kind === "starts-with") {
                const matchv = path.shift();
                if(matchv == null) return null;
                if(!matchv.startsWith(bitv.text)) return null;
                res_opts[outname] = matchv.replace(bitv.text, "");
            }// TODO add this back once there is another {kind: …} // else assertNever(bitv);
        }
    }
    if(cfg.assert_end && path.length !== 0) return null;

    return {opts: res_opts as unknown as CleanTooltip<ParentOpts & BitsToOpts<Bits>>, path: path};
}

function routerBased<ParentOpts extends BaseParentOpts, Out>(is_root: boolean): Router<ParentOpts, Out> {
    const routes: ((opts: ParentOpts, path: string[]) => Out | null)[] = [];

    const res: Router<ParentOpts, Out> = {
        with<Bits extends readonly RouteBit[]>(bits: Bits, cb: (urlr: Router<CleanTooltip<ParentOpts & BitsToOpts<Bits>>, Out>) => void): void {
            const subrouter = routerBased<CleanTooltip<ParentOpts & BitsToOpts<Bits>>, Out>(false);
            cb(subrouter);
            routes.push((opts, path) => {
                const match = checkMatch(opts, path, bits, {assert_end: false});
                if(match) {
                    return subrouter.parseSub(match.opts, match.path);
                }
                return null;
            });
        },
        route<Bits extends readonly RouteBit[]>(bits: Bits, cb: (args: CleanTooltip<ParentOpts & BitsToOpts<Bits>>) => Out): void {
            routes.push((opts, path) => {
                const match = checkMatch(opts, path, bits, {assert_end: true});
                if(match) {
                    return cb(match.opts);
                }
                return null;
            });
        },
        catchall(cb): void {
            routes.push((opts, path) => cb(opts));
        },
        parse(path: string): Out | null {
            if(!is_root) throw new Error("not root, ParentOpts ≠ BaseParentOpts");

            let url: URL;
            try {
                url = new URL(path, new URL("https://example/"));
            }catch(e) {return null}

            const pathsplit = url.pathname.split("/").filter(v => v);

            const base_opts: BaseParentOpts = {
                query: Object.fromEntries(url.searchParams) as {[key: string]: "unsupported"},
                path: url.pathname,
            };
            return res.parseSub(base_opts as ParentOpts, pathsplit);
        },
        parseSub(opts: ParentOpts, path: string[]): Out | null {
            for(const route of routes) {
                const out = route(opts, path);
                if(out) return out;
            }
            return null;
        },
    };
    return res;
}
export function router<Out>(): Router<BaseParentOpts, Out> {
    return routerBased<BaseParentOpts, Out>(true);
}

// tests // reminder: babel-node is way faster than ts-node, use that for running tests
// function routerTest() {
//     type RouteOut = {
//         kind: "subreddit",
//         base: string[],
//     };

//     const normal_sorts = ["one", "two"] as const;

//     const urlr = router<RouteOut>();
//     urlr.with(["r", {subreddit: "any"}], urlr => {
//         urlr.route([{sort: normal_sorts}], (opts) => ({
//             kind: "subreddit",
//             base: ["r", opts.subreddit, opts.sort],
//         }));
//     });
//     urlr.parse("/r/subreddit/one");
// }