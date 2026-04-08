/** @jsxImportSource solid-js */

import { render } from "solid-js/web";

import { App } from "./App.tsx";
import "./styles.css";

const root = document.getElementById("gran-web-root");

if (!root) {
  throw new Error("Gran web root element not found");
}

render(() => <App />, root);
