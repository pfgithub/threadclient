import tap from "tap";
import { anRoot, anSetReconcile, createAppData } from "./app_data";
import "./test_setup";

function fndemo(): number {
    return 3;
}

// ok let's try out snapshots

tap.test("program", async () => {
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