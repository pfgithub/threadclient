import tap from "tap";
import { UUID } from "tmeta-util";
import {
    anCreateUndoGroup, AnRoot, anRoot, anSetReconcile, anSetReconcileIncomplete,
    anUndo, applyActionToSnapshot, createAppData, findDiffSignals, FloatingAction, modifyActions, SignalPath,
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

type Server = {[key: string]: {
    value: string,
    affects: string,
}};
function uploadToServer(server: Server, root: AnRoot) {
    const client_actions = root.actions.filter(act => act.from === "client");
    Object.assign(server, Object.fromEntries(client_actions.map(a => [a.id, JSON.stringify(a.value)])));
}
function downloadFromServer(server: Server, root: AnRoot) {
    // todo only publish actions that the server doesn't know the client has
    // (eg if there is a transport error, the server will publish the same action
    //  multiple times but usually each action will only be posted once to the client)
    modifyActions(root, {
        insert: Object.entries(server).map(([k, v]): FloatingAction => ({
            id: k as UUID,
            from: "server",
            value: JSON.parse(v.value) as FloatingAction["value"],
            affects: JSON.parse(v.affects) as FloatingAction["affects"],
        })),
        remove: [],
    });
}
function sync(server: Server, ...clients: AnRoot[]) {
    for(const client of clients) {
        uploadToServer(server, client);
    }
    for(const client of clients) {
        downloadFromServer(server, client);
    }
}

void tap.test("applying actions to snapshots", async () => {
    // create object
    tap.same(applyActionToSnapshot({
        id: "0" as UUID,
        from: "client",
        value: {
            kind: "reorder_keys",
            old_keys: [],
            new_keys: [],
        },
        affects: [[]],
    }, undefined), {});

    // does not create object if parents were not created
    tap.same(applyActionToSnapshot({
        id: "0" as UUID,
        from: "client",
        value: {
            kind: "reorder_keys",
            old_keys: [],
            new_keys: [],
        },
        affects: [["home", "someuser", "Documents"]],
    }, undefined), undefined);

    // creates value
    tap.same(applyActionToSnapshot({
        id: "0" as UUID,
        from: "client",
        value: {
            kind: "set_value",
            new_value: "content",
        },
        affects: [["mytextdocument.txt"]],
    }, {'mytextdocument.txt': undefined}), {'mytextdocument.txt': "content"});

    // does not create value if parents were not created
    tap.same(applyActionToSnapshot({
        id: "0" as UUID,
        from: "client",
        value: {
            kind: "set_value",
            new_value: "what an amazing text document. shame the parents weren't created.",
        },
        affects: [["mytextdocument.txt"]],
    }, undefined), undefined);
});

void tap.test("deleting objects should delete any changes made", async () => {
    type Person = {
        name: string,
        description: string,
    };
    const client_1 = createAppData<{[key: string]: Person}>();
    const client_2 = createAppData<{[key: string]: Person}>();

    const server: Server = {};

    tap.same(anRoot(client_1).snapshot, undefined);

    // Client 1 creates a user

    const undo_group = anCreateUndoGroup();
    anSetReconcileIncomplete(client_1["julia"]!, () => ({}), {undo_group});

    tap.same(anRoot(client_1).snapshot, {
        julia: {},
    });
    tap.same(anRoot(client_2).snapshot, undefined);

    // Clients sync
    sync(server, anRoot(client_1), anRoot(client_2));

    tap.same(anRoot(client_1).snapshot, {
        julia: {},
    });
    tap.same(anRoot(client_2).snapshot, {
        julia: {},
    });

    // Client 2 sets the user's name
    anSetReconcileIncomplete(client_2["julia"]!.name, () => "Secret Keeper");

    tap.same(anRoot(client_1).snapshot, {
        julia: {},
    });
    tap.same(anRoot(client_2).snapshot, {
        julia: {
            name: "Secret Keeper",
        },
    });

    // Clients sync
    sync(server, anRoot(client_1), anRoot(client_2));

    tap.same(anRoot(client_1).snapshot, {
        julia: {
            name: "Secret Keeper",
        },
    });
    tap.same(anRoot(client_2).snapshot, {
        julia: {
            name: "Secret Keeper",
        },
    });

    // Client 1 undoes the creation
    anUndo(anRoot(client_1), undo_group);

    tap.same(anRoot(client_1).snapshot, undefined);
    tap.same(anRoot(client_2).snapshot, {
        julia: {
            name: "Secret Keeper",
        },
    });

    // Client 2 has not yet recieved the undo event and sets the description
    anSetReconcileIncomplete(client_2["julia"]!.description, () => "Keeper of Secrets");

    tap.same(anRoot(client_1).snapshot, undefined);
    tap.same(anRoot(client_2).snapshot, {
        julia: {
            name: "Secret Keeper",
            description: "Keeper of Secrets",
        },
    });

    // Clients sync
    sync(server, anRoot(client_1), anRoot(client_2));

    tap.same(anRoot(client_1).snapshot, undefined);
    tap.same(anRoot(client_2).snapshot, undefined);

    console.log("final", anRoot(client_1).snapshot, anRoot(client_2).snapshot);
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