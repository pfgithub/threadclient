console.log("env loaded");

const forbidden_protocols = [
    "chrome-extension://",
    "chrome-search://",
    "chrome://",
    "devtools://",
    "edge://",
    "https://chrome.google.com/webstore",
    // also the mozilla extensions page
];

// why do we have this function? can't the browser just tell us
// when we try to do something on a forbidden url?
export function isForbiddenUrl(url: string): boolean {
    return forbidden_protocols.some(protocol => url.startsWith(protocol));
}

export const is_firefox = navigator.userAgent.includes("Firefox");