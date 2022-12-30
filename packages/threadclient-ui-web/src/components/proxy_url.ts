export default function proxyURL(url: string): string {
    // warning: this code is copy/pasted in multiple files
    // search and replace all versions
    const use_mock = localStorage.getItem("--use-mock");
    if(url.startsWith("http"/*s?://*/) && use_mock != null) {
        return use_mock + url.replace(":/", "");
    }
    return url;
}