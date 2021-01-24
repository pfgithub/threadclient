function assertNever(v: never): never {console.log(v); throw new Error("not never");}


export type RGBA = {r: number, g: number, b: number, a: number};
export type HSLA = {h: number, s: number, l: number, a: number};

function scale(x: number, inLow: number, inHigh: number, outLow: number, outHigh: number) {
    return (x - inLow) * (outHigh - outLow) / (inHigh - inLow) + outLow;
}

function clamp(x: number, min: number, max: number) {
    return Math.min(max, Math.max(min, x));
}

function multiplyMatrices(m1: number[][], m2: number[][]) {
    const result: number[][] = [];
    for (let i = 0, len = m1.length; i < len; i++) {
        result[i] = [];
        for (let j = 0, len2 = m2[0].length; j < len2; j++) {
            let sum = 0;
            for (let k = 0, len3 = m1[0].length; k < len3; k++) {
                sum += m1[i][k] * m2[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
}
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
        max === r ? (((g - b) / c) % 6) :
            max === g ? ((b - r) / c + 2) :
                ((r - g) / c + 4)
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
        return {r, g, b, a};
    }

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    const [r, g, b] = (
        h < 60 ? [c, x, 0] :
            h < 120 ? [x, c, 0] :
                h < 180 ? [0, c, x] :
                    h < 240 ? [0, x, c] :
                        h < 300 ? [x, 0, c] :
                            [c, 0, x]
    ).map((n) => Math.round((n + m) * 255));

    return {r, g, b, a};
}
function modifyBlueFgHue(hue: number) {
    return scale(hue, 205, 245, 205, 220);
}
const MIN_FG_LIGHTNESS = 0.55;
const MAX_BG_LIGHTNESS = 0.4;
function modifyFgHSL({h, s, l, a}: HSLA, pole: HSLA) {
    const isLight = l > 0.5;
    const isNeutral = l < 0.2 || s < 0.24;
    const isBlue = !isNeutral && h > 205 && h < 245;
    if (isLight) {
        const lx = scale(l, 0.5, 1, MIN_FG_LIGHTNESS, pole.l);
        if (isNeutral) {
            const hx = pole.h;
            const sx = pole.s;
            return {h: hx, s: sx, l: lx, a};
        }
        let hx = h;
        if (isBlue) {
            hx = modifyBlueFgHue(h);
        }
        return {h: hx, s, l: lx, a};
    }

    if (isNeutral) {
        const hx = pole.h;
        const sx = pole.s;
        const lx = scale(l, 0, 0.5, pole.l, MIN_FG_LIGHTNESS);
        return {h: hx, s: sx, l: lx, a};
    }

    let hx = h;
    let lx: number;
    if (isBlue) {
        hx = modifyBlueFgHue(h);
        lx = scale(l, 0, 0.5, pole.l, Math.min(1, MIN_FG_LIGHTNESS + 0.05));
    } else {
        lx = scale(l, 0, 0.5, pole.l, MIN_FG_LIGHTNESS);
    }

    return {h: hx, s, l: lx, a};
}
function modifyBgHSL({h, s, l, a}: HSLA, pole: HSLA) {
    const isDark = l < 0.5;
    const isBlue = h > 200 && h < 280;
    const isNeutral = s < 0.12 || (l > 0.8 && isBlue);
    if (isDark) {
        const lx = scale(l, 0, 0.5, 0, MAX_BG_LIGHTNESS);
        if (isNeutral) {
            const hx = pole.h;
            const sx = pole.s;
            return {h: hx, s: sx, l: lx, a};
        }
        return {h, s, l: lx, a};
    }

    const lx = scale(l, 0.5, 1, MAX_BG_LIGHTNESS, pole.l);

    if (isNeutral) {
        const hx = pole.h;
        const sx = pole.s;
        return {h: hx, s: sx, l: lx, a};
    }

    let hx = h;
    const isYellow = h > 60 && h < 180;
    if (isYellow) {
        const isCloserToGreen = h > 120;
        if (isCloserToGreen) {
            hx = scale(h, 120, 180, 135, 180);
        } else {
            hx = scale(h, 60, 120, 60, 105);
        }
    }

    return {h: hx, s, l: lx, a};
}
function applyColorMatrix([r, g, b]: number[], matrix: number[][]) {
    const rgb = [[r / 255], [g / 255], [b / 255], [1], [1]];
    const result = multiplyMatrices(matrix, rgb);
    return [0, 1, 2].map((i) => clamp(Math.round(result[i][0] * 255), 0, 255));
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
    const dot = fixed.indexOf('.');
    if (dot >= 0) {
        const zerosMatch = fixed.match(/0+$/);
        if (zerosMatch) {
            if (zerosMatch.index === dot + 1) {
                return fixed.substring(0, dot);
            }
            return fixed.substring(0, zerosMatch.index);
        }
    }
    return fixed;
}
export function rgbToHexString({r, g, b, a}: RGBA): string {
    return `#${(a != null && a < 1 ? [r, g, b, Math.round(a * 255)] : [r, g, b]).map((x) => {
        return `${x < 16 ? '0' : ''}${x.toString(16)}`;
    }).join('')}`;
}
export function darkenColor(mode: "foreground" | "background", rgb: RGBA): RGBA {
    const hsl = rgbToHSL(rgb);
    const pole = mode === "foreground"
        ? {h: 36, s: 0.09803921568627463, l: 0.9, a: 1}
        : mode === "background"
        ? {h: 200, s: 0.05882352941176472, l: 0.1, a: 1}
        : assertNever(mode)
    ;
    const modified = mode === "foreground"
        ? modifyFgHSL(hsl, pole)
        : mode === "background"
        ? modifyBgHSL(hsl, pole)
        : assertNever(mode)
    ;
    const {r, g, b, a} = hslToRGB(modified);
    const matrix = [
        [1, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 1, 0],
        [0, 0, 0, 0, 1],
    ];
    const [rf, gf, bf] = applyColorMatrix([r, g, b], matrix);
    return {r: rf, g: gf, b: bf, a};
}


function xmur3(str: string) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++)
        (h = Math.imul(h ^ str.charCodeAt(i), 3432918353)),
            (h = (h << 13) | (h >>> 19));
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
    const hsl = {h: rand() * 360, s: rand() * 0.5 + 0.5, l: rand() * 0.4 + 0.1, a: 1 };
    const hsl_dark = {...hsl, l: 1 - hsl.l};
    return [hslToRGB(hsl), hslToRGB(hsl_dark)];
    // return {r: rand() * 128 |0, g: rand() * 128 |0, b: rand() * 128 |0, a: 1};
}