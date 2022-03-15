import { generateUUID, UUID } from "tmeta-util";

export type { UUID };

export function uuid(): UUID {
    return generateUUID(Date.now(), {
        readBytes: (u8a) => crypto.getRandomValues(u8a),
    });
}