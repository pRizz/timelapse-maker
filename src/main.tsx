import { render } from "solid-js/web";
import App from "./App";
import "./styles/global.css";

const maybeRoot = document.getElementById("root");

if (!maybeRoot) {
  throw new Error("Root element not found.");
}

render(() => <App />, maybeRoot);
