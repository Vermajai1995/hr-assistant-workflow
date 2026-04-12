"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function SiteHeader() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setCompact(window.scrollY > 24);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`site-header ${compact ? "compact" : ""}`}>
      <div className="site-header-inner">
        <Link href="/" className="brand-lockup">
          <span className="brand-mark">JP</span>
          <span className="brand-copy">
            <strong>Jai Patel</strong>
            <small>HireFlow · Speech → HR Requirement Extractor</small>
          </span>
          <span className="brand-copy-compact">HireFlow</span>
        </Link>

        <nav className="site-nav">
          <Link href="/" className="ghost-link">
            Home
          </Link>
          <Link href="/capture" className="primary-link">
            Workspace
          </Link>
        </nav>
      </div>
    </header>
  );
}
