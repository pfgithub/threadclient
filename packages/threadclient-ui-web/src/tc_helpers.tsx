import type * as Generic from "api-types-generic";
import { rt } from "api-types-generic";
import { assertNever, escapeHTML } from "tmeta-util";
import { scoreToString } from "./components/InfoBar";
import { dynamicLoader, hideshow, HideShowCleanup } from "./page1";
import { global_counter_info } from "./router";

export function isModifiedEvent(event: MouseEvent): boolean {
    return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

export type SafelinkLink = {kind: "link", url: string, external: boolean};
export function unsafeLinkToSafeLink(client_id: string, href: string): (
    | {kind: "error", title: string}
    | {kind: "mailto", title: string}
    | SafelinkLink
) {
    // TODO get this to support links like https://….reddit.com/… and turn them into SPA links
    if(href.startsWith("/") && client_id) {
        href = "/"+client_id+href;
    }
    if(href.startsWith("mailto:")) {
        return {kind: "mailto", title: href.replace("mailto:", "")};
    }
    let is_raw = false;
    if(href.startsWith("raw!")) {
        href = href.replace("raw!", "");
        is_raw = true;
    }
    if(!href.startsWith("http") && !href.startsWith("/")) {
        return {kind: "error", title: href};
    }
    // consider just returning "#https://www.reddit.com/" instead of having this url replacement logic
    let urlparsed: URL | undefined;
    try {
        urlparsed = new URL(href);
    }catch(e) {
        urlparsed = undefined;
    }
    if(urlparsed && !is_raw && (urlparsed.host === "reddit.com" || urlparsed.host.endsWith(".reddit.com"))) {
        if(urlparsed.host === "mod.reddit.com") {
            href = "/reddit/mod"+urlparsed.pathname+urlparsed.search+urlparsed.hash;
        }else{
            href = "/reddit"+urlparsed.pathname+urlparsed.search+urlparsed.hash;
        }
    }
    if(urlparsed && !is_raw && (urlparsed.host === "redd.it")) {
        href = "/reddit/comments"+urlparsed.pathname+urlparsed.search+urlparsed.hash;
    }

    if(href.startsWith("/")) return {kind: "link", url: href.replace("/", "#"), external: false};
    return {kind: "link", url: href, external: true};
}

type RedditMarkdownRenderer = {
    renderMd(text: string): string & {_is_safe: true},
};

export const getRedditMarkdownRenderer = dynamicLoader(async (): Promise<RedditMarkdownRenderer> => {
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const exports = await (await import("./snudown.wasm")).default<{
        memory: WebAssembly.Memory,

        // (len: usize) => [*]u8
        //   creates a u8 array of specified length
        allocString: (len: number) => number,

        // (ptr: [*]u8, len: usize)
        //   frees a u8 array of specified length
        freeText: (ptr: number, len: number) => void,

        // (strptr: [*]u8, len: usize) => [*:0]u8 (caller must free!)
        //   converts markdown to html. panics on oom. returns
        //   a null-terminated utf-8 string the caller must free.
        markdownToHTML: (strptr: number, len: number) => number,

        // (strptr: [*:0]u8) => usize
        //   gets the byte length of a null-terminated string.
        strlen: (strptr: number) => number,
    }>({
        env: {
            __assert_fail: (assertion: number, file: number, line: number, fn: number) => {
                console.log(assertion, file, line, fn);
                throw new Error("assert failed");
            },
            __stack_chk_fail: () => {
                throw new Error("stack overflow");
            },
            debugprints: (text: number, len: number) => {
                console.log("print text:",dec.decode(new Uint8Array(exports.memory.buffer, text, len)));
            },
            debugprinti: (intv: number) => {
                console.log("print int:", intv);
            },
            debugprintc: (intv: number) => {
                console.log("print char:", String.fromCodePoint(intv));
            },
            debugpanic: (text: number, len: number) => {
                throw new Error("Panic: "+ dec.decode(new Uint8Array(exports.memory.buffer, text, len)));
            }
        },
    });
    return {renderMd(md: string) {
        try{
            const utf8 = enc.encode(md);
            const strptr = exports.allocString(utf8.byteLength);
            const inmem = new Uint8Array(exports.memory.buffer, strptr, utf8.byteLength);
            inmem.set(utf8);
            const res = exports.markdownToHTML(strptr, utf8.byteLength);
            const outlen = exports.strlen(res);
            const outarr = new Uint8Array(exports.memory.buffer, res, outlen);
            const decoded = dec.decode(outarr);
            exports.freeText(strptr, utf8.byteLength);
            exports.freeText(res, outlen);
            return decoded as string & {_is_safe: true};
        }catch(er){
            const e = er as Error;
            // note that chrome sometimes crashes on wasm errors and this
            // handler might not run.
            console.log(e.toString() + "\n" + e.stack);
            return escapeHTML("Error "+e.toString()+"\n"+e.stack) as string & {_is_safe: true};
        }
    }};
});


export async function textToBody(body: Generic.BodyText): Promise<Generic.Body> {
    const content = body.content;
    if(body.markdown_format === "reddit") {
        const [mdr, htr] = await Promise.all([
            getRedditMarkdownRenderer(),
            import("threadclient-client-reddit/src/html_to_richtext"),
        ]);
        const safe_html = mdr.renderMd(content);
        return {kind: "richtext", content: htr.parseContentHTML(safe_html, body.client_id)};
    }else if(body.markdown_format === "none") {
        return {kind: "richtext", content: [rt.p(rt.txt(content))]};
    }else if(body.markdown_format === "reddit_html") {
        const htr = await import("threadclient-client-reddit/src/html_to_richtext");
        console.log(content);
        return {kind: "richtext", content: htr.parseContentHTML(content, body.client_id)};
    }else assertNever(body.markdown_format);
}


// what if eventually stuff like this returned a Generic.Thread or something
// and it was displayed like a crosspost
// that could be interesting maybe
export async function getTwitchClip(
    clipid: string,
): Promise<Generic.Body> {
    function gqlRequest(operation: string, hash: string, gql_vars: unknown) {
        return {
            extensions: {persistedQuery: {sha256Hash: hash, version: 1}},
            operationName: operation,
            variables: gql_vars,
        };
    }

    const res_untyped: unknown = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: {
            'Content-Type': "application/json",
            'Accept': "application/json",
            'Client-Id': "kimne78kx3ncx6brgo4mv6wki5h1ko",
        },
        body: JSON.stringify([
            gqlRequest("VideoAccessToken_Clip",
                "36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11",
                {slug: clipid}
            ),
            gqlRequest("ClipsChatCard",
                "94c1c7d97d860722a5b7ef3c3b3de3783b37fc32d69bcccc8ea0cda372cf1f01",
                {slug: clipid}
            ),
            gqlRequest("ClipsBroadcasterInfo", // 9
                "ce258d9536360736605b42db697b3636e750fdb14ff0a7da8c7225bdc2c07e8a",
                {slug: clipid}
            ),
            gqlRequest("ClipsTitle", // 12
                "f6cca7f2fdfbfc2cecea0c88452500dae569191e58a265f97711f8f2a838f5b4",
                {slug: clipid}
            ),
            gqlRequest("ClipsCurator", // 13
                "769e99d9ac3f68e53c63dd902807cc9fbea63dace36c81643d776bcb120902e2",
                {slug: clipid}
            ),
            gqlRequest("ClipsFullVideoButton", // 14
                "d519a5a70419d97a3523be18fe6be81eeb93429e0a41c3baa9441fc3b1dffebf",
                {slug: clipid}
            ),
        ]),
    }).then(r => r.json());
    console.log(res_untyped);
    const [video, chat_card, broadcaster_info, title, curator, full_video_btn] = res_untyped as [
        video: {data: {clip: null | {
            id: string,
            playbackAccessToken: {
                signature: string,
                value: string,
            },
            videoQualities: {
                frameRate: number,
                quality: "360" | "480" | "720" | "unsupported",
                sourceURL: string,
            }[],
        }}},
        chat_card: {data: {clip: {
            id: string,
            videoOffsetSeconds: number,
            createdAt: string,
            curator: {id: string, login: string},
            video: {id: string, login: string},
        }}},
        broadcaster_info: {data: {clip: {
            id: string,
            game: {name: string, displayName: string},
            broadcaster: {
                id: string,
                profileImageURL: string,
                displayName: string,
                login: string,
                stream: null,
            },
        }}},
        title: {data: {clip: {
            id: string,
            title: string,
        }}},
        curator: {data: {clip: {
            id: string,
            curator: {id: string, displayName: string, login: string},
        }}},
        full_video_btn: {data: {clip: {
            id: string,
            videoOffsetSeconds: number,
            durationSeconds: number,
            title: string,
            broadcaster: {id: string, login: string},
            video: {id: string, broadcastType: "ARCHIVE" | "unsupported"},
            game: {id: string, displayName: string},
        }}},
    ];
    if(!video.data.clip) {
        return {
            kind: "richtext",
            content: [
                rt.p(rt.txt("The clip could not be found."))
            ],
        };
    }

    () => [chat_card, broadcaster_info, curator, full_video_btn];

    return {
        kind: "video",
        source: {
            kind: "video",
            sources: video.data.clip.videoQualities.map(quality => {
                return {url: quality.sourceURL
                    + "?sig="+encodeURIComponent(video.data.clip!.playbackAccessToken.signature)
                    + "&token="+encodeURIComponent(video.data.clip!.playbackAccessToken.value),
                    quality: quality.quality+"p",
                };
            }),
        },
        caption: title.data.clip.title,
        gifv: false,
    };

    // TODO ClipsChatReplay 05bb2716e4760d4c5fc03111a5afe9b0ab69fc875e9b65ea8a63bbc34d5af21d
    // variables:
    // - slug,
    // - videoOffsetSeconds,
    // → something that gives a cursor
    // then
    // ClipsChatReplay 05bb2716e4760d4c5fc03111a5afe9b0ab69fc875e9b65ea8a63bbc34d5af21d
    // variables:
    // - slug,
    // - cursor,
    // → the chat messages
}


export type CounterState = {
    loading: boolean,
    pt_count: number | "hidden" | "none",
    your_vote: "increment" | "decrement" | undefined,
};
export type GlobalCounter = {
    state: CounterState,
    handlers: Set<() => void>,
    users: number,
    update_time: number,
};
export type WatchableCounterState = {
    state: CounterState,
    emit: () => void,
    onupdate: (cb: () => void) => void,
};

export function watchCounterState(
    counter_id_raw: string | null,
    updates: {count: number | "hidden" | "none", you: "increment" | "decrement" | undefined, time: number},
): HideShowCleanup<WatchableCounterState> {
    const counter_id = counter_id_raw ?? `${Math.random()}`;
    const global_state: GlobalCounter = global_counter_info.get(counter_id) ?? {
        state: {
            loading: false,
            pt_count: updates.count,
            your_vote: updates.you, 
        },
        handlers: new Set(),
        users: 0,
        update_time: updates.time,
    };
    if(!global_counter_info.has(counter_id)) global_counter_info.set(counter_id, global_state);
    if(global_state.update_time < updates.time) {
        global_state.state.pt_count = updates.count;
        global_state.state.your_vote = updates.you;
    }
    const res: WatchableCounterState = {
        state: global_state.state,
        emit() {
            // [...] is used because Set forEach will loop forever if you
            // add a new item to the set during the loop.
            [...global_state.handlers].forEach(handler => {
                handler();
            });
        },
        onupdate(cb) {
            const uniqueCallback = () => {
                cb();
                // consider only firing cb when hsc is visible? and if it's hidden, batch it for when it becomes visible again?
                // probably not an issue currently
            };
            global_state.handlers.add(uniqueCallback);
            hsc.on("cleanup", () => {
                global_state.handlers.delete(uniqueCallback);
            });
        },
    };
    const hsc = hideshow(res);
    global_state.users++;
    hsc.on("cleanup", () => {
        global_state.users--;
    });
    return hsc;
}

export function getPointsText(state: CounterState): {text: string, raw: string} {
    if(state.pt_count === "hidden" || state.pt_count === "none") return {text: "—", raw: "[score hidden]"};
    const score_mut = state.pt_count + (
        state.your_vote === "increment" ? 1 : state.your_vote === "decrement" ? -1 : 0
    );
    return {text: scoreToString(score_mut), raw: score_mut.toLocaleString()};
}
