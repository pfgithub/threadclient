import "@fortawesome/fontawesome-free/css/all.css";
import { JSX, onCleanup } from "solid-js";

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

// NOTES:
// - if there is a thumbnail, do not show the user pfp
//   (you can show it on hover)
// - do not show buttons on non-pivoted posts. instead, show the `…` thing
// vv I think this is the same for posts and replies. That is a goal.
//    the only difference is that replies show their body always and posts only
//    do when pivoted.

// ok I'm missing one thing right now:
// how do you collapse comments + can you expand posts?
// I guess what I can do for now is just say you can't expand posts, you have to
// pivot them.
// that doesn't seem right though, why can you expand comments then?
// oh actually wait we can just do uncollapsed posts exactly the same as comments

// okay yeah that'll be alright I guess
// so we have:
// - collapsed
// - expanded
// collapsed state shows:
// - thumbnail
// - title
// - author
// - info
// expanded state shows:
//
// oh I'm missing: why do comments mix author and info into one line and show a summary?
// why do posts do neither?

// ok I think we have:
// - a title line
// - an attribution line (author, pfp, sub, reblog)
// - an info line (reply count, vote count, time, percent)

// the note is:
// - comments do not have a title or a thumbnail

export default function UITestingPageRoot(): JSX.Element {
    document.documentElement.style.overflowY = "hidden";
    onCleanup(() => {
        document.documentElement.style.overflowY = "";
    });

    // the swipe to close animation is basically the same as SwipeActions.tsx but vertical instead
    // of horizontal.

    // oh nevermind, we can't do this. disabling pan-y means we can't zoom in and look around the
    // image like we could before. nevermind

    return (
        <div class="
            h-screen overflow-hidden overflow-x-scroll dark:bg-zinc-800
            snap-x snap-mandatory flex flex-row gap-6 relative
        " style={{
            'touch-action': "pan-x pinch-zoom",
        }}>
            {[
                [640, 480],
                [480, 640],
                [1000, 10],
                [10, 1000],
            ].map((size, i) => (
                <div class="w-screen flex-shrink-0 snap-center bg-zinc-900">
                    <img
                        src={"https://picsum.photos/seed/n"+i+"/"+size[0]+"/"+size[1]+".jpg"}
                        width={size[0]}
                        height={size[1]}
                        class="w-full h-full object-contain"
                    />
                </div>
            ))}
        </div>
    );
}