
    // function SerializeComponent(): JSX.Element {
    //     const [text, setText] = createSignal("loading…");

    //     const npath0 = path[0];
    //     const path1 = path.splice(1);

    //     (async () => {
    //         const client = await fetchClient(npath0 ?? "E");
    //         if(!client) return setText("Ebadclient_"+npath0);
    //         const {stringify} = await import("@effectful/serialization");
    //         const v = await client.getPage!("/"+path1.join("/")+search);
    //         return setText(stringify(v));
    //     })().catch(e => {
    //         console.log("err;", e);
    //         setText((e as Error).toString() + "\n" + (e as Error).stack);
    //     });

    //     return <main class="client-wrapper">
    //         <div class="select-none">
    //             Stats: About {text().length} bytes.
    //         </div>
    //         <div class="display-comments-view">
    //             <RichtextParagraphs content={[
    //                 rt.pre(text(), "json"),
    //             ]} />
    //         </div>
    //     </main>;
    // }