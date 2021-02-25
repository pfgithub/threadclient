(() => {
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    console.log("dark mode: ", scheme.matches);
    document.documentElement.classList.toggle("dark", scheme.matches);
    scheme.addEventListener("change", e => {
        console.log("color scheme change", e.matches);
        updateColorScheme();
    });
    function updateColorScheme() {
        const [lsitem, resv] = getColorScheme();
        document.documentElement.classList.toggle("dark", lsitem === "system" ? resv : lsitem === "dark");
        on_cs_change.forEach(cb => cb(lsitem, resv));
    }
    let on_cs_change = [];
    let prev_ls_v = localStorage.getItem("color-scheme");
    window.addEventListener("storage", () => {
        const new_ls_v = localStorage.getItem("color-scheme");
        if(prev_ls_v !== new_ls_v) updateColorScheme();
    });
    window.getColorScheme = (callback) => {
        const lsitem = localStorage.getItem("color-scheme");

        const match_res = window.matchMedia("(prefers-color-scheme: dark)");
        const system = match_res.matches;

        const setting = lsitem === "light" ? "light" : lsitem === "dark" ? "dark" : "system";

        return [setting, system];
    };
    window.onColorSchemeChange = (callback) => {
        on_cs_change.push(callback);
        return () => on_cs_change = on_cs_change.splice(on_cs_change.indexOf(callback), 1);
    };
    window.setColorScheme = (new_scheme) => {
        if(new_scheme === "light" || new_scheme === "dark") {
            prev_ls_v = new_scheme;
            localStorage.setItem("color-scheme", new_scheme);
        }else{
            prev_ls_v = null;
            localStorage.removeItem("color-scheme");
        }
        updateColorScheme();
    };
})();