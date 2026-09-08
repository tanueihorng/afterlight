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

export function useHashRoute(): [Route, (r: Route) => void] {
  const parse = (): Route => {
    const h = window.location.hash.replace(/^#\/?/, "");
    const base = h.split("/")[0] as Route;
    return (ROUTES as readonly string[]).includes(base) ? base : "today";
  };
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const nav = (r: Route) => {
    window.location.hash = `#/${r}`;
  };
  return [route, nav];
}
