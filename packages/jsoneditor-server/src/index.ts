import cors, { CorsOptions } from "cors";
import initExpress from "express";
import init_http from "http";
import { Server as SocketIOServer } from "socket.io";
import r from "rethinkdb";

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

io.of(/^.*$/).on("connection", socket => {
    const document_name = socket.nsp.name;
    // 1. check for permission
    if(!hasPermission()) return;
    // 2. accept addListener(key) requests
    // 3. respond to all things
    console.log("user connected to document", document_name);
});

(async () => {
    // for each client we're going to have a list of items they're observing
    // the client asks to view an item, we load and give the result back and notify
    // them on any changes. the client can unsubscribe at any time.

    const conn = await r.connect({db: "jsoneditor"});
    r.table("documents").changes().run(conn, (e1: Error | undefined, cursor) => {
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