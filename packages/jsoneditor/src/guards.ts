export function isObject(v: unknown): v is {[key: string]: unknown} {
    return v != null && typeof v === "object";
}

export function asObject(v: unknown): {[key: string]: unknown} | null {
    return isObject(v) ? v : null;
}

export function isString(v: unknown): v is string {
    return typeof v === "string";
}

export function asString(v: unknown): string | null {
    return isString(v) ? v : null;
}

export function unreachable(): never {
    throw new Error("Expected unreachable");
}