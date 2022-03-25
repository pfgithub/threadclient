import cors, { CorsOptions } from "cors";
import initExpress from "express";
import init_http from "http";
import { Server as SocketIOServer } from "socket.io";
import r, { ChangesOptions } from "rethinkdb";
import { assertNever } from "tmeta-util";

// https://firebase.google.com/docs/reference/node/firebase.database.ServerValue
// we'll want to do this

const express = initExpress();

const http = init_http.createServer(express);

const corsopts: CorsOptions = {
    // origin: "http://localhost:3000",
    origin: "*",
    methods: ["GET", "POST"],
};

const io = new SocketIOServer(http, {
    cors: corsopts,
});

express.use(cors(corsopts));

function hasPermission(): boolean {
    return true;
}
type DocumentValue = {
    listeners: DocumentListener[],
    actions: unknown[],
};
type DocumentListener = (v: unknown[]) => void;
const documents = new Map<string, DocumentValue>();
function getDocument(document_name: string): DocumentValue {
    let doc = documents.get(document_name);
    if(!doc) {
        doc = {listeners: [], actions: []};
        documents.set(document_name, doc);
    }
    return doc;
}

type Document = {disconnect: () => void};
function watchDocument(document_name: string, cb: DocumentListener): Document {
    const doc = getDocument(document_name);

    // TODO per document
    cb(doc.actions);
    doc.listeners.push(cb);
    return {
        disconnect: () => {
            doc.listeners = doc.listeners.filter(l => l !== cb);
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
                const res: DBAction = {
                    version: "1",
                    id: action["id"],
                    value: JSON.stringify(action["value"]),
                    affects: JSON.stringify(action["affects"]),
                    document: document_name,
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

type DBActionPrimary = {
    id: string,
    // document: string, // TODO we'll do queries based on document
    // rather than watching all documents.
};
type DBAction = DBActionPrimary & {
    version: "1",
    id: string,
    document: string,
    value: undefined | string,
    affects: undefined | string,
};
type OldDBAction = DBActionPrimary & (DBAction | {
    version: "0",
    id: string,
    value: undefined | string,
    affects: undefined | string,
});
function upgradeDBAction(old: OldDBAction): DBAction {
    if(old.version === "1") return old;
    if(old.version === "0") return {
        ...old,
        version: "1",
        document: "none",
    };
    assertNever(old);
}

function isObject(v: unknown): v is {[key: string]: unknown} {
    return v != null && typeof v === "object";
}

(async () => {
    conn = await r.connect({db: "jsoneditor"});
    const opts: Partial<ChangesOptions> = {
        includeInitial: true,
        includeStates: true,
    };
    r.table("actions").changes(opts as ChangesOptions).run(conn, (e1: Error | undefined, cursor) => {
        if(e1) return console.error(e1);
        const unsent: Map<string, unknown[]> = new Map();
        cursor.each((e2: Error | undefined, item_old: {new_val: OldDBAction}) => {
            if(e2) return console.error(e2);
            console.log("got item", item_old);
            if(!('new_val' in item_old)) return;
            const action = upgradeDBAction(item_old.new_val);
            const new_action: unknown = {
                id: action.id,
                from: "server",
                value: JSON.parse(action.value ?? "null") as unknown,
                affects: JSON.parse(action.affects ?? "null") as unknown,
            };

            let unsentv = unsent.get(action.document);
            if(!unsentv) {
                unsentv = [];
                unsent.set(action.document, []);
            }
            unsentv.push(new_action);

            getDocument(action.document).actions.push(new_action);
        });
        setInterval(() => {
            for(const [document, actions] of [...unsent.entries()]) {
                if(actions.length === 0) continue;
                const to_send = actions.splice(0);
                getDocument(document).listeners.forEach(lsnr => lsnr(to_send));
            }
        }, 20);
    });

    // [!] don't listen until db is ready

    await new Promise(re => http.listen(3564, () => re(undefined)));
    console.log("Listening", http.address());
})().catch(e => {
    console.error(e);
});