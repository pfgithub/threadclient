import type * as Generic from "api-types-generic";

export function getVredditSources(id: string): Generic.VideoSource {
    const link = "https://v.redd.it/"+id;
    return {
        kind: "video",
        sources: [
            {url: link+"/DASHPlaylist.mpd"},
            {url: link+"/HLSPlaylist.m3u8"},
        ],
        preview: [
            {url: link+"/DASH_96.mp4", type: "video/mp4"},
            {url: link+"/DASH_96", type: "video/mp4"},
        ],
    };
}