declare module "_variables" {
    export let version: string;
    export type LogEntry = {
        hash: string,
        hash_full: string,
        author_name: string,
        author_email: string,
        date: `${number}`, // new Date(+.date)
        commit_title: string,
        commit_body: string, // includes title
    };
    export let log: LogEntry[];
    export let build_time: number;
}