```
cd packages/jsoneditor-server/
rethinkdb
```

create a database `jsoneditor`

- create a table `documents` primary key `id`
- create a table `actions` primary key `id`
- create a table `snapshots` primary key `id`

```
cd packages/jsoneditor-server/
../../node_modules/.bin/esno src/index.ts
```