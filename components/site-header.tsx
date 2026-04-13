"use client";

import Image from "next/image";
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
        <Link target="_blank" href="https://pateljai.com/" className="brand-lockup">
          <Image
            src="/logo.png"
            alt="Jai Patel logo"
            width={40}
            height={40}
            className="brand-logo"
            priority
          />
          <span className="brand-copy">
            <strong>Jai Patel</strong>
          </span>
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
