import {secret_consumer_key, public_consumer_key} from "./secret.ts";
import {b64_hmac_sha1} from "./hmac_sha1.js";
import {percentEncode} from "./percent_encode.ts";

function generateSignature(parameters: {[key: string]: string}, http_method: string, url: string, secret_consumer_key: string, token: string | undefined) {
    const param_string = Object.entries(parameters)
        .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
        .map(([key, value]) => key+"="+percentEncode(value))
        .join("&")
    ;

    const sig_base = [http_method.toUpperCase(), url, param_string].map(c => percentEncode(c)).join("&");

    const sig_key = [secret_consumer_key, token ?? ""].map(c => percentEncode(c)).join("&");

    const signed = b64_hmac_sha1(sig_key, sig_base);

    return signed;
}
const query = (items: {[key: string]: string}) => {
    let res = "";
    for(const [key, value] of Object.entries(items)) {
        if(res) res += "&";
        res += [key, value].map(v => encodeURIComponent(v)).join("=");
    }
    return res;
};
function decodeParams(params: string): {[key: string]: string} {
    const items: [string, string][] = params.split("&").map(v => v.split("=").map(q => decodeURIComponent(q)) as [string, string]);
    return Object.fromEntries(items);
}
async function getAuthenticationURL() {
    const parameters = {
        oauth_nonce: (+("" + Math.random()).replace(".", "")).toString(16),
        oauth_callback: "https://thread.pfg.pw/login/twitter",
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: "" + (Date.now() / 1000 |0),
        oauth_consumer_key: public_consumer_key,
        oauth_version: "1.0",
    };
    const http_method = "POST";
    const url = "https://api.twitter.com/oauth/request_token";

    const signature = generateSignature(parameters, http_method, url, secret_consumer_key, undefined);
    const outparams = {...parameters, oauth_signature: signature};

    const auth_res = await fetch(url, {
        method: http_method,
        headers: {
            'Accept': 'application/json',
            'Authorization': "OAuth " + Object.entries(outparams)
                .map(([key, value]) => key + "=\"" + percentEncode(value) + "\"").join(", ")
            ,
        },
    }).catch(e => {console.log(e);});
    if(!auth_res) throw new Error("error");

    if(auth_res.status !== 200) {
        console.log(await auth_res.text())
        throw new Error("bad resp code");
    }
    const text = await auth_res.text();
    const items = decodeParams(text);
    console.log(items);
    const resp_url = "https://api.twitter.com/oauth/authorize?"+query({
        oauth_token: items.oauth_token,
    });
    return resp_url;
}
async function renderAccessToken(oauth_token: string, oauth_verifier: string) {
    const parameters = {
        oauth_consumer_key: public_consumer_key,
        oauth_nonce: (+("" + Math.random()).replace(".", "")).toString(16),
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: "" + (Date.now() / 1000 |0),
        oauth_token,
        oauth_version: "1.0",
        oauth_verifier,
    };
    const http_method = "POST";
    const url = "https://api.twitter.com/oauth/access_token";

    const signature = generateSignature(parameters, http_method, url, secret_consumer_key, undefined);
    const outparams = {
        oauth_consumer_key: public_consumer_key,
        oauth_nonce: parameters.oauth_nonce,
        oauth_signature: signature,
        oauth_signature_method: parameters.oauth_signature_method,
        oauth_timestamp: parameters.oauth_timestamp,
        oauth_version: parameters.oauth_version,
    };

    const fetchres = await fetch(url+"?"+query({
        oauth_token,
        oauth_verifier,
    }), {
        method: http_method,
        headers: {
            'Accept': 'application/json',
            'Authorization': "OAuth "+Object.entries(outparams)
                .map(([key, value]) => key + "=\"" + percentEncode(value) + "\"").join(", ")
            ,
        },
    });
    if(fetchres.status !== 200) {
        console.log(fetchres.status, fetchres.statusText+":", await fetchres.text());
        throw new Error("Got error!");
    }
    const text = await fetchres.text();
    const items = decodeParams(text) as {
        oauth_token: string,
        oauth_token_secret: string,
        user_id: string,
        screen_name: string,
    };
    console.log(items);
}
// getAuthenticationURL().then(r => {
//     console.log("Response URL: ", r);
// }).catch(e => {
//     console.log("Error", e);
// });


function test() {
    const eg = generateSignature({
        status: "Hello Ladies + Gentlemen, a signed OAuth request!",
        include_entities: "true",
        oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
        oauth_nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: "1318622958",
        oauth_token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
        oauth_version: "1.0",
    },
        "post", "https://api.twitter.com/1.1/statuses/update.json",
        "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
        "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE"
    );
    if(eg !== "hCtSmYh+iHYCEqBWrE7C7hYmtUk=") throw new Error("test failed");
}