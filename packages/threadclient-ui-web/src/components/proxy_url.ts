export default function proxyURL(url: string): string {
    const use_mock = localStorage.getItem("--use-mock");
    if(url.startsWith("http"/*s?://*/) && use_mock != null) {
        return use_mock + url.replace(":/", "");
    }
    return url;
}