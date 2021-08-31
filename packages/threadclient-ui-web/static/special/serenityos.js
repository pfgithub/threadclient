window.el = (el) => document.createElement(el);
window.txt = (txt) => document.createTextNode(txt);

Node.prototype.attr = function (atrs) { Object.entries(atrs).forEach((item) => item[1] == null ? this.removeAttribute(item[0]) : this.setAttribute(item[0], item[1])); return this };
Node.prototype.adto = function (prnt) { prnt.appendChild(this); return this };
Node.prototype.adch = function (child) { this.appendChild(child); return this }; // this.appendChild.apply(this, arguments)?
Node.prototype.atxt = function (txta) { this.appendChild(txt(txta)); return this };
//Object.defineProperty(Array.prototype, "last", { enumerable: false, get: function () { return this[this.length - 1] } });
//Object.defineProperty(Object.prototype, "dwth", { enumerable: false, value: function (cb) { cb(this); return this } });
if(!Node.prototype.remove) Node.prototype.remove = function() {if(this.parentNode) this.parentNode.removeChild(this);}

const content = document.getElementById("content");

const loadarea = el("div").adto(content);

/**
 * @param {never} value
 * @return {never}
 */
function assertNever(value) {
    throw new Error("not never");
}

function linkButton(href) {
    if(href.startsWith("http://") || href.startsWith("https://")) {
        const res = el("a");
        res.attr({class: "link", href: href});
        return res;
    }
    return el("span").attr({class: "error", title: href});
}

/** @typedef {import("api-types-generic").Body} Generic_Body */
/**
 * @param {Generic_Body} body
 */
function renderBody(body) {
    const frame = el("div");

    if(body.kind === "text") {
        el("pre").atxt(body.content);
    }else if(body.kind === "array") {
        for(const cbody of body.body) {
            frame.adch(renderBody(cbody));
        }
    }else if(body.kind === "link") {
        linkButton(body.url).atxt(body.url).adto(frame);
        // there's no reason this should have to be implemented twice -
        // the link previewer in app.tsx returns a body so it should be
        // reused here. (+URL polyfill +babel ←es5)
        if(body.url.endsWith(".jpg")
            || body.url.endsWith(".png")) {
            el("img").attr({src: body.url}).adto(frame);
        }
    }else{
        el("span").atxt("TODO "+body.kind).attr({class: "error"}).adto(frame);
    }

    return frame;
}

/** @typedef {import("api-types-generic").Node} Generic_Node */
/**
 * @param {Generic_Node} node
 */
function renderNode(node) {
    const frame = el("div");
    
    // var is a hack; const should be used here but it refers to the wrong thing inside the onclick
    // handlers in the if statements if const is used. couldn't find a minimal repro but it
    // probably requires html elements specifically because I couldn't reproduce with just objects
    var title_line = el("div").adto(frame);
    var info_line = el("div").adto(frame);
    var actions_line = el("div").adto(frame);
    var body_area = el("div").adto(frame);

    if(node.kind !== "thread") return frame.atxt("Error! Not thread!");

    if(node.title) {
        title_line.adch(el("h1").atxt(node.title.text));
    }
    if(node.info) {
        info_line.atxt("By ").adch(linkButton(node.info.author.link).atxt(node.info.author.name));
        if(node.info.in) {
            info_line.atxt(" in ").adch(linkButton(node.info.in.link).atxt(node.info.in.name));
        }
    }

    if(node.layout === "reddit-post") {
        const showbtn = el("button").attr({class: "native"}).adto(actions_line).atxt("Show");
        actions_line.atxt(" ");
        let showing = false;
        let body_rendered = undefined;
        showbtn.addEventListener("mousedown", () => {
            if(!showing) {
                showing = true;
                showbtn.textContent = "Hide";
                body_rendered = renderBody(node.body).adto(body_area);
            }else{
                showing = false;
                showbtn.textContent = "Show";
                body_rendered.remove();
            }
        });
    }

    for(const action of node.actions) {
        if(action.kind === "link") {
            actions_line.adch(linkButton(action.url).atxt(action.text));
        }else{
            actions_line.adch(el("span").attr({class: "error"}).atxt("«"+action.kind+"»"));            
        }
        actions_line.atxt(" ");
    }

    return frame;
}

/** @typedef {import("api-types-generic").Page} Generic_Page */
/**
 * @param {Generic_Page} page
 */
function loaddone(page) {
    loadarea.remove();
    const preel = el("pre").atxt("Loaded!").adto(content);
    if(page.body.kind === "listing") {
        for(const item of page.body.items) {
            for(const node of item.parents) {
                renderNode(node).adto(content);
            }
        }
    }else if(page.body.kind === "one") {
        el("div").attr({class: "error"}).atxt("Unsupported `one`").adto(content);
    }else assertNever(page.body);
}

const loadbtn = el("button").attr({class: "native"}).atxt("Load!").adto(loadarea);
loadbtn.addEventListener("mousedown", () => {
    if(loadbtn.getAttribute("disabled") != null) return;
    loadbtn.textContent = "...";
    loadbtn.attr({disabled: ""});
    // document addEventListener mouseup {capture: true} => {loop up target, see if parents contains this button {onclick()}, clear mouseup listener}

    loaddone(window.sample);
    // this functions: (if you disable location origin checks in xmlhttprequest.cpp)
    //const xhr = new XMLHttpRequest();
    //xhr.addEventListener("readystatechange", () => {
    //    const preel = el("pre").adto(loadarea).atxt("readystate "+xhr.readyState);
    //    if(xhr.readyState == xhr.DONE) {
            // TODO check xhr.status
    //        loaddone(JSON.parse(xhr.responseText));
    //    }
    //});
    //xhr.open("GET", "https://www.reddit.com/.json?raw_json=1&rtj=only&emotes_as_images=true", true);
    //xhr.send();
});