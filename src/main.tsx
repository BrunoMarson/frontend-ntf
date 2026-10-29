import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { queryClient } from "./api/query-client";
import "./styles.css";

async function startApplication() {
  const useMockApi = import.meta.env.VITE_API_MOCKING === "enabled" ||
    (import.meta.env.DEV && import.meta.env.VITE_API_MOCKING !== "disabled");
  if (useMockApi) {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("O elemento raiz da aplicação não foi encontrado.");

  window.addEventListener("kurio:session-expired", () => {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "artworks" });
    if (window.location.pathname !== "/login") {
      const returnTo = window.location.pathname + window.location.search;
      window.location.assign(`/login?redirect=${encodeURIComponent(returnTo)}`);
    }
  });

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void startApplication();
