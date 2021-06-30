export function stringify(object: unknown): {[key: string]: unknown} {
    const seen_map = new Map<unknown, {idx: string, seen_count: number} | {idx: undefined | string, seen_count: 1}>();
    let index = 1;
    JSON.stringify(object, (key, value: unknown) => {
        if(typeof value === "object") {
            const sv = seen_map.get(value);
            if(sv && value != null) {
                if(sv.idx == null) sv.idx = "@" + index++;
                sv.seen_count++;
                return undefined;
            }
            seen_map.set(value, {idx: undefined, seen_count: 1});
        }
        return value;
    });

    const symbol_map = new Map<symbol, {symidx: string}>();
    let symbol_index = 1;
    const res: {[key: string]: unknown} = {};
    for(const [seenobj, {idx, seen_count}] of seen_map) {
        if(seen_count === 1 && seenobj !== object) continue;
        res["@"+idx] = JSON.parse(JSON.stringify(seenobj, (key, value: unknown) => {
            if(typeof value === "object" && key !== "") {
                const sval = seen_map.get(value);
                if(sval && sval.seen_count > 1) return {'$ref': sval.idx};
            }
            if(typeof value === "symbol") {
                const symval = symbol_map.get(value)
                    ?? symbol_map.set(value, {symidx: "#" + symbol_index++}).get(value)!
                ;
                return {'$sym': symval};
            }
            return value;
        }));
    }
    return res;
}