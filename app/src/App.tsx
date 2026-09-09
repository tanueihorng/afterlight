import { lazy, Suspense, useEffect, useState } from "react";
import { t, type MessageKey } from "./lib/i18n";
import { useHashRoute, type Route } from "./lib/router";
import { useStore } from "./lib/store";
import Today from "./pages/Today";
import TimelinePage from "./pages/TimelinePage";

// Split out of the initial download: the drawing canvas, the file-heavy imaging views, the brief
// and the 3D explorer are all things you open deliberately, not on the way to recording a day.
const WhatISee = lazy(() => import("./pages/WhatISee"));
const MyEyes = lazy(() => import("./pages/MyEyes"));
const SelfTests = lazy(() => import("./pages/SelfTests"));
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

/** Labels are looked up per render, so switching language does not need a reload. */
const NAV: { route: Route; key: MessageKey; icon: string }[] = [
  { route: "today", key: "nav.today", icon: "◐" },
  { route: "what-i-see", key: "nav.what_i_see", icon: "✧" },
  { route: "timeline", key: "nav.timeline", icon: "⌁" },
  { route: "my-eyes", key: "nav.my_eyes", icon: "◉" },
  { route: "self-tests", key: "nav.self_tests", icon: "◎" },
  { route: "imaging", key: "nav.imaging", icon: "▣" },
  { route: "appointments", key: "nav.appointments", icon: "✚" },
  { route: "visualize", key: "nav.visualize", icon: "◍" },
  { route: "settings", key: "nav.settings", icon: "⚙" },
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
        {t("app.skip_to_content")}
      </a>
      <div className="shell" aria-hidden={!onboarded}>
        <aside className="sidebar" aria-label="Afterlight">
          <div className="brand">
            <div className="brand-name">{t("app.name")}</div>
            <div className="brand-tag">{t("app.tagline")}</div>
          </div>
          <button className="sidebar-search" onClick={() => setPalette("search")}>
            <span aria-hidden>⌕</span>
            <span>{t("app.search")}</span>
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
                <span className="nav-label">{t(item.key)}</span>
              </button>
            ))}
          </nav>
          <button className="nav-item" onClick={() => setPalette("ask")}>
            <span className="nav-icon" aria-hidden>
              ?
            </span>
            <span className="nav-label">{t("app.ask")}</span>
          </button>
          <div className="sidebar-footer">{t("app.local_only")}</div>
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
              <span className="tab-label">{t(item.key)}</span>
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
            <span className="tab-label">{t("app.more")}</span>
          </button>
        </nav>

        <main className="main" id="main" tabIndex={-1}>
          <div className="topbar-date" style={{ marginBottom: 10 }}>
            {formatLongDate(todayLocal())}
          </div>
          <ErrorBoundary
            key={route}
            where={
              NAV.find((n) => n.route === route)
                ? t(NAV.find((n) => n.route === route)!.key)
                : route
            }
          >
            <Suspense
              fallback={
                <p className="muted" role="status">
                  {t("app.opening")}
                </p>
              }
            >
              {route === "today" && <Today />}
              {route === "what-i-see" && <WhatISee />}
              {route === "timeline" && <TimelinePage />}
              {route === "my-eyes" && <MyEyes />}
              {route === "self-tests" && <SelfTests />}
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
                <span>{t(item.key)}</span>
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
              <span>{t("app.search")}</span>
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
