import cors, { CorsOptions } from "cors";
import initExpress from "express";
import init_http from "http";
import { Server as SocketIOServer } from "socket.io";
import r from "rethinkdb";

// https://firebase.google.com/docs/reference/node/firebase.database.ServerValue
// we'll want to do this

const express = initExpress();

const http = init_http.createServer(express);

const corsopts: CorsOptions = {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
};

const io = new SocketIOServer(http, {
    cors: corsopts,
});

express.use(cors(corsopts));

function hasPermission(): boolean {
    return true;
}

let document_listeners: (() => void)[] = [];

type Document = {disconnect: () => void};
function watchDocument(document_name: string, cb: (() => void)): Document {
    // TODO per document
    document_listeners.push(cb);
    return {
        disconnect: () => {
            document_listeners = document_listeners.filter(l => l !== cb);
        },
    };
}

io.of(/^.*$/).on("connection", socket => {
    const document_name = socket.nsp.name;
    // 1. check for permission
    if(!hasPermission()) return;
    // 2. send all events
    // - in the future, we may want to only send events that are relevant to that
    //   user rather than sending everything

    const doc = watchDocument(document_name, () => {
        // we should emit an action[] with:
        // - the action data with new ids
        // - an array of ids that the client should delete from their actions array
        // socket.emit("action", );
    });

    socket.on("disconnect", () => {
        // unregister db watcher
        doc.disconnect();
    });

    socket.on("create actions", actions_str => {
        try {
            if(typeof actions_str !== "string") throw new Error("bad actions data");
            const actions: unknown = JSON.parse(actions_str);
            if(!Array.isArray(actions)) throw new Error("actions is not not array");
        }catch(e) {
            console.error("Error in client message", e, ". Disconnecting client.");
            socket.disconnect();
        }
    });

    console.log("user connected to document", document_name);
});

(async () => {
    // for each client we're going to have a list of items they're observing
    // the client asks to view an item, we load and give the result back and notify
    // them on any changes. the client can unsubscribe at any time.

    const conn = await r.connect({db: "jsoneditor"});
    r.table("actions").changes().run(conn, (e1: Error | undefined, cursor) => {
        if(e1) return console.error(e1);
        cursor.each((e2: Error | undefined, item) => {
            if(e2) return console.error(e2);
            console.log("got item", item);
        });
    });

    await new Promise(re => http.listen(3564, () => re(undefined)));
    console.log("Listening", http.address());
})().catch(e => {
    console.error(e);
});