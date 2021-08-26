export type Item = {
    id: number,
    title?: undefined | string,
    points: number | null, // null if the item does not have points (eg a job)
    user: string | null, // null if the item does not have an author (eg a job)
    time: number, // sec since epoch
    // time_ago: string,

    type?: undefined | "link" | "ask" | "job", // note: the api will return `link` for `ask` responses sometimes.
    content?: undefined | string, // html, must be parsed and transformed. contains <p>, <a>, <pre><code>, …
    url: string, // eg `item?id=…` (no slash)
    domain?: undefined | string, // eg `twitter.com`

    comments?: undefined | Item[],
    comments_count?: undefined | number,
};

export type Page = Item | Item[];