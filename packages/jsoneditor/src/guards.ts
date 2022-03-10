import { ScObject, StateValue } from "./app_data";
import { Include } from "./util";

export function isObject(v: StateValue): v is ScObject {
    return v != null && typeof v === "object";
}

export function asObject(v: StateValue): ScObject | null {
    return isObject(v) ? v : null;
}

export function isObject2(v: unknown): v is {[key: string]: unknown} {
    return v != null && typeof v === "object";
}

export function asObject2(v: unknown): {[key: string]: unknown} | null {
    return isObject2(v) ? v : null;
}

export function isString(v: StateValue): v is string {
    return typeof v === "string";
}

export function asString(v: StateValue): string | null {
    return isString(v) ? v : null;
}

export function unreachable(): never {
    throw new Error("Expected unreachable");
}