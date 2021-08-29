import { Server } from "ws";
import {promises as fs} from "fs";
import os from "os";

const port = 3018;

const wss = new Server({
    port,
});

const addresses: [string, string][] = [["", "localhost"]];
Object.entries(os.networkInterfaces()).forEach(([ikey, interfaces]) => {
    let count = 0;
    for(const nterface of interfaces ?? []) {
        if(!nterface.internal) {
            if(!nterface.internal) {
                if(nterface.family === "IPv6") continue; // don't display ipv6
                addresses.push([
                    (count > 0 ? (ikey + ":" + count) : ikey) + " - ",
                    nterface.address,
                ]);
                count += 1;
            }
        }
    }
});

console.log("Listening on:");
console.log(addresses.map(addr => (
    addr[0] + "ws://" + addr[1] + ":" + port
)).join("\n"));
console.log();

wss.on("connection", ws => {
    console.log("Client connected");
    Promise.all([
        fs.readFile(__dirname+"/../projects/main/config.json", "utf-8"),
        fs.readFile(__dirname+"/../projects/main/audio.mp3"),
        // TODO checkpointing
        fs.readFile(__dirname+"/../projects/main/actions.json", "utf-8"),
    ]).then(([config_json, audio, actions_json]) => {
        ws.send(config_json);
        ws.send(audio);
        ws.send(actions_json);
        ws.send(JSON.stringify({kind: "ready"}));
    }).catch(e => {
        console.log("file read error", e);
        ws.send(JSON.stringify({kind: "error", message: "server is not configured correctly"}));
        ws.close();
    });

    ws.on("message", message => {
        if(typeof message !== "string") {
            ws.send({kind: "error", message: "binary data not supported"});
            ws.close();
            return;
        }
        console.log("Got", message);
    });
    ws.on("close", () => {
        console.log("Client disconnected");
    });
});