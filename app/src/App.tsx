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
import { BrandMark, Icon, type IconName } from "./components/Icon";
import { AppearancePanel, Dock, Popover, useFluidSurfaces } from "./components/Chrome";

/** The four destinations that fit the thumb zone; everything else lives behind "More". */
const PRIMARY: Route[] = ["today", "what-i-see", "timeline", "appointments"];

/** The desktop dock has room for one more; the rest sit behind its "More" menu. */
const DOCK: Route[] = ["today", "what-i-see", "timeline", "my-eyes", "appointments"];

/** Labels are looked up per render, so switching language does not need a reload. */
const NAV: { route: Route; key: MessageKey; icon: IconName }[] = [
  { route: "today", key: "nav.today", icon: "today" },
  { route: "what-i-see", key: "nav.what_i_see", icon: "see" },
  { route: "timeline", key: "nav.timeline", icon: "timeline" },
  { route: "my-eyes", key: "nav.my_eyes", icon: "eyes" },
  { route: "self-tests", key: "nav.self_tests", icon: "checks" },
  { route: "imaging", key: "nav.imaging", icon: "imaging" },
  { route: "appointments", key: "nav.appointments", icon: "calendar" },
  { route: "visualize", key: "nav.visualize", icon: "visualize" },
  { route: "settings", key: "nav.settings", icon: "settings" },
];

export default function App() {
  const [route, nav] = useHashRoute();
  const store = useStore();
  const [palette, setPalette] = useState<null | "search" | "ask">(null);
  const [moreOpen, setMoreOpen] = useState(false);
  useFluidSurfaces();

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

  // The Visualize page runs live 3-D scenes; the aura and the glass blur step aside there.
  useEffect(() => {
    const root = document.documentElement;
    if (route === "visualize") root.setAttribute("data-scene", "3d");
    else root.removeAttribute("data-scene");
  }, [route]);

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
      <div className="aura" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="shell" aria-hidden={!onboarded}>
        <header className="app-header">
          <div className="brand">
            <BrandMark />
            <span className="brand-name">{t("app.name")}</span>
          </div>
          <Dock label="Main navigation">
            {NAV.filter((n) => DOCK.includes(n.route)).map((item) => (
              <button
                key={item.route}
                className="dock-item"
                onClick={() => nav(item.route)}
                aria-current={route === item.route ? "page" : undefined}
              >
                <Icon name={item.icon} />
                <span className="dock-label">{t(item.key)}</span>
              </button>
            ))}
            <Popover
              label={t("app.more")}
              icon="more"
              buttonClass={`dock-item ${DOCK.includes(route) ? "" : "is-elsewhere"}`}
              panelClass="center"
              showLabel
            >
              {(close) => (
                <>
                  {NAV.filter((n) => !DOCK.includes(n.route)).map((item) => (
                    <button
                      key={item.route}
                      className="menu-item"
                      aria-current={route === item.route ? "page" : undefined}
                      onClick={() => {
                        nav(item.route);
                        close();
                      }}
                    >
                      <Icon name={item.icon} />
                      {t(item.key)}
                    </button>
                  ))}
                  <p className="menu-foot">{t("app.local_only")}</p>
                </>
              )}
            </Popover>
          </Dock>
          <div className="header-actions">
            <button
              className="icon-btn glass"
              onClick={() => setPalette("search")}
              aria-label={t("app.search")}
              title={`${t("app.search")} (⌘K)`}
            >
              <Icon name="search" />
            </button>
            <button
              className="icon-btn glass"
              onClick={() => setPalette("ask")}
              aria-label={t("app.ask")}
              title={`${t("app.ask")} (?)`}
            >
              <Icon name="ask" />
            </button>
            <Popover
              label="Appearance"
              icon="palette"
              buttonClass="icon-btn glass"
              panelClass="appearance"
            >
              {(close) => (
                <AppearancePanel
                  onMore={() => {
                    close();
                    nav("settings");
                  }}
                />
              )}
            </Popover>
          </div>
        </header>
        <nav className="tabbar glass" aria-label="Main">
          {NAV.filter((n) => PRIMARY.includes(n.route)).map((item) => (
            <button
              key={item.route}
              className={`tab ${route === item.route ? "active" : ""}`}
              onClick={() => nav(item.route)}
              aria-current={route === item.route ? "page" : undefined}
            >
              <span className="tab-icon" aria-hidden>
                <Icon name={item.icon} />
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
              <Icon name="more" />
            </span>
            <span className="tab-label">{t("app.more")}</span>
          </button>
        </nav>

        <main className="main" id="main" tabIndex={-1}>
          {/* Today opens with its own greeting and date; every other page gets the date here. */}
          {route !== "today" && (
            <div className="topbar-date" style={{ marginBottom: 10 }}>
              {formatLongDate(todayLocal())}
            </div>
          )}
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
                <Icon name={item.icon} />
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
              <Icon name="search" />
              <span>{t("app.search")}</span>
            </button>
            <button
              className="sheet-nav-item"
              onClick={() => {
                setMoreOpen(false);
                setPalette("ask");
              }}
            >
              <Icon name="ask" />
              <span>{t("app.ask")}</span>
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
