import { StateObject, State, StateValue } from "./app_data";
import { UUID } from "./uuid";

export function isObject(v: StateValue): v is StateObject {
    return v != null && typeof v === "object";
}

export function asObject(v: StateValue): StateObject | null {
    return isObject(v) ? v : null;
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