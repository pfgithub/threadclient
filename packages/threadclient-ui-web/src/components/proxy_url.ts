export default function proxyURL(url: string): string {
    if(!url.startsWith("/")) return (localStorage.getItem("--use-mock") ?? "") + url;
    return url;
}