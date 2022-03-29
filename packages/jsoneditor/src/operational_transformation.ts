export type Path = (string | number)[];

export type Primitive = string | number | boolean | null;

export type Op = {
    kind: "insert_before",
    path: Path,
    index: number,
} | {
    kind: "move",
    src: Path,
    dest: Path,
} | {
    kind: "set_primitive",
    path: Path,
    value: Primitive,
} | {
    kind: "delete",
    path: Path,
};

// we need client-local ui state somehow that tracks these nodes

// https://github.com/ottypes/json0

// here, just use that