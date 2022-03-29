import tap from "tap";
import {
    anCreateUndoGroup, AnRoot, anRoot, anSetReconcile, anSetReconcileIncomplete,
    anUndo, applyActionToSnapshot, createAppData, findDiffSignals,
    addActions, reducePath, SignalPath, TemporaryActionID, PermanentAction,
    PermanentActionID, JSON as JSON_t,
} from "./app_data";
import "./test_setup";

export {};

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

function dupeJSON<T extends JSON_t>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as typeof v;
}

type Server = PermanentAction[];
function uploadToServer(server: Server, root: AnRoot) {
    const client_actions = root.temporary_actions.splice(0);
    server.push(...client_actions.map((client_action): PermanentAction => {
        client_action = dupeJSON(client_action);
        return {
            id_type: "permanent",
            permanent_id: server.length as PermanentActionID,
    
            temporary_id: client_action.temporary_id,
            value: client_action.value,
            affects_tree: client_action.affects_tree,
        };
    }));
}
function downloadFromServer(server: Server, root: AnRoot) {
    // todo only publish actions that the server doesn't know the client has
    // (eg if there is a transport error, the server will publish the same action
    //  multiple times but usually each action will only be posted once to the client)
    addActions(root, {
        temporary: [],
        permanent: dupeJSON(server),
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
        temporary_id: "0" as TemporaryActionID,
        value: {
            kind: "reorder_keys",
            old_keys: [],
            new_keys: [],
            path: [],
        },
        affects_tree: [],
    }, undefined), {});

    // does not create object if parents were not created
    tap.same(applyActionToSnapshot({
        temporary_id: "0" as TemporaryActionID,
        value: {
            kind: "reorder_keys",
            old_keys: [],
            new_keys: [],
            path: ["home", "someuser", "Documents"],
        },
        affects_tree: ["home", "someuser", "Documents"],
    }, undefined), undefined);

    // creates value
    tap.same(applyActionToSnapshot({
        temporary_id: "0" as TemporaryActionID,
        value: {
            kind: "set_value",
            new_value: "content",
            path: ["mytextdocument.txt"],
        },
        affects_tree: ["mytextdocument.txt"],
    }, {'mytextdocument.txt': undefined}), {'mytextdocument.txt': "content"});

    // does not create value if parents were not created
    tap.same(applyActionToSnapshot({
        temporary_id: "0" as TemporaryActionID,
        value: {
            kind: "set_value",
            new_value: "what an amazing text document. shame the parents weren't created.",
            path: ["mytextdocument.txt"],
        },
        affects_tree: ["mytextdocument.txt"],
    }, undefined), undefined);
});

void tap.test("deleting objects should delete any changes made", async () => {
    type Person = {
        name: string,
        description: string,
    };
    const client_1 = createAppData<{[key: string]: Person}>();
    const client_2 = createAppData<{[key: string]: Person}>();

    const server: Server = [];

    tap.same(anRoot(client_1).snapshot, null);

    // Client 1 creates a user

    const undo_group = anCreateUndoGroup();
    anSetReconcileIncomplete(client_1["julia"]!, () => ({}), {undo_group});

    tap.same(anRoot(client_1).snapshot, {
        julia: {},
    });
    tap.same(anRoot(client_2).snapshot, null);

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

void tap.test("reducePath", async () => {
    tap.same(reducePath([], []), []);
    tap.same(reducePath(["a"], []), []);
    tap.same(reducePath(["a"], ["a"]), ["a"]);
    tap.same(reducePath([], ["a"]), []);
    tap.same(reducePath(["a", "b", "c"], ["a", "b", "d", "e"]), ["a", "b"]);
});