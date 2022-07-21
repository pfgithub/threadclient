import { JSX } from "solid-js";

// ok iconsets I tried:
// - remixicon
//     super neat but unfortunately the icons don't fit in with text very well
// - fontawesome
//     pro is required for the non-bold arrow icon. icons fit in nicely though
// - ikonate
//     no font = hard to manage size
// - glyphs
//     no font = hard to manage sizez
// - typicons
//     wrong style
// - ionicons
//     no longer distribute a css font file in 5.0+
// - solid-icons 
//     contains many icon packs, but does not fit in with text
//
// ok I'm staying with fontawesome
// the issue is that most of these are designed to look nice in square boxes but
// don't fit in with text. like they need resonable baselines and matching stroke
// widths in order to fit in with text and they don't have that.
//
// anyway maybe I'll get fontawesome pro eventually so I can have the right up arrow icon
// or I'll just use `↑`

export default function UITestingPageRoot(): JSX.Element {
    return <>…</>;
}