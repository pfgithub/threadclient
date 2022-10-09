import * as Generic from "api-types-generic";
import { createMemo, JSX, untrack } from "solid-js";
import { Show, SwitchKind } from "tmeta-util-solid";
import { getWholePageRootContextOpt } from "../util/utils_solid";

export default function ReadLink<T>(props: {
    link: Generic.Link<T>,
    children: (value: T) => JSX.Element,
    whenError?: undefined | ((emsg: string) => JSX.Element),
    fallback: JSX.Element,
}): JSX.Element {
    const hprc = getWholePageRootContextOpt();
    const linkval = createMemo((): ({kind: "none"} | {kind: "error", msg: string} | {kind: "value", value: T}) => {
        if(hprc == null) return {kind: "error", msg: "There is no page root context to read links on"};
        const linkres = hprc.content.view(props.link);
        if(linkres == null) return {kind: "none"};
        if(linkres.error != null) return {kind: "error", msg: linkres.error};
        return {kind: "value", value: linkres.value};
    }, undefined, {equals: (a, b) => {
        // this might not be necessary if SwitchKind is implemented well but I'm not sure if it is
        // ^ it is not because it fundamentally cannot be implemented well due to how unions work
        // - unions would have to have a seperate tag and value for SwitchKind to be implemented to handle
        //   this properly
        if(a === b) return true;
        if(a == null) return a === b;
        if(b == null) return false;
        if(a.kind === "error") return b.kind === "error" && a.msg === b.msg;
        if(a.kind === "value") return b.kind === "value" && a.value === b.value;
        return false;
    }});

    return <SwitchKind item={linkval()} children={{
        'none': () => props.fallback,
        'error': emsg => <Show when={props.whenError} fallback={<div class="text-red-500">
            error: {emsg.msg}
        </div>} children={whenError => <>{untrack(() => whenError(emsg.msg))}</>} />,
        'value': value => <>{untrack(() => props.children(value.value))}</>,
    }} />;
}