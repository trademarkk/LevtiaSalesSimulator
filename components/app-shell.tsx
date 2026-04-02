import Link from "next/link";
import type { ReactNode } from "react";

type NavigationItem = {
  href: string;
  label: string;
  active?: boolean;
};

type AppShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  roleLabel: string;
  userName: string;
  navigationItems?: NavigationItem[];
};

export function AppShell({
  children,
  eyebrow,
  title,
  description,
  roleLabel,
  userName,
  navigationItems,
}: AppShellProps) {
  return (
    <div className="workspace">
      <div className="workspace__backdrop workspace__backdrop--left" />
      <div className="workspace__backdrop workspace__backdrop--right" />

      <header className="workspace__header">
        <div>
          <span className="pill pill--soft">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="workspace__controls">
          <div className="workspace__identity">
            <span className="pill">{roleLabel}</span>
            <strong>{userName}</strong>
          </div>

          <form action="/api/logout" method="post">
            <button type="submit" className="secondary-button">
              Выйти
            </button>
          </form>
        </div>
      </header>

      {navigationItems?.length ? (
        <nav className="workspace__nav">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`workspace__nav-link ${item.active ? "workspace__nav-link--active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {children}
    </div>
  );
}
