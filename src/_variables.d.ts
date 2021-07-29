declare module "virtual:_variables" {
    export type LogEntry = {
        hash: string,
        hash_full: string,
        author_name: string,
        author_email: string,
        date: `${number}`, // new Date(+.date)
        commit_title: string,
        commit_body: string, // includes title
    };
    export const variables: {
        version: string,
        log: LogEntry[],
        build_time: number,
        build_mode: "production" | "development" | "test",
    };
}