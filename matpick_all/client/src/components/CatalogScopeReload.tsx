import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";

function getCatalogScope(location: string) {
  const url = new URL(location, window.location.origin);
  if (url.pathname === "/map" || url.pathname === "/map/") {
    return `map:${url.searchParams.get("type") || "featured"}:${url.searchParams.get("value") || ""}:${url.searchParams.get("_cursor") || ""}`;
  }
  const detail = /^\/restaurant\/([^/]+)\/?$/.exec(url.pathname);
  if (detail) return `restaurant:${detail[1]}`;
  const topic = /^\/explore\/topic\/([^/]+)/.exec(url.pathname);
  if (topic) return `topic:${url.pathname}:${url.searchParams.get("_cursor") || ""}`;
  if (url.pathname === "/explore" || url.pathname === "/explore/") return "explore:featured";
  if (url.pathname.startsWith("/my/favorites")) return "favorites";
  if (url.pathname.startsWith("/reviews")) return "reviews";
  if (url.pathname.startsWith("/creator/")) return `creator:${url.pathname}:${url.searchParams.get("_cursor") || ""}`;
  if (url.pathname.startsWith("/admin")) return `admin:${url.pathname}`;
  return "static";
}

/** Reload when navigation changes the bounded catalog window required by a route. */
export default function CatalogScopeReload() {
  const [location] = useLocation();
  const search = useSearch();
  const initialScope = useRef(getCatalogScope(`${window.location.pathname}${window.location.search}`));

  useEffect(() => {
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const nextScope = getCatalogScope(currentUrl);
    if (nextScope !== initialScope.current) {
      window.location.assign(currentUrl);
    }
  }, [location, search]);

  return null;
}
