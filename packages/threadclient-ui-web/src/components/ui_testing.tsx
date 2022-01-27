import { JSX } from "solid-js";
import { classes } from "../util/utils_solid";
import { TopLevelWrapper } from "./page2";
export * from "../util/interop_solid";

export default function UITestingPage(): JSX.Element {
    return <div class="m-4 text-gray-800">
        <h1>Posts, Above or below pivot:</h1>
        <section><TopLevelWrapper><div class="m-2 text-base text-gray-800">
            <h2>
                Neque porro quisquam est qui dolorem ipsum quia dolor sit amet,
                consectetur, adipisci velit.
            </h2>
            <div class="text-gray-500">
                By
                {" "}<span style="color:#93FF79">someuser123</span>{" "}
                in
                {" "}<span style="color:#3b82f6">Location</span>
            </div>
        </div></TopLevelWrapper></section>
        <section><TopLevelWrapper><div class="m-2 text-base text-gray-800">
            <h2>
                Letraset sheets containing Lorem Ipsum passages.
            </h2>
            <div class="text-gray-500">
                By
                {" "}<span style="color:#e287f5">Author</span>{" "}
                in
                {" "}<span style="color:#3b82f6">Location</span>
            </div>
        </div></TopLevelWrapper></section>
        <h1>Post, At pivot:</h1>
        <section><TopLevelWrapper><div class="m-4 text-base text-gray-800">
            <h2 class="text-3xl">
                Neque porro quisquam est qui dolorem ipsum quia dolor sit amet,
                consectetur, adipisci velit.
            </h2>
            <div class="mt-2" />
            <div class="text-gray-500">
                By
                {" "}<span style="color:#93FF79">Author</span>{" "}
                in
                {" "}<span style="color:#3b82f6">Location</span>
            </div>
            <div class="mt-8" />
            <p class="my-4">
                Lorem Ipsum is simply dummy text of the printing and typesetting
                industry. Lorem Ipsum has been the industry's standard dummy text
                ever since the 1500s, when an unknown printer took a galley of type
                and scrambled it to make a type specimen book. It has survived not
                only five centuries, but also the leap into electronic typesetting,
                remaining essentially unchanged. It was popularised in the 1960s with
                the release of Letraset sheets containing Lorem Ipsum passages, and
                more recently with desktop publishing software like Aldus PageMaker
                including versions of Lorem Ipsum.
            </p>
            <p class="my-4">
                Contrary to popular belief, Lorem Ipsum is not simply random text. It
                has roots in a piece of classical Latin literature from 45 BC, making
                it over 2000 years old. Richard McClintock, a Latin professor at
                Hampden-Sydney College in Virginia, looked up one of the more obscure
                Latin words, consectetur, from a Lorem Ipsum passage, and going
                through the cites of the word in classical literature, discovered the
                undoubtable source. Lorem Ipsum comes from sections 1.10.32 and
                1.10.33 of "de Finibus Bonorum et Malorum" (The Extremes of Good and
                Evil) by Cicero, written in 45 BC. This book is a treatise on the
                theory of ethics, very popular during the Renaissance. The first line
                of Lorem Ipsum, "Lorem ipsum dolor sit amet..", comes from a line in
                section 1.10.32.
            </p>
            <p class="my-4">
                The standard chunk of Lorem Ipsum used since the 1500s is reproduced
                below for those interested. Sections 1.10.32 and 1.10.33 from "de
                Finibus Bonorum et Malorum" by Cicero are also reproduced in their
                exact original form, accompanied by English versions from the 1914
                translation by H. Rackham.
            </p>
            <div class="mt-8" />
            <div class="flex gap-4">
                <Button>Save</Button>
                <Button>Share</Button>
            </div>
        </div></TopLevelWrapper></section>
    </div>;
}

function Button(props: {children: JSX.Element}): JSX.Element {
    return <button class={classes(
        "bg-white py-1 px-2 rounded-md border-white border-top-gray-400 border-1",
        "text-gray-600",
        "light:bg-gray-700",
    )}>{props.children}</button>;
}