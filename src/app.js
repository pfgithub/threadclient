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

    const pathURL = (path) => "https://www.reddit.com/"+path.path;

    const listingToThread = (listing) => {
        const {data} = listing;
        const res = {};
        if(res.kind === "Listing") {
            res.title = "Listing";
        }else{
            res.title = data.title;
            res.actions = [{name: "Reply"}];
            res.stats = [{name: "Votes", count: data.score}];
        }
        res.children = [];
        if(data.children) for(const child of data.children) {
            res.children.push(listingToThread(child));
        }
        res.children.push({"load_more": "TODO"});
        return res;
    };

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
            return {path: ".json", options: {}};
        },
        async getThread(path) {
            try {
                const listing = await (await fetch(pathURL(path))).json();
                return listingToThread(listing);
            }catch(e) {
                return {
                    title: "Error!",
                    error: true,
                    comments: [
                        {"load_more": path}
                    ],
                };
            }
        },
        getThreadViewerLink(path) {
            return "/reddit/"+path.path;
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
                    if(comments.comments) addChildren(comments.comments, after_node);
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