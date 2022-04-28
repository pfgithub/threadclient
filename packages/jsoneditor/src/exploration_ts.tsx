/* eslint-disable */

import { JSX } from "solid-js";

export const a = "";

const idStr = <T,>() => <W extends string>(w: W): W & {__is: T} => {
    return w as W & {__is: T};
};

type JObject = {
    id: "-N0gk9Mfm2iXGUkeWUMS",
    fields: JField[],
    multiline: boolean,
};
type JField = {
    id: "-N0gkJ4N6etM-Md1KiyT",
    key?: JString | JSlot | undefined,
    value: JValue,
    // enables copy/pasting between objects and arrays eg
    // if you paste from an array to an object, it will put a bunch of fields with a slot for the key
    // if you paste into an array, it will error at all the keys

    // ok there's no reason to do this, we can just have seperate objectfield/arrayfield and handle
    // that on paste
};
type JArray = {
    id: "-N0gkrMd2kkRkNrVMEU2",
    fields: JField[],
    multiline: boolean,
};
type JString = {
    id: "-N0gkxU5wAjciRZnERvO",
    text: string,
};
type JNumber = {
    id: "-N0gkzBWv3Cx0Ryyouky",
    num: number,
};
type JBoolean = {
    id: "-N0gl-Obi0cyd58QHO85",
    text: string,
};
type JSlot = {
    id: "-N0gpdqw6BjkuWrRqqTG",
};

type JValue = JObject | JArray | JString | JNumber | JBoolean | JSlot;

type ObjSpec<T extends Obj> = {
    id: T["id"],
    children(obj: T): number | null,
    child(obj: T, n: number): Obj,
};

function renderJObject(obj: JObject): JSX.Element {
    return <>{"{}"}</>;
}
const j_object: ObjSpec<JObject> = {
    id: "-N0gk9Mfm2iXGUkeWUMS",
    children(obj) {
        return obj.fields.length;
    },
    child(obj, n) {
        return obj.fields[n]!;
    },
};

function renderJArray(j: JArray): JSX.Element {
    return <>{"[]"}</>;
}
const j_array: ObjSpec<JArray> = {
    id: "-N0gkrMd2kkRkNrVMEU2",
    children(obj) {
        return obj.fields.length;
    },
    child(obj, n) {
        return obj.fields[n]!;
    },
};

function renderJString(j: JString): JSX.Element {
    // when you're typing in here, you should be able to type "\" and it should show a menu to
    // let you insert escapes. basically like an ime.
    // also, typing any character should insert the actual character. eg you can press enter
    // to insert "\n" and press dblquote to insert "\"". pasting should convert the pasted content to
    // text and then insert.
    //
    // a fun thing we can do is display newlines because we're a node-based editor. so we can do that
    // if we want. we could even display double quotes without the escape.
    return <>{JSON.stringify(j.text)}</>;
}
const j_string: ObjSpec<JString> = {
    id: "-N0gkxU5wAjciRZnERvO",
    children(obj) {
        return obj.text.length;
    },
    child(obj, n) {
        throw new Error("todo return a fake char node");
    },
};

function renderJNumber(j: JNumber): JSX.Element {
    // when you're editing in here, it should be looser than once you've clicked out
    // basically: when you're focused in the jnumber, we should have a custom editor. it should
    // show a little outline so you know.
    //
    // this also means if multiple people are editing, they each commit once
    // so it doesn't do normal text reconciliation stuff. it's like clicking a button and having a popup
    // appear and when you press "ok" it updates for everyone.
    return <>{JSON.stringify(j.num)}</>;
}
const j_number: ObjSpec<JNumber> = {
    id: "-N0gkzBWv3Cx0Ryyouky",
    children(obj) {
        return 1; // two positions for the cursor to be in
        // when the cursor is there, we'll show our overlay and handle cursor movements within
        // the overlay.
    },
    child(obj, n) {
        throw new Error("todo return something");
    },
};

const j_field: ObjSpec<JField> = {
    id: "-N0gkJ4N6etM-Md1KiyT",
    children(obj) {
        // sl|ot
        // |value|
        // sl|ot: sl|ot
        // |key|: sl|ot
        // sl|ot: |value|
        // |key|: |value|
        const val_slot = obj.value.id === "-N0gpdqw6BjkuWrRqqTG";
        if(obj.key == null) return 1 -+ val_slot;
        const key_slot = obj.key?.id === "-N0gpdqw6BjkuWrRqqTG";
        return 3 -+ val_slot -+ key_slot;
        // if you're at the end of value and you type ':', if value is a string it will switch it to
        // the key and focus you in value

        // if you delete from index 1 to 2:
        // - what to do?
        //   - if value is a slot, just set value to key and key to null
        //   - if key is a slot, delete
        //   - otherwise:
        //     - select range 0 to 2

        // ok what I actually want is for you not to be able to select from 1 to 2
        // you can select 0 to 1 and then 1 to 3, or 3 to 2 and then 2 to 0, or 1 to 3, or 2 to 0
        //
        // that should be pretty easy to do, we just define a custom selection stop function

        // if you type ',' at index 1 or 2:
        // - split in half

        // delete from index 2 to 3:
        // - replace the node with a slot

        // delete from index 0 to 1:
        // - replace the node with a slot
    },
    child(obj) {
        throw new Error("todo get child");
    },
};

const capsule_id = idStr<Capsule>()("-N0XUsb0qNRaLGPO5ozK");
export type Capsule = {
    id: typeof capsule_id,
    items: (Text | Capsule)[],
};
const text_id = idStr<Text>()("-N0XV2FiLWJAMynVk0ZX");
export type Text = {
    id: typeof text_id,
    chars: Char[],
};
const char_id = idStr<Char>()("-N0XWfQf03qhkJoqskTQ");
export type Char = {
    id: typeof char_id,
    char: string,
};
const sys_rawtext_id = idStr<SysRawtext>()("@sys_rawtext");
export type SysRawtext = {
    id: typeof sys_rawtext_id,
    text: string,
};

export type Obj = {
    id: string,
};

function is<T extends Obj>(obj: Obj, id: string & {__is: T}): obj is T {
    return obj.id === id;
}

// ok these are bad
// instead, the node can handle the insert event and convert the content as needed.

// I guess the question is if you eg paste an image in a span
// - it needs to split the span
// but that's okay, the node can handle that or something.

function capsuleInsert(obj: Capsule, index: number, new_items: Obj[]): Obj[] {
    const items = [...obj.items];
    // if the items don't fit in the capsule:
    // - insert them in a text
    // - fall through any that don't fit in the text
    // if when doing an insertion, any items fall through out the root of the page:
    // - cancel the operation

    // alternatively:
    // if any items don't fit in the capsule:
    // - insert them in a text
    // - error if any fall through the text
    throw new Error("TODO");
}

function textInsert(obj: Text, index: number, new_items: Obj[]): Obj[] {
    /*
    alternatively:
    obj.chars.map(char => {
        if(is(elem, char_id)) return char;
        if(is(elem, sys_rawtext_id)) {
            return ;
        }
    })
    */

    const items: Obj[] = [...obj.chars];
    items.splice(index, 0, ...new_items);

    const committed: Obj[] = [];
    const newWorking = () => ({id: text_id, chars: []});
    let working: Text = newWorking();
    const addChar = (item: Char) => {
        working.chars.push(item);
    };
    const addOther = (item: Obj) => {
        commit();
        committed.push(item);
    };
    const commit = () => {
        if(working.chars.length > 0) {
            committed.push(working);
            working = newWorking();
        }
    };
    for(const elem of items) {
        if(is(elem, char_id)) {
            addChar(elem);
        }else if(is(elem, sys_rawtext_id)) {
            for(const char of [...elem.text]) {
                addChar({id: char_id, char});
            }
        }else{
            addOther(elem);
        }
    }
    commit();

    return committed;
}