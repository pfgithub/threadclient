/* eslint-disable */

import type * as Generic from "api-types-generic";
import type * as Reddit from "api-types-reddit";
import {rt} from "api-types-generic";
import * as reddit from "./reddit";

// === RTJ TO RICHTEXT ===

function fmtRichtext(richtext: Generic.Richtext.Paragraph[]): string {
    return richtext.map(fmtRichtextPar).join("\n\n");
}
function fmtRichtextPar(richtext: Generic.Richtext.Paragraph): string {
    if(richtext.kind === "paragraph") {
        return fmtRichtextSpans(richtext.children);
    }else return "%TODO fmt: ["+richtext.kind+"]";
}
function fmtRichtextStyle(style: Generic.Richtext.Style): string {
    const res = (style.strong ?? false ? "*" : "") + (style.emphasis ?? false ? "_" : "") + (style.strikethrough ?? false ? "~" : "") + (style.superscript ?? false ? "^" : "");
    return res;
}
function fmtRichtextSpans(richtext: Generic.Richtext.Span[]): string {
    return richtext.map(fmtRichtextSpan).join("");
}
function fmtRichtextSpan(richtext: Generic.Richtext.Span): string {
    if(richtext.kind === "text") {
        const styl = fmtRichtextStyle(richtext.styles);
        return "[" + styl + richtext.text + styl + "]";
    } else if (richtext.kind === "link") {
        return `[${fmtRichtextSpans(richtext.children)}](${richtext.url})`;
    }else return "[TODO span:"+richtext.kind+"]";
}

function testsample(doc: Reddit.Richtext.Document) {
    return fmtRichtext(reddit.richtextDocument(doc, {media_metadata: {}}));
}


// @ts-expect-error
test("richtext sample 1", () => {
    // https://thread.pfg.pw/#reddit/r/Solo_Roleplaying/comments/x99b3q/kult_rpg_solo_play_example/inqztdb/?context=3&sort=new
    // @ts-expect-error
    expect(`
        [I almost got a solo game of ][_Kult_][ going, but I switched to ][_Silent Legions_][ instead. Although the Machine City in Metropolis seemed to bleed through into my game anyways, so...]
        `.trim(), testsample({"document":[{"c":[{"e":"text","t":"I almost got a solo game of Kult going, but I switched to Silent Legions instead. Although the Machine City in Metropolis seemed to bleed through into my game anyways, so...","f":[[2,28,4],[2,58,14]]}],"e":"par"}]}));
});
// @ts-expect-error
test("regression #10", () => {
    // https://github.com/pfgithub/threadclient/issues/10
    // https://thread.pfg.pw/#reddit/r/modnews/comments/14n9426/accessibility_updates_to_mod_tools_part_2/jq67gvk/?context=3&sort=confidence
    // @ts-expect-error
    expect(testsample({"document":[
        {"c":[{"e":"text","t":"I just want to make sure more admins see many of the existing bugs that still exist in the moderator workflow on mobile. I posted this 4 days ago to Mod Support."}],"e":"par"},
        {"c":[{"u":"https://www.reddit.com/r/ModSupport/comments/14jkqiy/this_is_the_current_experience_moderating_on/","e":"link","t":"This is the Current Experience Moderating on Mobile"}],"e":"par"},
        {"c":[{"e":"text","t":"I want the admins to understand fully, that while it's technically possible to most things on mobile these days why mods don't want to. The issues with your app simply don't exist with third party developers that we are used to using, and some of what your app still lacks, they, and other tools have had for years. When the first party app is too tedious and frustrating that it makes you quit and open your third party app, you're simply not ready to close that door.","f":[[2,121,13]]}],"e":"par"},
        {"c":[{"e":"text","t":"I'm appreciative of the changes (many of which go back more than a year). But you are seriously not ready on this timeline."}],"e":"par"},
        {"c":[{"e":"text","t":"I will simply be moderating less, and at best, increasing the amount of response time, not just in efficiency but also in that I'll just wait until I can get to a desktop so I won't have to put up with the tedium and frustrations of the mod queue on mobile."}],"e":"par"},
        {"c":[{"e":"text","t":"Why can't I preview markdown formatting before submitting a response? come on. Your own mobile mod queue doesn't even support markdown...","f":[[2,70,7]]}],"e":"par"},
    ]}))
        .toMatchInlineSnapshot(`
          "[I just want to make sure more admins see many of the existing bugs that still exist in the moderator workflow on mobile. I posted this 4 days ago to Mod Support.]

          [[This is the Current Experience Moderating on Mobile]](https://www.reddit.com/r/ModSupport/comments/14jkqiy/this_is_the_current_experience_moderating_on/)

          [I want the admins to understand fully, that while it's technically possible to most things on mobile these days why mods ][_don't want to_][. The issues with your app simply don't exist with third party developers that we are used to using, and some of what your app still lacks, they, and other tools have had for years. When the first party app is too tedious and frustrating that it makes you quit and open your third party app, you're simply not ready to close that door.]

          [I'm appreciative of the changes (many of which go back more than a year). But you are seriously not ready on this timeline.]

          [I will simply be moderating less, and at best, increasing the amount of response time, not just in efficiency but also in that I'll just wait until I can get to a desktop so I won't have to put up with the tedium and frustrations of the mod queue on mobile.]

          [Why can't I preview markdown formatting before submitting a response? ][_come on_][. Your own mobile mod queue doesn't even support markdown...]"
        `);
});

