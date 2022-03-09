import { batch, createEffect, createSignal } from "solid-js";

export default function Design() {
    const [num, setNum] = createSignal(0);

    createEffect(() => alert("num is now: "+num()));

    return <div>
        playground to design stuff

        <button onClick={() => {
            batch(() => {
                setNum(v => v + 1);
                setNum(v => v + 1);
            });
        }}>++</button> {"" + num()}
    </div>;
}