export type UUID = string & {__is_uuid: true};

/// generates a 16-character unique string (48 bytes utf-8)
export function uuid(): UUID {
  return [
    ...crypto.getRandomValues(new Uint8Array(16))
  ].map(byte => {
    // // btoa chars
    // return String.fromCodePoint(byte);
    // (make sure to call btoa on the joined output)

    // // latin characters with accents. may have normalization issues. 32 bytes utf-8.
    // return String.fromCodePoint(byte + 256);

    // // braille patterns 0..255. 48 bytes utf-8.
    // return String.fromCodePoint(byte + 10240);

    // yi syllables 0..255. 48 bytes utf-8.
    return String.fromCodePoint(byte + 40960);
  }).join("") as UUID;
}

// woah I need to look at uuidv5
// it seems like a way to generate unique consistent ids
// it's [base_uuid] + [text] = [new_uuid] which is exactly what I need
// that's basically a hash function isn't it
// wondering how secure it is then
// oh it uses sha-1…
// nvm
// oh wow. it's a choice between md5 and sha-1
// yeah don't use uuidv5 for user-inputted data