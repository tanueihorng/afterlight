import { useEffect, useState } from "react";

export const ROUTES = [
  "today",
  "what-i-see",
  "timeline",
  "my-eyes",
  "self-tests",
  "imaging",
  "appointments",
  "visualize",
  "settings",
] as const;

export type Route = (typeof ROUTES)[number];

/** The path segments after the route, e.g. `#/visualize/atlas/wet_amd` → ["atlas", "wet_amd"]. */
export function routeParams(): string[] {
  return window.location.hash.replace(/^#\/?/, "").split("/").slice(1).filter(Boolean);
}

export function useHashRoute(): [Route, (r: Route, ...params: string[]) => void] {
  // Track the whole hash, not just the base route: `#/visualize` and `#/visualize/atlas/pdr` are
  // the same route, so storing only the route means a deep link never re-renders anything.
  const [hash, setHash] = useState(() => window.location.hash);
  const base = hash.replace(/^#\/?/, "").split("/")[0] as Route;
  const route: Route = (ROUTES as readonly string[]).includes(base) ? base : "today";

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const nav = (r: Route, ...params: string[]) => {
    window.location.hash = params.length ? `#/${r}/${params.join("/")}` : `#/${r}`;
  };
  return [route, nav];
}
