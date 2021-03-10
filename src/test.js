        window.el = (el) => document.createElement(el);
        window.txt = (txt) => document.createTextNode(txt);

        Node.prototype.attr = function (atrs) { Object.entries(atrs).forEach((item) => item[1] == null ? this.removeAttribute(item[0]) : this.setAttribute(item[0], item[1])); return this };
        Node.prototype.adto = function (prnt) { prnt.appendChild(this); return this };
        Node.prototype.adch = function (child) { this.appendChild(child); return this }; // this.appendChild.apply(this, arguments)?
        Node.prototype.atxt = function (txta) { this.appendChild(txt(txta)); return this };
        //Object.defineProperty(Array.prototype, "last", { enumerable: false, get: function () { return this[this.length - 1] } });
        //Object.defineProperty(Object.prototype, "dwth", { enumerable: false, value: function (cb) { cb(this); return this } });

        const content = document.getElementById("content");

        const loadarea = el("div").adto(content);

        /** @typedef {import("./types/generic").Page} Generic_Page */
        /**
         * @param {Generic_Page} loaded_content
         */
        function loaddone(loaded_content) {
            loadarea.parentNode.removeChild(loadarea);
            const preel = el("pre").atxt("Loaded!").adto(content);
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