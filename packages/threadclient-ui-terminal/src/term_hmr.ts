async function main() {
    let focus: unknown | undefined;
    const setFocus = (nv: unknown) => focus = nv;

    let oncleanup: (() => void)[] | undefined = [];

    const reload = async () => {
        console.log("opts.reload() called");
        if(!oncleanup) throw new Error("failed to reload; not done loading yet");

        [...oncleanup].reverse().forEach(v => v());
        oncleanup = undefined;

        delete require.cache[require.resolve("./terminal")];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        oncleanup = await (require("./terminal") as typeof import("./terminal")).main({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            focus: (): any => focus as any,
            setFocus,
            reload,
        });
    };
    await reload();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});