import "windi.css";
import "./style.css";

import {initializeApp} from "firebase/app";
import { render } from "solid-js/web";
import AnimatorState from "./animator_state";
import { DefaultErrorBoundary } from "./error_boundary";

initializeApp({
    apiKey: "AIzaSyAJ3J40bR4cGKRrhQdsGE5W-aRSc6RbFBc",
    authDomain: "animator-9443f.firebaseapp.com",
    databaseURL: "https://animator-9443f-default-rtdb.firebaseio.com",
    storageBucket: "animator-9443f.appspot.com",
});

render(() => <DefaultErrorBoundary data={0}>
    <AnimatorState />
</DefaultErrorBoundary>, document.getElementById("app")!);