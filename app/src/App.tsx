import { lazy, Suspense, useEffect, useState } from "react";
import { useHashRoute, type Route } from "./lib/router";
import { useStore } from "./lib/store";
import Today from "./pages/Today";
import TimelinePage from "./pages/TimelinePage";

// Split out of the initial download: the drawing canvas, the file-heavy imaging views, the brief
// and the 3D explorer are all things you open deliberately, not on the way to recording a day.
const WhatISee = lazy(() => import("./pages/WhatISee"));
const MyEyes = lazy(() => import("./pages/MyEyes"));
const Imaging = lazy(() => import("./pages/Imaging"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Visualize = lazy(() => import("./pages/Visualize"));
const Settings = lazy(() => import("./pages/Settings"));
import Onboarding from "./components/Onboarding";
import CommandPalette from "./components/CommandPalette";
import ErrorBoundary from "./components/ErrorBoundary";
import Sheet from "./components/Sheet";
import { formatLongDate, todayLocal } from "./lib/util";
import { applyPrefs, prefsFromMeta } from "./lib/prefs";

/** The four destinations that fit the thumb zone; everything else lives behind "More". */
const PRIMARY: Route[] = ["today", "what-i-see", "timeline", "appointments"];

const NAV: { route: Route; label: string; icon: string; section?: string }[] = [
  { route: "today", label: "Today", icon: "◐" },
  { route: "what-i-see", label: "What I See", icon: "✧" },
  { route: "timeline", label: "Timeline", icon: "⌁" },
  { route: "my-eyes", label: "My Eyes", icon: "◉" },
  { route: "imaging", label: "Imaging & Documents", icon: "▣" },
  { route: "appointments", label: "Appointments", icon: "✚" },
  { route: "visualize", label: "Visualize", icon: "◍" },
  { route: "settings", label: "Settings", icon: "⚙" },
];

export default function App() {
  const [route, nav] = useHashRoute();
  const store = useStore();
  const [palette, setPalette] = useState<null | "search" | "ask">(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette("search");
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPalette("search");
      } else if (e.key === "?" && !typing) {
        e.preventDefault();
        setPalette("ask");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    applyPrefs(prefsFromMeta(store.meta), document.documentElement);
  }, [store.meta]);

  if (!store.ready) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          color: "var(--text-3)",
        }}
      >
        Opening your local record…
      </div>
    );
  }

  const onboarded = store.meta?.onboarded ?? false;

  return (
    <>
      {!onboarded && <Onboarding />}
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className="shell" aria-hidden={!onboarded}>
        <aside className="sidebar" aria-label="Afterlight">
          <div className="brand">
            <div className="brand-name">Afterlight</div>
            <div className="brand-tag">A living record of the sight you fought to keep.</div>
          </div>
          <button className="sidebar-search" onClick={() => setPalette("search")}>
            <span aria-hidden>⌕</span>
            <span>Search my records</span>
            <kbd>⌘K</kbd>
          </button>
          <nav aria-label="Main navigation">
            {NAV.map((item) => (
              <button
                key={item.route}
                className={`nav-item ${route === item.route ? "active" : ""}`}
                onClick={() => nav(item.route)}
                aria-current={route === item.route ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <button className="nav-item" onClick={() => setPalette("ask")}>
            <span className="nav-icon" aria-hidden>
              ?
            </span>
            <span className="nav-label">Ask my records</span>
          </button>
          <div className="sidebar-footer">
            Records are stored locally in this browser. Nothing is uploaded without your action.
          </div>
        </aside>
        <nav className="tabbar" aria-label="Main">
          {NAV.filter((n) => PRIMARY.includes(n.route)).map((item) => (
            <button
              key={item.route}
              className={`tab ${route === item.route ? "active" : ""}`}
              onClick={() => nav(item.route)}
              aria-current={route === item.route ? "page" : undefined}
            >
              <span className="tab-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="tab-label">{item.label}</span>
            </button>
          ))}
          <button
            className={`tab ${!PRIMARY.includes(route) ? "active" : ""}`}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
          >
            <span className="tab-icon" aria-hidden>
              ⋯
            </span>
            <span className="tab-label">More</span>
          </button>
        </nav>

        <main className="main" id="main" tabIndex={-1}>
          <div className="topbar-date" style={{ marginBottom: 10 }}>
            {formatLongDate(todayLocal())}
          </div>
          <ErrorBoundary key={route} where={NAV.find((n) => n.route === route)?.label ?? route}>
            <Suspense fallback={<p className="muted" role="status">Opening…</p>}>
            {route === "today" && <Today />}
            {route === "what-i-see" && <WhatISee />}
            {route === "timeline" && <TimelinePage />}
            {route === "my-eyes" && <MyEyes />}
            {route === "imaging" && <Imaging />}
            {route === "appointments" && <Appointments />}
            {route === "visualize" && <Visualize />}
            {route === "settings" && <Settings />}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      {moreOpen && (
        <Sheet title="Go to" onClose={() => setMoreOpen(false)}>
          <div className="sheet-nav">
            {NAV.filter((n) => !PRIMARY.includes(n.route)).map((item) => (
              <button
                key={item.route}
                className="sheet-nav-item"
                onClick={() => {
                  nav(item.route);
                  setMoreOpen(false);
                }}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
            <button
              className="sheet-nav-item"
              onClick={() => {
                setMoreOpen(false);
                setPalette("search");
              }}
            >
              <span aria-hidden>⌕</span>
              <span>Search my records</span>
            </button>
            <button
              className="sheet-nav-item"
              onClick={() => {
                setMoreOpen(false);
                setPalette("ask");
              }}
            >
              <span aria-hidden>?</span>
              <span>Ask my records</span>
            </button>
          </div>
        </Sheet>
      )}

      {palette && (
        <CommandPalette initialMode={palette} onClose={() => setPalette(null)} onNavigate={nav} />
      )}
    </>
  );
}
