import "windi.css";

console.log("Options loaded");

const root = document.createElement("p");
root.textContent = "options loaded (dev: "+__DEV__+")";
document.body.appendChild(root);

root.classList.add("m-4", "p-4");