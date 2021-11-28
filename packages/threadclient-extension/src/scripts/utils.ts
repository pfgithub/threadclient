import { resolve } from "path";
import { bgCyan, black } from "kolorist";

// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
export const port = parseInt(process.env['PORT'] || "") || 3303;
export const r = (...args: string[]): string => resolve(__dirname, "..", "..", ...args);
export const is_dev = process.env['NODE_ENV'] !== "production";

export function log(name: string, message: string): void {
    // eslint-disable-next-line no-console
    console.log(black(bgCyan(` ${name} `)), message);
}