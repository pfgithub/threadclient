import faker from "@faker-js/faker";
import "@fortawesome/fontawesome-free/css/all.css";
import { For, JSX } from "solid-js";
import { ShowBool } from "tmeta-util-solid";
import { getRandomColor, rgbToString, seededRandom } from "../darken_color";
import { classes, getSettings } from "../util/utils_solid";
import { TopLevelWrapper } from "./page2";
import { SettingPicker } from "./settings";
export * from "../util/interop_solid";

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

export default function UITestingPage(): JSX.Element {
    faker.seed(123); // this won't work right consistently because it's
    // global state but the code below can be rerun multiple times

    const settings = getSettings();

    return <div class="m-4 <sm:mx-0 text-gray-800">
        <SettingPicker
            setting={settings.color_scheme}
            options={["light", "dark", undefined]}
            name={v => ({
                light: "Light",
                dark: "Dark",
                default: "System Default",
            } as const)[v ?? "default"]}
        />
        <h1>Posts, Above or below pivot:</h1>
        <For each={[1, 2]}>{() => {
            const expanded = false;
            return <section><TopLevelWrapper><div class="m-2 text-sm text-gray-800">
                <div class="flex flex-wrap justify-end items-center">
                    <div>
                        <img src={faker.image.image(400, 400)} class="h-12 w-12 rounded-md" />
                    </div>
                    <div class="mr-4" />
                    <div class="flex-1">
                        <h2>
                            {faker.lorem.sentence()}
                        </h2>
                        <div class="text-gray-500">
                            By <Username /> in
                            {" "}<span style="color:#3b82f6">{faker.random.word()}</span>
                        </div>
                        <div class="text-gray-500 flex flex-wrap gap-2 <sm:text-xs">
                            <span><i class="far fa-comment" /> 12</span>
                            <span><i class="fas fa-arrow-up" /> 21.8k</span>
                            <span><i class="far fa-smile" /> 83%</span>
                            <span><i class="far fa-clock" /> 2y</span>
                        </div>
                    </div>
                    <div class="mr-2" />
                    <div class="self-start"><Button>…</Button></div>
                </div>
                <ShowBool when={expanded}><div class="mt-2">
                    <img src={faker.image.image(600, 500)} />
                </div></ShowBool>
            </div></TopLevelWrapper></section>;
        }}</For>
        <h1>Post, At pivot:</h1>
        <section><TopLevelWrapper><div class="m-4 text-sm text-gray-800">
            <h2 class="text-3xl">
                {faker.lorem.sentence(18)}
            </h2>
            <div class="mt-2" />
            <div class="text-gray-500">
                By <Username /> in
                {" "}<span style="color:#3b82f6">{faker.random.word()}</span>
            </div>
            <div class="mt-8" />
            <div class="text-base"><For each={[5, 5, 5]}>{par_cnt => (
                <p class="my-4">
                    {faker.lorem.paragraph(par_cnt)}
                </p>
            )}</For></div>
            <div class="mt-8" />
            <div class="text-gray-500">
                21.8k points, 2 years ago, 83% upvoted
            </div>
            <div class="mt-2" />
            <div class="flex flex-wrap gap-4">
                <Button>Save</Button>
                <Button>Share</Button>
            </div>
        </div></TopLevelWrapper></section>
        <h1>Comment, At pivot:</h1>
        <section><TopLevelWrapper><div class="m-4 text-sm text-gray-800">
            <div class="flex flex-wrap justify-end gap-4 items-center">
                <img src={faker.internet.avatar()} class="rounded-full w-12 h-12" />
                <div class="text-gray-500 flex-1">
                    <Username />
                </div>
            </div>
            <div class="mt-6" />
            <div class="text-base"><For each={[5, 5, 5]}>{par_cnt => (
                <p class="my-4">
                    {faker.lorem.paragraph(par_cnt)}
                </p>
            )}</For></div>
            <div class="mt-8" />
            <div class="text-gray-500">
                21.8k points, 2 years ago
            </div>
            <div class="mt-2" />
            <div class="flex flex-wrap gap-4">
                <Button>Save</Button>
                <Button>Share</Button>
            </div>
        </div></TopLevelWrapper></section>
        <h1>Comment, Above pivot:</h1>
        <section><TopLevelWrapper><div class="m-2 text-sm text-gray-800">
            <div class="flex flex-wrap justify-end gap-2 items-center">
                <img src={faker.internet.avatar()} class="rounded-full w-8 h-8" />
                <div class="text-gray-500">
                    <Username />
                </div>
                <div class="text-gray-500 flex-1" />
                <div class="text-gray-500">
                    21.8k points, 2 years ago
                </div>
                <div class="self-start"><Button>…</Button></div>
            </div>
            <div class="mt-4" />
            <For each={[5, 5, 5]}>{par_cnt => (
                <p class="mt-4">
                    {faker.lorem.paragraph(par_cnt)}
                </p>
            )}</For>
        </div></TopLevelWrapper></section>
        <h1>Comment, Collapsed:</h1>
        <section><TopLevelWrapper><div class="mx-2 text-sm text-gray-800">
            <div class="flex flex-wrap justify-end gap-2 items-center">
                <div class="text-gray-500">
                    <Username />
                </div>
                <div class="text-gray-500 flex-1 max-lines max-lines-1">
                    {faker.lorem.paragraph(5)}
                </div>
                <div class="text-gray-500">
                    21.8k points, 2 years ago
                </div>
            </div>
        </div></TopLevelWrapper></section>
    </div>;
}

function Username(): JSX.Element {
    const name = faker.internet.userName();
    const getStyle = () => {
        const [author_color, author_color_dark] = getRandomColor(seededRandom(name.toLowerCase()));
        return  {
            '--light-color': rgbToString(author_color),
            '--dark-color': rgbToString(author_color_dark),
        };
    };
    return <span style={getStyle()} class="text-$light-color dark:text-$dark-color">
        {name}
    </span>;
}

function Button(props: {
    children: JSX.Element,
    onClick?: undefined | (() => void),
}): JSX.Element {
    return <button class={classes(
        "py-1 px-2 rounded-md",
        "text-gray-600",
        "bg-gray-200 border-b-1 border-gray-500",
        "dark:border-t-1 dark:border-b-0 dark:bg-white dark:border-gray-400",
    )} onClick={props.onClick}>{props.children}</button>;
}