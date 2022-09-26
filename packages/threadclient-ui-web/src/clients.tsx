import type { ThreadClient } from "threadclient-client-base";
import { client_cache } from "./router";

const client_initializers: {[key: string]: () => Promise<ThreadClient>} = {
    faker: () => import("threadclient-client-faker").then(client => client.client),
    reddit: () => import("threadclient-client-reddit").then(client => client.client),
    mastodon: () =>  import("threadclient-client-mastodon").then(client => client.client),
    shell: () =>  import("threadclient-client-shell").then(client => client.client),
};
export async function fetchClient(name_any: string): Promise<ThreadClient | undefined> {
    const name = name_any.toLowerCase();
    const clientInitializer = client_initializers[name];
    if(!clientInitializer) return undefined;
    if(!client_cache[name]) client_cache[name] = await clientInitializer();
    if(client_cache[name]!.id !== name) throw new Error("client has incorrect id");
    return client_cache[name];
}
/**
 * @deprecated Use async fetchClient
 */
export function getClientCached(name: string): ThreadClient | undefined {
    return client_cache[name] ?? undefined;
}
