const std = @import("std");
const c = @cImport({
    @cInclude("ws.h");
});

// to make this "single-threaded":
var global_mutex = std.Thread.Mutex{};

fn onopen(fd: c_int) callconv(.C) void {
    const held = global_mutex.acquire();
    defer held.release();

    const addr = std.mem.spanZ(c.ws_getaddress(fd));
    defer std.heap.c_allocator.free(addr);

    std.log.info("{d}[{s}]: connected", .{ fd, addr });
}
fn onclose(fd: c_int) callconv(.C) void {
    const held = global_mutex.acquire();
    defer held.release();

    const addr = std.mem.spanZ(c.ws_getaddress(fd));
    defer std.heap.c_allocator.free(addr);

    std.log.info("{d}[{s}]: disconnected", .{ fd, addr });
}

fn onmessage(fd: c_int, message_any: [*c]const u8, size: u64, kind: c_int) callconv(.C) void {
    const held = global_mutex.acquire();
    defer held.release();

    const message = message_any[0..size];

    const addr = std.mem.spanZ(c.ws_getaddress(fd));
    defer std.heap.c_allocator.free(addr);

    // kind may be either c.WS_FR_OP_TXT or WS_FR_OP_BIN

    if (kind != c.WS_FR_OP_TXT) {
        std.log.info("{d}[{s}]: got invalid binary message", .{ fd, addr });
        return sendError(fd, null, "binary not allowed");
    }

    std.log.info("{d}[{s}]: message {d} `{s}`", .{ fd, addr, kind, message });

    var json_parser = std.json.Parser.init(std.heap.c_allocator, false);
    defer json_parser.deinit();
    var json_res = json_parser.parse(message) catch {
        return sendError(fd, null, "bad json");
    };
    defer json_res.deinit();

    const jh = JsonHelper{ .value = json_res.root };

    const id = jh.get("id").asInt() catch {
        return sendError(fd, null, "json missing .id : int");
    };
    const message_kind = jh.get("kind").asString() catch {
        return sendError(fd, id, "json missing .kind : int");
    };

    _ = message_kind;

    return sendError(fd, id, "TODO support messages");
}

fn sendJson(fd: c_int, json: [:0]const u8) !void {
    const res = c.ws_sendframe_txt(fd, json, false);
    if (res != 0) return error.UnknownError;
}

fn sendError(fd: c_int, message_id: ?i64, text: []const u8) void {
    // {id: number | null, kind: "error", message: string}
    std.log.info("{d}[??].{d}: responded with error `{s}`", .{ fd, message_id, text });
    const res = stringify(std.heap.c_allocator, .{
        .id = message_id,
        .kind = "error",
        .message = text,
    });
    defer std.heap.c_allocator.free(res);
    sendJson(fd, res) catch {
        _ = c.ws_close_client(fd);
    };
}

fn stringify(alloc: *std.mem.Allocator, value: anytype) [:0]const u8 {
    var res = std.ArrayList(u8).init(alloc);
    std.json.stringify(value, .{}, res.writer()) catch @panic("oom");
    res.append(0) catch @panic("oom");
    const len = res.items.len;
    return res.toOwnedSlice()[0 .. len - 1 :0];
}

const JsonHelper = struct {
    value: ?std.json.Value,

    pub fn subvalue(_: JsonHelper, value: ?std.json.Value) JsonHelper {
        return JsonHelper{ .value = value };
    }

    pub fn get(jh: JsonHelper, field: []const u8) JsonHelper {
        return switch (jh.value orelse return jh.subvalue(null)) {
            .Object => |obj| jh.subvalue(obj.get(field)),
            else => jh.subvalue(null),
        };
    }
    pub fn asOptString(jh: JsonHelper) !?[]const u8 {
        return switch (jh.value orelse return null) {
            .String => |str| return str,
            else => return error.BadJSON,
        };
    }
    pub fn asString(jh: JsonHelper) ![]const u8 {
        return (try jh.asOptString()) orelse return error.BadJSON;
    }
    pub fn asInt(jh: JsonHelper) !i64 {
        return switch (jh.value orelse return error.BadJSON) {
            .Integer => |int| return int,
            else => return error.BadJSON,
        };
    }
    pub fn asEnum(jh: JsonHelper, comptime Enum: type) !Enum {
        return std.meta.stringToEnum(Enum, try jh.asString()) orelse return error.BadJSON;
    }
    // I'd rather use non-exhaustive enums so this can be done in asEnum but unfortunately "non-exhaustive enum must specify size"
    pub fn asEnumDefaulted(jh: JsonHelper, comptime Enum: type, default: Enum) !Enum {
        return std.meta.stringToEnum(Enum, try jh.asString()) orelse return default;
    }
    fn ReturnValueType(comptime fnc: anytype) type {
        return @typeInfo(@typeInfo(@TypeOf(fnc)).Fn.return_type orelse unreachable).ErrorUnion.payload;
    }
    pub fn exists(jh: JsonHelper) bool {
        return jh.value != null and jh.value.? != .Null;
    }
    pub fn asBoolOpt(jh: JsonHelper) !?bool {
        return switch (jh.value orelse return null) {
            .Bool => |v| v,
            else => return error.BadJSON,
        };
    }
};

pub fn main() anyerror!void {
    var events: c.ws_events = .{
        .onopen = onopen,
        .onclose = onclose,
        .onmessage = onmessage,
    };
    const port = 3018;

    std.log.info("Starting websocket server at :{d}…", .{port});
    const rt = c.ws_socket(&events, port, 0);
    std.log.info("Server exited. {d}", .{rt});
}
