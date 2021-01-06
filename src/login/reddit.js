const query = new URLSearchParams(location.search);

const code = query.get("code");
const state = query.get("state");

if(state !== "thread.pfg.pw") {
    uhtml.render(document.body, uhtml.html`<div class="error">Invalid</div>`);
    throw new Error("");
}

fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST", mode: "cors", credentials: "omit",
    headers: {
        'Authorization': "Basic "+btoa(client_id+":"),
        'Content-Type': "application/x-www-form-urlencoded",
    },
    body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirect_uri)}`,
}).then(v => v.json()).then(v => {
    if(v.error) {throw new Error("error");}

    const res_data = {
        access_token: v.access_token,
        refresh_token: v.refresh_token,
        expires: Date.now() + (v.expires_in * 1000),
        scope: v.scope,
    };

    console.log(v, res_data);

    localStorage.setItem("reddit-secret", JSON.stringify(res_data));
    uhtml.render(document.body, uhtml.html`<div class="note">Success! You may now close this page</div>`);
}).catch(e => console.log(e));
// if this request fails, it could be
// : firefox tracker prevention for some reason disallows this