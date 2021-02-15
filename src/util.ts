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

export const encodeQuery = (items: {[key: string]: string}): string => {
    let res = "";
    for(const [key, value] of Object.entries(items)) {
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