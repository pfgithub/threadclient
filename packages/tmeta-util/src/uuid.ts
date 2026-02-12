// https://github.com/firebase/firebase-js-sdk/blob/master/packages/database/src/core/util/NextPushId.ts
// modified to:
// - use a crypto random bytes function instead of Math.random()

// Modeled after base64 web-safe chars, but ordered by ASCII.
const push_chars = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

function assert(cond: boolean, msg: string): void {
    if(!cond) throw new Error(msg);
}

export type UUID = string & {__is_uuid: true};

export type RandSource = {
    readBytes: (write_to: Uint8Array) => void,
};

/**
 * Fancy ID generator that creates 20-character string identifiers with the
 * following properties:
 *
 * 1. They're based on timestamp so that they sort *after* any existing ids.
 * 2. They contain 72-bits of random data after the timestamp so that IDs won't
 *    collide with other clients' IDs.
 * 3. They sort *lexicographically* (so the timestamp is converted to characters
 *    that will sort properly).
 * 4. They're monotonically increasing. Even if you generate more than one in
 *    the same timestamp, the latter ones will sort after the former ones. We do
 *    this by using the previous random bits but "incrementing" them by 1 (only
 *    in the case of a timestamp collision).
 */
export const generateUUID = (() => {
    // Timestamp of last push, used to prevent local collisions if you push twice
    // in one ms.
    let last_push_time = 0;

    // We generate 72-bits of randomness which get turned into 12 characters and
    // appended to the timestamp to prevent collisions with other clients. We
    // store the last characters we generated because in the event of a collision,
    // we'll use those same characters except "incremented" by one.
    const last_rand_chars: number[] = [];

    return (now: number, rand_soruce: RandSource): UUID => {
        const duplicate_time = now === last_push_time;
        last_push_time = now;

        const timestamp_chars = new Array(8);
        for (let i = 7; i >= 0; i--) {
            timestamp_chars[i] = push_chars.charAt(now % 64);
            // NOTE: Can't use << here because javascript will convert to i32 and lose
            // the upper bits.
            now = Math.floor(now / 64);
        }
        assert(now === 0, "Cannot push at time == 0");

        let id = timestamp_chars.join("");

        if (!duplicate_time) {
            const bytes = new Uint8Array(12);
            rand_soruce.readBytes(bytes);

            for (let i = 0; i < 12; i++) {
                last_rand_chars[i] = bytes[i]! % 64; // don't want to bother with
                // doing this properly and reading 6 bits at a time from a 9 item
                // uint8array
            }
        } else {
            // If the timestamp hasn't changed since last push, use the same random
            // number, except incremented by 1.
            let i;
            for (i = 11; i >= 0 && last_rand_chars[i] === 63; i--) {
                last_rand_chars[i] = 0;
            }
            last_rand_chars[i]!++;
        }
        for (let i = 0; i < 12; i++) {
            id += push_chars.charAt(last_rand_chars[i]!);
        }
        assert(id.length === 20, "nextPushId: Length should be 20.");

        return id as UUID;
    };
})();
