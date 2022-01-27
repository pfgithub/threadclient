import { JSX, For } from "solid-js";
import { classes } from "../util/utils_solid";
import { TopLevelWrapper } from "./page2";
import faker from "@faker-js/faker";
import { getRandomColor, rgbToString, seededRandom } from "../darken_color";
export * from "../util/interop_solid";

export default function UITestingPage(): JSX.Element {
    faker.seed(123); // this won't work right consistently because it's
    // global state but the code below can be rerun multiple times

    return <div class="m-4 text-gray-800">
        <h1>Posts, Above or below pivot:</h1>
        <section><TopLevelWrapper><div class="m-2 text-base text-gray-800">
            <h2>
                {faker.lorem.sentence()}
            </h2>
            <div class="text-gray-500">
                By <Username /> in
                {" "}<span style="color:#3b82f6">{faker.random.word()}</span>
            </div>
        </div></TopLevelWrapper></section>
        <section><TopLevelWrapper><div class="m-2 text-base text-gray-800">
            <h2>
                {faker.lorem.sentence()}
            </h2>
            <div class="text-gray-500">
                By <Username /> in
                {" "}<span style="color:#3b82f6">{faker.random.word()}</span>
            </div>
        </div></TopLevelWrapper></section>
        <h1>Post, At pivot:</h1>
        <section><TopLevelWrapper><div class="m-4 text-base text-gray-800">
            <h2 class="text-3xl">
                {faker.lorem.sentence(18)}
            </h2>
            <div class="mt-2" />
            <div class="text-gray-500">
                By <Username /> in
                {" "}<span style="color:#3b82f6">{faker.random.word()}</span>
            </div>
            <div class="mt-8" />
            <For each={[5, 5, 5]}>{par_cnt => (
                <p class="my-4">
                    {faker.lorem.paragraph(par_cnt)}
                </p>
            )}</For>
            <div class="mt-8" />
            <div class="flex gap-4">
                <Button>Save</Button>
                <Button>Share</Button>
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

function Button(props: {children: JSX.Element}): JSX.Element {
    return <button class={classes(
        "bg-white py-1 px-2 rounded-md border-white border-top-gray-400 border-1",
        "text-gray-600",
        "light:bg-gray-700",
    )}>{props.children}</button>;
}