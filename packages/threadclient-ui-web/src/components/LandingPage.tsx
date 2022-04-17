import * as Generic from "api-types-generic";
import { createEffect, createSelector, createSignal, For, JSX, Setter, untrack } from "solid-js";
import { Show } from "tmeta-util-solid";
import { getWholePageRootContext } from "../util/utils_solid";
import { createMergeMemo } from "./createMergeMemo";
import { autokey, CollapseData, flattenPost } from "./flatten";
import { InternalIcon } from "./Icon";
import PageFlatItem from "./PageFlatItem";
import { array_key } from "./symbols";

function DisplayPost(props: {
    post: Generic.Link<Generic.PostNotLoaded>,
    options?: undefined | {allow_threading?: undefined | boolean},
}): JSX.Element {
    const collapse_data: CollapseData = {
        map: new Map(),
    };

    const hprc = getWholePageRootContext();

    const view = createMergeMemo(() => {
        return autokey(flattenPost(props.post, [], {
            collapse_data,
            content: hprc.content(),
            settings: {
                allow_threading: props.options?.allow_threading,
            },
        }, {
            first_in_wrapper: true,
            is_pivot: false,
            at_or_above_pivot: false,
            threaded: false,
            depth: 0,
        }));
    }, {key: array_key, merge: true});

    return <For each={view.data}>{item => (
        <PageFlatItem
            item={item}
            collapse_data={collapse_data}
        />
    )}</For>;
}

function ToggleButton(props: {value: string, setValue: Setter<string>}): JSX.Element {
    const [prevValue, setPrevValue] = createSignal(props.value);
    const selector = createSelector(() => props.value);
    const prevSelector = createSelector(prevValue);
    
    const [shape, setShape] = createSignal<HTMLDivElement | null>(null);

    createEffect<HTMLDivElement | null>(arg0 => {
        const prev_shape = arg0;
        const next_shape = shape();
        const current_value = untrack(() => props.value);

        if(prev_shape != null && next_shape != null && next_shape !== prev_shape) untrack(() => {
            const prev_pos = prev_shape.getBoundingClientRect();
            const new_pos = next_shape.getBoundingClientRect();

            // transition new element

            const diff_x = prev_pos.x - new_pos.x;
            const diff_y = prev_pos.y - new_pos.y;
            // const fi_r = new_pos.width - prev_pos.width;
            // const fi_b = new_pos.height - prev_pos.height;
            const diff_w = prev_pos.width / new_pos.width;
            const diff_h = prev_pos.height / new_pos.height;

            next_shape.style.transform = [
                "translate("+diff_x+"px, "+diff_y+"px)",
                "scale("+diff_w+", "+diff_h+")",
            ].join(" ");

            next_shape.offsetHeight;
            next_shape.style.transition = "0.1s transform ease-out";
            next_shape.style.transform = "";

            const ontransitionend = (e: Event) => {
                if(e.target !== e.currentTarget) return;
                next_shape.removeEventListener("transitionend", ontransitionend);
                next_shape.style.transition = "";
            };
            next_shape.addEventListener("transitionend", ontransitionend);
        });

        setPrevValue(current_value); // delete old element

        return next_shape;
    }, null);

    return <div class="flex flex-row gap-1 rounded-md bg-slate-400 dark:bg-zinc-700 p-1">
        <button class="block relative px-2" onClick={() => props.setValue("off")}>
            <Show if={selector("off") || prevSelector("off")}>
                <div
                    ref={itm => setShape(itm)}
                    class="absolute top-0 left-0 w-full h-full rounded-md bg-slate-100 dark:bg-zinc-500 shadow"
                />
            </Show>
            <span class="relative z-1">Off</span>
        </button>
        <button class="block relative px-2" onClick={() => props.setValue("on")}>
            <Show if={selector("on") || prevSelector("on")}>
                <div
                    ref={itm => setShape(itm)}
                    class="absolute top-0 left-0 w-full h-full rounded-md bg-slate-100 dark:bg-zinc-500 shadow"
                />
            </Show>
            <span class="relative z-1">On</span>
        </button>
    </div>;
}

export default function LandingPage(): JSX.Element {
    /* https://play.tailwindcss.com/ also you need some heropatterns set to opacity:1.0. also:
    // where graph(x: string) => heroPattern("graph", "#"+x) and same for topography(x)
    module.exports = {
      theme: {
        extend: {
          borderWidth: {1: "1px"},
          backgroundImage: {
            'graph-zinc-800': `url("${graph("27272A")}")`,
            'graph-slate-350': `url("${graph("B0BCCD")}")`,
            'topography-zinc-800': `url("${topography("27272A")}")`,
            'topography-slate-350': `url("${topography("B0BCCD")}")`,
          },
        },
      },
      plugins: [],
    }; */
    return <div class="min-h-screen overflow-x-hidden bg-slate-300 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">
        <div class="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
            <div class="mx-auto max-w-xl p-4 pb-0">
                <div>github link, light/dark mode toggle (toggles between system default and an override)</div>
            </div>
            <div class="mx-auto max-w-xl p-8">
                <span role="heading" class="text-3xl font-bold">ThreadClient</span>
                <p class="text-2xl font-light text-slate-500 dark:text-zinc-400">
                    A new client for
                    <span class="border-b-2 border-dashed">
                        <span class="text-slate-900 dark:text-zinc-100">Reddit</span>
                        {" "}
                        <InternalIcon tag="fa-angle-down" filled={true} label={null} />
                    </span>
                </p>
            </div>
        </div>
    
        <div class="
            bg-slate-300 dark:bg-zinc-900
            bg-graph-slate-350 dark:bg-graph-zinc-800
            bg-fixed
            text-slate-900 dark:text-zinc-100
        ">
            <div class="mx-auto max-w-xl p-8">
                <div class="grid grid-cols-2 gap-8">
                    <div class="text-lg">
                        <span class="
                            text-sm font-bold uppercase
                            text-slate-500 dark:text-zinc-400
                        " role="heading">Unthreaded Replies</span>
                        <p>
                            It often gets difficult to read long comment chains because of the increased indentation.
                            ThreadClient automatically unthreads these chains.
                        </p>
                    </div>
                    <div class="space-y-4">{untrack(() => {
                        const [value, setValue] = createSignal("on");
                        return <>
                            <div class="flex flex-row justify-center">
                                <ToggleButton value={value()} setValue={setValue} />
                            </div>
                            <div class="relative">
                                <div class="
                                    absolute left-0 h-full w-screen rounded-l-xl
                                    bg-slate-100 dark:bg-zinc-700 shadow-md
                                " />
                                <div class="relative py-4">
                                    <DisplayPost
                                        post={"/homepage/unthreading" as Generic.Link<Generic.PostNotLoaded>}
                                        options={{
                                            allow_threading: value() === "on",
                                        }}
                                    />
                                </div>
                            </div>
                        </>;
                    })}</div>
                </div>
            </div>
        </div>
    
        <div class="
            bg-slate-300 dark:bg-zinc-900
            bg-graph-slate-350 dark:bg-graph-zinc-800
            bg-fixed
            text-slate-900 dark:text-zinc-100
        ">
            <div class="mx-auto max-w-xl p-8">
                <div class="grid grid-cols-2 gap-8">
                    <div class="space-y-4">
                        <div class="relative">
                            <div class="
                                absolute right-0 top-0 h-full w-screen rounded-r-xl
                                bg-slate-100 dark:bg-zinc-700 shadow-md
                            " />
                            <div class="relative p-4">interactive demo</div>
                        </div>
                    </div>
                    <div class="text-lg">
                        <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                            Link Previews
                        </span>
                        <p>
                            Preview links directly inline. ThreadClient supports previewing from over [XX(keep
                            up-to-date by referencing the actual value in the code)] sources
                        </p>
                    </div>
                </div>
            </div>
        </div>
    
        <div class="
            bg-slate-300 dark:bg-zinc-900
            bg-graph-slate-350 dark:bg-graph-zinc-800
            bg-fixed
            text-slate-900 dark:text-zinc-100
        ">            <div class="mx-auto max-w-xl p-8">
                <div class="grid grid-cols-2 gap-8">
                    <div class="text-lg">
                        <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                            Repivoting
                        </span>
                        <p>When reading deep in comment threads or looking around links, something or other.</p>
                    </div>
                    <div class="space-y-4">
                        <div class="relative">
                            <div class="
                                absolute left-0 h-full w-screen rounded-l-xl
                                bg-slate-100 dark:bg-zinc-700 shadow-md
                            " />
                            <div class="relative p-4">not sure how to demo this but do it</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    
        <div class="
            bg-slate-300 dark:bg-zinc-900
            bg-graph-slate-350 dark:bg-graph-zinc-800
            bg-fixed
            text-slate-900 dark:text-zinc-100
        ">
            <div class="mx-auto max-w-xl p-8">
                <div class="grid grid-cols-2 gap-8">
                    <div class="space-y-4">
                        <div class="relative">
                            <div class="
                                absolute right-0 top-0 h-full w-screen rounded-r-xl
                                bg-slate-100 dark:bg-zinc-700 shadow-md
                            " />
                            <div class="relative p-4">
                                put this in a phone ui and use a flag to force enable treating pointer as touch within
                                this frame. and maybe even change the cursor to look like a touch
                            </div>
                        </div>
                    </div>
                    <div class="text-lg">
                        <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                            Swipe Actions
                        </span>
                        <p>
                            Swipe comments to collapse them or repivot or something. Might be configurable eventually.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    
        <div class="
            bg-slate-300 dark:bg-zinc-900
            bg-graph-slate-350 dark:bg-graph-zinc-800
            bg-fixed
            text-slate-900 dark:text-zinc-100
        ">
            <div class="mx-auto max-w-xl p-8">
                <div class="grid grid-cols-2 gap-8">
                    <div class="text-lg">
                        <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                            Preview Before Posting
                        </span>
                        <p>
                            Preview your comments as they will show up to others before posting them. We're also
                            working on a full richtext editor but that's not out yet
                        </p>
                    </div>
                    <div class="space-y-4">
                        <div class="relative">
                            <div class="
                                absolute left-0 h-full w-screen rounded-l-xl
                                bg-slate-100 dark:bg-zinc-700 shadow-md
                            " />
                            <div class="relative p-4">preview `reddit_markdown` and also fix the `'loading…` bug</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    
        <div class="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
            <div class="mx-auto max-w-xl p-8">
                <div class="text-lg">
                    <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                        Extension
                    </span>
                    <ul class="list-disc">
                        <li>Automatically redirect to ThreadClient when you click a Reddit link</li>
                        <li>Show if you have any new chat messages directly in ThreadClient</li>
                        <li>Support uploading images and galleries when you create a post</li>
                    </ul>
                </div>
            </div>
        </div>
    
        <div class="
            bg-slate-300 dark:bg-zinc-900
            bg-topography-slate-350 dark:bg-topography-zinc-800
            bg-fixed
            text-slate-900 dark:text-zinc-100
        ">
            <div class="mx-auto max-w-xl p-8">
                <div class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                    More Features
                </div>
                <div>these should be cards you can click for a fullscreen demo</div>
                <div class="pb-4" />
                <div class="grid grid-cols-3 gap-4">
                    <button class="
                        dark:border-t-1 dark:border-zinc-500
                        block rounded-xl
                        bg-slate-200 dark:bg-zinc-700
                        p-4 text-left
                        hover:bg-slate-100 hover:dark:bg-zinc-600 hover:shadow-md
                    ">
                        <div class="h-full">
                            <span class="text-sm font-bold uppercase text-slate-900 dark:text-zinc-100" role="heading">
                                Syntax Highlighting
                            </span>
                            <p class="text-base text-slate-500 dark:text-zinc-300">
                                ThreadClient will (!TODO!) automatically syntax highlight code blocks
                            </p>
                        </div>
                    </button>
                    <button class="
                        dark:border-t-1 dark:border-zinc-500
                        block rounded-xl
                        bg-slate-200 dark:bg-zinc-700
                        p-4 text-left
                        hover:bg-slate-100 hover:dark:bg-zinc-600 hover:shadow-md
                    ">
                        <div class="h-full">
                            <span class="text-sm font-bold uppercase text-slate-900 dark:text-zinc-100" role="heading">
                                Braille Art Fix
                            </span>
                            <p class="text-base text-slate-500 dark:text-zinc-300">
                                ThreadClient will correctly display braille art on desktop and mobile
                            </p>
                        </div>
                    </button>
                    <button class="
                        dark:border-t-1 dark:border-zinc-500
                        block rounded-xl
                        bg-slate-200 dark:bg-zinc-700
                        p-4 text-left
                        hover:bg-slate-100 hover:dark:bg-zinc-600 hover:shadow-md
                    ">
                        <div class="h-full">
                            <span class="text-sm font-bold uppercase text-slate-900 dark:text-zinc-100" role="heading">
                                Percent Upvoted
                            </span>
                            <p class="text-base text-slate-500 dark:text-zinc-300">
                                ThreadClient shows you what percentage of voters upvoted the post
                            </p>
                        </div>
                    </button>
                    <button class="
                        dark:border-t-1 dark:border-zinc-500
                        block rounded-xl
                        bg-slate-200 dark:bg-zinc-700
                        p-4 text-left
                        hover:bg-slate-100 hover:dark:bg-zinc-600 hover:shadow-md
                    ">
                        <div class="h-full">
                            <span class="text-sm font-bold uppercase text-slate-900 dark:text-zinc-100" role="heading">
                                See Comment Markdown
                            </span>
                            <p class="text-base text-slate-500 dark:text-zinc-300">
                                Want to see how someone else formatted something? Press the Source button to see
                                markdown
                            </p>
                        </div>
                    </button>
                    {/*<!-- <button class="
                        dark:border-t-1 dark:border-zinc-500
                        block rounded-xl
                        bg-slate-200 dark:bg-zinc-700
                        p-4 text-left
                        hover:bg-slate-100 hover:dark:bg-zinc-600 hover:shadow-md
                    ">
                        <div class="h-full">
                            <span class="text-sm font-bold uppercase text-slate-900 dark:text-zinc-100" role="heading">Web App</span>
                            <p class="text-base text-slate-500 dark:text-zinc-300">Add ThreadClient to your home screen to use it like an app on mobile</p>
                        </div>
                    </button> -->*/
                    }
                    <button class="
                        dark:border-t-1 dark:border-zinc-500
                        block rounded-xl
                        bg-slate-200 dark:bg-zinc-700
                        p-4 text-left
                        hover:bg-slate-100 hover:dark:bg-zinc-600 hover:shadow-md
                    ">
                        <div class="h-full">
                            <span class="text-sm font-bold uppercase text-slate-900 dark:text-zinc-100" role="heading">
                                Offline Mode
                            </span>
                            <p class="text-base text-slate-500 dark:text-zinc-300">
                                TODO: should support an offline mode where you can save a bunch of posts and read later
                            </p>
                        </div>
                    </button>
                    <button class="
                        dark:border-t-1 dark:border-zinc-500
                        block rounded-xl
                        bg-slate-200 dark:bg-zinc-700
                        p-4 text-left
                        hover:bg-slate-100 hover:dark:bg-zinc-600 hover:shadow-md
                    ">
                        <div class="h-full">
                            <span class="text-sm font-bold uppercase text-slate-900 dark:text-zinc-100" role="heading">
                                Hide Automod
                            </span>
                            <p class="text-base text-slate-500 dark:text-zinc-300">
                                TODO: automod commentss should have a checkbox "don't show me again" and it hides by
                                content
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    
        <div class="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
            <div class="mx-auto max-w-xl p-8">
                <div class="text-lg">
                    <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                        Performance
                    </span>
                    <ul class="list-disc">
                        <li>
                            video. compare performance of threadclient, new.reddit, and old.reddit in these situations:
                        </li>
                        <li>- first load</li>
                        <li>- opening comments on a post</li>
                        <li>we can even get technical and enable react devtools highlighting to show that threadclient
                            doesn't update nearly as much as new.reddit</li>
                    </ul>
                </div>
            </div>
        </div>
    
        <div class="bg-slate-600 text-slate-100 dark:bg-zinc-900 dark:text-zinc-100">
            <div class="mx-auto max-w-xl p-8">ThreadClient. github link</div>
        </div>
    </div>;
}