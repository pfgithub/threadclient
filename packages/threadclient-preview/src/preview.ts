import * as Generic from "api-types-generic";
import { getVredditSources } from "threadclient-preview-vreddit";

function replaceExtension(path: string, ext: string): string {
    const split = path.split(".");
    split.pop();
    split.push(ext);
    return split.join(".");
}

function getVredditPreview(id: string): Generic.Video {
    const video: Generic.Video = {
        kind: "video",
        source: getVredditSources(id),
        gifv: false,
    };
    return video;
}

// TODO: let's reimplement this with page2 as getting a post that contains the Generic.Body
export const preview_sources: {[key: string]: (args: {
    url: URL | undefined,
    path: string,
    link: string,
    next: () => null | Generic.Body,
}) => null | Generic.Body} = {'image': ({url,  link, path, next}) => {
    // for safety, ideally these would be requested by a server. this is safe enough though.

    const is_mp4_link_masking_as_gif = url ? path.endsWith(".gif") && url.searchParams.get("format") === "mp4" : false;
    if(is_mp4_link_masking_as_gif) {
        return {kind: "video", gifv: true, source: {
            kind: "video",
            sources: [{url: link, quality: "Highest"}],
        }};
    }
    if((url?.hostname ?? "") === "i.imgur.com" && path.endsWith(".gif")
        || path.endsWith(".gifv")
    ) {
        return {kind: "video", gifv: true, source: {kind: "video", sources: [
            {url: replaceExtension(link, "webm"), quality: "Highest"},
            {url: replaceExtension(link, "mp4"), quality: "Highest"},
            {url: link, quality: "Highest"},
        ]}};
    }
    if((url?.hostname ?? "") === "i.redd.it"
        || path.endsWith(".png") || path.endsWith(".jpg")
        || path.endsWith(".jpeg")|| path.endsWith(".gif")
        || path.endsWith(".webp")|| (url?.hostname ?? "") === "pbs.twimg.com"
    ) return {kind: "captioned_image", url: link, w: null, h: null};

    if(path.endsWith(".mp4") || path.endsWith(".webm")) {
        return {kind: "video", gifv: false, source: {kind: "video", sources: [
            {url: link, quality: "Highest"},
        ]}};
    }
    if(path.endsWith(".mp3")) {
        return {kind: "audio", url: link};
    }

    return next();
}, 'vreddit': ({url, link, path, next}) => {
    if(link.startsWith("https://v.redd.it/")) return getVredditPreview(link.replace("https://v.redd.it/", ""));
    if(url && (url.host === "reddit.com" || url.host.endsWith(".reddit.com") && url.pathname.startsWith("/link"))) {
        const pathsplit = path.split("/");
        pathsplit.shift();
        // /link/:postname/video/:videoid/player
        if(pathsplit[0] === "link" && pathsplit[2] === "video" && pathsplit[4] === "player") {
            return getVredditPreview(pathsplit[3] ?? "");
        }
    }
    return next();
}, 'youtube': ({url, link, path, next}) => {
    if(url && (
        url.host === "www.youtube.com"
        || url.host === "youtube.com"
        || url.host === "m.youtube.com"
    ) && url.pathname === "/watch") {
        const ytvid_id = url.searchParams.get("v");
        if(ytvid_id != null) return {kind: "youtube", id: ytvid_id, search: url.searchParams.toString()};
    }
    if(url && (url.host === "youtu.be") && url.pathname.split("/").length === 2) {
        const youtube_video_id = url.pathname.split("/")[1] ?? "no_id";
        return {kind: "youtube", id: youtube_video_id, search: url.searchParams.toString()};
    }
    return next();
}, 'vocaroo': ({url, link, path, next}) => {
    if(url && (url.host === "vocaroo.com" || url.host === "www.vocaroo.com" || url.host === "voca.ro")) {
        const splitv = url.pathname.split("/").filter(q => q);
        if(splitv.length === 1 && splitv[0] != null && splitv[0] !== "") {
            return {kind: "audio", url: "https://media.vocaroo.com/mp3/"+splitv[0]};
        }
    }
    return next();
}, 'giphy': ({url, link, path, next}) => {
    if(url && (url.host === "giphy.com" || url.host === "www.giphy.com")) {
        const splitv = url.pathname.split("/").filter(q => q);
        if(splitv.length === 3 && splitv[0] === "gifs" && splitv[2] === "fullscreen") {
            const giphy_id_bits = splitv[1]!.split("-");
            const giphy_id = giphy_id_bits[giphy_id_bits.length - 1];
            return {kind: "video", source: {
                kind: "video",
                sources: [
                    {
                        url: "https://media4.giphy.com/media/"+giphy_id+"/giphy.mp4",
                        quality: "Highest",
                    },
                ],
            }, gifv: true};
        }
    }
    return next();
}, 'imgur': ({url, link, path, next}) => {
    if(url && (url.host === "www.imgur.com" || url.host === "imgur.com" || url.host === "m.imgur.com")) {
        const splitv = url.pathname.split("/").filter(q => q);
        const galleryid = splitv[1]!;
        const isv = splitv[0] === "gallery" ? "gallery" : splitv[0] === "a" ? "album" : undefined;
        if(isv !== undefined && splitv.length === 2) {
            return {
                kind: "imgur",
                imgur_id: galleryid,
                imgur_kind: isv,
            };
        }
        if(splitv.length === 1 && (splitv[0] ?? "").length > 4) {
            return {
                kind: "captioned_image",
                url: "https://i.imgur.com/"+splitv[0]+".jpg",
                w: null,
                h: null,
            };
        }
    }
    return next();
}, 'twitch': ({url, link, path, next}) => {
    if(url && url.host === "clips.twitch.tv" && url.pathname.split("/").filter(q => q).length === 1) {
        const clipid = url.pathname.split("/").filter(q => q)[0];
        if(clipid != null) return {
            kind: "twitch_clip",
            slug: clipid,
        };
    }
    return next();
}, 'soundcloud': ({url, link, path, next}) => {
    if(url && (url.host === "soundcloud.com" || url.host.endsWith(".soundcloud.com"))) return {
        kind: "oembed",
        client_id: "n/a",
        url: "https://soundcloud.com/oembed?format=json&url="+encodeURIComponent(link),
    };
    return next();
}, 'tiktok': ({url, link, path, next}) => {
    if(url && (url.host === "tiktok.com" || url.host.endsWith(".tiktok.com"))) return {
        kind: "oembed",
        client_id: "n/a",
        url: "https://www.tiktok.com/oembed?url="+encodeURIComponent(link),
    };
    return next();
}};

export function previewLink(
    link: string,
    opts: {suggested_embed?: undefined | string},
): undefined | Generic.Body {
    let url_mut: URL | undefined;
    try {
        url_mut = new URL(link);
    }catch(e) {
        // ignore
    }
    const url = url_mut;
    const path = url?.pathname ?? link;

    // TODO: we should update this
    // - it should be easy to specify a handler for a given:
    //   - domain eg `*.reddit.com`
    //   - domain list eg `www.imgur.com | imgur.com | m.imgur.com`

    const sources = Object.values(preview_sources);
    const execSource = (i: number): null | Generic.Body => {
        const src = sources[i];
        if(!src) return final();
        return src({url, link, path, next: () => execSource(i + 1)});
    };

    const final = (): null | Generic.Body => {
        if(opts.suggested_embed != null) return {
            kind: "reddit_suggested_embed",
            suggested_embed: opts.suggested_embed,
        };
        return null;
    };

    return execSource(0) ?? undefined;
}
