```
cd packages/jsoneditor-server/
rethinkdb
```

create a database `jsoneditor` containing table `documents` primary key `id`

```
cd packages/jsoneditor-server/
../../node_modules/.bin/esno src/index.ts
```