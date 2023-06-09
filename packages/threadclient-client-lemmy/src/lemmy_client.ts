import { LemmyHttp } from 'lemmy-js-client';

const base_url = "test";

const client = new LemmyHttp(base_url);
const jwt = await client.login({
    // no oauth yet :/
    username_or_email: "",
    password: "",
});


/*

*/