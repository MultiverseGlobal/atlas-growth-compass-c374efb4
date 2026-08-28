import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import App from "./App.tsx";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";

const fallbackRender = ({ error }: { error: Error }) => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 text-zinc-50 p-4 text-center font-mono">
      <h1 className="text-xl font-bold mb-2">System Failure</h1>
      <p className="text-sm text-zinc-400 mb-6">The application encountered a critical error during mounting.</p>
      <pre className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-4 rounded-lg overflow-auto max-w-lg text-left">
        {error.message}
      </pre>
      <button onClick={() => window.location.reload()} className="mt-8 px-4 py-2 bg-zinc-100 text-zinc-900 font-semibold rounded hover:bg-zinc-200 transition-colors">
        Reboot System
      </button>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary fallbackRender={fallbackRender}>
    <App />
  </ErrorBoundary>
);
