import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { getBrowserFallbackLocale } from "./lib/locale";
import "./index.css";

// Mount the recovery UI before loading modules that request catalog data.
// A rejected API request must not leave the whole application blank.
const App = lazy(() => import("./App"));
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center">{getBrowserFallbackLocale() === "en" ? "Loading Matpick…" : "맛픽을 불러오고 있어요…"}</div>}>
      <App />
    </Suspense>
  </ErrorBoundary>
);
