// @ts-ignore
import { JSDOM } from "jsdom";
import { webcrypto } from "crypto";
global.window = (new (JSDOM as {
    new(): typeof window,
})());
(global.crypto as any) = webcrypto;