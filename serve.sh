#!/bin/sh
mkdir -p dist/
cp zig-cache/lib/app.wasm dist/
cp src/index.html dist/
cp src/zigdom.js dist/
serve dist/ -n