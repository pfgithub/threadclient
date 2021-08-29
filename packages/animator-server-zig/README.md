requires zig

```
cd deps
git clone https://github.com/Theldus/wsServer

zig build -Dtarget=x86_64-linux-musl
zig build -Dtarget=x86_64-macos
```

you can't build for windows right now because `pthread.h not found`

note: depends on gpl code
