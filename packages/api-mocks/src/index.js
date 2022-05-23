// ok we're going to accept requests
// http://localhost:xxxx/https://[any url]
// and then we fetch the actual value and cache the result
// or, if run with --offline, we error 404

const express = require("express");
const proxy = require("express-http-proxy");
const path = require("path");
const fs = require("fs");
const decompress = require("brotli/decompress");

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
let passthrough_cache = new Map();
if(process.env.ONLINE === "true" || process.env.ONLINE === "passthrough") {
    app.use("/mock", (req, res, next) => {
        const urlv = toSafeFilename(req);
        const v = passthrough_cache.get(urlv);
        if(v != null) return res.send(v);
        return next();
    });
    app.use("/mock", proxy((req) => {
        return req["@origin"];
    }, {
        userResDecorator: (proxy_res, proxy_res_data, req, user_res) => {
            const safilename = toSafeFilename(req);
            fs.mkdirSync(path.dirname(safilename), {recursive: true});
            let nprdata = proxy_res_data;
            if(proxy_res.headers["content-encoding"] === "br") {
                nprdata = decompress(nprdata);
            }
            // TODO consider brotli compressing file content
            // - 386kb → 24kb for the reddit results
            if(process.env.ONLINE === "true") {
                fs.writeFileSync(safilename, nprdata, "binary");
                console.log("cached URL: "+req.method + " " + req.url);
            }
            if(process.env.ONLINE === "passthrough") {
                console.log("viewed URL: "+req.method + " " + req.url);
                passthrough_cache.set(safilename, nprdata);
            }
            return proxy_res_data;
        },
    }));
}
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("E_INTERNAL_SERVER_ERROR");
});
app.use((req, res, next) => {
    console.log("E_URL_NOT_CACHED: "+req.method + " " + req.url);
    res.status(404).send("E_404");
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});