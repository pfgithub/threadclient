import { createSignal, JSX, untrack } from "solid-js";
import { DragButton, DraggableList } from "./DraggableList";

export default function Design(): JSX.Element {
    const [items, setItems] = createSignal(Object.fromEntries(new Array(30).fill(0).map((_, i) => {
        // javascript does not keep key order when the key can be parsed as a number
        // …
        // i love javascript
        // it is very consistent
        //
        // literally look at this
        // Object.keys({"1": "a", "0": "b"})
        // ["0", "1"]
        //
        // this is defined in some spec somewhere
        return ["_" + i, {
            data: "my data for "+i,
        }] as const;
    })));

    return <div>
        <DraggableList
            items={Object.keys(items())}
            setItems={cb => {
                setItems(it => {
                    const oldv = Object.keys(it);
                    const newv = cb(oldv);
                    const res = Object.fromEntries(newv.map(key => [key, it[key]!] as const));
                    console.log("upd", newv, Object.keys(res));
                    return res;
                });
            }}
            wrapper_class="pt-2 first:pt-0"
            nodeClass={selfIsDragging => [
                "bg-gray-700 rounded-md flex flex-row flex-wrap",
                selfIsDragging() ? "opacity-80 shadow-md" : ""
            ].join(" ")}
        >{key => <>
            <div class="flex-1 p-2">
                Collapsed item {key} (state {Math.random()})
                {untrack(() => <div style={{height: (Math.random() * 20 |0) + "px"}} />)}
            </div>
            <DragButton class={selfIsDragging => [
                    "px-4 rounded-md",
                    selfIsDragging() ? "bg-gray-500" : "hover:bg-gray-600",
            ].join(" ")}>
                ≡
            </DragButton>
        </>}</DraggableList>
    </div>;
}