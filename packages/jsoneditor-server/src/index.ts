import cors, { CorsOptions } from "cors";
import initExpress from "express";
import init_http from "http";
import { Server as SocketIOServer } from "socket.io";
import r, { ChangesOptions } from "rethinkdb";

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

type DocumentListener = (v: unknown[]) => void;
let document_listeners: (DocumentListener)[] = [];
const all_actions: unknown[] = [];

type Document = {disconnect: () => void};
function watchDocument(document_name: string, cb: DocumentListener): Document {
    // TODO per document
    cb(all_actions);
    document_listeners.push(cb);
    return {
        disconnect: () => {
            document_listeners = document_listeners.filter(l => l !== cb);
        },
    };
}

let conn!: r.Connection;
io.of(/^.*$/).on("connection", socket => {
    const document_name = socket.nsp.name;
    console.log("user connected to document", document_name);

    // 1. check for permission
    if(!hasPermission()) return;
    // 2. send all events
    // - in the future, we may want to only send events that are relevant to that
    //   user rather than sending everything

    const doc = watchDocument(document_name, (actions) => {
        socket.emit("create actions", actions);
        socket.broadcast.to(socket.id).emit("create actions", actions);
        console.log("SENT ACTIONS", actions);
    });

    socket.on("disconnect", () => {
        console.log("user disconnected from document", document_name);
        // unregister db watcher
        doc.disconnect();
    });

    socket.on("create actions", async (actions: unknown) => {
        try {
            if(!Array.isArray(actions)) throw new Error("actions is not not array");
            const submit_actions = actions.map(action => {
                if(!isObject(action)) throw new Error("action is not object");
                if(typeof action["id"] !== "string") {
                    throw new Error("action missing .id field");
                }
                const res = {
                    version: "2",
                    id: action["id"],
                    value: JSON.stringify(action["value"]),
                };
                return res;
            });
            // assign new ids to actions
            // - why? just to fix people with bad clocks?
            // - we'll skip this for now. we can consider doing this in the future
            const res = await r.table("actions").insert(submit_actions, {
                conflict: "error",
                // client submitted an action that has already been submitted.
                // this may happen if the client attempts to submit values and
                // the response does not get back to them so the client attempts again.
                // as long as the client has not changed actions (which it should not do)
                // any resubmitted actions can be safely ignored.
                //
                // error still allows other items to be inserted
            }).run(conn);
            console.log("SUBMITTED TO DB", {...res, first_error: undefined});
        }catch(e) {
            console.error("Error in client message", e, ". Disconnecting client.");
            socket.disconnect();
        }
    });
});

function isObject(v: unknown): v is {[key: string]: unknown} {
    return v != null && typeof v === "object";
}

(async () => {
    // for each client we're going to have a list of items they're observing
    // the client asks to view an item, we load and give the result back and notify
    // them on any changes. the client can unsubscribe at any time.

    conn = await r.connect({db: "jsoneditor"});
    const opts: Partial<ChangesOptions> = {
        includeInitial: true,
        includeStates: true,
    };
    r.table("actions").changes(opts as ChangesOptions).run(conn, (e1: Error | undefined, cursor) => {
        if(e1) return console.error(e1);
        const unsent: unknown[] = [];
        cursor.each((e2: Error | undefined, item: {new_val: {
            version: undefined | "2",
            id: string,
            value: string,
        }}) => {
            if(e2) return console.error(e2);
            console.log("got item", item);
            if(!('new_val' in item)) return;
            const new_action: unknown = {
                id: item.new_val.id,
                from: "server",
                value: item.new_val.version === undefined ? (
                    item.new_val.value as unknown
                ) : (
                    JSON.parse(item.new_val.value) as unknown
                ),
            };
            unsent.push(new_action);
            all_actions.push(new_action);
        });
        setInterval(() => {
            if(unsent.length === 0) return;
            const to_send = unsent.splice(0);
            document_listeners.forEach(doc => doc(to_send));
        }, 20);
    });

    // [!] don't listen until db is ready

    await new Promise(re => http.listen(3564, () => re(undefined)));
    console.log("Listening", http.address());
})().catch(e => {
    console.error(e);
});