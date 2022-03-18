import tap from "tap";
import {
    anCreateUndoGroup, anRoot, anSetReconcile, anSetReconcileIncomplete,
    anUndo, createAppData, findDiffSignals, SignalPath,
} from "./app_data";
import "./test_setup";

void tap.test("program", async () => {
    const data = createAppData<{
        name: string,
    }>();
    tap.same(anRoot(data).snapshot, undefined);
    anSetReconcile(data.name, () => "Julia");
    // TODO test that events are emitted for these paths and no others:
    // - [{"v":"keys"}]
    // - ["name"]
    tap.same(anRoot(data).snapshot, {
        name: "Julia",
    });
});

// hmm i'm not sure about this
void tap.test("deleting objects should delete any changes made", async () => {
    type Person = {
        name: string,
        description: string,
    };
    const data = createAppData<{[key: string]: Person}>();
    const root = anRoot(data);

    tap.same(anRoot(data).snapshot, undefined);

    // Client 1 creates a user

    const undo_group = anCreateUndoGroup();
    anSetReconcileIncomplete(data["julia"]!, () => ({}), {undo_group});

    tap.same(anRoot(data).snapshot, {
        julia: {},
    });

    // Client 2 sets the user's name

    anSetReconcileIncomplete(data["julia"]!.name, () => "Julia");

    tap.same(anRoot(data).snapshot, {
        julia: {
            name: "Julia"
        },
    });

    // Client 1 undoes the creation

    anUndo(root, undo_group);

    // tap.same(anRoot(data).snapshot, undefined); ← not sure if this should be correct
    // behaviour or not. so i'm not implementing it yet.

    // Client 3 has only received the first event and just now sets the user's name

    anSetReconcileIncomplete(data["julia"]!.name, () => "Julia");

    tap.same(anRoot(data).snapshot, {
        julia: {
            name: "Julia"
        },
    });

    // ^ is this the behaviour we want? seems strange

    // feels like we want:
    // - in arrays, you have to create an item before you can add things
    // - in objects, you can set to any key we want
    // is that true?
    //
    // that's not easy to handle given that right now, arrays and objects are the same
    // thing
});

void tap.test("findDiffSignals", async () => {
    function testv(prev: unknown, next: unknown, value: SignalPath[]) {
        tap.equal(
            findDiffSignals(["root"], prev, next).map(l => JSON.stringify(l)).join("\n"),
            value.map(l => JSON.stringify(l)).join("\n"),
        );
    }
    testv(undefined, {}, [
        ["root"],
    ]);
    testv({}, undefined, [
        ["root"],
    ]);
    // updating an object only changes its keys 
    testv({}, {james: undefined}, [
        ["root", {v: "keys"}],
    ]);
    // keys are emitted after new values are created
    testv({}, {james: {
        name: "James",
        description: "player",
    }}, [
        ["root", "james", "name"],
        ["root", "james", "description"],
        ["root", "james", {v: "keys"}],
        ["root", "james"],
        ["root", {v: "keys"}],
    ]);
    // keys are emitted before old values are deleted
    testv({james: {
        name: "James",
        description: "player",
    }}, {}, [
        ["root", {v: "keys"}],
        ["root", "james", {v: "keys"}],
        ["root", "james", "name"],
        ["root", "james", "description"],
        ["root", "james"],
    ]);
});