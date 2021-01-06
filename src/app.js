const raw = (string) => ({__raw: "" + string, toString: () => string});
const templateGenerator = (helper) => {
    return (strings, ...values) => {
        if(!strings.raw && !Array.isArray(strings)) {
            return helper(strings);
        }
        const result = [];
        strings.forEach((string, i) => {
            result.push(raw(string), values[i] || "");
        });
        return result.map(el => typeof el.__raw === "string" ? el.__raw : helper(el)).join("");
    };
};
const url = templateGenerator(str => encodeURIComponent(str));
const html = uhtml.html;

const query = items => {
    let res = "";
    for(const [key, value] of Object.entries(items)) {
        if(!res) res += "?";
        else res += "&";
        res += url`${key}=${value}`;
    }
    return res;
};

function reddit() {
    const isLoggedIn = () => {
        return !!localStorage.getItem("reddit-secret");
    };

    const pathURL = (path) => {;
        if(!isLoggedIn()) return "https://reddit.com"+path+".json";
        return "https://oauth.reddit.com"+path+".json";
    };

    const threadFrom = (path) => ({path, options: {}});

    // ok so the idea::
    // reddit listings are [pageinfo], [comments]
    // so::
    // if this is the outermost listing, the pageinfo is needed to display info about the current page
    // so like
    // when we return a result from getThread it can be like this
    // {
    //     parent: Post
    //     children: Post[]
    // }
    // and then also the client viewer thing can update the parent post if eg you load the comments
    // ok part 2:: there are different types of posts
    const listingToThread = (listing) => {
        console.log(listing);
        if(Array.isArray(listing)) return listingToThread(listing[1]);
        const {data} = listing;
        const res = {};
        if(res.kind === "Listing") {
            res.title = "Listing";
        }else{
            res.title = data.title;
            res.body = data.body;
            res.actions = [{name: "Reply"}];
            res.stats = [{name: "Votes", count: data.score}];
        }
        res.children = [];
        // ok this isn't structured well atm
        // this needs a redo
        // children is []Node. replies is Node.
        if(data.children) for(const child of data.children) {
            res.children.push(listingToThread(child));
        }
        res.children.push({"load_more": threadFrom(data.permalink || "TODO")});
        return res;
    };

    const getAccessToken = async () => {
        const data = localStorage.getItem("reddit-secret");
        if(!data) return null;
        const json = JSON.parse(data);
        console.log(json.expires, Date.now());
        if(json.expires < Date.now()) {
            // refresh token
            console.log("Token expired, refreshing…");
            const v = await (await fetch("https://www.reddit.com/api/v1/access_token", {
                method: "POST", mode: "cors", credentials: "omit",
                headers: {
                    'Authorization': "Basic "+btoa(client_id+":"),
                    'Content-Type': "application/x-www-form-urlencoded",
                },
                body: url`grant_type=refresh_token&refresh_token=${json.refresh_token}`,
            })).json();
            const res_data = {
                access_token: v.access_token,
                refresh_token: v.refresh_token,
                expires: Date.now() + (v.expires_in * 1000),
                scope: v.scope,
            };
            localStorage.setItem("reddit-secret", JSON.stringify(res_data));
            console.log("Refreshed √");
            return res_data.access_token;
        }
        return json.access_token;
    }

    const getAuthorization = async () => {
        const access_token = await getAccessToken();
        if(!access_token) return '';
        return 'Bearer '+access_token;
    }

    const res = {
        id: "reddit",
        links: () => [
            ["Home", () => "/"],
            ["r/test", () => "/r/test"]
            ["Notifications", () => "/message/inbox"]
        ],
        isLoggedIn,
        getLoginURL() {
            const state = "thread.pfg.pw";
            const scope =
                "identity edit flair history modconfig modflair modlog" + " " +
                "modposts modwiki mysubreddits privatemessages read report save" + " " +
                "submit subscribe vote wikiedit wikiread"
            ;

            const url = `https://www.reddit.com/api/v1/authorize` +
                query({client_id, response_type: "code", state, redirect_uri, duration: "permanent", scope})
            ;
            return url;
        },
        async getThread(path) {
            try {
                const listing = await fetch(pathURL(path), {
                    mode: "cors", credentials: "omit",
                    headers: isLoggedIn() ? {
                        'Authorization': await getAuthorization(),
                    } : {},
                }).then(v => v.json());
                console.log(listing);
                return listingToThread(listing);
            }catch(e) {
                return {
                    title: "Error!",
                    error: true,
                    children: [
                        {"load_more": path}
                    ],
                };
            }
        },
        async login(query) {
            const code = query.get("code");
            const state = query.get("state");

            if(!code || !state) {
                throw new Error("No login requested");
            }
            if(state !== "thread.pfg.pw") {
                throw new Error("Login was wrong link'd");
            }

            const v = await fetch("https://www.reddit.com/api/v1/access_token", {
                method: "POST", mode: "cors", credentials: "omit",
                headers: {
                    'Authorization': "Basic "+btoa(client_id+":"),
                    'Content-Type': "application/x-www-form-urlencoded",
                },
                body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirect_uri)}`,
            }).then(v => v.json())
        
            if(v.error) {
                console.log(v.error);
                throw new Error("error "+v.error);
            }

            const res_data = {
                access_token: v.access_token,
                refresh_token: v.refresh_token,
                expires: Date.now() + (v.expires_in * 1000),
                scope: v.scope,
            };

            console.log(v, res_data);

            localStorage.setItem("reddit-secret", JSON.stringify(res_data));
        },
    };
    return res;
}

function clientLogin(client, on_complete) { return {insertBefore(parent, before_once) {
    const frame = document.createElement("div");
    parent.insertBefore(frame, before_once);

    const login_url = client.getLoginURL();
    uhtml.render(frame, html`<a href="${login_url}" rel="noreferrer noopener" target="_blank">Log In</a>`);

    let done = false;
    const event_listener = () => {
        if(!done && client.isLoggedIn()) {
            done = true;
            uhtml.render(frame, html`Logged In!`);
            on_complete();
        }
    };
    document.addEventListener("focus", event_listener);

    return {removeSelf() {
        frame.remove();
        document.removeEventListener("focus", event_listener)
    } };
} } }

const makeDefer = () => {
	let list = [];
	let res = cb => {list.unshift(cb)};
	res.cleanup = () => {list.forEach(cb => cb())};
	return res;
};

function isModifiedEvent(event) {
    return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);
}

function linkButton(href, onclick, children) {
    const a_ref = {current: null};
    const click = (event) => {
        if (
            !event.defaultPrevented && // onClick prevented default
            event.button === 0 && // ignore everything but left clicks
            !isModifiedEvent(event) // ignore clicks with modifier keys
        ) {
            event.preventDefault();
            event.stopPropagation();
            onclick();
        }
    };
    return html`<a ref=${a_ref} href=${href} onclick=${click} target="_blank" rel="noreferrer noopener">${children}</a>`;
}

function clientListing(client, listing) { return {insertBefore(parent, before_once) {
    const defer = makeDefer();
    console.log(listing);

    const frame = document.createElement("div");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    const children_node = {current: null};
    uhtml.render(frame, html`
        <div class="post-title">${listing.title}</div>
        <div class="post-body">${listing.body}</div>
        <ul ref=${children_node}></ul>
    `);
    const addChildren = (children, li_before_once) => {
        for(const child_listing of children) {
            const v = document.createElement("li");
            if('load_more' in child_listing) {
                const thread_link = child_listing.load_more;

                uhtml.render(v, linkButton(client.id + "/" + thread_link, async () => {
                    uhtml.render(v, html`Loading…`);
                    const comments = await client.getThread(thread_link);
                    v.remove();
                    if(comments.children) addChildren(comments.children, after_node);
                }, html`Load more…`));

                const after_node = document.createComment("");
                children_node.current.insertBefore(after_node, li_before_once);
            }else{
                const child_node = clientListing(client, child_listing).insertBefore(v, null);
                defer(() => child_node.removeSelf());
            }
            children_node.current.insertBefore(v, li_before_once);
        }
    }
    if(listing.children) addChildren(listing.children, null);

    return {removeSelf: () => defer.cleanup()};
} } }

function clientMain(client, current_path) { return {insertBefore(parent, before_once) {
    const defer = makeDefer();

    const frame = document.createElement("div");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    if(!client.isLoggedIn()) {
        const login_prompt = clientLogin(client, () => login_prompt.removeSelf()).insertBefore(frame, null);
        return {removeSelf: () => defer.cleanup()};
    }

    uhtml.render(frame, html`Loading…`);

    (async () => {
        const home_thread = await client.getThread(current_path);
        
        uhtml.render(frame, html``);
        const home_node = clientListing(client, home_thread).insertBefore(frame, null);
        defer(() => home_node.removeSelf());
        
    })().catch(e => console.log(e));

    return {removeSelf: () => defer.cleanup(), hide: () => {
        if(frame.style.display !== "none") frame.style.display = "none";
    }, show: () => {
        if(frame.style.display !== "") frame.style.display = "";
    }};
} } }

function fullscreenError(message) { return {insertBefore(parent, before_once) {
    const defer = makeDefer();

    const frame = document.createElement("div");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    frame.appendChild(document.createTextNode(message));

    return {removeSelf: () => defer.cleanup(), hide: () => {
        if(frame.style.display !== "none") frame.style.display = "none";
    }, show: () => {
        if(frame.style.display !== "") frame.style.display = "";
    }};
} } }

function clientLoginPage(client, query) { return {insertBefore(parent, before_once) {
    const defer = makeDefer();

    const frame = document.createElement("div");
    defer(() => frame.remove());
    parent.insertBefore(frame, before_once);

    uhtml.render(frame, uhtml.html`<div>…</div>`);
    (async () => {
        uhtml.render(frame, uhtml.html`<div>Logging In…</div>`);
        try {
            await client.login(query);
        }catch(e) {
            console.log(e);
            // TODO if this is the only open history item, don't target _blank
            const login_url = client.getLoginURL();
            uhtml.render(frame, uhtml.html`<div class="error">Login error! ${e.toString()}. <a href="${login_url}" rel="noreferrer noopener" target="_blank">Retry</a></div>`);
            return;
        }
        // if this page is still active, navigate({path: "/login/success", replace: true}); to get rid of the token in the url
        uhtml.render(frame, uhtml.html`<div>Logged In! You may now close this page.</div>`);
    })();

    return {removeSelf: () => defer.cleanup(), hide: () => {
        if(frame.style.display !== "none") frame.style.display = "none";
    }, show: () => {
        if(frame.style.display !== "") frame.style.display = "";
    }};
} } }


window.onpopstate = ev => {
    // onNavigate(ev?.state.index ?? 0);
    onNavigate(ev.state ? ev.state.index : 0, location);
};

const client_cache = {};
const client_initializers = {
    reddit: () => reddit(),
};
const getClient = (name) => {
    if(!client_initializers[name]) return undefined;
    if(!client_cache[name]) client_cache[name] = client_initializers[name]();
    if(client_cache[name].id !== name) throw new Error("client has incorrect id");
    return client_cache[name];
}

const nav_history = [];

function navigate({path, replace}) {
    if(!replace) replace = false;
    if(replace) {
        nav_history[current_history_index] = {url: "::redirecting::", node: {removeSelf: () => {}, hide: () => {}, show: () => {}}};
        history.replaceState({index: current_history_index}, "ThreadReader", path);
        onNavigate(current_history_index, location);
    }else{
        history.pushState({index: current_history_index + 1}, "ThreadReader", path);
        onNavigate(current_history_index + 1, location);
    }
}

let navigate_event_handlers = [];

let current_history_index = 0;
function onNavigate(to_index, url) {
    console.log("Navigating", to_index, url);
    navigate_event_handlers.forEach(evh => evh(url));

    const thisurl = url.pathname + url.search;
    current_history_index = to_index;
    if(nav_history[to_index]) {
        // hide all history
        nav_history.forEach(item => item.node.hide());
        if(nav_history[to_index].url !== thisurl) {
            console.log("URLS differ. «", nav_history[to_index].url, "» «", thisurl, "»");
            
            // a b c d to_index [… remove these]
            for(let i = nav_history.length - 1; i >= to_index; i--) {
                nav_history.pop().node.removeSelf();
            }
            const addedit = {url: thisurl};
            nav_history.push(addedit);
            if(nav_history[to_index] !== addedit) throw new Error("assert failed");
        }else{
            // show the current history
            nav_history[to_index].node.show();
            return; // done
        }
    }else{
        nav_history.forEach(item => item.node.hide());
        nav_history[to_index] = {url: thisurl};
    }

    const path = url.pathname.split("/").filter(w => w);

    const path0 = path.shift();

    console.log(path);

    if(!path0) {
        navigate({path: "/reddit", replace: true});
        return;
    }
    if(path0 === "login"){
        const client = getClient(path[0]);
        if(!client) {
            nav_history[to_index].node = fullscreenError("404 unknown client "+path[0]).insertBefore(document.body, null);
            return;
        }
        nav_history[to_index].node = clientLoginPage(client, new URLSearchParams(location.search)).insertBefore(document.body, null);
        return;
    }

    const client = getClient(path0);

    if(!client){
        nav_history[to_index].node = fullscreenError("404 unknown client "+path0).insertBefore(document.body, null);
        return;
    }
    nav_history[to_index].node = clientMain(client, "/"+path.join("/")+url.search).insertBefore(document.body, null);
    return;
}

{
    let spa_navigator_frame = document.createElement("div");
    document.body.appendChild(spa_navigator_frame);
    let spa_navigator_input = document.createElement("input");
    spa_navigator_frame.appendChild(spa_navigator_input);
    let spa_navigator_button = document.createElement("button");
    spa_navigator_button.appendChild(document.createTextNode("Go!"));
    spa_navigator_frame.appendChild(spa_navigator_button);
    spa_navigator_button.onclick = () => {
        navigate({path: spa_navigator_input.value});
    }

    navigate_event_handlers.push(url => spa_navigator_input.value = url.pathname + url.search);
}

onNavigate(0, location);