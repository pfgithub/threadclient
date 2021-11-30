async function main() {
    let focus: unknown | undefined;
    const setFocus = (nv: unknown) => focus = nv;

    const reload = async () => {
        await (await import("./terminal")).main({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            focus: (): any => focus as any,
            setFocus,
        });
    };
    await reload();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});