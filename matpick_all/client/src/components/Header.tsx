/*
 * Matpick Header — "Warm Kitchen Table" Design
 * Gowun Batang serif logo, warm beige background, minimal nav
 */
import { Link, useLocation } from "wouter";
import { UtensilsCrossed } from "lucide-react";

export default function Header() {
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
          </div>
          <span
            className="text-xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            맛픽
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/"
            className={`transition-colors no-underline ${
              location === "/"
                ? "text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            맛집 탐색
          </Link>
          <span className="text-muted-foreground/40 cursor-default text-xs">
            지도 (준비중)
          </span>
        </nav>
      </div>
    </header>
  );
}
