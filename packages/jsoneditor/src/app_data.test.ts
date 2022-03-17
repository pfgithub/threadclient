import tap from "tap";

function fndemo(): number {
    return 3;
}

tap.test("program", async () => {
    tap.equal(fndemo(), 3);
});