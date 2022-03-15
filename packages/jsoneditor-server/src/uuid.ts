import { generateUUID, UUID } from "tmeta-util";
import * as crypto from "crypto";

export type { UUID };

export function uuid(): UUID {
    return generateUUID(Date.now(), {
        readBytes: (u8a) => {
            const bytes = crypto.randomBytes(u8a.length);
            bytes.forEach((byte, i) => u8a[i] = byte);
        },
    });
}