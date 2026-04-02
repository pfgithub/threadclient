
import { createSignal } from "solid-js";
import { ThreadClient } from "threadclient-client-base";
import { generateUUID, UUID } from "tmeta-util";
import { registerSW } from "virtual:pwa-register";
import { variables } from "virtual:_variables";
import { current_version, renderChangelogBannerIfNeeded } from "./components/changelog_manager";
import { elButton } from "./page1";
import { HistoryState, navigate, NavigationEntry, onNavigate, startDebugTool, URLLike } from "./page1_routing";
import { GlobalCounter } from "./tc_helpers";
import { getSettings } from "./util/utils_solid";

export let rootel!: HTMLElement;

export let global_counter_info!: Map<string, GlobalCounter>;
export let alertarea: HTMLElement | undefined;
export let bodytop!: HTMLDivElement;
export let navbar: HTMLElement; 

export let nav_history_map: Map<UUID, NavigationEntry>;
export let current_nav_history_key!: UUID;

export let client_cache!: {[key: string]: ThreadClient}; // what's this for? can't we just import() every time?
// that should cache for us right?

export let navigate_event_handlers!: ((url: URLLike) => void)[];

export let page2mainel!: HTMLElement;

export function uuid(): UUID {
    return generateUUID(Date.now(), {
        readBytes: (u8a) => crypto.getRandomValues(u8a),
    });
}
console.log("here's a uuid:", uuid());

export function setCurrentHistoryKey(new_key: UUID): void {
    current_nav_history_key = new_key;
}

export function fixURL(): void {
    if(location.hash === "") {
        const dupe = new URL(
            location.origin + "/#"
            + ((location.pathname.replace("/", "")
            + location.search
            + location.hash) || "/"),
        );
        history.replaceState(history.state, "", dupe);
    }
}

export function main(): void {
    const bannerarea = document.createElement("div").adto(document.body);
    rootel = document.createElement("threadclient");
    document.body.appendChild(rootel);

    global_counter_info = new Map<string, GlobalCounter>();

    fixURL();

    window.onpopstate = (ev: PopStateEvent) => {
        fixURL();

        // onNavigate(ev?.state.index ?? 0);
        const state = ev.state as HistoryState | undefined;
        const newkey = state?.key ?? uuid();
        if(newkey !== state?.key) {
            const newstate: HistoryState = {key: newkey};
            history.replaceState(newstate, "", location.href);
        }
        onNavigate(newkey, location, undefined);
    };
    
    client_cache = {};
    
    nav_history_map = new Map();
    
    navigate_event_handlers = [];
    
    current_nav_history_key = uuid();
    bodytop = el("div").adto(rootel);
    
    if(
        (navigator as unknown as {standalone: boolean}).standalone
        || window.matchMedia("(display-mode: standalone)").matches
    ) {
        const frame = el("nav").clss("navbar", "bg-slate-100 dark:bg-zinc-800", "transition-opacity").adto(rootel);
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
        const frame = el("nav").adto(rootel);
        navbar = frame;
    }
    
    console.log("ThreadClient built on "+variables.build_time+" version "+current_version);

    page2mainel = el("div").adto(rootel);
    
    // MISSING:
    // availableForOfflineUse, setAvailableForOfflineUse
    // updateAvailable, setUpdateAvailable
    // updateSW

    const new_state: HistoryState = {key: current_nav_history_key};
    history.replaceState(new_state, "ThreadClient",
        location.pathname + location.search + location.hash,
    );
    onNavigate(current_nav_history_key, location, undefined);

    let drtime = 100;
    const rmdarkreader = () => {
        document.head.querySelector(".darkreader")?.remove();
        drtime *= 2;
        setTimeout(() => rmdarkreader(), drtime);
    };
    setTimeout(() => rmdarkreader(), 0);


    alertarea = el("div").adto(rootel).clss("alert-area");

    startDebugTool(rootel);
    renderChangelogBannerIfNeeded(bannerarea);
}

const [availableForOfflineUse, setAvailableForOfflineUse] = createSignal(false);
const [updateAvailable, setUpdateAvailable] = createSignal(false);
export { availableForOfflineUse, updateAvailable };

export const updateSW = registerSW({
    onNeedRefresh() {
        console.log("An update to ThreadClient is available");
        setUpdateAvailable(true);
        const settings = getSettings();
        if(settings.updateNotifications() === "on") {
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

// TODO show an error message
if(import.meta.hot) {
    // import.meta.hot.decline();
    // technically the "right" thing to do is import.meta.hot.decline(); but I
    // don't want to accidentally refresh the page if I update router.ts. maybe
    // I should.
    //
    // I really hate it when hmr reloads your app pages. wish I could have an hmr
    // that never reloads app pages - at the most it shows a dialog saying "the
    // app is out of date. refresh."
    import.meta.hot.accept((new_mod) => {
        console.log("ATTEMPT TO HOT RELOAD ROUTER.TSX", new_mod, alertarea);

        // don't want to bother with manually updating all the exports this has or
        // reinitializing stuff or whatever
        if(!alertarea || !(global_counter_info as unknown as boolean)) {
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