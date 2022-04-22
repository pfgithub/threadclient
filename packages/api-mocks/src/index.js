// ok we're going to accept requests
// http://localhost:xxxx/https://[any url]
// and then we fetch the actual value and cache the result
// or, if run with --offline, we error 404

const express = require("express");
const proxy = require("express-http-proxy");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3772;

/**
 * @param {string} url
 * @returns  {string}
 */
function toSafeFilename(req) {

    // oh on mac/linux we can use "\\" to replace "/" in paths. unfortunately not cross-platform though.
    // so we're using "[5c]". "https[3a][5c][5c]www.google.com[5c]"
    const safechars = new Set([..." _-0123456789abcdefghijklmnopqrstuvwxyz&"]); // no "." because "."/".." special paths
    const fsafe = (a) => a ? [...a.toLowerCase()].map(c => {
        // !these characters must not be used because of windows
        // - <>:"/\|?*
        // oh that's annoying, I wanted to use ?
        if(safechars.has(c)) return c;
        if(c === "/") return "$";
        if(c === "?") return "#";
        if(c === ":") return ";";
        if(c === ".") return ",";
        return `[${c.codePointAt().toString(16)}]`;
    }).join("") : "@";
    return __dirname + "/../data/" + fsafe(req["@origin"]) + "/" + fsafe(`${req.method} ${req.url}`);
}

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");

    res.header("Content-Type", "application/json");
    res.header("Content-Disposition", "inline; filename=\"a.json\"");

    if (req.method.toUpperCase() === "OPTIONS") {
        return res.sendStatus(200);
    }
    return next();
});

app.use("/mock", (req, res, next) => {
    const urlv = req.url.replace("/", "");
    const urlq = new URL(urlv);

    req["@origin"] = urlq.origin;

    req.url = urlq.pathname+urlq.search;
    return next();
});
app.use("/mock", (req, res, next) => {
    if(req.method.toLowerCase() === "options") {
        return res.sendStatus(200);
    }

    const urlv = toSafeFilename(req);
    try {
        const file = fs.readFileSync(urlv);
        return res.send(file);
    }catch(e) {
        return next();
    }
});
if(process.env.ONLINE === "true") {
    app.use("/mock", proxy((req) => {
        return req["@origin"];
    }, {
        userResDecorator: (proxy_res, proxy_res_data, req, user_res) => {
            const safilename = toSafeFilename(req);
            fs.mkdirSync(path.dirname(safilename), {recursive: true});
            fs.writeFileSync(safilename, proxy_res_data);
            console.log("cached URL: "+req.method + " " + req.url);
            return proxy_res_data;
        },
    }));
}
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(400).send("404!");
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});