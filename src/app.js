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
    const is_logged_in = localStorage.getItem("authorized_code");

    const pathURL = (path) => "https://oauth.reddit.com/"+path.path+".json";

    const threadFrom = (path) => ({path, options: {}});

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
        login_url: "",
        isLoggedIn() {
            return !!localStorage.getItem("reddit-secret");
        },
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
        homeThread() {
            return threadFrom("");
        },
        async getThread(path) {
            try {
                const listing = await (await fetch(pathURL(path), {
                    mode: "cors", credentials: "omit",
                    headers: {
                        'Authorization': await getAuthorization(),
                        // nooo f
                        // access-control-allow-headers	X-Signature,X-Signature-v2,Content-Type,Origin,Accept,X-origination-host,X-origination-path
                        // none of those are authorization
                        // oops proxy time
                    }
                })).json();
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
        getThreadViewerLink(path) {
            return "?service=reddit&path="+encodeURIComponent(path.path);
        }
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

                uhtml.render(v, linkButton(client.getThreadViewerLink(thread_link), async () => {
                    uhtml.render(v, html`Loading…`);
                    const comments = await client.getThread(thread_link);
                    v.remove();
                    if(comments.children) addChildren(comments.children, after_node);
                }, html`Load more…`));

                const after_node = document.createComment("");
                children_node.current.insertBefore(after_node, li_before_once);
            }else{
                const child_node = clientListing(client, child_listing).insertBefore(v, null);
                defer(() => child_node.remove());
            }
            children_node.current.insertBefore(v, li_before_once);
        }
    }
    if(listing.children) addChildren(listing.children, null);

    return {removeSelf: () => defer.cleanup()};
} } }

function clientMain(client) { return {insertBefore(parent, before_once) {
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
        const home_thread = await client.getThread(client.homeThread());
        
        uhtml.render(frame, html``);
        const home_node = clientListing(client, home_thread).insertBefore(frame, null);
        defer(() => home_node.remove());
        
    })().catch(e => console.log(e));

    return {removeSelf: () => defer.cleanup()};
} } }

clientMain(reddit()).insertBefore(document.body, null);