import * as Generic from "api-types-generic";
import { Listbox } from "solid-headless";
import { createSignal, For, JSX, untrack, useContext } from "solid-js";
import { collapse_data_context, getSettings, getWholePageRootContext } from "../util/utils_solid";
import { CollapseData, FlatTreeItem } from "./flatten";
import { FlatItemTsch, FlattenTreeItem } from "./flatten2";
import { InternalIcon, InternalIconRaw } from "./Icon";
import { A } from "./links";
import PageFlatItem from "./PageFlatItem";
import ReplyEditor from "./reply";
import ToggleButton from "./ToggleButton";

function DisplayPost(props: {
    post: Generic.Link<Generic.Post>,
    options?: undefined | {allow_threading?: undefined | boolean},
}): JSX.Element {
    const collapse_data: CollapseData = useContext(collapse_data_context)!;

    const hprc = getWholePageRootContext();

    const view = FlatItemTsch.useChildren(() => <FlattenTreeItem
        tree_item={(() => {
            const readlink = Generic.readLink(hprc.content(), props.post);
            if(readlink == null || readlink.error != null || readlink.value.kind === "tabbed") throw new Error("e;bad;;"+readlink);
            const flat_tree_item: FlatTreeItem = {kind: "flat_post", link: props.post, post: readlink.value};
            return flat_tree_item;
        })()}
        parent_indent={[]}
        rpo={{
            first_in_wrapper: true,
            is_pivot: false,
            at_or_above_pivot: false,
            threaded: false,
            depth: 0,
            displayed_in: "tree",
        }}
    />);

    return <For each={view()}>{item => (
        <PageFlatItem
            item={item}
            collapse_data={collapse_data}
        />
    )}</For>;
}

function FeaturePreviewCard(props: {
    title: JSX.Element,
    icon: string,
    description: JSX.Element,
    link: string,
}): JSX.Element {
    const hprc = getWholePageRootContext();
    return <A href={props.link} client_id={"shell"} class={`
        dark:border-t-1 dark:border-zinc-500
        block rounded-xl
        bg-slate-200 dark:bg-zinc-700
        p-4 text-left
        hover:bg-slate-100 hover:dark:bg-zinc-600 hover:shadow-md
    `} page={(): Generic.Page2 | undefined => {
        if(!hprc.content()[props.link]) return undefined;
        return {
            content: hprc.content(),
            pivot: props.link as Generic.Link<Generic.Post>,
        };
    }}>
        <div class="h-full">
            <div class="text-sm font-bold uppercase text-slate-900 dark:text-zinc-100" role="heading">
                {props.title}
            </div>
            <p class="text-base text-slate-500 dark:text-zinc-300">
                {props.description}
            </p>
        </div>
    </A>;
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

    const [homeFor, setHomeFor] = createSignal<undefined | string>("reddit");
    const settings = getSettings();

    return <div class="min-h-screen overflow-x-hidden bg-slate-300 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">
        <div class="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
            <div class="mx-auto max-w-3xl p-4 pb-0">
                <div class="flex flex-wrap justify-end items-center">
                    <div>
                        <A class="hover:underline" href="https://github.com/pfgithub/threadclient" client_id="">
                            <InternalIconRaw class="fa-brands fa-github" label={null} />
                            {" "}Github
                        </A>
                    </div>
                    <div class="flex-1" />
                    <ToggleButton value={settings.colorScheme()} setValue={nv => {
                        const upv = settings.colorScheme.base() === nv ? undefined : nv;
                        settings.colorScheme.setOverride(upv);
                        return upv;
                    }} choices={[
                        ["light" as const, <InternalIcon tag="fa-sun" filled={true} label="Light" />],
                        ["dark" as const, <InternalIcon tag="fa-moon" filled={true} label="Dark" />],
                    ]} />
                </div>
            </div>
            <div class="mx-auto max-w-3xl p-8">
                <span role="heading" class="text-3xl font-bold">ThreadClient</span>
                <div class="text-2xl font-light text-slate-500 dark:text-zinc-400">
                    A new client for{" "}
                    <div class="inline-block relative"><Listbox value={homeFor()} onSelectChange={v => setHomeFor(v)}>
                        <A class={`
                            border-slate-500 dark:border-zinc-400
                            border-b-2 border-dashed
                            hover:border-solid
                            hover:border-slate-900 hover:dark:border-zinc-100
                            hover:text-slate-900 hover:dark:text-zinc-100
                            transition duration-100
                            inline-block
                            outline-default
                        `} href="/client-picker" client_id="shell">
                            <span class="text-slate-900 dark:text-zinc-100">
                                {homeFor() === "reddit" ? "Reddit" : "Mastodon"}
                            </span>
                            {" "}
                            <InternalIcon
                                class="text-lg"
                                tag={"fa-angle-down"}
                                filled={true} label={null}
                            />
                        </A>
                    </Listbox></div>
                </div>
            </div>
            <div class="mx-auto max-w-3xl pt-0 p-8 flex flex-wrap gap-4">
                <A href="/" client_id="reddit" class={`
                    inline-block
                    relative group overflow-hidden
                    bg-gradient-to-br from-blue-500 to-blue-600
                    text-slate-100 dark:text-zinc-100
                    rounded-lg
                    <sm:flex-1
                    text-center
                `}>
                    <div class="
                        absolute inset-0
                        bg-gradient-to-br from-blue-400 to-blue-600
                        opacity-0 group-hover:opacity-100
                        transform -translate-y-3 group-hover:translate-y-0
                        transition duration-100
                    "></div>
                    <div class="relative p-4">
                        Open ThreadClient
                    </div>
                </A>
                <A href="/settings" client_id="" class={`
                    inline-block
                    relative group overflow-hidden
                    text-slate-900 dark:text-zinc-100
                    rounded-lg
                    hover:bg-slate-200 dark:hover:bg-zinc-700
                    transition
                `}>
                    <div class="
                        absolute inset-0
                        border-4 border-slate-300 dark:border-zinc-600
                        rounded-lg
                    "></div>
                    <div class="relative p-4">
                        <InternalIcon tag="fa-gear" filled={true} label="Settings" />
                    </div>
                </A>
            </div>
        </div>
    
        <div class="
            bg-slate-300 dark:bg-zinc-900
            bg-graph-slate-350 dark:bg-graph-zinc-800
            bg-fixed
            text-slate-900 dark:text-zinc-100
        ">
            <div class="mx-auto max-w-3xl p-8">{untrack(() => {
                const [value, setValue] = createSignal<"off" | "on">("on");

                return <div class="grid sm:grid-cols-2 sm:grid-flow-col-dense gap-x-8 gap-y-4">
                    <div class="hidden sm:block sm:col-start-1" />
                    <div class="sm:col-start-1 text-lg">
                        <span class="
                            text-sm font-bold uppercase
                            text-slate-500 dark:text-zinc-400
                        " role="heading">Unthreaded Replies</span>
                        <p>
                            It often gets difficult to read long comment chains because of the increased indentation.
                            ThreadClient automatically unthreads these chains.
                        </p>
                    </div>
                    <div class="sm:col-start-2 flex flex-row justify-center">
                        <ToggleButton value={value()} setValue={v => v ? setValue(v) : void 0} choices={[
                            ["off" as const, <>Nest</>],
                            ["on" as const, <>Unthread</>],
                        ]} />
                    </div>
                    <div class="sm:col-start-2 h-max shadow-md -mx-8 sm:mx-0">
                        <DisplayPost
                            post={"/homepage/unthreading" as Generic.Link<Generic.Post>}
                            options={{
                                allow_threading: value() === "on",
                            }}
                        />
                    </div>
                </div>;
            })}</div>
            
            <div class="mx-auto max-w-3xl p-8">
                <div class="grid sm:grid-cols-2 gap-8">
                    <div class="text-lg">
                        <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                            Link Previews
                        </span>
                        <p>
                            Preview links directly inline. ThreadClient supports previewing from
                            many of the most popular sources.
                        </p>
                    </div>
                    <div class="h-max shadow-md -mx-8 sm:mx-0">
                        <DisplayPost
                            post={"/homepage/link-previews" as Generic.Link<Generic.Post>}
                        />
                    </div>
                </div>
            </div>
            
            <div class="mx-auto max-w-3xl p-8">
                <div class="grid sm:grid-cols-2 gap-8">
                    <div class="text-lg">
                        <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                            Repivoting
                        </span>
                        <p>
                            When reading deep in comment threads, press the top part of the comment next to the
                            username to just see replies to that comment.
                        </p>
                    </div>
                    <div class="h-max shadow-md -mx-8 sm:mx-0">
                        <DisplayPost
                            post={"/homepage/repivot" as Generic.Link<Generic.Post>}
                        />
                    </div>
                </div>
            </div>
            
            <div class="mx-auto max-w-3xl p-8">
                <div class="grid sm:grid-cols-2 gap-8">
                    <div class="text-lg">
                        <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                            Swipe Actions
                        </span>
                        <p>
                            Swipe comments to collapse them or repivot or something. Might be configurable eventually.
                        </p>
                    </div>
                    <div class="h-max shadow-md -mx-8 sm:mx-0">
                        <div class="relative">
                            <div class="
                                absolute left-0 h-full w-full sm:rounded-xl
                                bg-slate-100 dark:bg-zinc-800 shadow-md
                            " />
                            <div class="relative p-4">
                                put this in a phone ui and use a flag to force enable treating pointer as touch within
                                this frame. and maybe even change the cursor to look like a touch
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mx-auto max-w-3xl p-8">
                <div class="grid sm:grid-cols-2 gap-8">
                    <div class="text-lg">
                        <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                            Preview Before Posting
                        </span>
                        <p>
                            Preview your comments as they will show up to others before posting them. We're also
                            working on a full richtext editor but that's not out yet
                        </p>
                    </div>
                    <div class="h-max shadow-md -mx-8 sm:mx-0">
                        <div class="relative">
                            <div class="
                                absolute left-0 h-full w-full sm:rounded-xl
                                bg-slate-100 dark:bg-zinc-800 shadow-md
                            " />
                            <div class="relative p-4">
                                <ReplyEditor action={{
                                    kind: "reply",
                                    key: "@0",
                                    text: "Reply",
                                    reply_info: {encoding_type: "reply", encoding_symbol: Symbol()},
                                    client_id: "shell",
                                    mode: "reply",
                                }} onCancel={() => {
                                    //
                                }} onAddReply={() => {
                                    //
                                }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    
        <div class="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
            <div class="mx-auto max-w-3xl p-8">
                <div class="text-lg">
                    <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                        Reddit Feature Coverage
                    </span>
                    <p>
                        ThreadClient supports viewing most content on Reddit and creating some. If there's a Reddit
                        feature that's missing that you use, ask for it{" "}
                        <A
                            class="text-blue-500 hover:underline"
                            href="https://github.com/pfgithub/threadclient/issues/new/choose"
                            client_id={"NA"}
                        >
                                here
                        </A>.
                    </p>
                </div>
            </div>
        </div>

        <div class="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
            <div class="mx-auto max-w-3xl p-8">
                <div class="text-lg">
                    <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                        Performance
                    </span>
                    <ul class="list-disc">
                        <li>
                            Buttons react instantly, unlike on new.reddit
                            [TODO; FIX COLLAPSE BUTTON PERF REGRESSION]
                        </li>
                        <li>
                            Going back a page reacts instantly, unlike on old.reddit
                            [TODO; FIX PAGE2 NAVIGATION PERFORMANCE REGRESSION]
                        </li>
                        {/*<li>
                            loading is about the same speed on ThreadClient, new.reddit, old.reddit,
                            and the mobile app
                        </li>
                        <li>
                            new.reddit usually feels sluggish. when you click a button, it often takes a moment
                            for something to happen.
                        </li>
                        <li>
                            old.reddit is pretty good, but navigating back a page often requires a full reload
                            and is slow.
                        </li>
                        <li>
                            the mobile app is better than new.reddit but still pretty slow on my phone
                        </li>
                        <li>
                            threadclient is generally pretty snappy. on page2, history navigations can lag
                            a bit right now because of a change in how history is handled. also, collapsing
                            can lag because of a change in how collapsing is handled. both of these issues
                            need to be fixed before releasing page2.
                        </li>
                        <li>
                            apollo (another third-party client for reddit) is better than threadclient because it's
                            a native app
                        </li>*/
                        }
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
            <div class="mx-auto max-w-3xl p-8">
                <div class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                    More Features
                </div>
                <div class="pb-4" />
                <div class="grid sm:grid-cols-3 gap-4">
                    <FeaturePreviewCard
                        title="Syntax Highlighting"
                        icon="fa-solid fa-code" // icon-pro="fa-regular fa-code"
                        description={<>ThreadClient will (!TODO!) automatically syntax highlight code blocks</>}
                        link="/homepage/syntax-highlighting"
                    />
                    <FeaturePreviewCard
                        title="Braille Art Fix"
                        icon="fa-solid fa-image"
                        description={<>ThreadClient will correctly display braille art on desktop and mobile</>}
                        link="/homepage/braille-art-fix"
                    />
                    <FeaturePreviewCard
                        title="Percent Upvoted"
                        icon="fa-solid fa-face-smile"
                        description={<>ThreadClient shows you what percentage of voters upvoted a post</>}
                        link="/homepage/percent-upvoted"
                    />
                    <FeaturePreviewCard
                        title="See Markdown"
                        icon="fa-brands fa-markdown" // icon-pro="fa-solid fa-brackets-curly"
                        description={<>ThreadClient can show you how someone else formatted something</>}
                        link="/homepage/see-comment-markdown"
                    />
                    <FeaturePreviewCard
                        title="PWA"
                        icon="fa-solid fa-mobile-button"
                        description={<>Add ThreadClient to your home screen to use it like an app on mobile</>}
                        link="/homepage/pwa"
                    />
                    <FeaturePreviewCard
                        title="Offline Mode"
                        icon="fa-solid fa-wifi" // icon-pro="fa-solid fa-wifi-exclamation"
                        description={<>TODO: should support an offline mode where you can save and read later</>}
                        link="/homepage/offline-mode"
                    />
                    <FeaturePreviewCard
                        title="Hide Automod"
                        icon="fa-solid fa-circle-minus"
                        description={<>TODO: automod 'don't show me again' to auto collapse</>}
                        link="/homepage/hide-automod"
                    />
                    <FeaturePreviewCard
                        title="Both Sidebars"
                        icon="fa-solid fa-circle-minus"
                        description={<>ThreadClient displays both the old.reddit and new.reddit sidebars</>}
                        link="/homepage/both-sidebars"
                    />
                </div>
            </div>
        </div>
    
        <div class="bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100">
            <div class="mx-auto max-w-3xl p-8">
                <div class="text-lg">
                    <span class="text-sm font-bold uppercase text-slate-500 dark:text-zinc-400" role="heading">
                        Extension (TODO)
                    </span>
                    <ul class="list-disc">
                        <li>Automatically redirect to ThreadClient when you click a Reddit link</li>
                        <li>(TODO) Show if you have any new chat messages directly in ThreadClient</li>
                        <li>(TODO) Support uploading images and galleries when you create a post</li>
                    </ul>
                </div>
            </div>
        </div>
    
        <div class="bg-slate-600 text-slate-100 dark:bg-zinc-900 dark:text-zinc-100">
            <div class="mx-auto max-w-3xl p-8">ThreadClient. github link</div>
        </div>
    </div>;
}