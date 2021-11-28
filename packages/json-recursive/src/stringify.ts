export function stringify(object: unknown): {[key: string]: unknown} {
    const seen_map = new Map<unknown, {idx: string | null, seen_count: number}>();
    let index = 1;
    JSON.stringify(object, (key, value: unknown) => {
        if(typeof value === "object") {
            const sv = seen_map.get(value);
            if(sv && value != null) {
                if(sv.idx == null) sv.idx = "@" + index++;
                sv.seen_count++;
                return undefined;
            }
            seen_map.set(value, {idx: null, seen_count: 1});
        }
        return value;
    });

    const symbol_map = new Map<symbol, {symidx: string}>();
    let symbol_index = 1;
    const res: {[key: string]: unknown} = {};
    for(const [seenobj, {idx, seen_count}] of seen_map) {
        if(seen_count === 1 && seenobj !== object) continue;
        res[idx ?? "@root"] = JSON.parse(JSON.stringify(seenobj, (key, value: unknown) => {
            if(typeof value === "object" && key !== "") {
                const sval = seen_map.get(value);
                if(sval && sval.seen_count > 1) return {'$ref': sval.idx ?? "@root"};
            }
            if(typeof value === "symbol") {
                const symval = symbol_map.get(value)
                    ?? symbol_map.set(value, {symidx: "#" + symbol_index++ + "#" + value.toString()}).get(value)!
                ;
                return {'$sym': symval};
            }
            return value;
        }));
    }
    return res;
}

export function destringify(text: string): unknown {
    const ds = JSON.parse(text) as unknown as {[key: string]: unknown};
    const value_map = new Map<string, boolean>();
    const symbol_map = new Map<string, symbol>();
    const autoreplace = (value: unknown): (undefined | {value: unknown}) => {
        if(typeof value === "object") {
            if(value == null) return undefined;
            if('$ref' in value) {
                return {value: resolvestr((value as unknown as {'$ref': string})['$ref'])};
            }
            if('$sym' in value) {
                const symkey = (value as unknown as {'$sym': string})['$sym'];
                const pv = symbol_map.get(symkey);
                if(pv) return {value: pv};
                const nsym = Symbol(symkey);
                symbol_map.set(symkey, nsym);
                return {value: nsym};
            }
        }
        return undefined;
    };
    const resolvestr = (str: string) => {
        if(value_map.has(str)) return ds[str];
        value_map.set(str, true);
        return resolve(ds[str]);
    };
    const resolve = (value: unknown) => {
        if(typeof value === "object") {
            if(Array.isArray(value)) {
                for(let i = 0; i < value.length; i++) {
                    const isc = autoreplace(resolve(value[i]));
                    if(isc) value[i] = isc.value;
                }
            }else{
                if(value == null) return null;
                for(const [key, item] of Object.entries(value)) {
                    const isc = autoreplace(resolve(item));
                    if(isc) (value as unknown as {[key: string]: unknown})[key] = isc.value;
                }
            }
            return value;
        }else{
            return value;
        }
    };
    return resolvestr("@root");
}