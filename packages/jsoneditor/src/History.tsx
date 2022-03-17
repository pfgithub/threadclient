import { For, JSX } from "solid-js";
import { AnRoot, anUndo } from "./app_data";
import { Button, Buttons } from "./components";

export default function History(props: {root: AnRoot}): JSX.Element {
    const undoOrRedo = () => {
        const {redo} = anUndo(props.root, props.root.undos[props.root.undo_index]);
        props.root.undos[props.root.undo_index] = redo;
    };
    return <div class="space-y-2">
        <Buttons>
            <Button onClick={() => {
                props.root.undo_index -= 1;
                undoOrRedo();
                props.root.undos_signal[1]();
            }} disabled={(() => {
                props.root.undos_signal[0]();
                return props.root.undo_index === 0;
            })()}>Undo</Button>
            <Button onClick={() => {
                undoOrRedo();
                props.root.undo_index += 1;
                props.root.undos_signal[1]();
            }} disabled={(() => {
                props.root.undos_signal[0]();
                return props.root.undos.length === props.root.undo_index;
            })()}>Redo</Button>
        </Buttons>
        <div>
            history index: {props.root.undos_signal[0]() ?? props.root.undo_index}
        </div>
        <div>
            <For each={(() => {
                props.root.undos_signal[0]();
                return [...props.root.undos].reverse();
            })()} children={(undo, i) => <div
                style={(() => {
                    props.root.undos_signal[0]();
                    return {
                        opacity: (props.root.undos.length - i() - 1) < props.root.undo_index ? 1.0 : 0.5,
                    };
                })()}
            >
                {"History Item"}
            </div>} />
        </div>
    </div>;
}