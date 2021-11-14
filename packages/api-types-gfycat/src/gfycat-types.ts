export declare namespace V1 {
    // types for the v1 api

    // `<api_root>/v1/gfycats/<slug>`
    export type GfyContentUrl = {
        url: string,
        size: number,
        width: number,
        height: number,
    };
    export type GfySuccessResponse = {
        gfyItem: {
            avgColor: string,
            content_urls: {
                // thumbnails
                poster: GfyContentUrl,
                mobilePoster: GfyContentUrl,

                // gifs
                max1mbGif?: undefined | GfyContentUrl,
                max2mbGif?: undefined | GfyContentUrl,
                max5mbGif?: undefined | GfyContentUrl,
                
                // videos
                mp4?: undefined | GfyContentUrl,
                mobile?: undefined | GfyContentUrl,
                webm?: undefined | GfyContentUrl,
                webp?: undefined | GfyContentUrl,
            },
            createDate: number,
            description?: undefined | string,
            title?: undefined | string,
            width: number,
            height: number,

            mobileUrl?: undefined | string,
            webmUrl?: undefined | string,
            webpUrl?: undefined | string,
            mp4Url?: undefined | string,
        },
    };
    export type GfyErrorResponse = {
        errorMessage: string,
    } | {
        message: string,
    };
    export type GfyResponse = GfySuccessResponse | GfyErrorResponse;
}

export declare namespace V2 {
    // types for the v2 api

    // `<api_root>/v2/gifs/<slug>`
    export type GfySuccessResponse = {
        gif: {
            id: string, // slug
            createDate: number, // sec since epoch
            hasAudio: boolean,

            width: number,
            height: number,
            likes: number,

            // display these in-ui with links to /browse?tags=Tag Name
            tags: string[],

            verified: boolean,
            views: number,
            duration: number, // sec
            published: boolean,

            urls: {
                sd: string,
                hd: string,
                gif: string,
                poster: string, // image
                thumbnail: string, // image
                vthumbnail: string, // same as sd video? not sure why this exists
            },

            userName: null | string,
            type: 1 | "unsupported",
            avgColor: string, // show this before poster before the actual video
            gallery: null | "unsupported",
        },
        user: null | {
            creationtime: number, // sec since epoch
            followers: number,
            following: number,
            gifs: number,
            name: string,
            profileImageUrl: string,
            profileUrl: string, // display in-ui with an external link to /users/Username
            publishedGifs: number,
            subscription: 0,
            url: string,
            username: string,
            verified: boolean,
            views: number,
        },
    };
    export type GfyErrorResponse = {
        logged: boolean,
        reported: boolean,
    } & ({
        errorMessage: {
            code: string,
            description: string,
        },
    } | {
        message: string,
    });

    export type GfyResponse = GfySuccessResponse | GfyErrorResponse;
}

// note: gfy gifs should be rendered as page2 posts I think
