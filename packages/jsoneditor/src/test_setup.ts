// @ts-ignore
import { JSDOM } from "jsdom";
import { webcrypto } from "crypto";
global.window = new JSDOM();
(global.crypto as any) = webcrypto;