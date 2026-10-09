import type { ReactNode } from "react";
import { ThemeToggle } from "../theme";

export function AuthFrame({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="signin">
      <section className="signin-hero">
        <p className="kicker light">Substation maintenance</p>
        <h1>{title}</h1>
        <p>{lede}</p>
      </section>
      <section className="signin-panel">
        <div className="signin-theme">
          <ThemeToggle />
        </div>
        {children}
      </section>
    </div>
  );
}
