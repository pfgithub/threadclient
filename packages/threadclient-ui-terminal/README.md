note: for running, use `./node_modules/.bin/esno .` directly because yarn
is unbearably slow

- literally two seconds w/ `yarn workspace … esno …`
- one second w/ `yarn esno …` directly from this folder
- 300㎳ with `./node_modules/.bin/esno` directly

`sh -c "cd packages/threadclient-ui-terminal && ./node_modules/.bin/esno ."`
