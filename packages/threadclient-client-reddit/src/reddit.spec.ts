/* eslint-disable */

import type * as Generic from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import {rt} from "api-types-generic";
import * as reddit from "./reddit";

let expect_count = 0;
let expect_pass_count = 0;
function expect(expected: string, value: unknown) {
    expect_count += 1;
    let pfx = "\x1b[92m[✓]\x1b(B\x1b[m ";
    let ems = "";
    if(expected === "" + value) {
        expect_pass_count += 1;
    }else{
        pfx = "\x1b[91m[✗]\x1b(B\x1b[m ";
        ems = " ↳ `\x1b[97m"+expected+"\x1b(B\x1b[m` expected";
    }
    console.log(pfx + value);
    if(ems) console.log(ems);
}
function exit() {
    const all_passed = expect_count === expect_pass_count;
    const color = all_passed ? "\x1b[92m" : "\x1b[91m";
    console.log("");
    console.log(color + expect_pass_count + "/" + expect_count + " tests passed.\x1b(B\x1b[m ");
    process.exit(all_passed ? 0 : 1);
}

// === RTJ TO RICHTEXT ===

function fmtRichtext(richtext: Generic.Richtext.Paragraph[]): string {
    return richtext.map(fmtRichtextPar).join("\n\n");
}
function fmtRichtextPar(richtext: Generic.Richtext.Paragraph): string {
    if(richtext.kind === "paragraph") {
        return richtext.children.map(fmtRichtextSpan).join("");
    }else return "%TODO fmt: ["+richtext.kind+"]";
}
function fmtRichtextStyle(style: Generic.Richtext.Style): string {
    const res = (style.strong ?? false ? "*" : "") + (style.emphasis ?? false ? "_" : "") + (style.strikethrough ?? false ? "~" : "") + (style.superscript ?? false ? "^" : "");
    return res;
}
function fmtRichtextSpan(richtext: Generic.Richtext.Span): string {
    if(richtext.kind === "text") {
        const styl = fmtRichtextStyle(richtext.styles);
        return "[" + styl + richtext.text + styl + "]";
    }else return "[TODO span:"+richtext.kind+"]";
}

function testsample(doc: Reddit.Richtext.Document) {
    return fmtRichtext(reddit.richtextDocument(doc, {media_metadata: {}}));
}


// https://thread.pfg.pw/#reddit/r/Solo_Roleplaying/comments/x99b3q/kult_rpg_solo_play_example/inqztdb/?context=3&sort=new
expect(`
[I almost got a solo game of ][_Kult_][ going, but I switched to ][_Silent Legions_][ instead. Although the Machine City in Metropolis seemed to bleed through into my game anyways, so...]
`.trim(), testsample({"document":[{"c":[{"e":"text","t":"I almost got a solo game of Kult going, but I switched to Silent Legions instead. Although the Machine City in Metropolis seemed to bleed through into my game anyways, so...","f":[[2,28,4],[2,58,14]]}],"e":"par"}]}));

exit();