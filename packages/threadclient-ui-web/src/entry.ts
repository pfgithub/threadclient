import "./main.scss";
import "windi.css";
import "./main2.scss";
import "./_stdlib";
import {main} from "./router";

(window as unknown as {global: typeof window}).global = window; // https://github.com/awto/effectfuljs/issues/29

main();
