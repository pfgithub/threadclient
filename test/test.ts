import {promises as fs} from "fs";

import * as reddit from "../src/clients/reddit";

void (async () => {
    const dircont = await fs.readdir(__dirname+"/sample_data");

    for(const file of dircont) {
        const filecont = await fs.readFile(__dirname+"/sample_data/"+file, "utf-8");
        const parsed = JSON.parse(filecont);
        // const res = reddit.pageFromListing("/PATHROOT", parsed, {});
        // await fs.writeFile(__dirname+"/sample_out/"+file, JSON.stringify(res, (key: string, value) => {
        //     if(key === "raw_value") return undefined;
        //     return value;
        // }, "\t"), "utf-8");
    }
})();