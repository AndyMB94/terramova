// Primero: configura zod antes de que otros módulos creen o usen esquemas.
import "@/shared/lib/zod-config";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import "@/shared/styles/index.css";

// Las cifras (Geist Mono) solo aparecen cuando llegan los datos; si la fuente se pidiera
// entonces, se vería un instante la monoespaciada del sistema. Se carga desde el inicio.
void document.fonts?.load('1em "Geist Mono Variable"', "0123456789,.°");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("No se encontró el elemento #root.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
