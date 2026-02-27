import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { DictionariesProvider } from "./context/DictionariesContext";
import { ToastProvider } from "./context/ToastContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <DictionariesProvider>
          <App />
        </DictionariesProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
