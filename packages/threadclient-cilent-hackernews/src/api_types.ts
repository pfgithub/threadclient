export type Item = {
    id: number,
    deleted?: boolean,
    type: "job" | "story" | "comment" | "poll" | "pollopt" | "unsupported",
    by?: string,
    time?: number, // seconds since epoch
    text?: string, // html
    dead?: boolean,
    parent?: number, // id of parent
    poll?: number, // for a pollopt, id of the poll
    kids?: number[], // ordered children
    url?: string,
    score?: number, // score for 'story', or votes for 'pollopt'
    title?: string, // for 'story', 'poll', or 'job'. html.
    parts?: number[], // pollopt ids for a poll
    descendants?: number, // comment count for a story or poll
};
export type User = {
    id: string,
    created: number,
    karma: number,
    about?: string, // html
    submitted?: number[],
};
export type Listing = number[];
export type Updates = {
    items: number[],
    profiles: string[],
};

export type RequestInfo = {
    body?: never | {[key: string]: string | undefined},
    response: unknown,
    query?: never | {[key: string]: string | null | undefined},
};
export type IsRequest<T extends RequestInfo> = T;
export type PathBit<T extends string = string> = `«ENCODED_${T}»`;

export type Requests = {
    [key: `/v0/item/${PathBit}`]: IsRequest<{response: Item}>,
    [key: `/v0/user/${PathBit}`]: IsRequest<{response: User}>,

    "/v0/maxitem": IsRequest<{response: number}>,
    [key: `/v0/${PathBit}`]: IsRequest<{response: Listing}>,
    "/v0/updates": IsRequest<{response: Updates}>,
};

export type ListingType = "topstories" | "newstories" | "beststories" | "askstories" | "showstories" | "jobstories";