export type RGBA = {r: number, g: number, b: number, a: number};
export type HSLA = {h: number, s: number, l: number, a: number};

export function rgbToHSL({r: r255, g: g255, b: b255, a = 1}: RGBA): HSLA {
    const r = r255 / 255;
    const g = g255 / 255;
    const b = b255 / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const c = max - min;

    const l = (max + min) / 2;

    if (c === 0) {
        return {h: 0, s: 0, l, a};
    }

    let h = (
        max === r ? (
            ((g - b) / c) % 6
        ) : max === g ? (
            (b - r) / c + 2
        ) : ((r - g) / c + 4)
    ) * 60;
    if (h < 0) {
        h += 360;
    }

    const s = c / (1 - Math.abs(2 * l - 1));

    return {h, s, l, a};
}
export function hslToRGB({h, s, l, a = 1}: HSLA): RGBA {
    if (s === 0) {
        const [r, b, g] = [l, l, l].map((x) => Math.round(x * 255));
        return {r: r!, g: g!, b: b!, a};
    }

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    const [r, g, b] = (
        h < 60 ? (
            [c, x, 0]
        ) : h < 120 ? (
            [x, c, 0]
        ) : h < 180 ? (
            [0, c, x]
        ) : h < 240 ? (
            [0, x, c]
        ) : h < 300 ? (
            [x, 0, c]
        ) : [c, 0, x]
    ).map((n) => Math.round((n + m) * 255));

    return {r: r!, g: g!, b: b!, a};
}
export function rgbToString(rgb: RGBA): string {
    const {r, g, b, a} = rgb;
    if (a != null && a < 1) {
        return `rgba(${toFixed(r)}, ${toFixed(g)}, ${toFixed(b)}, ${toFixed(a, 2)})`;
    }
    return `rgb(${toFixed(r)}, ${toFixed(g)}, ${toFixed(b)})`;
}
function toFixed(n: number, digits = 0) {
    const fixed = n.toFixed(digits);
    if (digits === 0) {
        return fixed;
    }
    const dot = fixed.indexOf(".");
    if (dot >= 0) {
        const zeros_match = fixed.match(/0+$/);
        if (zeros_match) {
            if (zeros_match.index === dot + 1) {
                return fixed.substring(0, dot);
            }
            return fixed.substring(0, zeros_match.index);
        }
    }
    return fixed;
}


function xmur3(str: string) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    };
}

function sfc32(a: number, b: number, c: number, d: number) {
    return function () {
        a >>>= 0;
        b >>>= 0;
        c >>>= 0;
        d >>>= 0;
        let t = (a + b) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        d = (d + 1) | 0;
        t = (t + d) | 0;
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
    };
}

export function seededRandom(string: string): () => number {
    const seed = xmur3(string);
    return sfc32(seed(), seed(), seed(), seed());
}

export function getRandomColor(rand: () => number): [RGBA, RGBA] {
    const hue = rand() * 360;
    const saturation = rand() * 0.5 + 0.5;
    const lightness = rand();

    const hsl = {h: hue, s: saturation, l: lightness * 0.3 + 0.2, a: 1 };
    const hsl_dark = {...hsl, l: 1 - (lightness * 0.4 + 0.1)};
    return [hslToRGB(hsl), hslToRGB(hsl_dark)];
    // return {r: rand() * 128 |0, g: rand() * 128 |0, b: rand() * 128 |0, a: 1};
}