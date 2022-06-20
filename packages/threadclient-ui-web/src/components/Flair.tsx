import type * as Generic from "api-types-generic";
import {
    createMemo,
    For, JSX
} from "solid-js";
import { RichtextSpans } from "./richtext";

function luminance([r, g, b]: [number, number, number]) {
    const a = [r, g, b].map((itm) => {
        const v = itm / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow( (v + 0.055) / 1.055, 2.4 );
    });
    return a[0]! * 0.2126 + a[1]! * 0.7152 + a[2]! * 0.0722;
}
function contrast(rgb1: [number, number, number], rgb2: [number, number, number]) {
    const lum1 = luminance(rgb1);
    const lum2 = luminance(rgb2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}
function hexToRgb(hexin: string): [number, number, number] | null {
    const hex = hexin.replace("#", "");
    if(hex.length !== 6) return null;
    const bigint = parseInt(hex, 16); // apparently this will return 0 for "0hello" and that's not great.
    if(isNaN(bigint)) return null;
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return [r, g, b];
}
function rgbToHex(rgb: [number, number, number]): `#${string}` {
    return `#${rgb.map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
function getBestTextColor(
    col_hex: string | undefined, backup: string, choices: string[],
): {bg: `#${string}`, text: `#${string}`} {
    const rgb = hexToRgb(col_hex ?? "") ?? hexToRgb(backup)!;
    let highest_contrast: [number, [number, number, number]] = [-Infinity, [0, 0, 0]];
    for(const choice of choices) {
        const choicergb = hexToRgb(choice)!;
        const cont = contrast(rgb, choicergb);
        if(cont > highest_contrast[0]) {
            highest_contrast = [cont, choicergb];
        }
    }
    return {bg: rgbToHex(rgb), text: rgbToHex(highest_contrast[1])};
}
function getFlairColors(col_hex: string | undefined): {
    '--flair-bg-light': `#${string}`,
    '--flair-bg-dark': `#${string}`,
    '--flair-text-light': `#${string}`,
    '--flair-text-dark': `#${string}`,
} {
    const choices = ["#FFFFFF", "#000000"];
    const light = getBestTextColor(col_hex, "#94A3B8", choices);
    const dark = getBestTextColor(col_hex, "#52525B", choices);
    return {
        '--flair-bg-dark': dark.bg,
        '--flair-text-dark': dark.text,
        '--flair-bg-light': light.bg,
        '--flair-text-light': light.text,
    };
}
export function Flair(props: {flairs: Generic.Flair[], pre_space?: undefined | boolean}): JSX.Element {
    // TODO renderFlair
    return <span><For each={props.flairs}>{(flair, i) => {
        const flairCol = createMemo(() => getFlairColors(flair.color));
        return <>
        {(props.pre_space ?? false) || i() !== 0 ? " " : ""}
        <span
            class={flair.system != null ? {
                // note: reconsider this. eg: these things should be options in the
                // post, not flairs probably.
                none: "",
                op: "text-blue-500",
                cake: "text-gray-500",
                admin: "text-red-500",
                moderator: "text-green-500",
                approved: "text-green-500",
                error: "text-red-500",
            }[flair.system] : ("rounded-full px-2"
                + " bg-$flair-bg-light dark:bg-$flair-bg-dark text-$flair-text-light dark:text-$flair-text-dark"
            )}
            style={flairCol()}
        >
            <RichtextSpans spans={flair.elems} />
        </span></>;
    }}</For></span>;
}