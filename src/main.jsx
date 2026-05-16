import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#0d0d0d",
            color: "#f5f5f0",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "0.75rem",
            letterSpacing: "0.06em",
            borderRadius: "0",
            border: "1px solid rgba(255,255,255,0.08)",
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
