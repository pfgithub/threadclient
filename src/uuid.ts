export type UUID = string & {__is_uuid: true};

/// generates a 22-24 character unique string
export function uuid(): UUID {
  return btoa([
    ...crypto.getRandomValues(new Uint8Array(16))
  ].map(byte =>
    String.fromCodePoint(byte)
  ).join("")).replaceAll("=", "") as UUID;
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