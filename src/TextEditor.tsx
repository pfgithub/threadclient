import { JSX } from "solid-js/jsx-runtime";
import { SetStoreFunction, Store } from "solid-js/store";

const keyed_by = Symbol();

export type TextEditorNode = {
    node_data: unknown,
    children?: undefined | {
        value: TextEditorNode,
        [keyed_by]: symbol,
    }[];
};

export type RootState = {
    data: Store<{data: TextEditorNode}>,
    setData: SetStoreFunction<{data: unknown}>,
};

// // a little composable leaf node
// // for now it's just an <input /> but eventually we should probably do
// // make it a real TextNode. the point is it handles selection and stuff
//
// export function Leaf(): JSX.Element {
//
// }

// I think I want to make this out of little tiny editable leaf nodes
// that we put event handlers on to say what happens when you move out of them

// so like the leaf nodes handle their own movement or something idk
// and we broadcast up to ask how to move around

// ok here's what we want
// model:
// root: <div class="min-h-[130px] p-2 bg-gray-700 rounded-md space-y-4">
//   paragraph[]: <p
//     text[] {bold: boolean}
//
// and then a bunch of fancy interactions:
// - merge two texts if they have the same attributes
// - pressing enter in a text should insert a newline. if there is already
//   a newline, it should make a new paragraph.

export function TextEditor(props: {
    state: RootState,
}): JSX.Element {
    // this stylinng can probably be provided by the root node
    return <div class="min-h-[130px] p-2 bg-gray-700 rounded-md">
        todo
    </div>;
}

export default function TextApp(props: {
    state: RootState,
}): JSX.Element {
    return <div class="mx-auto max-w-2xl bg-gray-800 p-4 h-full">
        <TextEditor state={props.state} />
    </div>;
}