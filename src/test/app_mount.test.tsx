import { describe, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import App from "../App";

describe("App route mount tests", () => {
  const routes = [
    "/",
    "/landing",
    "/auth",
    "/auth/callback",
    "/onboarding",
    "/objectives",
    "/hq/engine",
    "/hq/settings",
    "/hq/leads/123",
    "/hq/leads/123/proposal",
    "/privacy",
    "/random-unknown-route",
  ];

  for (const r of routes) {
    it(`mounts App at ${r}`, async () => {
      window.history.pushState({}, "", r);
      const div = document.createElement("div");
      document.body.appendChild(div);
      const root = createRoot(div);
      await act(async () => {
        root.render(<App />);
      });
      root.unmount();
      div.remove();
    });
  }
});
