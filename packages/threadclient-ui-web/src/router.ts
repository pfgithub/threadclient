
import { createSignal } from "solid-js";
import { ThreadClient } from "threadclient-client-base";
import { registerSW } from "virtual:pwa-register";
import { variables } from "virtual:_variables";
import { elButton, GlobalCounter, HistoryState, navigate, NavigationEntry, onNavigate, URLLike } from "./app";
import { getSettings } from "./util/utils_solid";

export let global_counter_info!: Map<string, GlobalCounter>;
export let alertarea: HTMLElement | undefined;
export let bodytop!: HTMLDivElement;
export let navbar: HTMLElement; 

export let nav_history!: NavigationEntry[];
export let session_name!: string;

export let client_cache!: {[key: string]: ThreadClient};

export let navigate_event_handlers!: ((url: URLLike) => void)[];
export let current_history_index!: number;

export let page2mainel!: HTMLElement;

export function setCurrentHistoryIndex(new_index: number): void {
    current_history_index = new_index;
}

export function main(): void {
    global_counter_info = new Map<string, GlobalCounter>();

    window.onpopstate = (ev: PopStateEvent) => {
        // onNavigate(ev?.state.index ?? 0);
        console.log("onpopstate. ev:",ev.state);
        const state = ev.state as HistoryState | undefined;
        if(state?.session_name !== session_name) {
            console.log("Going to history item from different session");
            onNavigate(0, location, undefined);
            return;
        }
        onNavigate(state?.index ?? 0, location, undefined);
    };
    
    client_cache = {};
    
    nav_history = [];
    session_name = "" + Math.random();
    
    navigate_event_handlers = [];
    
    current_history_index = 0;
    bodytop = el("div").adto(document.body);
    
    const pagever = getSettings().page_version.value();
    if(pagever === "1" || pagever === "2") {
        const frame = el("nav").clss("navbar", "bg-postcolor-100", "transition-opacity").adto(document.body);
        navbar = frame;
        // todo use style.top = xpx position absolute and then when fixed use top=0 fixed
    
        const navbar_button = ["px-2"];
    
        el("button").adto(frame).attr({'aria-label': "Back"}).atxt("←").clss(...navbar_button).onev("click", e => {
            e.stopPropagation();
            history.back();
        });
        el("button").adto(frame).attr({'aria-label': "Forward"}).atxt("→").clss(...navbar_button).onev("click", e => {
            e.stopPropagation();
            history.forward();
        });
    
        const nav_path = el("input").attr({'aria-label': "URL"}).adto(frame)
            .clss("bg-transparent text-center border border-gray-600 dark:border-gray-500")
        ;
    
        const nav_go = el("button").attr({'aria-label': "Go"}).clss(...navbar_button).atxt("⏎").adto(frame);
        const nav_reload = el("button").attr({'aria-label': "Reload"}).clss(...navbar_button).atxt("🗘").adto(frame);
    
        const go = () => navigate({path: "/"+nav_path.value.replace(/^\//, "")});
        nav_go.onclick = () => go();
        nav_path.onkeydown = k => k.key === "Enter" ? go() : 0;
    
        nav_reload.onclick = () => alert("TODO refresh");
    
        navigate_event_handlers.push(url => {
            if(url.pathname.toLowerCase().startsWith("/http://")
            || url.pathname.toLowerCase().startsWith("/https://")) {
                nav_path.value = (url.pathname + url.search).substr(1);
            }else{
                nav_path.value = url.pathname + url.search;
            }
        });
    
        let prev_scroll = window.scrollY;
        let resp = 0;
        // TODO:
        // on touch release, either transition resp to 0 or to 100
        document.addEventListener("scroll", e => {
            const this_scroll = window.scrollY;
            const diff = this_scroll - prev_scroll;
            prev_scroll = this_scroll;
    
            const max_resp = Math.max(0, Math.min(100, this_scroll));
    
            resp += diff;
            if(resp > max_resp) resp = max_resp;
            if(resp < 0) resp = 0;
            let navbar_h = resp;
    
            if(this_scroll < 0) navbar_h = -this_scroll;
    
            frame.style.setProperty("--mobile-transform", "translateY("+(-navbar_h)+"px)");
        }, {passive: false});
    
        // if(window.visualViewport) window.visualViewport.addEventListener("resize", () => {
        //     navbar.classList.toggle("opacity-0", window.visualViewport.scale > 1);
        // }); // fun but unnecessary
    }else{
        const frame = el("nav").adto(document.body);
        navbar = frame;
    }
    
    console.log("ThreadClient built on "+variables.build_time);

    page2mainel = el("div").adto(body);
    
    // MISSING:
    // availableForOfflineUse, setAvailableForOfflineUse
    // updateAvailable, setUpdateAvailable
    // updateSW

    history.replaceState({index: 0, session_name}, "ThreadClient",
        location.pathname + location.search + location.hash,
    );
    onNavigate(0, location, undefined);

    let drtime = 100;
    const rmdarkreader = () => {
        document.head.querySelector(".darkreader")?.remove();
        drtime *= 2;
        setTimeout(() => rmdarkreader(), drtime);
    };
    setTimeout(() => rmdarkreader(), 0);


    alertarea = el("div").adto(document.body).clss("alert-area");
}

const [availableForOfflineUse, setAvailableForOfflineUse] = createSignal(false);
const [updateAvailable, setUpdateAvailable] = createSignal(false);
export { availableForOfflineUse, updateAvailable };

export const updateSW = registerSW({
    onNeedRefresh() {
        console.log("An update to ThreadClient is available");
        setUpdateAvailable(true);
        const settings = getSettings();
        if(settings.update_notifications.value() === "on") {
            const alert = el("div").clss("alert").adto(alertarea!);
            el("div").clss("alert-body").adto(alert).atxt("An update to ThreadClient is available.");
            elButton("pill-empty").atxt("Ignore").adto(alert).onev("click", (e) => {
                e.stopPropagation();
                alert.remove();
            });
            alert.atxt(" ");
            elButton("pill-empty").atxt("Update (Refresh)").adto(alert).onev("click", (e) => {
                e.stopPropagation();
                void updateSW(true);
            });
        }
    },
    onOfflineReady() {
        console.log("Ready for offline use.");
        setAvailableForOfflineUse(true);
    },
});
console.log("updateSW", updateSW);
if(navigator.serviceWorker != null) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        if(registrations.every(registration => registration.active) && registrations.length !== 0) {
            setAvailableForOfflineUse(true);
        }
    }).catch(e => console.log("Error checking sw registrations", e));    
}

console.log("ROUTER.TS WAS RELOADED.", import.meta.hot);
// TODO show an error message
if(import.meta.hot) {
    console.log("...configuring router.ts as an hmr boundary");
    // import.meta.hot.decline();
    // technically the "right" thing to do is import.meta.hot.decline(); but I
    // don't want to accidentally refresh the page if I update router.ts. maybe
    // I should.
    //
    // I really hate it when hmr reloads your app pages. wish I could have an hmr
    // that never reloads app pages - at the most it shows a dialog saying "the
    // app is out of date. refresh."
    import.meta.hot.accept((new_mod: typeof import("./router")) => {
        console.log("ATTEMPT TO HOT RELOAD ROUTER.TSX", new_mod, alertarea);

        // don't want to bother with manually updating all the exports this has or
        // reinitializing stuff or whatever
        if(!alertarea || !global_counter_info) {
            throw new Error("attempt to update router.ts twice");
        }
        console.log(alertarea, global_counter_info);

        const alert = el("div").clss("alert").adto(alertarea);
        el("div").clss("alert-body").adto(alert).atxt("router.tsx does not support updating.");
        elButton("pill-empty").atxt("Ignore (Error)").adto(alert).onev("click", (e) => {
            e.stopPropagation();
            alert.remove();
        });
        alert.atxt(" ");
        elButton("pill-empty").atxt("Update (Refresh)").adto(alert).onev("click", (e) => {
            e.stopPropagation();
            void location.reload();
        });
    });
}


//