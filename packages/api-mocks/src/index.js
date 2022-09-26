//use it
const CachingProxy = require("caching-proxy");

const proxy = new CachingProxy({
    port: 9090, 
    dir: "./data/cached-data",
});

() => proxy;