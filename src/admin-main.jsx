import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import AdminApp from "./AdminApp.jsx";
import "./admin.css";

ReactDOM.createRoot(document.getElementById("admin-root")).render(
  <React.StrictMode>
    <BrowserRouter basename="/admin">
      <AdminApp />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#1a1a1a",
            color: "#f5f5f0",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "0.75rem",
            letterSpacing: "0.06em",
            borderRadius: "0",
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
